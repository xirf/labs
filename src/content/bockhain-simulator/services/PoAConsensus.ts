import type { Block } from "../models/Block";
import { addActivityLog } from "../utils/log";

export class PoAConsensus {

    nodeId: string;                      // Unique ID of this node
    send: (msg: any) => void;            // Function to broadcast messages to peers
    getPeers: () => Set<string>;         // Function to get current peers (Set<peerId>)
    votes: Map<string, Set<string>>;     // blockHash → Set<nodeId> who voted
    commitCb: (block: Block) => void;    // Callback to call when block is committed

    constructor(nodeId: string, sendFn: (msg: any) => void, getPeersFn: () => Set<string>) {
        this.nodeId = nodeId;
        this.send = sendFn;              // broadcast(message)
        this.getPeers = getPeersFn;     // () => Set<peerId>
        this.votes = new Map();        // blockHash → Set<nodeId>
        this.commitCb = () => { };
    }

    onCommit(cb: (block: Block) => void) {
        this.commitCb = cb;
        addActivityLog('info', `PoAConsensus initialized for node ${this.nodeId}`);
    }

    handleMessage(msg: { type: string, from: string, blockHash: string, block: Block }) {
        if (msg.type === 'VOTE') {
            if (!msg.blockHash || !msg.block || msg.from === this.nodeId) return; // Ignore self votes

            addActivityLog('info', `Node ${this.nodeId} received vote for block ${msg.blockHash} from ${msg.from}`);
            
            const s = this.votes.get(msg.blockHash) || new Set();
            s.add(msg.from); this.votes.set(msg.blockHash, s);

            const majority = Math.floor(this.getPeers().size / 2) + 1;
            if (s.size >= majority) {
                this.commitCb(msg.block);
                this.votes.delete(msg.blockHash);
                addActivityLog('info', `Node ${this.nodeId} committed block ${msg.blockHash} with ${s.size} votes`);
            }
        }
    }

    /** Proposer calls after mining to kick off voting */
    propose(block: Block) {
        this.votes.set(block.hash, new Set([this.nodeId]));
        this.send({ type: 'VOTE', from: this.nodeId, blockHash: block.hash, block });
        addActivityLog('info', `Node ${this.nodeId} proposed block ${block.hash}`);
    }
}