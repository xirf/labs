import { generateKeyPair, sign, sha256, verify, clone } from '../../utils/crypto';
import { Transaction } from '../../models/Transaction';
import { Block } from '../../models/Block';
import { ContractEngine } from '../ContractEngine';
import { PoWMiner } from '../PoWMiner';
import { addActivityLog } from '../../utils/log';
import type { BlockchainNode } from '../BlockchainNode';
import type { BlockchainNodeMessage } from '../BlockchainNode';

export function emit(node: BlockchainNode, evt: string) {
    for (const f of node.listeners[evt]) f(node.getState());
}

export function loadOrGenerateKeys(node: BlockchainNode): { publicKey: string; privateKey: string } {
    const stored = localStorage.getItem(`keys_${node.id}`);
    if (stored) {
        return JSON.parse(stored);
    }
    const keyPair = generateKeyPair();
    localStorage.setItem(`keys_${node.id}`, JSON.stringify(keyPair));
    return keyPair;
}

export async function signTransaction(node: BlockchainNode, tx: Transaction): Promise<void> {
    const txData = `${tx.type}|${tx.from}|${tx.to}|${tx.amount}|${JSON.stringify(tx.payload)}|${tx.timestamp}`;
    tx.signature = await sign(txData, node.keyPair.privateKey);
    tx.publicKey = node.keyPair.publicKey;
}

export async function mineLoop(node: BlockchainNode, diff: number) {
    while (node.mining && !node.minerAbort.killed) {
        if (node.mempool.length === 0) {
            await new Promise(r => setTimeout(r, 500));
            continue;
        }
        const block = new Block({
            index: node.chain.length,
            prevHash: node.chain.length ? node.chain[node.chain.length - 1].hash : 'GENESIS',
            proposer: node.id,
            difficulty: diff,
            transactions: clone(node.mempool),
        });
        const ok = await PoWMiner.mine(block, diff, node.minerAbort);
        if (!ok) {
            if (node.mining && node.minerAbort.killed) {
                node.minerAbort = { killed: false };
                continue;
            }
            break;
        }
        node.bus.broadcast({ type: 'NEW_BLOCK', from: node.id, block });
        node.consensus.propose(block);
        await new Promise(r => setTimeout(r, 200));
    }
}

export async function commitBlock(node: BlockchainNode, block: Block): Promise<void> {
    if (node.chain.find(b => b.hash === block.hash)) return;
    for (const tx of block.transactions) {
        const isValid = await verifyTransaction(node, tx);
        if (!isValid) {
            addActivityLog('security', `Block ${block.hash} rejected - contains invalid transaction ${tx.id}`);
            return;
        }
    }
    if (node.mining) {
        node.minerAbort.killed = true;
    }
    const ids = new Set(block.transactions.map(t => t.id));
    node.mempool = node.mempool.filter(t => !ids.has(t.id));
    for (const tx of block.transactions) {
        if (tx.type === 'deploy') {
            const c = ContractEngine.deploy(tx.payload);
            node.contracts[c.address] = c;
            addActivityLog('contract', `Deployed contract ${c.address} with code: ${tx.payload.slice(0, 20)}...`);
        } else if (tx.type === 'call') {
            const c = node.contracts[tx.to];
            if (c) ContractEngine.call(c, tx.payload, node.contracts);
            addActivityLog('contract', `Called contract ${tx.to} with input: ${JSON.stringify(tx.payload)}`);
        } else if (tx.type === 'transfer') {
            if (!node.balances[tx.from]) node.balances[tx.from] = 0;
            if (!node.balances[tx.to]) node.balances[tx.to] = 0;
            if (node.balances[tx.from] >= tx.amount) {
                node.balances[tx.from] -= tx.amount;
                node.balances[tx.to] += tx.amount;
            }
        }
    }
    node.chain.push(block);
    if (node.chain.length > 100) {
        addActivityLog('network', `Node ${node.id} trimmed blockchain to last 100 blocks`);
        node.chain = node.chain.slice(-100);
    }
    localStorage.setItem('chain', JSON.stringify(node.chain));
    localStorage.setItem('balances', JSON.stringify(node.balances));
    emit(node, 'chain');
    emit(node, 'mempool');
    emit(node, 'balances');
    emit(node, 'contracts');
    if (node.mining) {
        node.minerAbort = { killed: false };
    }
}

