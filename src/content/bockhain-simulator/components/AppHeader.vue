<template>
  <header class="border-b border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900">
    <div class="max-w-7xl mx-auto px-4 py-4">
      <div class="flex items-center justify-between">
        <div>
          <h1 class="text-2xl font-bold text-gray-900 dark:text-white">Blockchain Simulator</h1>
          <div class="text-sm text-gray-600 dark:text-gray-400">
            Node ID: {{ blockchain.nodeId.value }} 
            <span class="ml-2">
              <button @click="copy('nodeId')"
                      class="text-blue-500 hover:underline">
                <i class="i-myna-copy h-4 w-4 translate-y-1" v-if="!copied"></i>
                <span v-if="copied" class="text-green-500">Copied!</span>
              </button>
            </span>
          </div>
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
import { inject, ref } from 'vue'

const blockchain = inject('blockchainNode')
const copied = ref(false)

function copy(params: string) {
  const nodeId = blockchain.nodeId.value
  const textToCopy = params === 'nodeId' ? nodeId : JSON.stringify(blockchain, null, 2)

  navigator.clipboard.writeText(textToCopy).then(() => {
    copied.value = true
    setTimeout(() => {
      copied.value = false
    }, 2000)
  }).catch(err => {
    alert('Failed to copy: ' + err)
    copied.value = false
  })
}
</script>