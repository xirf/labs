import { uid } from '../utils/crypto.js';

interface TransactionData {
    type?: 'transfer' | 'deploy' | 'call';
    from: string;
    to: string;
    amount?: number;
    payload?: any;      // contract code or call data
}

export class Transaction {
    id: string;                             // Unique transaction ID
    type: 'transfer' | 'deploy' | 'call';   // Type of transaction    
    from: string;                           // Sender address
    to: string;                             // Recipient address (or contract address)
    amount: number;                         // Amount of tokens (0 for deploy/call)
    payload: any;                           // Contract code (for deploy) or call data (for call)
    timestamp: number;                      // Unix timestamp of when the transaction was created

    // Note: In a real blockchain, you might also have a nonce to prevent replay attacks

    constructor({ type = 'transfer', from, to, amount = 0, payload = null }: TransactionData) {
        this.id = uid();
        this.type = type;
        this.from = from;
        this.to = to;
        this.amount = amount;
        this.payload = payload;
        this.timestamp = Date.now();
    }
}