export function handleHello(node: BlockchainNode, msg: BlockchainNodeMessage) {
    node.peers.add(msg.from);
    node.peerLastSeen.set(msg.from, Date.now());
    emit(node, 'peers');
    if (msg.from !== node.id) {
        node.bus.broadcast({ type: 'HELLO_ACK', from: node.id, to: msg.from });
    }
    addActivityLog('peer', `New peer ${msg.from} joined the network`);
}

export function handleHelloAck(node: BlockchainNode, msg: BlockchainNodeMessage) {
    if (msg.to === node.id) {
        node.peers.add(msg.from);
        node.peerLastSeen.set(msg.from, Date.now());
        emit(node, 'peers');
    }
    addActivityLog('network', `Node ${node.id} acknowledged peer ${msg.from}`);
}

export function handleGoodbye(node: BlockchainNode, msg: BlockchainNodeMessage) {
    node.peers.delete(msg.from);
    node.peerLastSeen.delete(msg.from);
    emit(node, 'peers');
    addActivityLog('peer', `Peer ${msg.from} left the network`);
}

export function handleHeartbeat(node: BlockchainNode, msg: BlockchainNodeMessage) {
    node.peers.add(msg.from);
    node.peerLastSeen.set(msg.from, Date.now());
}

export function handleDifficultyUpdate(node: BlockchainNode, msg: BlockchainNodeMessage) {
    if (msg.difficulty && msg.difficulty !== node.difficulty) {
        if (node.mining) {
            node.stopMining();
        }
        node.difficulty = msg.difficulty;
        localStorage.setItem('networkDifficulty', msg.difficulty.toString());
        emit(node, 'difficulty');
        addActivityLog('network', `Difficulty updated to ${msg.difficulty} by ${msg.from}`);
    }
}

export async function verifyTransaction(node: BlockchainNode, tx: Transaction): Promise<boolean> {
    try {
        if (!tx.id || !tx.type || !tx.from || tx.timestamp === undefined) {
            addActivityLog('security', `Transaction ${tx.id} rejected - missing required fields`);
            return false;
        }
        if (!tx.signature || !tx.publicKey) {
            addActivityLog('security', `Transaction ${tx.id} rejected - missing signature`);
            return false;
        }
        const txData = `${tx.type}|${tx.from}|${tx.to}|${tx.amount}|${JSON.stringify(tx.payload)}|${tx.timestamp}`;
        const isValidSignature = await verify(txData, tx.signature, tx.publicKey);
        if (!isValidSignature) {
            addActivityLog('security', `Transaction ${tx.id} rejected - invalid signature`);
            return false;
        }
        const now = Date.now();
        if (now - tx.timestamp > 60 * 60 * 1000) {
            addActivityLog('security', `Transaction ${tx.id} rejected - too old (replay attack)`);
            return false;
        }
        const isDuplicate = node.chain.some(block =>
            block.transactions.some(existingTx =>
                existingTx.id === tx.id ||
                (existingTx.from === tx.from && existingTx.to === tx.to && existingTx.amount === tx.amount && existingTx.timestamp === tx.timestamp)
            )
        );
        if (isDuplicate) {
            addActivityLog('security', `Transaction ${tx.id} rejected - duplicate transaction`);
            return false;
        }
        if (tx.type === 'transfer') {
            if (tx.amount < 0) {
                addActivityLog('security', `Transaction ${tx.id} rejected - negative amount`);
                return false;
            }
            if (node.balances[tx.from] !== undefined && node.balances[tx.from] < tx.amount) {
                addActivityLog('security', `Transaction ${tx.id} rejected - insufficient balance`);
                return false;
            }
        }
        if (tx.payload && typeof tx.payload === 'string') {
            const maliciousPatterns = [/<script/i, /javascript:/i, /on\w+=/i];
            if (maliciousPatterns.some(pattern => pattern.test(tx.payload))) {
                addActivityLog('security', `Transaction ${tx.id} rejected - malicious payload detected`);
                return false;
            }
        }
        return true;
    } catch (error) {
        addActivityLog('security', `Transaction ${tx.id} rejected - verification error: ${error}`);
        return false;
    }
}

