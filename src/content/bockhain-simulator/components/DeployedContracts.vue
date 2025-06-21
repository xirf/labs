<template>
    <div v-if="Object.keys(contracts).length > 0"
         class="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700">
        <div class="p-4 border-b border-gray-200 dark:border-gray-700">
            <h2 class="text-lg font-semibold flex items-center gap-2">
                <i class="i-myna-code text-purple-500"></i>
                Deployed Contracts ({{ Object.keys(contracts).length }})
            </h2>
        </div>
        <div class="p-4 max-h-48 overflow-y-auto">
            <div class="space-y-2">
                <div v-for="(contract, addr) in contracts"
                     :key="addr"
                     class="border border-gray-200 dark:border-gray-600 rounded p-2 text-sm">
                    <div class="font-mono text-xs mb-1">{{ addr.slice(0, 12) }}...{{ addr.slice(-8) }}</div>
                    <div class="text-xs text-gray-600 dark:text-gray-400">
                        State: {{ JSON.stringify(contract.state) }}
                    </div>
                </div>
            </div>
        </div>
    </div>
</template>

<script setup lang="ts">
import { inject } from 'vue'
const blockchain = inject('blockchainNode')
const contracts = blockchain.contracts
</script>