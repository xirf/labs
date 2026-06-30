<script setup lang="ts">
import { computed } from 'vue';

const props = defineProps<{
  data: Float32Array;
  rows: number;
  cols: number;
  label?: string;
  maxDisplayRows?: number;
  maxDisplayCols?: number;
  colorScale?: 'blue' | 'green' | 'red' | 'gray';
}>();

const displayRows = computed(() => Math.min(props.rows, props.maxDisplayRows || 12));
const displayCols = computed(() => Math.min(props.cols, props.maxDisplayCols || 32));

const getColor = (val: number) => {
  const alpha = Math.min(1, Math.abs(val) * 2);
  const color = props.colorScale || 'blue';
  if (color === 'blue') return `rgba(59, 130, 246, ${alpha})`;
  if (color === 'green') return `rgba(34, 197, 94, ${alpha})`;
  if (color === 'red') return `rgba(239, 68, 68, ${alpha})`;
  return `rgba(156, 163, 175, ${alpha})`;
};

const getValue = (r: number, c: number) => {
  return props.data[r * props.cols + c].toFixed(3);
};
</script>

<template>
  <div class="matrix-view">
    <div v-if="label" class="text-[10px] uppercase tracking-wider text-gray-500 mb-1 font-bold">{{ label }} <span class="ml-1 opacity-50">{{ rows }}x{{ cols }}</span></div>
    <div class="overflow-auto border border-white/5 bg-black/40 rounded p-1">
      <div
        class="grid gap-[1px]"
        :style="{
          gridTemplateColumns: `repeat(${displayCols}, minmax(4px, 1fr))`
        }"
      >
        <template v-for="r in displayRows" :key="r">
          <div
            v-for="c in displayCols"
            :key="`${r}-${c}`"
            class="aspect-square rounded-[1px] relative group"
            :style="{ backgroundColor: getColor(data[(r-1) * cols + (c-1)]) }"
          >
            <div class="absolute bottom-full left-1/2 -translate-x-1/2 mb-1 hidden group-hover:block bg-black text-[10px] px-1 py-0.5 rounded border border-white/20 whitespace-nowrap z-50 pointer-events-none">
                {{ getValue(r-1, c-1) }}
            </div>
          </div>
        </template>
      </div>
      <div v-if="rows > displayRows || cols > displayCols" class="text-[8px] text-center text-gray-600 mt-1 italic text-white">
          Showing {{ displayRows }}x{{ displayCols }} of {{ rows }}x{{ cols }}
      </div>
    </div>
  </div>
</template>
