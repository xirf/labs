<template>
    <div class="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700">
        <div class="p-4 border-b border-gray-200 dark:border-gray-700">
            <h2 class="text-lg font-semibold flex items-center gap-2">
                <i class="i-lucide-clock-alert text-yellow-500"></i>
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
                     @click="openTransactionDetail(tx)"
                     class="border border-gray-200 dark:border-gray-600 rounded p-2 text-sm cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors">
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

    <!-- Transaction Detail Dialog -->
    <div v-if="selectedTransaction"
         class="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50"
         @click="closeTransactionDetail">
        <div class="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-2xl w-full mx-4 max-h-96 overflow-y-auto"
             @click.stop>
            <div class="p-4 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
                <h3 class="text-lg font-semibold flex items-center gap-2">
                    <i class="i-lucide-file-text text-blue-500"></i>
                    Transaction Details
                </h3>
                <button @click="closeTransactionDetail"
                        class="text-gray-500 hover:text-gray-700 dark:hover:text-gray-300">
                    <i class="i-lucide-x w-5 h-5"></i>
                </button>
            </div>
            <div class="p-4 space-y-4">
                <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                        <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                            Transaction ID
                        </label>
                        <div class="bg-gray-100 dark:bg-gray-700 p-2 rounded text-sm font-mono break-all">
                            {{ selectedTransaction.id }}
                        </div>
                    </div>
                    <div>
                        <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                            Type
                        </label>
                        <div class="bg-gray-100 dark:bg-gray-700 p-2 rounded text-sm capitalize">
                            {{ selectedTransaction.type }}
                        </div>
                    </div>
                    <div>
                        <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                            From
                        </label>
                        <div class="bg-gray-100 dark:bg-gray-700 p-2 rounded text-sm font-mono break-all">
                            {{ selectedTransaction.from }}
                        </div>
                    </div>
                    <div v-if="selectedTransaction.to">
                        <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                            To
                        </label>
                        <div class="bg-gray-100 dark:bg-gray-700 p-2 rounded text-sm font-mono break-all">
                            {{ selectedTransaction.to }}
                        </div>
                    </div>
                    <div>
                        <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                            Timestamp
                        </label>
                        <div class="bg-gray-100 dark:bg-gray-700 p-2 rounded text-sm">
                            {{ new Date(selectedTransaction.timestamp).toLocaleString() }}
                        </div>
                    </div>
                    <div v-if="selectedTransaction.amount">
                        <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                            Amount
                        </label>
                        <div class="bg-gray-100 dark:bg-gray-700 p-2 rounded text-sm">
                            {{ selectedTransaction.amount }}
                        </div>
                    </div>
                </div>

                <div v-if="selectedTransaction.payload">
                    <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                        Payload
                    </label>
                    <div class="bg-gray-100 dark:bg-gray-700 p-3 rounded text-sm font-mono">
                        <pre class="whitespace-pre-wrap">{{ formatPayload(selectedTransaction.payload) }}</pre>
                    </div>
                </div>

                <div v-if="selectedTransaction.signature">
                    <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                        Signature
                    </label>
                    <div class="bg-gray-100 dark:bg-gray-700 p-2 rounded text-sm font-mono break-all">
                        {{ selectedTransaction.signature }}
                    </div>
                </div>
            </div>
        </div>
    </div>
</template>

<script setup lang="ts">
import { ref, inject } from 'vue'
import type { BlockchainNodeState } from '../main.vue'
import type { Transaction } from '../models/Transaction'


const mempool = inject<BlockchainNodeState>('blockchainNode')?.mempool
const selectedTransaction = ref<Transaction | null>(null)

const openTransactionDetail = (tx: Transaction): void => {
    selectedTransaction.value = tx
}

const closeTransactionDetail = (): void => {
    selectedTransaction.value = null
}

const formatPayload = (payload: any): string => {
    if (typeof payload === 'string') {
        try {
            return JSON.stringify(JSON.parse(payload), null, 2)
        } catch {
            return payload
        }
    }
    return JSON.stringify(payload, null, 2)
}
</script>