export class BPE {
  vocab: Record<string, number>;
  merges: [string, string][];
  decoder: Record<number, string>;

  constructor(tokenizerJson: any) {
    this.vocab = tokenizerJson.model.vocab;
    this.merges = tokenizerJson.model.merges.map((m: string[]) => [m[0], m[1]]);
    this.decoder = Object.fromEntries(
      Object.entries(this.vocab).map(([token, id]) => [id, token])
    );
  }

  encode(text: string): number[] {
    let tokens = text.split('').map(c => {
        if (c === ' ') return 'Ġ';
        return c;
    });

    while (true) {
      let bestMerge: [string, string] | null = null;
      let bestMergeIdx = Infinity;

      for (let i = 0; i < tokens.length - 1; i++) {
        const pair: [string, string] = [tokens[i], tokens[i+1]];
        const mergeIdx = this.merges.findIndex(m => m[0] === pair[0] && m[1] === pair[1]);

        if (mergeIdx !== -1 && mergeIdx < bestMergeIdx) {
          bestMergeIdx = mergeIdx;
          bestMerge = this.merges[mergeIdx];
        }
      }

      if (!bestMerge) break;

      const newTokens: string[] = [];
      const [first, second] = bestMerge;
      const combined = first + second;

      for (let i = 0; i < tokens.length; i++) {
        if (i < tokens.length - 1 && tokens[i] === first && tokens[i+1] === second) {
          newTokens.push(combined);
          i++;
        } else {
          newTokens.push(tokens[i]);
        }
      }
      tokens = newTokens;
    }

    return tokens.map(t => this.vocab[t] ?? this.vocab['<unk>'] ?? 0);
  }

  decode(ids: number[]): string {
    return ids.map(id => {
        const token = this.decoder[id] || '';
        return token.replace('Ġ', ' ');
    }).join('');
  }
}
