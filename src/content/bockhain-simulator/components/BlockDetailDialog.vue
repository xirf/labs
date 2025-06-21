<template>
    <div v-if="isOpen" 
         class="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50"
         @click="closeDialog">
        <div class="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-4xl w-full mx-4 max-h-[90vh] overflow-hidden"
             @click.stop>
            <!-- Header -->
            <div class="p-4 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
                <h2 class="text-xl font-semibold flex items-center gap-2">
                    <i class="i-myna-cube text-green-500"></i>
                    Block #{{ block?.index }} Details
                </h2>
                <button @click="closeDialog" 
                        class="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200">
                    <i class="i-myna-x text-xl"></i>
                </button>
            </div>

            <!-- Content -->
            <div class="p-4 overflow-y-auto max-h-[calc(90vh-80px)]">
                <div class="space-y-6" v-if="block">
                    <!-- Block Header Info -->
                    <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                            <h3 class="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Block Index</h3>
                            <div class="font-mono text-sm bg-gray-100 dark:bg-gray-700 p-2 rounded">
                                {{ block.index }}
                            </div>
                        </div>
                        <div>
                            <h3 class="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Timestamp</h3>
                            <div class="font-mono text-sm bg-gray-100 dark:bg-gray-700 p-2 rounded">
                                {{ new Date(block.timestamp).toLocaleString() }}
                            </div>
                        </div>
                        <div>
                            <h3 class="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Nonce</h3>
                            <div class="font-mono text-sm bg-gray-100 dark:bg-gray-700 p-2 rounded">
                                {{ block.nonce }}
                            </div>
                        </div>
                        <div>
                            <h3 class="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Difficulty</h3>
                            <div class="font-mono text-sm bg-gray-100 dark:bg-gray-700 p-2 rounded">
                                {{ block.difficulty || 'N/A' }}
                            </div>
                        </div>
                    </div>

                    <!-- Block Hash -->
                    <div>
                        <h3 class="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Block Hash</h3>
                        <div class="font-mono text-sm bg-gray-100 dark:bg-gray-700 p-2 rounded break-all">
                            {{ block.hash }}
                        </div>
                    </div>

                    <!-- Previous Hash -->
                    <div>
                        <h3 class="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Previous Block Hash</h3>
                        <div class="font-mono text-sm bg-gray-100 dark:bg-gray-700 p-2 rounded break-all">
                            {{ block.previousHash || 'Genesis Block' }}
                        </div>
                    </div>

                    <!-- Proposer -->
                    <div>
                        <h3 class="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Proposer</h3>
                        <div class="font-mono text-sm bg-gray-100 dark:bg-gray-700 p-2 rounded">
                            {{ block.proposer }}
                        </div>
                    </div>

                    <!-- Transactions -->
                    <div>
                        <h3 class="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                            Transactions ({{ block.transactions.length }})
                        </h3>
                        <div v-if="block.transactions.length === 0" 
                             class="text-gray-500 italic text-sm">
                            No transactions in this block
                        </div>
                        <div v-else class="space-y-2">
                            <div v-for="(tx, index) in block.transactions" 
                                 :key="index"
                                 class="border border-gray-200 dark:border-gray-600 rounded p-3 bg-gray-50 dark:bg-gray-700">
                                <div class="grid grid-cols-1 md:grid-cols-2 gap-2 text-xs">
                                    <div>
                                        <span class="font-medium">From:</span>
                                        <span class="font-mono ml-1">{{ tx.from }}</span>
                                    </div>
                                    <div>
                                        <span class="font-medium">To:</span>
                                        <span class="font-mono ml-1">{{ tx.to }}</span>
                                    </div>
                                    <div>
                                        <span class="font-medium">Amount:</span>
                                        <span class="ml-1">{{ tx.amount }}</span>
                                    </div>
                                    <div>
                                        <span class="font-medium">Type:</span>
                                        <span class="ml-1 capitalize">{{ tx.type || 'transfer' }}</span>
                                    </div>
                                    <div v-if="tx.signature" class="md:col-span-2">
                                        <span class="font-medium">Signature:</span>
                                        <div class="font-mono text-xs mt-1 break-all">{{ tx.signature }}</div>
                                    </div>
                                    <div v-if="tx.data" class="md:col-span-2">
                                        <span class="font-medium">Data:</span>
                                        <div class="font-mono text-xs mt-1 bg-gray-100 dark:bg-gray-600 p-2 rounded">
                                            <pre>{{ JSON.stringify(tx.data, null, 2) }}</pre>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>

                    <!-- Raw Block Data -->
                    <div>
                        <h3 class="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Raw Block Data</h3>
                        <div class="font-mono text-xs bg-gray-100 dark:bg-gray-700 p-3 rounded overflow-x-auto">
                            <pre>{{ JSON.stringify(block, null, 2) }}</pre>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    </div>
</template>

<script setup lang="ts">
interface Block {
    index: number
    timestamp: number
    hash: string
    previousHash: string
    proposer: string
    nonce: number
    difficulty?: number
    transactions: Array<{
        from: string
        to: string
        amount: number
        type?: string
        signature?: string
        data?: any
    }>
}

const props = defineProps<{
    isOpen: boolean
    block: Block | null
}>()

const emit = defineEmits<{
    close: []
}>()

const closeDialog = () => {
    emit('close')
}
</script>

<style scoped>
/* Custom scrollbar for better appearance */
::-webkit-scrollbar {
    width: 8px;
}

::-webkit-scrollbar-track {
    @apply bg-gray-100 dark:bg-gray-700;
}

::-webkit-scrollbar-thumb {
    @apply bg-gray-300 dark:bg-gray-600 rounded;
}

::-webkit-scrollbar-thumb:hover {
    @apply bg-gray-400 dark:bg-gray-500;
}
</style>