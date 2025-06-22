<template>
  <div class="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700">
    <div class="p-4 border-b border-gray-200 dark:border-gray-700">
      <h2 class="text-lg font-semibold flex items-center gap-2">
        <i class="i-lucide-pickaxe text-orange-500"></i>
        Mining
      </h2>
    </div>
    <div class="p-4 space-y-4">
      <div>
        <label class="block text-sm font-medium mb-2">Difficulty</label>
        <input v-model.number="blockchain.difficulty.value"
               @change="updateDifficulty"
               type="number"
               min="1"
               max="6"
               class="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700">
      </div>
      <div class="flex gap-2">
        <button @click="startMining"
                :disabled="blockchain.mining.value"
                class="flex-1 bg-green-600 hover:bg-green-700 disabled:bg-gray-400 text-white px-4 py-2 rounded-md font-medium">
          Start Mining
        </button>
        <button @click="stopMining"
                :disabled="!blockchain.mining.value"
                class="flex-1 bg-red-600 hover:bg-red-700 disabled:bg-gray-400 text-white px-4 py-2 rounded-md font-medium">
          Stop Mining
        </button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { inject, type Ref } from 'vue'
import type { BlockchainNode } from '../services/BlockchainNode'

interface BlockchainService {
  node: () => BlockchainNode | null
  difficulty: Ref<number>
  mining: Ref<boolean>
}

const blockchain = inject<BlockchainService>('blockchainNode')

if (!blockchain) {
  throw new Error('BlockchainNode service not provided')
}

const updateDifficulty = (): void => {
  const node = blockchain.node()
  if (node) {
    node.updateDifficulty(blockchain.difficulty.value)
  }
}

const startMining = (): void => {
  const node = blockchain.node()
  if (node && !blockchain.mining.value) {
    node.startMining(blockchain.difficulty.value)
    blockchain.mining.value = true
  }
}

const stopMining = (): void => {
  const node = blockchain.node()
  if (node && blockchain.mining.value) {
    node.stopMining()
    blockchain.mining.value = false
  }
}
</script>