export async function handleTransaction(node: BlockchainNode, msg: BlockchainNodeMessage): Promise<void> {
    if (!msg.tx || node.mempool.find(t => t.id === msg.tx!.id)) {
        return;
    }
    const isValid = await verifyTransaction(node, msg.tx);
    if (!isValid) {
        addActivityLog('security', `Node ${node.id} rejected invalid transaction ${msg.tx.id} from ${msg.from}`);
        return;
    }
    node.mempool.push(msg.tx);
    emit(node, 'mempool');
    node.bus.broadcast(msg);
    addActivityLog('transaction', `Node ${node.id} received valid transaction ${msg.tx.id} from ${msg.from}`);
}

export function handleNewBlock(node: BlockchainNode, msg: BlockchainNodeMessage) {
    if (msg.block) {
        validateAndProposeBlock(node, msg.block);
    }
    addActivityLog('network', `Node ${node.id} received new block ${msg.block!.hash} from ${msg.from}`);
}

export async function validateAndProposeBlock(node: BlockchainNode, block: Block): Promise<void> {
    try {
        if (!block.hash || !block.prevHash || block.index === undefined) {
            addActivityLog('security', `Block ${block.hash} rejected - missing required fields`);
            return;
        }
        const raw = `${block.index}|${block.prevHash}|${block.timestamp}|${block.nonce}|${JSON.stringify(block.transactions)}`;
        const expectedHash = await sha256(raw);
        if (expectedHash !== block.hash) {
            addActivityLog('security', `Block ${block.hash} rejected - invalid hash`);
            return;
        }
        if (node.chain.length > 0) {
            const lastBlock = node.chain[node.chain.length - 1];
            if (block.prevHash !== lastBlock.hash) {
                addActivityLog('security', `Block ${block.hash} rejected - invalid previous hash`);
                return;
            }
        }
        const target = '0'.repeat(block.difficulty);
        if (!block.hash.startsWith(target)) {
            addActivityLog('security', `Block ${block.hash} rejected - insufficient difficulty`);
            return;
        }
        for (const tx of block.transactions) {
            const isValid = await verifyTransaction(node, tx);
            if (!isValid) {
                addActivityLog('security', `Block ${block.hash} rejected - contains invalid transaction ${tx.id}`);
                return;
            }
        }
        addActivityLog('validation', `Block ${block.hash} validation successful`);
        node.consensus.propose(block);
    } catch (error) {
        addActivityLog('security', `Block ${block.hash} rejected - validation error: ${error}`);
    }
}

export function handleBlockchainReset(node: BlockchainNode, msg: BlockchainNodeMessage) {
    if (msg.from === node.id) return;
    if (node.mining) {
        node.stopMining();
    }
    resetLocalState(node);
    emitStateChanges(node);
    addActivityLog('network', `Blockchain reset by ${msg.from}`);
}

export function resetLocalState(node: BlockchainNode) {
    node.chain = [];
    node.mempool = [];
    node.contracts = {};
    node.balances = { [node.id]: 100 };
    node.difficulty = 4;
    localStorage.removeItem('chain');
    localStorage.removeItem('balances');
    localStorage.setItem('networkDifficulty', '4');
}

export function emitStateChanges(node: BlockchainNode) {
    emit(node, 'chain');
    emit(node, 'mempool');
    emit(node, 'balances');
    emit(node, 'contracts');
}

export function handleVote(node: BlockchainNode, msg: BlockchainNodeMessage) {
    if (msg.block) {
        node.consensus.handleMessage({
            type: 'VOTE',
            from: msg.from,
            blockHash: msg.block.hash,
            block: msg.block,
        });
    }
}

export function onBusMessage(node: BlockchainNode, msg: BlockchainNodeMessage) {
    if (!msg || !msg.type || !msg.from) return;
    const handlers: { [key: string]: (node: BlockchainNode, msg: BlockchainNodeMessage) => void | Promise<void> } = {
        'HELLO': handleHello,
        'HELLO_ACK': handleHelloAck,
        'GOODBYE': handleGoodbye,
        'HEARTBEAT': handleHeartbeat,
        'DIFFICULTY_UPDATE': handleDifficultyUpdate,
        'TX': handleTransaction,
        'NEW_BLOCK': handleNewBlock,
        'BLOCKCHAIN_RESET': handleBlockchainReset,
        'VOTE': handleVote,
    };
    const handler = handlers[msg.type];
    if (handler) {
        (handler as any)(node, msg);
    }
}
