<template>
  <div class="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700">
    <div class="p-4 border-b border-gray-200 dark:border-gray-700">
      <h2 class="text-lg font-semibold flex items-center gap-2">
        <i class="i-myna-paper-plane text-blue-500"></i>
        Create Transaction
      </h2>
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

const blockchain = inject('blockchainNode')
const txPayload = ref('')
const txTo = ref('')
const txAmount = ref(0)

const currentBalance = computed(() => {
  return blockchain.balances.value[blockchain.nodeId.value] || 0
})

const afterBalance = computed(() => {
  return currentBalance.value - (txAmount.value || 0)
})

const createTransaction = () => {
  const node = blockchain.node()
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
  const peers = Array.from(blockchain.peers.value).filter(p => p !== blockchain.nodeId.value)
  if (peers.length > 0) {
    const randomPeer = peers[Math.floor(Math.random() * peers.length)]
    txTo.value = randomPeer
  } else {
    alert('No other peers available to send transaction to.')
  }
}
</script>