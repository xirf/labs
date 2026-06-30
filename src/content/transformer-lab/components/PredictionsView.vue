<script setup lang="ts">
import { computed } from 'vue';

const props = defineProps<{
  probs: Float32Array;
  tokenizer: any;
  topK?: number;
}>();

const topPredictions = computed(() => {
  if (!props.probs) return [];
  const k = props.topK || 10;
  const indexed = Array.from(props.probs).map((p, i) => ({ id: i, prob: p }));
  indexed.sort((a, b) => b.prob - a.prob);
  return indexed.slice(0, k).map(item => ({
    ...item,
    token: props.tokenizer ? props.tokenizer.decode([item.id]) : item.id.toString()
  }));
});
</script>

<template>
  <div class="predictions-view text-white">
    <div class="text-sm font-bold text-green-400 mb-4">Top Next Token Predictions</div>
    <div class="flex flex-col gap-2">
        <div
            v-for="(pred, index) in topPredictions"
            :key="index"
            class="flex items-center gap-3 group text-white"
        >
            <div class="w-10 text-[10px] font-mono opacity-40 text-right text-white">{{ pred.id }}</div>
            <div class="flex-grow flex flex-col gap-1">
                <div class="flex justify-between items-center text-xs">
                    <span class="font-mono bg-white/10 px-1 rounded text-white">{{ pred.token }}</span>
                    <span class="opacity-60 text-white">{{ (pred.prob * 100).toFixed(2) }}%</span>
                </div>
                <div class="h-1.5 bg-white/5 rounded-full overflow-hidden">
                    <div
                        class="h-full bg-green-500/60 transition-all duration-500"
                        :style="{ width: `${pred.prob * 100}%` }"
                    ></div>
                </div>
            </div>
        </div>
    </div>
  </div>
</template>
