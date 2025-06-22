import { sign } from '../../utils/crypto';
import { Transaction } from '../../models/Transaction';
import { Block } from '../../models/Block';
import { sha256 } from '../../utils/crypto';
import type { BlockchainNode } from '../BlockchainNode';
import { emit } from './private';

export async function createTx(node: BlockchainNode, payload: any, to = '', amount = 0): Promise<string> {
    const tx = new Transaction({
        type: 'transfer',
        from: node.id,
        payload,
        to,
        amount,
    });
    await node._signTransaction(tx);
    node.mempool.push(tx);
    emit(node, 'mempool');
    node.bus.broadcast({ type: 'TX', from: node.id, tx });
    return tx.id;
}

export async function deployContract(node: BlockchainNode, code: string): Promise<string> {
    const tx = new Transaction({
        type: 'deploy',
        from: node.id,
        payload: code,
        to: '',
    });
    await node._signTransaction(tx);
    node.mempool.push(tx);
    emit(node, 'mempool');
    node.bus.broadcast({ type: 'TX', from: node.id, tx });
    return tx.id;
}

export async function callContract(node: BlockchainNode, address: string, input: any): Promise<string> {
    const tx = new Transaction({
        type: 'call',
        from: node.id,
        to: address,
        payload: input,
    });
    await node._signTransaction(tx);
    node.mempool.push(tx);
    emit(node, 'mempool');
    node.bus.broadcast({ type: 'TX', from: node.id, tx });
    return tx.id;
}

export function updateDifficulty(node: BlockchainNode, newDifficulty: number) {
    node.difficulty = newDifficulty;
    localStorage.setItem('networkDifficulty', newDifficulty.toString());
    node.bus.broadcast({ type: 'DIFFICULTY_UPDATE', from: node.id, difficulty: newDifficulty });
}

export function startMining(node: BlockchainNode, difficulty?: number) {
    if (node.mining) return;
    const targetDifficulty = difficulty || node.difficulty;
    if (targetDifficulty !== node.difficulty) {
        updateDifficulty(node, targetDifficulty);
    }
    node.mining = true;
    node.minerAbort = { killed: false };
    node._mineLoop(targetDifficulty);
}

export function stopMining(node: BlockchainNode) {
    if (node.mining) {
        node.minerAbort.killed = true;
        node.mining = false;
    }
}

export function resetBlockchain(node: BlockchainNode) {
    if (node.mining) {
        stopMining(node);
    }
    node.chain = [];
    node.mempool = [];
    node.contracts = {};
    localStorage.removeItem('chain');
    localStorage.removeItem('networkDifficulty');
    node.difficulty = 4;
    localStorage.setItem('networkDifficulty', '4');
    node.bus.broadcast({ type: 'BLOCKCHAIN_RESET', from: node.id });
    emit(node, 'chain');
    emit(node, 'mempool');
}

export function proposeValidator(node: BlockchainNode, nodeId: string) {
    node.bus.broadcast({ type: 'PROPOSE_VALIDATOR', from: node.id, nodeId });
}

export function voteValidator(node: BlockchainNode, nodeId: string, approve: boolean) {
    node.bus.broadcast({ type: 'VOTE_VALIDATOR', from: node.id, nodeId, approve });
}

export async function createMaliciousTx(node: BlockchainNode, type: 'invalid_signature' | 'double_spend' | 'invalid_balance' | 'malformed_data' | 'replay_attack'): Promise<string> {
    let tx: Transaction;
    switch (type) {
        case 'invalid_signature':
            tx = new Transaction({
                type: 'transfer',
                from: node.id,
                to: Array.from(node.peers)[1] || 'unknown',
                amount: 10,
                payload: 'Malicious transaction with invalid signature',
            });
            tx.signature = await sign(`fake_data`, 'wrong_private_key');
            tx.publicKey = node.keyPair.publicKey;
            break;
        case 'double_spend':
            tx = new Transaction({
                type: 'transfer',
                from: node.id,
                to: Array.from(node.peers)[1] || 'unknown',
                amount: node.balances[node.id] + 100,
                payload: 'Double spend attempt',
            });
            await node._signTransaction(tx);
            break;
        case 'invalid_balance':
            tx = new Transaction({
                type: 'transfer',
                from: node.id,
                to: Array.from(node.peers)[1] || 'unknown',
                amount: -50,
                payload: 'Invalid negative amount',
            });
            await node._signTransaction(tx);
            break;
        case 'malformed_data':
            tx = new Transaction({
                type: 'transfer',
                from: node.id,
                to: Array.from(node.peers)[1] || 'unknown',
                amount: 10,
                payload: { malicious: true, script: '<script>alert("xss")</script>' },
            });
            await node._signTransaction(tx);
            tx.payload = null;
            break;
        case 'replay_attack':
            const existingTx = node.chain.flatMap(block => block.transactions)[0];
            if (existingTx) {
                tx = new Transaction({
                    type: existingTx.type,
                    from: existingTx.from,
                    to: existingTx.to,
                    amount: existingTx.amount,
                    payload: existingTx.payload,
                });
                tx.signature = existingTx.signature;
                tx.publicKey = existingTx.publicKey;
                tx.timestamp = existingTx.timestamp;
            } else {
                tx = new Transaction({
                    type: 'transfer',
                    from: node.id,
                    to: Array.from(node.peers)[1] || 'unknown',
                    amount: 10,
                    payload: 'Replay attack attempt',
                });
                await node._signTransaction(tx);
            }
            break;
        default:
            throw new Error(`Unknown malicious transaction type: ${type}`);
    }
    node.bus.broadcast({ type: 'TX', from: node.id, tx });
    return tx.id;
}

export async function createMaliciousBlock(node: BlockchainNode): Promise<void> {
    if (!node.mining) {
        return;
    }
    const maliciousTx = new Transaction({
        type: 'transfer',
        from: 'fake_node',
        to: node.id,
        amount: 1000000,
        payload: 'Malicious block creation',
    });
    const block = new Block({
        index: node.chain.length,
        prevHash: 'INVALID_PREV_HASH',
        proposer: node.id,
        difficulty: 1,
        transactions: [maliciousTx],
    });
    block.hash = await sha256('malicious_block_' + Date.now());
    block.nonce = 0;
    node.bus.broadcast({ type: 'NEW_BLOCK', from: node.id, block });
}

