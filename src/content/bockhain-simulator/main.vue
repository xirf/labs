<template>
  <div class="min-h-screen bg-l-base dark:bg-d-base text-l-on-base dark:text-d-on-base font-sans">
    <AppHeader />

    <div class="max-w-7xl mx-auto px-4 py-6">
      <div class="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <!-- Left Column: Controls & Actions -->
        <div class="space-y-6">
          <MiningControls />
          <TransactionCreator />
          <ContractDeployment />
        </div>

        <!-- Middle Column: Blockchain -->
        <BlockchainDisplay />

        <!-- Right Column: Mempool & Peers -->
        <div class="space-y-6">
          <Mempool />
          <ActivityLogs />
          <NetworkPeers />
          <DeployedContracts />
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, provide, onMounted, onUnmounted, type Ref } from 'vue'
import { BlockchainNode } from './services/BlockchainNode.js'
import { activityLogs, clearActivityLogs } from './utils/log.ts'

import AppHeader from './components/AppHeader.vue'
import MiningControls from './components/MiningControls.vue'
import TransactionCreator from './components/TransactionCreator.vue'
import ContractDeployment from './components/ContractDeployment.vue'
import BlockchainDisplay from './components/BlockchainDisplay.vue'
import Mempool from './components/Mempool.vue'
import ActivityLogs from './components/ActivityLogs.vue'
import NetworkPeers from './components/NetworkPeers.vue'
import DeployedContracts from './components/DeployedContracts.vue'
import type { Block } from './models/Block.ts'
import type { Transaction } from './models/Transaction.ts'

// Reactive state
const nodeId = ref('')
const mining = ref(false)
const difficulty = ref(4)
const chain = ref<Block[]>([])
const mempool = ref<Transaction[]>([])
const peers = ref(new Set())
const contracts = ref({})
const balances = ref({})

// Node instance
let node: BlockchainNode | null = null

export interface BlockchainNodeState {
  node: () => BlockchainNode | null,
  nodeId: Ref<string>,
  mining: Ref<Boolean>,
  difficulty: Ref<number>,
  chain: Ref<Block[]>,
  mempool: Ref<Transaction[]>,
  peers: Ref<Set<string>>,
  contracts: Ref<Record<string, any>>,
  balances: Ref<Record<string, number>>,
  activityLogs: Ref<any[]>,
  clearActivityLogs: () => void
}

// Provide blockchain node and state
provide('blockchainNode', {
  node: () => node,
  nodeId,
  mining,
  difficulty,
  chain,
  mempool,
  peers,
  contracts,
  balances,
  activityLogs,
  clearActivityLogs
})

const formatTime = (timestamp: string) => {
  return new Date(timestamp).toLocaleTimeString()
}

provide('formatTime', formatTime)

onMounted(() => {
  // Initialize blockchain node
  node = new BlockchainNode()
  nodeId.value = node.id
  difficulty.value = node.difficulty

  // Set up event listeners
  node.on('chain', (state) => {
    chain.value = state.chain
  })

  node.on('mempool', (state) => {
    console.log('Mempool updated:', state.mempool)
    mempool.value = state.mempool
  })

  node.on('peers', (state) => {
    peers.value = state.peers
  })

  node.on('contracts', (state) => {
    contracts.value = state.contracts
  })

  node.on('balances', (state) => {
    balances.value = state.balances
  })

  node.on('difficulty', (state) => {
    difficulty.value = state.difficulty
  })

  // Initial state
  const initialState = node.getState()
  chain.value = initialState.chain
  mempool.value = initialState.mempool
  peers.value = initialState.peers || new Set()
  contracts.value = node.contracts || {}
  balances.value = initialState.balances || {}
})

onUnmounted(() => {
  if (node) {
    node.stopMining()
  }
})
</script>