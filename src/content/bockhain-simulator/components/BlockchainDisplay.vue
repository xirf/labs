<template>
  <div class="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700">
    <div class="p-4 border-b border-gray-200 dark:border-gray-700">
      <h2 class="text-lg font-semibold flex items-center gap-2">
        <i class="i-myna-link text-green-500"></i>
        Blockchain ({{ blockchain.chain.value.length }} blocks)
      </h2>
    </div>
    <div class="p-4 overflow-y-auto">
      <div v-if="blockchain.chain.value.length === 0"
           class="text-center text-gray-500 py-8">
        No blocks yet. Start mining to create the genesis block!
      </div>
      <div v-else
           class="space-y-3">
        <div v-for="(block, index) in blockchain.chain.value.slice().reverse()"
             :key="block.hash"
             class="border border-gray-200 dark:border-gray-600 rounded-lg p-3 hover:bg-gray-50 dark:hover:bg-gray-700">
          <div class="flex items-center justify-between mb-2">
            <div class="font-medium">Block #{{ block.index }}</div>
            <div class="text-xs text-gray-500">
              {{ new Date(block.timestamp).toLocaleTimeString() }}
            </div>
          </div>
          <div class="text-xs text-gray-600 dark:text-gray-400 font-mono">
            Hash: {{ block.hash.slice(0, 16) }}...
          </div>
          <div class="text-xs text-gray-600 dark:text-gray-400">
            Proposer: {{ block.proposer.slice(0, 8) }}...
          </div>
          <div class="text-xs text-gray-600 dark:text-gray-400">
            Transactions: {{ block.transactions.length }}
          </div>
          <div class="text-xs text-gray-600 dark:text-gray-400">
            Nonce: {{ block.nonce }}
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { inject } from 'vue'

const blockchain = inject('blockchainNode')
</script>