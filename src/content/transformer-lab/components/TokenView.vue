<script setup lang="ts">
import { computed } from 'vue';

const props = defineProps<{
  tokenIds: number[];
  tokenizer: any;
  activeTokenIndex?: number;
}>();

const tokens = computed(() => {
  if (!props.tokenizer) return props.tokenIds.map(id => ({ id, text: id.toString() }));
  return props.tokenIds.map(id => ({
    id,
    text: props.tokenizer.decode([id])
  }));
});
</script>

<template>
  <div class="flex flex-wrap gap-2 p-4 bg-black/20 rounded-lg border border-white/5">
    <div
      v-for="(token, index) in tokens"
      :key="index"
      class="px-3 py-1.5 rounded transition-all cursor-default text-sm font-mono border"
      :class="[
        activeTokenIndex === index
          ? 'bg-blue-600/30 border-blue-500 text-blue-100 shadow-[0_0_15px_rgba(59,130,246,0.3)]'
          : 'bg-white/5 border-white/10 text-gray-300 hover:border-white/30'
      ]"
    >
      <span class="opacity-40 mr-1 text-[10px]">{{ token.id }}</span>
      <span>{{ token.text }}</span>
    </div>
  </div>
</template>
