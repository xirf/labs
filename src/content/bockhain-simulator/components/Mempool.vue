<template>
    <div class="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700">
        <div class="p-4 border-b border-gray-200 dark:border-gray-700">
            <h2 class="text-lg font-semibold flex items-center gap-2">
                <i class="i-myna-clock text-yellow-500"></i>
                Mempool ({{ mempool?.length }})
            </h2>
        </div>
        <div class="p-4 max-h-64 overflow-y-auto">
            <div v-if="mempool?.length === 0"
                 class="text-center text-gray-500 py-4">
                No pending transactions
            </div>
            <div v-else
                 class="space-y-2">
                <div v-for="tx in mempool"
                     :key="tx.id"
                     class="border border-gray-200 dark:border-gray-600 rounded p-2 text-sm">
                    <div class="flex items-center justify-between mb-1">
                        <span class="font-medium capitalize">{{ tx.type }}</span>
                        <span class="text-xs text-gray-500">{{ tx.id.slice(0, 6) }}</span>
                    </div>
                    <div class="text-xs text-gray-600 dark:text-gray-400">
                        From: {{ tx.from.slice(0, 8) }}...
                    </div>
                    <div v-if="tx.to"
                         class="text-xs text-gray-600 dark:text-gray-400">
                        To: {{ tx.to.slice(0, 8) }}...
                    </div>
                    <div v-if="tx.payload"
                         class="text-xs text-gray-600 dark:text-gray-400 truncate">
                        Data: {{ String(tx.payload).slice(0, 30) }}...
                    </div>
                </div>
            </div>
        </div>
    </div>
</template>

<script setup lang="ts">
import { ref, inject } from 'vue'
import type { BlockchainNodeState } from '../main.vue';

const mempool = inject<BlockchainNodeState>('blockchainNode')?.mempool
</script>