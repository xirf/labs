<template>
  <div class="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 relative">
    <div class="p-4 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
      <h2 class="text-lg font-semibold flex items-center gap-2">
        <i class="i-myna-code text-purple-500"></i>
        Smart Contracts
      </h2>
      <button @click="showHint = true"
              class="text-xs border rounded px-2 py-1 bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-100 border-gray-300 dark:border-gray-600 flex items-center gap-2">
        <i class="i-solar-lightbulb-broken w4 h4"></i>
        Help
      </button>
    </div>

    <!-- Hint/Docs Modal -->
    <div v-if="showHint"
         class="absolute top-0 right-10 z-50 w-96 p-4 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg shadow-lg">
      <div class="flex justify-between items-center mb-2">
        <h3 class="text-sm font-semibold text-gray-800 dark:text-gray-200">🧾 Contract Scripting Docs</h3>
        <button @click="showHint = false"
                class="text-gray-500 hover:text-gray-700 dark:hover:text-gray-300 text-sm">✖</button>
      </div>
      <div class="text-xs text-gray-700 dark:text-gray-300 space-y-2">
        <p>You can define contract logic using simple JavaScript.</p>
        <p>The contract code receives this three parameters:</p>
        <ul class="list-disc list-inside space-y-1">
          <li><code>state</code>: an object to persist contract state across calls.</li>
          <li><code>input</code>: payload provided during contract invocation.</li>
          <li><code>world</code>: contains all other contracts on the chain.</li>
          <li><code>log</code>: a function to log messages to the activity log.</li>
        </ul>
        <hr class="my-2 border-gray-200 dark:border-gray-600">
        <p><strong>Example:</strong></p>
        <pre class="bg-gray-100 dark:bg-gray-900 p-2 rounded text-xs font-mono">
<code>// Increase counter every time it's called
state.counter = (state.counter || 0) + 1;
</code>
      </pre>
      </div>
    </div>

    <div class="p-4 space-y-4">
      <!-- Contract Editor Section -->
      <div class="relative w-full">
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
      <div v-if="Object.keys(blockchain?.contracts.value || {}).length > 0"
           class="pt-4 border-t border-gray-200 dark:border-gray-600">
        <div class="space-y-3">
          <div>
            <label class="block text-sm font-medium mb-2">Contract Address</label>
            <select v-model="selectedContract"
                    class="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700">
              <option value="">Select contract...</option>
              <option v-for="addr in Object.keys(blockchain?.contracts.value || {})"
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
import type { BlockchainNodeState } from '../main.vue';

const blockchain = inject<BlockchainNodeState>('blockchainNode')
const contractCode = ref('state.counter = (state.counter || 0) + 1;')
const selectedContract = ref('')
const contractInput = ref('')
const showHint = ref(false)

const deployContract = () => {
  const node = blockchain?.node()
  if (node && contractCode.value.trim() && blockchain && blockchain.contracts.value) {
    node.deployContract(contractCode.value.trim())
    blockchain.contracts.value = node.contracts
  }
}

const callContract = () => {
  const node = blockchain?.node()
  if (node && selectedContract.value && contractInput.value.trim() && blockchain && blockchain.contracts.value) {
    node.callContract(selectedContract.value, contractInput.value.trim())
    contractInput.value = ''
    blockchain.contracts.value = node.contracts
  }
}
</script>