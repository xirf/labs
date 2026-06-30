export type Tensor = Float32Array;

export interface State {
  step: string;
  subStep: string;
  activations: Record<string, Tensor>;
  metadata: any;
}

export class TransformerEngine {
  readonly nLayers = 6;
  readonly nHeads = 6;
  readonly dModel = 384;
  readonly dHead = 64;
  readonly dFfn = 768;
  readonly vocabSize = 4096;
  readonly maxSeqLen = 128;

  weights: any = null;

  constructor() {}

  setWeights(weights: any) {
    this.weights = weights;
  }

  *infer(tokenIds: number[]): Generator<State> {
    if (!this.weights) throw new Error("Weights not loaded");

    const seqLen = tokenIds.length;

    let x = this.createEmptyTensor(seqLen, this.dModel);
    for (let i = 0; i < seqLen; i++) {
        const id = tokenIds[i];
        const emb = this.weights[`tok_emb.weight`].subarray(id * this.dModel, (id + 1) * this.dModel);
        x.set(emb, i * this.dModel);
    }

    yield {
        step: 'Embedding',
        subStep: 'Token & Position',
        activations: { 'residual': new Float32Array(x) },
        metadata: { tokenIds }
    };

    for (let l = 0; l < this.nLayers; l++) {
        const ln1_out = this.layerNorm(x,
            this.weights[`blocks.${l}.norm1.weight`],
            this.weights[`blocks.${l}.norm1.bias`],
            seqLen
        );

        yield {
            step: `Layer ${l}`,
            subStep: 'Layer Norm 1',
            activations: { 'ln1': ln1_out },
            metadata: { layer: l }
        };

        const { attn_out, attn_scores } = this.multiHeadAttention(ln1_out, l, seqLen);

        yield {
            step: `Layer ${l}`,
            subStep: 'Attention',
            activations: { 'attn_out': attn_out, 'attn_scores': attn_scores },
            metadata: { layer: l }
        };

        x = this.add(x, attn_out);

        yield {
            step: `Layer ${l}`,
            subStep: 'Residual Add 1',
            activations: { 'residual': new Float32Array(x) },
            metadata: { layer: l }
        };

        const ln2_out = this.layerNorm(x,
            this.weights[`blocks.${l}.norm2.weight`],
            this.weights[`blocks.${l}.norm2.bias`],
            seqLen
        );

        yield {
            step: `Layer ${l}`,
            subStep: 'Layer Norm 2',
            activations: { 'ln2': ln2_out },
            metadata: { layer: l }
        };

        const mlp_out = this.mlp(ln2_out, l, seqLen);

        yield {
            step: `Layer ${l}`,
            subStep: 'MLP',
            activations: { 'mlp_out': mlp_out },
            metadata: { layer: l }
        };

        x = this.add(x, mlp_out);

        yield {
            step: `Layer ${l}`,
            subStep: 'Residual Add 2',
            activations: { 'residual': new Float32Array(x) },
            metadata: { layer: l }
        };
    }

    x = this.layerNorm(x,
        this.weights[`norm.weight`],
        this.weights[`norm.bias`],
        seqLen
    );

    yield {
        step: 'Output',
        subStep: 'Final Norm',
        activations: { 'final_norm': x },
        metadata: {}
    };

    const lastTokenVector = x.subarray((seqLen - 1) * this.dModel);
    const logits = this.matmul(lastTokenVector, this.weights[`lm_head.weight`], 1, this.vocabSize, this.dModel);

    yield {
        step: 'Output',
        subStep: 'Logits',
        activations: { 'logits': logits },
        metadata: {}
    };

    const probs = this.softmax(logits);

    yield {
        step: 'Output',
        subStep: 'Softmax',
        activations: { 'probs': probs },
        metadata: {}
    };
  }

  createEmptyTensor(rows: number, cols: number): Tensor {
    return new Float32Array(rows * cols);
  }

  layerNorm(x: Tensor, weight: Tensor, bias: Tensor, seqLen: number): Tensor {
    const out = new Float32Array(x.length);
    const eps = 1e-5;
    for (let i = 0; i < seqLen; i++) {
        let sum = 0;
        for (let j = 0; j < this.dModel; j++) sum += x[i * this.dModel + j];
        const mean = sum / this.dModel;

        let varSum = 0;
        for (let j = 0; j < this.dModel; j++) {
            const diff = x[i * this.dModel + j] - mean;
            varSum += diff * diff;
        }
        const variance = varSum / this.dModel;
        const std = Math.sqrt(variance + eps);

        for (let j = 0; j < this.dModel; j++) {
            out[i * this.dModel + j] = ((x[i * this.dModel + j] - mean) / std) * weight[j] + bias[j];
        }
    }
    return out;
  }

