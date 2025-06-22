<template>
  <div class="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700">
    <div class="p-4 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
      <h2 class="text-lg font-semibold flex items-center gap-2">
        <i class="i-myna-link text-green-500"></i>
        Blockchain ({{ blockchain?.chain?.value.length }} blocks)
      </h2>
      <button @click="resetBlockchain"
              class="text-xs border rounded px-2 py-1 bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-100 border-gray-300 dark:border-gray-600 flex items-center gap-2">
        <i class="i-myna-refresh  w4 h4"></i>
        Reset
      </button>
    </div>
    <div class="p-4 overflow-y-auto">
      <div v-if="blockchain?.chain?.value.length === 0"
           class="text-center text-gray-500 py-8">
        No blocks yet. Start mining to create the genesis block!
      </div>
      <div v-else
           class="space-y-3">
        <div v-for="(block, index) in blockchain?.chain.value.slice().reverse()"
             :key="block.hash"
             class="border border-gray-200 dark:border-gray-600 rounded-lg p-3 hover:bg-gray-50 dark:hover:bg-gray-700 cursor-pointer transition-colors"
             @click="viewBlock(block)">
          <div class="flex items-center justify-between mb-2">
            <div class="font-medium">Block #{{ block.index }}</div>
            <div class="text-xs text-gray-500">
              {{ new Date(block.timestamp).toLocaleTimeString() }}
            </div>
          </div>
          <div class="text-xs text-gray-600 dark:text-gray-400 font-mono">
            Hash: {{ block.hash.slice(0, 30) }}...{{ block.hash.slice(-8) }}
          </div>
          <div class="text-xs text-gray-600 dark:text-gray-400">
            Proposer: {{ block.proposer }}
          </div>
          <div class="grid gap-2 grid-cols-2">
            <div class="text-xs text-gray-600 dark:text-gray-400">
              Transactions: {{ block.transactions.length }}
            </div>
            <div class="text-xs text-gray-600 dark:text-gray-400">
              Nonce: {{ block.nonce }}
            </div>
          </div>
          <div class="text-xs text-blue-600 dark:text-blue-400 mt-1">
            Click to view details
          </div>
        </div>
      </div>
    </div>

    <!-- Block Detail Dialog -->
    <BlockDetailDialog :is-open="showDialog"
                       :block="selectedBlock"
                       @close="closeDialog" />
  </div>
</template>

<script setup lang="ts">
import { inject, ref } from 'vue'
import BlockDetailDialog from './BlockDetailDialog.vue'
import type { BlockchainNodeState } from '../main.vue'

const blockchain = inject<BlockchainNodeState>('blockchainNode')

const showDialog = ref(false)
const selectedBlock = ref(null)

const viewBlock = (block: any) => {
  selectedBlock.value = block
  showDialog.value = true
}

const closeDialog = () => {
  showDialog.value = false
  selectedBlock.value = null
}

const resetBlockchain = (): void => {
  const node = blockchain?.node()
  if (node && confirm('Are you sure you want to reset the blockchain? This will clear all blocks, transactions, and contracts across all connected nodes.')) {
    node.resetBlockchain()
    if (!blockchain || !blockchain.mining || !blockchain.difficulty) return
    blockchain.mining.value = false
    blockchain.difficulty.value = 4
  }
}
</script>