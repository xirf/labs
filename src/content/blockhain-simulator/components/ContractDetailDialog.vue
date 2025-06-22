<template>
    <div v-if="isOpen"
         class="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50"
         @click="closeDialog">
        <div class="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-4xl w-full mx-4 max-h-[90vh] overflow-hidden"
             @click.stop>
            <!-- Header -->
            <div class="p-4 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
                <h2 class="text-xl font-semibold flex items-center gap-2">
                    <i class="i-solar-chat-square-code-broken text-purple-500"></i>
                    Contract Details
                </h2>
                <button @click="closeDialog"
                        class="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200">
                    <i class="i-myna-x text-xl"></i>
                </button>
            </div>

            <!-- Content -->
            <div class="p-4 overflow-y-auto max-h-[calc(90vh-80px)]">
                <div class="space-y-6">
                    <!-- Contract Address -->
                    <div>
                        <h3 class="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Address</h3>
                        <div class="font-mono text-sm bg-gray-100 dark:bg-gray-700 p-2 rounded">
                            {{ contract?.address }}
                        </div>
                    </div>

                    <!-- Contract State -->
                    <div>
                        <h3 class="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">State</h3>
                        <div class="font-mono text-sm bg-gray-100 dark:bg-gray-700 p-2 rounded">
                            <pre>{{ JSON.stringify(contract?.state, null, 2) }}</pre>
                        </div>
                    </div>

                    <!-- Contract Code -->
                    <div>
                        <h3 class="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Source Code</h3>
                        <div class="border border-gray-200 dark:border-gray-600 rounded overflow-hidden"
                        style="background: #24292e; "
                        >
                            <div v-if="highlightedCode"
                                 v-html="highlightedCode"
                                 class="text-sm p-4"></div>
                            <div v-else
                                 class="font-mono text-sm bg-gray-100 dark:bg-gray-700 p-4">
                                <pre>{{ contract?.code }}</pre>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    </div>
</template>

<script setup lang="ts">
import { ref, watch, computed } from 'vue'
import { codeToHtml, getSingletonHighlighter } from 'shiki'

interface Contract {
    address: string
    code: string
    state: any
}

const props = defineProps<{
    isOpen: boolean
    contract: Contract | null
}>()

const emit = defineEmits<{
    close: []
}>()

const highlightedCode = ref<string>('')

// Initialize Shiki highlighter
const initHighlighter = async () => {
    if (!props.contract?.code) return

    try {
        const highlighter = await getSingletonHighlighter({
            themes: ['github-light', 'github-dark'],
            langs: ['javascript']
        })

        const lightCode = highlighter.codeToHtml(props.contract.code, {
            lang: 'javascript',
            theme: 'github-light'
        })

        const darkCode = highlighter.codeToHtml(props.contract.code, {
            lang: 'javascript',
            theme: 'github-dark'
        })

        // Create a combined HTML with CSS for theme switching
        highlightedCode.value = `
            <div class="light-theme dark:hidden">${lightCode}</div>
            <div class="dark-theme hidden dark:block">${darkCode}</div>
        `
    } catch (error) {
        console.error('Failed to highlight code:', error)
        highlightedCode.value = ''
    }
}

// Watch for contract changes to re-highlight
watch(() => props.contract, () => {
    if (props.contract) {
        initHighlighter()
    }
}, { immediate: true })

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