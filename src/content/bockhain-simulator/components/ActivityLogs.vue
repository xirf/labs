<template>
    <div class="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700">
        <div class="p-4 border-b border-gray-200 dark:border-gray-700">
            <div class="flex justify-between items-center">
                <h2 class="text-lg font-semibold flex items-center gap-2">
                    <i class="i-myna-activity text-red-500"></i>
                    Activity Log
                </h2>
                <button @click="clearLogs"
                        class="text-xs text-gray-500 hover:text-gray-700">Clear</button>
            </div>
        </div>
        <div class="p-4 max-h-48 overflow-y-auto">
            <div v-if="activityLogs.length === 0"
                 class="text-center text-gray-500 py-4">
                No activity yet
            </div>
            <div v-else
                 class="space-y-1">
                <div v-for="log in activityLogs.slice().reverse().slice(0, 50)"
                     :key="log.id"
                     class="text-xs p-1 rounded"
                     :class="{
                        'text-blue-600 dark:text-blue-400': log.type === 'transaction',
                        'text-green-600 dark:text-green-400': log.type === 'mining',
                        'text-purple-600 dark:text-purple-400': log.type === 'contract',
                        'text-yellow-600 dark:text-yellow-400': log.type === 'network',
                        'text-red-600 dark:text-red-400': log.type === 'error',
                        'bg-gray-400 dark:bg-gray-700': log.type == 'info'
                    }">
                    <span class="text-gray-500">{{ formatTime(log.timestamp) }}</span>
                    {{ log.message }}
                </div>
            </div>
        </div>
    </div>
</template>

<script setup lang="ts">
import { inject } from 'vue'
const blockchain = inject('blockchainNode')
const activityLogs = blockchain.activityLogs

const clearLogs = () => {
    blockchain.clearActivityLogs()
}
const formatTime = (timestamp: number) => {
    const date = new Date(timestamp)
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })
}
</script>