import { uid } from '../utils/crypto.js';

interface TransactionData {
    type?: 'transfer' | 'deploy' | 'call';
    from: string;
    to: string;
    amount?: number;
    payload?: any;      // contract code or call data
    signature?: string; // Optional signature for the transaction
}

export class Transaction {
    id: string;
    type: string;
    from: string;
    to: string;
    amount: number;
    payload: any;
    timestamp: number;
    signature?: string;    // Transaction signature
    publicKey?: string;    // Signer's public key

    constructor(params: {
        type: string,
        from: string,
        to?: string,
        amount?: number,
        payload?: any
    }) {
        this.id = uid();
        this.type = params.type;
        this.from = params.from;
        this.to = params.to || '';
        this.amount = params.amount || 0;
        this.payload = params.payload;
        this.timestamp = Date.now();
    }
}