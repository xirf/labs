<script setup lang="ts">
import { ref, onMounted, computed, watch } from 'vue';
import { BPE } from './services/tokenizer';
import { TransformerEngine, type State } from './services/engine';
import { loadSafetensors } from './services/weights';

import TokenView from './components/TokenView.vue';
import MatrixView from './components/MatrixView.vue';
import AttentionView from './components/AttentionView.vue';
import PredictionsView from './components/PredictionsView.vue';

const loading = ref(true);
const loadProgress = ref(0);
const error = ref<string | null>(null);

const tokenizer = ref<BPE | null>(null);
const engine = ref<TransformerEngine | null>(null);

const inputText = ref('hi guppy');
const tokens = ref<number[]>([]);
const inferenceStates = ref<State[]>([]);
const currentStepIndex = ref(-1);

const activeAttentionHead = ref(0);

const currentState = computed(() => {
  if (currentStepIndex.value < 0 || currentStepIndex.value >= inferenceStates.value.length) return null;
  return inferenceStates.value[currentStepIndex.value];
});

const tokenStrings = computed(() => {
    if (!tokenizer.value || tokens.value.length === 0) return [];
    return tokens.value.map(id => tokenizer.value!.decode([id]));
});

async function initialize() {
  try {
    loading.value = true;
    const tokResponse = await fetch('/models/guppylm/tokenizer.json');
    if (!tokResponse.ok) throw new Error("Failed to load tokenizer");
    const tokJson = await tokResponse.json();
    tokenizer.value = new BPE(tokJson);

    const weights = await loadSafetensors('/models/guppylm/model.safetensors', (p) => {
      loadProgress.value = p;
    });

    engine.value = new TransformerEngine();
    engine.value.setWeights(weights);

    loading.value = false;
    runInference();
  } catch (e: any) {
    console.error(e);
    error.value = e.message;
    loading.value = false;
  }
}

function runInference() {
  if (!tokenizer.value || !engine.value) return;
  tokens.value = tokenizer.value.encode(inputText.value);
  inferenceStates.value = Array.from(engine.value.infer(tokens.value));
  currentStepIndex.value = 0;
}

function nextStep() {
  if (currentStepIndex.value < inferenceStates.value.length - 1) {
    currentStepIndex.value++;
  }
}

function prevStep() {
  if (currentStepIndex.value > 0) {
    currentStepIndex.value--;
  }
}

onMounted(() => {
  initialize();
});
</script>

