<template>
  <header class="border-b border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900">
    <div class="max-w-7xl mx-auto px-4 py-4">
      <div class="flex items-center justify-between">
        <div>
          <h1 class="text-2xl font-bold text-gray-900 dark:text-white">Blockchain Simulator</h1>
          <p class="text-sm text-gray-600 dark:text-gray-400">Node ID: {{ blockchain.nodeId.value }}</p>
        </div>
        <div class="flex items-center gap-4">
          <div class="flex items-center gap-2">
            <div class="w-2 h-2 rounded-full"
                 :class="blockchain.mining.value ? 'bg-green-500' : 'bg-gray-400'"></div>
            <span class="text-sm">{{ blockchain.mining.value ? 'Mining' : 'Idle' }}</span>
          </div>
          <div class="text-sm">
            Peers: {{ blockchain.peers.value.size }}
          </div>
          <div class="text-sm">
            Balance: {{ blockchain.balances.value[blockchain.nodeId.value] || 0 }}
          </div>
        </div>
      </div>
    </div>
  </header>
</template>

<script setup lang="ts">
import { inject } from 'vue'

const blockchain = inject('blockchainNode')
</script>