  multiHeadAttention(x: Tensor, l: number, seqLen: number) {
    const attn_out = new Float32Array(seqLen * this.dModel);
    const attn_scores = new Float32Array(this.nHeads * seqLen * seqLen);

    const qkv_weight = this.weights[`blocks.${l}.attn.qkv.weight`];
    const qkv_bias = this.weights[`blocks.${l}.attn.qkv.bias`];

    for (let i = 0; i < seqLen; i++) {
        const token_x = x.subarray(i * this.dModel, (i + 1) * this.dModel);
        const qkv = new Float32Array(this.dModel * 3);

        for (let j = 0; j < this.dModel * 3; j++) {
            let sum = qkv_bias[j];
            for (let k = 0; k < this.dModel; k++) {
                sum += token_x[k] * qkv_weight[j * this.dModel + k];
            }
            qkv[j] = sum;
        }

        const Q = qkv.subarray(0, this.dModel);
        const K = qkv.subarray(this.dModel, this.dModel * 2);
        const V = qkv.subarray(this.dModel * 2, this.dModel * 3);

        for (let h = 0; h < this.nHeads; h++) {
            const head_Q = Q.subarray(h * this.dHead, (h + 1) * this.dHead);

            for (let j = 0; j <= i; j++) {
                const other_x = x.subarray(j * this.dModel, (j + 1) * this.dModel);
                const other_qkv = new Float32Array(this.dModel * 3);
                for (let jj = 0; jj < this.dModel * 3; jj++) {
                    let sum = qkv_bias[jj];
                    for (let kk = 0; jj < this.dModel * 3 && kk < this.dModel; kk++) {
                        sum += other_x[kk] * qkv_weight[jj * this.dModel + kk];
                    }
                    other_qkv[jj] = sum;
                }
                const head_K = other_qkv.subarray(this.dModel + h * this.dHead, this.dModel + (h + 1) * this.dHead);

                let score = 0;
                for (let k = 0; k < this.dHead; k++) score += head_Q[k] * head_K[k];
                attn_scores[h * seqLen * seqLen + i * seqLen + j] = score / Math.sqrt(this.dHead);
            }
            for (let j = i + 1; j < seqLen; j++) attn_scores[h * seqLen * seqLen + i * seqLen + j] = -1e9;
            this.softmaxSubarray(attn_scores, h * seqLen * seqLen + i * seqLen, seqLen);
        }
    }

    for (let h = 0; h < this.nHeads; h++) {
        for (let i = 0; i < seqLen; i++) {
            for (let k = 0; k < this.dHead; k++) {
                let val = 0;
                for (let j = 0; j <= i; j++) {
                    const other_x = x.subarray(j * this.dModel, (j + 1) * this.dModel);
                    const other_qkv = new Float32Array(this.dModel * 3);
                    for (let jj = 0; jj < this.dModel * 3; jj++) {
                        let sum = qkv_bias[jj];
                        for (let kk = 0; kk < this.dModel; kk++) sum += other_x[kk] * qkv_weight[jj * this.dModel + kk];
                        other_qkv[jj] = sum;
                    }
                    const head_V = other_qkv.subarray(this.dModel * 2 + h * this.dHead, this.dModel * 2 + (h + 1) * this.dHead);
                    val += attn_scores[h * seqLen * seqLen + i * seqLen + j] * head_V[k];
                }
                attn_out[i * this.dModel + h * this.dHead + k] = val;
            }
        }
    }

    const out_weight = this.weights[`blocks.${l}.attn.out.weight`];
    const out_bias = this.weights[`blocks.${l}.attn.out.bias`];
    const final_out = new Float32Array(seqLen * this.dModel);
    for (let i = 0; i < seqLen; i++) {
        for (let j = 0; j < this.dModel; j++) {
            let sum = out_bias[j];
            for (let k = 0; k < this.dModel; k++) sum += attn_out[i * this.dModel + k] * out_weight[j * this.dModel + k];
            final_out[i * this.dModel + j] = sum;
        }
    }

    return { attn_out: final_out, attn_scores };
  }

  mlp(x: Tensor, l: number, seqLen: number): Tensor {
    const up_weight = this.weights[`blocks.${l}.ffn.up.weight`];
    const up_bias = this.weights[`blocks.${l}.ffn.up.bias`];
    const down_weight = this.weights[`blocks.${l}.ffn.down.weight`];
    const down_bias = this.weights[`blocks.${l}.ffn.down.bias`];

    const out = new Float32Array(seqLen * this.dModel);
    for (let i = 0; i < seqLen; i++) {
        const up = new Float32Array(this.dFfn);
        for (let j = 0; j < this.dFfn; j++) {
            let sum = up_bias[j];
            for (let k = 0; k < this.dModel; k++) sum += x[i * this.dModel + k] * up_weight[j * this.dModel + k];
            up[j] = Math.max(0, sum);
        }
        for (let j = 0; j < this.dModel; j++) {
            let sum = down_bias[j];
            for (let k = 0; k < this.dFfn; k++) sum += up[k] * down_weight[j * this.dFfn + k];
            out[i * this.dModel + j] = sum;
        }
    }
    return out;
  }

  matmul(a: Tensor, b: Tensor, rows: number, cols: number, inner: number): Tensor {
    const out = new Float32Array(rows * cols);
    for (let i = 0; i < rows; i++) {
        for (let j = 0; j < cols; j++) {
            let sum = 0;
            for (let k = 0; k < inner; k++) sum += a[i * inner + k] * b[j * inner + k];
            out[i * cols + j] = sum;
        }
    }
    return out;
  }

  add(a: Tensor, b: Tensor): Tensor {
    const out = new Float32Array(a.length);
    for (let i = 0; i < a.length; i++) out[i] = a[i] + b[i];
    return out;
  }

  softmax(x: Tensor): Tensor {
    const out = new Float32Array(x.length);
    let max = -Infinity;
    for (let i = 0; i < x.length; i++) if (x[i] > max) max = x[i];
    let sum = 0;
    for (let i = 0; i < x.length; i++) {
        out[i] = Math.exp(x[i] - max);
        sum += out[i];
    }
    for (let i = 0; i < x.length; i++) out[i] /= sum;
    return out;
  }

  softmaxSubarray(x: Tensor, offset: number, len: number) {
    let max = -Infinity;
    for (let i = 0; i < len; i++) if (x[offset + i] > max) max = x[offset + i];
    let sum = 0;
    for (let i = 0; i < len; i++) {
        x[offset + i] = Math.exp(x[offset + i] - max);
        sum += x[offset + i];
    }
    for (let i = 0; i < len; i++) x[offset + i] /= sum;
  }
}
