<template>
    <div class="bg-red-50 dark:bg-red-900/20 rounded-lg shadow-sm border border-red-200 dark:border-red-800">
        <div class="p-4 border-b border-red-200 dark:border-red-800">
            <h2 class="text-lg font-semibold flex items-center gap-2 text-red-700 dark:text-red-300">
                <i class="i-lucide-alert-triangle"></i>
                Malicious Transaction Simulator
            </h2>
            <p class="text-sm text-red-600 dark:text-red-400 mt-1">
                Test network security by sending malicious transactions
            </p>
        </div>
        <div class="p-4 space-y-3">
            <div class="grid grid-cols-1 md:grid-cols-2 gap-2">
                <button @click="sendMaliciousTx('invalid_signature')"
                        class="bg-red-600 hover:bg-red-700 text-white px-3 py-2 rounded text-sm font-medium">
                    Invalid Signature
                </button>
                <button @click="sendMaliciousTx('double_spend')"
                        class="bg-red-600 hover:bg-red-700 text-white px-3 py-2 rounded text-sm font-medium">
                    Double Spend
                </button>
                <button @click="sendMaliciousTx('invalid_balance')"
                        class="bg-red-600 hover:bg-red-700 text-white px-3 py-2 rounded text-sm font-medium">
                    Negative Amount
                </button>
                <button @click="sendMaliciousTx('malformed_data')"
                        class="bg-red-600 hover:bg-red-700 text-white px-3 py-2 rounded text-sm font-medium">
                    Malformed Data
                </button>
                <button @click="sendMaliciousTx('replay_attack')"
                        class="bg-red-600 hover:bg-red-700 text-white px-3 py-2 rounded text-sm font-medium">
                    Replay Attack
                </button>
                <button @click="sendMaliciousBlock"
                        class="bg-red-800 hover:bg-red-900 text-white px-3 py-2 rounded text-sm font-medium">
                    Malicious Block
                </button>
            </div>
        </div>
    </div>
</template>

<script setup lang="ts">
import { inject } from 'vue'
import type { BlockchainNode } from '../services/BlockchainNode'

interface BlockchainService {
    node: () => BlockchainNode | null
}

const blockchain = inject<BlockchainService>('blockchainNode')

if (!blockchain) {
    throw new Error('BlockchainNode service not provided')
}

type MaliciousTxType = 'invalid_signature' | 'double_spend' | 'invalid_balance' | 'malformed_data' | 'replay_attack'

const sendMaliciousTx = async (type: MaliciousTxType): Promise<void> => {
    const node = blockchain.node()
    if (node) {
        try {
            await node.createMaliciousTx(type)
            console.log(`Sent malicious transaction: ${type}`)
        } catch (error) {
            console.error(`Failed to send malicious transaction: ${error}`)
        }
    }
}

const sendMaliciousBlock = async (): Promise<void> => {
    const node = blockchain.node()
    if (node) {
        try {
            await node.createMaliciousBlock()
            console.log('Sent malicious block')
        } catch (error) {
            console.error(`Failed to send malicious block: ${error}`)
        }
    }
}
</script>