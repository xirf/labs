export class LocalStorageBus {
    nodeId: string;
    /**
     * LocalStorageBus allows communication between browser tabs using localStorage.
     * It listens for storage events and broadcasts messages to other tabs.
     *
     * @param nodeId Unique identifier for this node (e.g., wallet address)
     * @param onMessage Callback function to handle incoming messages
     */
    constructor(nodeId: string, onMessage: (msg: any) => void) {
        this.nodeId = nodeId;
        window.addEventListener('storage', e => {
            if (!e.key || !e.key.startsWith('bc_msg') || !e.newValue) return;
            console.log(e.newValue)
            const msg = JSON.parse(e.newValue);
            if (msg.from === this.nodeId) return; // ignore self
            onMessage(msg);
        });
    }

    broadcast(msg: any) {
        const key = 'bc_msg_' + Date.now() + '_' + Math.random();
        localStorage.setItem(key, JSON.stringify(msg));
        const newValue = JSON.stringify(msg)

        // Fire handler locally so this tab sees its own broadcast
        window.dispatchEvent(new StorageEvent('storage', { key, newValue }));


        const cleanedMsg = [
            'HELLO',
            'TX',
            'NEW_BLOCK',
            'BLOCKCHAIN_RESET',
            'VOTE',
        ]

        if (!cleanedMsg.includes(msg.type)) {
            setTimeout(() => {
                localStorage.removeItem(key);
            }, 500);
        }
    }
}