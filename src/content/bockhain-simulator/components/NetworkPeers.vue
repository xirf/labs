<template>
    <div class="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700">
        <div class="p-4 border-b border-gray-200 dark:border-gray-700">
            <h2 class="text-lg font-semibold flex items-center gap-2">
                <i class="i-myna-users text-cyan-500"></i>
                Network Peers ({{ peers.size }})
            </h2>
        </div>
        <div class="p-4">
            <div v-if="peers.size === 1"
                 class="text-center text-gray-500 py-4">
                No other peers connected
            </div>
            <div v-else
                 class="space-y-2">
                <div v-for="peer in Array.from(peers)"
                     :key="peer"
                     class="flex items-center gap-2 p-2 rounded"
                     :class="peer === nodeId ? 'bg-blue-50 dark:bg-blue-900/20' : 'bg-gray-50 dark:bg-gray-700'">
                    <div class="w-2 h-2 rounded-full shrink-0 bg-green-500"></div>
                    <span class="text-sm grow font-mono overflow-hidden text-ellipsis">{{ peer }}</span>
                    <div v-if="peer === nodeId"
                          class="text-xs shrink-0 text-blue-600 dark:text-blue-400">(You)</div>
                </div>
            </div>
        </div>
    </div>
</template>

<script setup lang="ts">
import { inject } from 'vue'
const blockchain = inject('blockchainNode')
const peers = blockchain.peers
const nodeId = blockchain.nodeId
</script>