<template>
  <div class="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700">
    <div class="p-4 border-b border-gray-200 dark:border-gray-700">
      <h2 class="text-lg font-semibold flex items-center gap-2">
        <i class="i-myna-code text-purple-500"></i>
        Smart Contracts
      </h2>
    </div>
    <div class="p-4 space-y-4">
      <div>
        <label class="block text-sm font-medium mb-2">Contract Code</label>
        <textarea v-model="contractCode"
                  rows="4"
                  class="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 font-mono text-sm"
                  placeholder="state.counter = (state.counter || 0) + 1;"></textarea>
      </div>
      <button @click="deployContract"
              class="w-full bg-purple-600 hover:bg-purple-700 text-white px-4 py-2 rounded-md font-medium">
        Deploy Contract
      </button>

      <!-- Contract Call -->
      <div v-if="Object.keys(blockchain.contracts.value).length > 0"
           class="pt-4 border-t border-gray-200 dark:border-gray-600">
        <div class="space-y-3">
          <div>
            <label class="block text-sm font-medium mb-2">Contract Address</label>
            <select v-model="selectedContract"
                    class="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700">
              <option value="">Select contract...</option>
              <option v-for="addr in Object.keys(blockchain.contracts.value)"
                      :key="addr"
                      :value="addr">
                {{ addr.slice(0, 8) }}...{{ addr.slice(-6) }}
              </option>
            </select>
          </div>
          <div>
            <label class="block text-sm font-medium mb-2">Call Data</label>
            <input v-model="contractInput"
                   type="text"
                   class="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700"
                   placeholder="Input data...">
          </div>
          <button @click="callContract"
                  :disabled="!selectedContract"
                  class="w-full bg-indigo-600 hover:bg-indigo-700 disabled:bg-gray-400 text-white px-4 py-2 rounded-md font-medium">
            Call Contract
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, inject } from 'vue'

const blockchain = inject('blockchainNode')
const contractCode = ref('state.counter = (state.counter || 0) + 1;')
const selectedContract = ref('')
const contractInput = ref('')

const deployContract = () => {
  const node = blockchain.node()
  if (node && contractCode.value.trim()) {
    node.deployContract(contractCode.value.trim())
    blockchain.contracts.value = node.contracts
  }
}

const callContract = () => {
  const node = blockchain.node()
  if (node && selectedContract.value && contractInput.value.trim()) {
    node.callContract(selectedContract.value, contractInput.value.trim())
    contractInput.value = ''
    blockchain.contracts.value = node.contracts
  }
}
</script>