<template>
  <div class="transformer-lab min-h-screen bg-[#0a0a0a] text-white p-4 md:p-8 font-sans border-0 border-transparent">
    <header class="mb-8 flex justify-between items-end border-0 border-transparent">
      <div>
        <h1 class="text-3xl font-bold mb-2 text-white">Transformer Lab</h1>
        <p class="text-gray-400">Interactively explore the inference process of GuppyLM (9M parameters).</p>
      </div>
      <div v-if="!loading && !error" class="text-xs text-gray-500 font-mono bg-white/5 px-2 py-1 rounded text-white">
        GuppyLM-9M Loaded
      </div>
    </header>

    <div v-if="loading" class="flex flex-col items-center justify-center py-40 border-0 border-transparent">
      <div class="i-solar-restarting-line-duotone text-5xl animate-spin mb-4 text-blue-500"></div>
      <p class="mb-2 text-white">Loading Model Weights...</p>
      <div class="w-64 h-1 bg-white/10 rounded-full overflow-hidden">
        <div class="h-full bg-blue-500 transition-all duration-300" :style="{ width: `${loadProgress * 100}%` }"></div>
      </div>
    </div>

    <div v-else-if="error" class="bg-red-900/20 border border-red-500/50 p-6 rounded-xl text-red-200 max-w-2xl mx-auto">
      <h2 class="font-bold mb-2 flex items-center gap-2 text-white">
        <div class="i-solar-danger-triangle-bold text-red-500"></div>
        Initialization Error
      </h2>
      <p class="opacity-80 text-sm font-mono text-white">{{ error }}</p>
      <button @click="initialize" class="mt-4 bg-red-500/20 hover:bg-red-500/30 text-red-300 px-4 py-1.5 rounded text-xs transition-colors border border-red-500/30">
        Try Again
      </button>
    </div>

    <div v-else class="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start border-0 border-transparent">
      <div class="lg:col-span-8 flex flex-col gap-6 border-0 border-transparent">
        <section class="bg-[#111] rounded-xl border border-white/10 p-6 text-white">
            <div class="flex items-center justify-between mb-4 border-0 border-transparent">
                <h3 class="text-xs uppercase tracking-widest text-gray-500 font-bold text-white">Input Tokens</h3>
                <div class="flex gap-2 border-0 border-transparent">
                    <input
                        v-model="inputText"
                        @keyup.enter="runInference"
                        type="text"
                        class="bg-black/50 border border-white/20 rounded px-3 py-1 text-sm text-white focus:border-blue-500 outline-none transition-colors w-48 md:w-64"
                    />
                    <button @click="runInference" class="bg-blue-600 hover:bg-blue-500 text-xs font-bold px-3 py-1 rounded transition-colors text-white">
                        Process
                    </button>
                </div>
            </div>
            <TokenView :token-ids="tokens" :tokenizer="tokenizer" />
        </section>

        <section class="bg-[#111] rounded-xl border border-white/10 p-6 min-h-[500px] text-white">
            <div v-if="currentState" class="flex flex-col h-full text-white">
                <div class="flex items-center justify-between mb-8 border-b border-white/5 pb-4 text-white">
                    <div>
                        <h2 class="text-xl font-bold text-blue-400 text-white">{{ currentState.step }}</h2>
                        <p class="text-xs text-gray-500 text-white">{{ currentState.subStep }}</p>
                    </div>
                    <div class="flex items-center gap-4 bg-black/40 px-4 py-2 rounded-lg border border-white/10 text-white">
                        <button @click="prevStep" :disabled="currentStepIndex === 0" class="hover:text-blue-400 disabled:opacity-20 disabled:hover:text-inherit text-white">
                            <div class="i-solar-alt-arrow-left-bold text-2xl text-white"></div>
                        </button>
                        <div class="text-xs font-mono w-16 text-center text-white">
                            Step {{ currentStepIndex + 1 }} / {{ inferenceStates.length }}
                        </div>
                        <button @click="nextStep" :disabled="currentStepIndex === inferenceStates.length - 1" class="hover:text-blue-400 disabled:opacity-20 disabled:hover:text-inherit text-white">
                            <div class="i-solar-alt-arrow-right-bold text-2xl text-white"></div>
                        </button>
                    </div>
                </div>

                <div class="flex-grow flex items-center justify-center py-4 text-white border-0 border-transparent">
                    <div v-if="currentState.subStep === 'Token & Position' || currentState.subStep === 'Layer Norm 1' || currentState.subStep === 'Layer Norm 2' || currentState.subStep === 'Residual Add 1' || currentState.subStep === 'Residual Add 2' || currentState.subStep === 'Final Norm'" class="w-full text-white">
                        <MatrixView
                            :data="currentState.activations[Object.keys(currentState.activations)[0]]"
                            :rows="tokens.length"
                            :cols="384"
                            :label="`Activations (${currentState.subStep})`"
                        />
                    </div>

                    <div v-else-if="currentState.subStep === 'Attention'" class="w-full text-white border-0 border-transparent">
                        <div class="grid grid-cols-1 md:grid-cols-2 gap-8 items-start text-white border-0 border-transparent">
                            <AttentionView
                                :scores="currentState.activations.attn_scores"
                                :num-heads="6"
                                :seq-len="tokens.length"
                                :tokens="tokenStrings"
                                v-model:activeHead="activeAttentionHead"
                            />
                            <MatrixView
                                :data="currentState.activations.attn_out"
                                :rows="tokens.length"
                                :cols="384"
                                label="Attention Output"
                                color-scale="green"
                            />
                        </div>
                    </div>

                    <div v-else-if="currentState.subStep === 'MLP'" class="w-full text-white">
                         <MatrixView
                            :data="currentState.activations.mlp_out"
                            :rows="tokens.length"
                            :cols="384"
                            label="MLP Output"
                            color-scale="red"
                        />
                    </div>

                    <div v-else-if="currentState.subStep === 'Logits'" class="w-full flex justify-center text-white">
                         <MatrixView
                            :data="currentState.activations.logits"
                            :rows="1"
                            :cols="4096"
                            label="Logits"
                        />
                    </div>

                    <div v-else-if="currentState.subStep === 'Softmax'" class="w-full max-w-md mx-auto text-white">
                        <PredictionsView
                            :probs="currentState.activations.probs"
                            :tokenizer="tokenizer"
                        />
                    </div>
                </div>
            </div>
            <div v-else class="flex flex-col items-center justify-center h-full text-gray-500 py-20 italic text-white">
                No active state
            </div>
        </section>
      </div>

      <div class="lg:col-span-4 flex flex-col gap-6 sticky top-8 text-white border-0 border-transparent">
        <div class="bg-[#111] rounded-xl border border-white/10 p-6 text-white">
          <h3 class="text-sm font-bold mb-4 flex items-center gap-2 text-white">
            <div class="i-solar-map-bold text-blue-400 text-white"></div>
            Navigation Map
          </h3>
          <div class="flex flex-col gap-1 overflow-y-auto max-h-[600px] pr-2 custom-scrollbar text-white">
            <div
                v-for="(state, idx) in inferenceStates"
                :key="idx"
                class="flex items-center gap-3 px-3 py-2 rounded cursor-pointer transition-all border group text-white"
                :class="[
                    currentStepIndex === idx
                        ? 'bg-blue-600/20 border-blue-500/50 text-blue-100'
                        : 'bg-white/5 border-transparent text-gray-400 hover:bg-white/10'
                ]"
                @click="currentStepIndex = idx"
            >
                <div class="w-4 h-4 rounded-full flex items-center justify-center text-[10px] border border-current opacity-40 group-hover:opacity-100 text-white">
                    {{ idx + 1 }}
                </div>
                <div class="flex flex-col text-white">
                    <span class="text-xs font-bold leading-tight text-white">{{ state.step }}</span>
                    <span class="text-[10px] opacity-60 leading-tight text-gray-400">{{ state.subStep }}</span>
                </div>
            </div>
          </div>
        </div>

        <div class="bg-[#111] rounded-xl border border-white/10 p-6 flex-grow text-white">
          <h3 class="text-sm font-bold mb-4 flex items-center gap-2 text-white">
            <div class="i-solar-info-circle-bold text-green-400 text-white"></div>
            Concept Explain
          </h3>
          <div class="text-xs text-gray-400 space-y-4 text-white">
              <div v-if="currentState?.subStep === 'Token & Position'">
                  <p><b class="text-white">Embedding:</b> Each token (word/part of word) is converted into a vector of 384 numbers. This represents the token's initial "meaning" in high-dimensional space.</p>
              </div>
              <div v-else-if="currentState?.subStep === 'Attention'">
                  <p><b class="text-white">Self-Attention:</b> This is where tokens "talk" to each other. Each token looks at other tokens to refine its own meaning based on context.</p>
                  <p class="mt-2 text-blue-300">The heatmap shows which tokens are paying attention to which other tokens.</p>
              </div>
              <div v-else-if="currentState?.subStep === 'MLP'">
                  <p><b class="text-white">MLP (Feed Forward):</b> A point-wise neural network that processes each token independently. It's often thought of as the "knowledge" part of the model, where facts are stored.</p>
              </div>
              <div v-else-if="currentState?.subStep.includes('Residual')">
                  <p><b class="text-white">Residual Connection:</b> We add the result of the layer back to the original input. This "Residual Stream" allows information to flow through many layers without getting lost.</p>
              </div>
              <div v-else-if="currentState?.subStep === 'Softmax'">
                  <p><b class="text-white">Output:</b> The model converts the final vector of the last token into a probability distribution over the entire vocabulary (4,096 tokens).</p>
              </div>
              <div v-else>
                  <p class="italic text-white">Select a step to see an explanation of what's happening mathematically and conceptually.</p>
              </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.custom-scrollbar::-webkit-scrollbar {
  width: 4px;
}
.custom-scrollbar::-webkit-scrollbar-track {
  background: transparent;
}
.custom-scrollbar::-webkit-scrollbar-thumb {
  background: rgba(255, 255, 255, 0.1);
  border-radius: 10px;
}
.custom-scrollbar::-webkit-scrollbar-thumb:hover {
  background: rgba(255, 255, 255, 0.2);
}
</style>
