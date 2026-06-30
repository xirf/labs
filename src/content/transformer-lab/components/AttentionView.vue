<script setup lang="ts">
import { computed } from 'vue';

const props = defineProps<{
  scores: Float32Array; // [head, query, key]
  numHeads: number;
  seqLen: number;
  activeHead?: number;
  tokens?: string[];
}>();

const scoresForHead = computed(() => {
  const head = props.activeHead || 0;
  const start = head * props.seqLen * props.seqLen;
  return props.scores.subarray(start, start + props.seqLen * props.seqLen);
});

const getScore = (q: number, k: number) => {
  return scoresForHead.value[q * props.seqLen + k];
};

const getColor = (score: number) => {
  return `rgba(59, 130, 246, ${score})`;
};
</script>

<template>
  <div class="attention-view">
    <div class="flex items-center justify-between mb-4">
        <div class="text-sm font-bold text-blue-400">Head {{ activeHead || 0 }} Attention</div>
        <div class="flex gap-1">
            <div
                v-for="h in numHeads"
                :key="h"
                class="w-4 h-4 rounded-full cursor-pointer border border-white/20 transition-colors"
                :class="[(activeHead || 0) === h-1 ? 'bg-blue-500' : 'bg-white/5 hover:bg-white/10']"
                @click="$emit('update:activeHead', h-1)"
            ></div>
        </div>
    </div>

    <div class="relative flex text-white">
        <div class="flex flex-col pr-2 justify-around">
            <div v-for="(t, i) in tokens" :key="i" class="text-[10px] text-right h-6 flex items-center font-mono opacity-60 text-white">
                {{ t }}
            </div>
        </div>

        <div class="flex flex-col">
            <div
                class="grid gap-1 border border-white/10 bg-black/40 p-1 rounded"
                :style="{
                    gridTemplateColumns: `repeat(${seqLen}, 24px)`,
                    gridTemplateRows: `repeat(${seqLen}, 24px)`
                }"
            >
                <template v-for="q in seqLen" :key="q">
                    <div
                        v-for="k in seqLen"
                        :key="`${q}-${k}`"
                        class="w-full h-full rounded-[2px] relative group"
                        :style="{
                            backgroundColor: getColor(getScore(q-1, k-1)),
                            opacity: k > q ? 0.05 : 1
                        }"
                    >
                        <div class="absolute bottom-full left-1/2 -translate-x-1/2 mb-1 hidden group-hover:block bg-black text-[10px] px-1 py-0.5 rounded border border-white/20 whitespace-nowrap z-50 pointer-events-none">
                            {{ getScore(q-1, k-1).toFixed(3) }}
                        </div>
                    </div>
                </template>
            </div>

            <div
                class="grid gap-1 pt-2"
                :style="{ gridTemplateColumns: `repeat(${seqLen}, 24px)` }"
            >
                <div v-for="(t, i) in tokens" :key="i" class="text-[10px] text-center font-mono opacity-60 origin-top-left -rotate-45 translate-x-2 text-white">
                    {{ t }}
                </div>
            </div>
        </div>
    </div>
  </div>
</template>
