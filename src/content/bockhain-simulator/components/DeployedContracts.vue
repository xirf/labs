<template>
    <div v-if="contracts && Object.keys(contracts).length > 0"
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
                     class="border border-gray-200 dark:border-gray-600 rounded p-2 text-sm hover:bg-gray-50 dark:hover:bg-gray-700 cursor-pointer transition-colors"
                     @click="viewContract(addr, contract)">
                    <div class="font-mono text-xs mb-1">{{ addr.slice(0, 12) }}...{{ addr.slice(-8) }}</div>
                    <div class="text-xs text-gray-600 dark:text-gray-400">
                        State: {{ JSON.stringify(contract.state) }}
                    </div>
                    <div class="text-xs text-blue-600 dark:text-blue-400 mt-1">
                        Click to view details
                    </div>
                </div>
            </div>
        </div>
    </div>

    <!-- Contract Detail Dialog -->
    <ContractDetailDialog 
        :is-open="showDialog"
        :contract="selectedContract"
        @close="closeDialog" />
</template>

<script setup lang="ts">
import { inject, ref } from 'vue'
import ContractDetailDialog from './ContractDetailDialog.vue'
import type {BlockchainNodeState} from '../main.vue'

const blockchain = inject<BlockchainNodeState>('blockchainNode')
const contracts = blockchain?.contracts

const showDialog = ref(false)
const selectedContract = ref<{ address: string, code: string, state: any } | null>(null)

const viewContract = (address: string, contract: any) => {
    selectedContract.value = {
        address,
        code: contract.code,
        state: contract.state
    }
    showDialog.value = true
}

const closeDialog = () => {
    showDialog.value = false
    selectedContract.value = null
}
</script>