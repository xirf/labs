<template>
  <div class="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 relative">
    <div class="p-4 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
      <h2 class="text-lg font-semibold flex items-center gap-2">
        <i class="i-solar-plain-2-linear text-blue-500"></i>
        Create Transaction
      </h2>
      <button @click="showHint = true"
              class="text-xs border rounded px-2 text-yellow py-1 bg-white dark:bg-gray-700 border-gray-300 dark:border-gray-600 flex items-center gap-2">
        <i class="i-mynaui-danger-triangle w4 h4"></i>
        Info
      </button>
    </div>
    <div v-if="showHint"
         class="absolute top-0 right-10 z-50 w-96 p-4 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg shadow-lg">
      <div class="flex justify-between items-center mb-2">
        <h3 class="text-sm font-semibold text-gray-800 dark:text-gray-200">⚠️ Attention</h3>
        <button @click="showHint = false"
                class="text-gray-500 hover:text-gray-700 dark:hover:text-gray-300 text-sm">✖</button>
      </div>
      <div class="text-xs text-gray-700 dark:text-gray-300 space-y-2">
        <p>This directly sends a token transfer between nodes. In real-world blockchains, most value transfers are handled through smart contract logic.</p>
      </div>
    </div>
    <div class="p-4 space-y-4">
      <div>
        <label class="block text-sm font-medium mb-2">Message/Data</label>
        <textarea v-model="txPayload"
                  rows="3"
                  class="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700"
                  placeholder="Enter transaction data..."></textarea>
      </div>
      <div>
        <div class="flex items-center justify-between mb-2">
          <label class="block text-sm font-medium mb-2">To (node ID)</label>
          <button @click="getRandomNodeId"
                  class="text-sm text-blue-500 hover:underline">
            Randomize
          </button>
        </div>
        <input v-model="txTo"
               type="text"
               class="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700"
               placeholder="Recipient node id" />
      </div>
      <div>
        <label class="block text-sm font-medium mb-2">Amount</label>
        <input v-model.number="txAmount"
               type="number"
               min="0"
               class="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700"
               placeholder="Tokens" />
        <p class="mt-1 text-xs text-gray-600 dark:text-gray-400">
          Balance: {{ currentBalance }} | After Tx: {{ afterBalance }}
        </p>
      </div>
      <button @click="createTransaction"
              class="w-full bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-md font-medium">
        Send Transaction
      </button>
    </div>
  </div>
</template>


<script setup lang="ts">
import { ref, inject, computed } from 'vue'
import type { BlockchainNodeState } from '../main.vue'

const blockchain = inject<BlockchainNodeState>('blockchainNode')
const txPayload = ref('')
const txTo = ref('')
const txAmount = ref(0)
const showHint = ref(false)

const currentBalance = computed(() => {
  return blockchain?.balances.value[blockchain.nodeId.value] || 0
})

const afterBalance = computed(() => {
  return currentBalance.value - (txAmount.value || 0)
})

const createTransaction = () => {
  const node = blockchain?.node()
  if (!node) return

  if (!txTo.value.trim()) {
    alert('Recipient is required')
    return
  }

  if (txAmount.value <= 0) {
    alert('Amount must be greater than 0')
    return
  }

  if (currentBalance.value < txAmount.value) {
    alert('Insufficient balance')
    return
  }

  node.createTx(txPayload.value.trim(), txTo.value.trim(), txAmount.value)
  txPayload.value = ''
  txTo.value = ''
  txAmount.value = 0
}

const getRandomNodeId = () => {
  const peers = Array.from(blockchain?.peers.value || []).filter(p => p !== blockchain?.nodeId.value)
  if (peers.length > 0) {
    const randomPeer = peers[Math.floor(Math.random() * peers.length)]
    txTo.value = randomPeer
  } else {
    alert('No other peers available to send transaction to.')
  }
}
</script>