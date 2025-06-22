<template>
    <div class="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700">
        <div class="p-4 border-b border-gray-200 dark:border-gray-700">
            <div class="flex justify-between items-center">
                <h2 class="text-lg font-semibold flex items-center gap-2 grow">
                    <i class="i-myna-activity text-red-500"></i>
                    Activity Log
                </h2>
                <div class="flex items-center gap-2 flex-wrap justify-end">
                    <button @click="clearLogs"
                            class="text-xs border rounded px-2 py-1 bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-100 border-gray-300 dark:border-gray-600 flex items-center gap-2">
                        <i class="i-myna-trash text-red-500  w4 h4"></i>
                        Clear
                    </button>
                    <select v-model="selectedType"
                            class="text-xs border rounded px-2 py-1 bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-100 border-gray-300 dark:border-gray-600 flex items-center gap-2">
                        <option value="">All</option>
                        <option v-for="type in logTypes"
                                :key="type"
                                :value="type">
                            {{ type }}
                        </option>
                    </select>
                </div>
            </div>
        </div>
        <div class="p-4 max-h-92 overflow-y-auto">
            <div v-if="activityLogs?.length === 0"
                 class="text-center text-gray-500 py-4">
                No activity yet
            </div>
            <div v-else
                 class="space-y-1">
                <div v-for="log in filteredLogs.slice().reverse().slice(0, 50)"
                     :key="log.id"
                     class="text-xs p-1 rounded break-all"
                     :class="{
                        'text-blue-600 dark:text-blue-400': log.type === 'transaction',
                        'text-green-600 dark:text-green-400': log.type === 'mining',
                        'text-purple-600 dark:text-purple-400': log.type === 'contract',
                        'text-yellow-600 dark:text-yellow-400': log.type === 'network',
                        'text-red-600 dark:text-red-400 bg-red-500/10': log.type === 'found',
                        'text-gray-600 dark:text-gray-400 bg-gray-100 dark:bg-gray-700': log.type === 'info',
                        'text-orange-600 dark:text-orange-400 bg-orange-50 dark:bg-orange-900/20': log.type === 'consensus',
                        'text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-900/20': log.type === 'governance',
                        'text-teal-600 dark:text-teal-400 bg-teal-50 dark:bg-teal-900/20': log.type === 'validation',
                        'text-cyan-600 dark:text-cyan-400 bg-cyan-50 dark:bg-cyan-900/20': log.type === 'peer',
                        'text-red-800 dark:text-red-300 bg-red-100 dark:bg-red-900/30': log.type === 'error',
                        'text-red-100 dark:text-red-100 bg-red-700 dark:bg-red-900/75': log.type === 'security'
                    }">
                    <div class="flex items-start gap-1">
                        <i class="shrink-0 translate-y-0.5"
                           :class="{
                            'i-myna-file-check': log.type === 'transaction',
                            'i-lucide-pickaxe': log.type === 'mining',
                            'i-myna-code': log.type === 'contract',
                            'i-myna-globe': log.type === 'network',
                            'i-myna-star': log.type === 'found',
                            'i-lucide-info': log.type === 'info',
                            'i-solar-hand-shake-linear': log.type === 'consensus',
                            'i-solar-crown-broken': log.type === 'governance',
                            'i-myna-shield-check': log.type === 'validation',
                            'i-myna-users': log.type === 'peer',
                            'i-solar-shield-warning-outline': (log.type === 'error' || log.type === 'security'),
                        }"></i>
                        <div class="flex-1">
                            <span class="text-gray-500">{{ formatTime(log.timestamp) }}</span>
                            <span class="ml-1">{{ log.message }}</span>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    </div>
</template>

<script setup lang="ts">
import { computed, inject, ref } from 'vue'
import type { BlockchainNodeState } from '../main.vue'

const logTypes = [
    'contract', 'transaction', 'mining', 'network',
    'found', 'info', 'consensus', 'governance', 'validation', 'peer', 'error', 'security'
]

const blockchain = inject<BlockchainNodeState>('blockchainNode')
const activityLogs = blockchain?.activityLogs
const selectedType = ref('')

const filteredLogs = computed(() => {
    if (!activityLogs?.value) return []
    if (!selectedType.value) return activityLogs.value
    return activityLogs.value.filter(log => log.type === selectedType.value)
})

const clearLogs = () => {
    blockchain?.clearActivityLogs()
}
const formatTime = (timestamp: number) => {
    const date = new Date(timestamp)
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })
}
</script>