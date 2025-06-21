export interface BlockData {
    index: number;          // Block index in the chain
    prevHash: string;      // Hash of the previous block
    proposer: string;      // Address of the block proposer (miner)
    difficulty: number;    // Mining difficulty (number of leading zeros in hash)
    transactions?: any[];  // Array of transactions included in the block
}

export class Block {
    index: number;          // Block index in the chain
    prevHash: string;      // Hash of the previous block
    proposer: string;      // Address of the block proposer (miner)
    timestamp: number;     // Unix timestamp of when the block was created
    nonce: number;         // Nonce used for mining
    difficulty: number;    // Mining difficulty (number of leading zeros in hash)
    transactions: any[];   // Array of transactions included in the block
    hash: string;          // Block hash (filled when mined)

    // Note: In a real blockchain, you might also have a merkle root for transactions

    constructor({ index, prevHash, proposer, difficulty, transactions = [] }: BlockData) {
        this.index = index;
        this.prevHash = prevHash;
        this.proposer = proposer;
        this.timestamp = Date.now();
        this.nonce = 0;
        this.difficulty = difficulty;
        this.transactions = transactions;
        this.hash = '';        // filled when mined
    }
}