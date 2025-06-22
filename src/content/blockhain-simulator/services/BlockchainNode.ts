import { uid, clone, sha256, generateKeyPair, sign, verify } from '../utils/crypto';
import { Transaction } from '../models/Transaction';
import { Block } from '../models/Block';
import { ContractEngine } from './ContractEngine';
import { PoWMiner } from './PoWMiner';
import { PoAConsensus } from './PoAConsensus';
import { LocalStorageBus } from './LocalStorageBus';
import { addActivityLog } from '../utils/log';

interface BlockchainNodeMessage {
  type: string,
  from: string,
  hash?: string,
  to?: string,
  tx?: Transaction,
  block?: Block,
  difficulty?: number
}

export class BlockchainNode {
  id: string;                   // Unique node ID
  peers: Set<string>;          // Set of peer node IDs
  chain: Block[];             // Array of blocks in the blockchain
  mempool: Transaction[];    // Array of pending transactions
  contracts: { [address: string]: { code: string, state: any } }; // Deployed contracts
  balances: { [addr: string]: number };         // Simple token balances
  peerLastSeen: Map<string, number>;           // Last heartbeat timestamp
  bus: LocalStorageBus;                       // Local storage-based message bus
  consensus: PoAConsensus;                   // Proof of Authority consensus instance
  listeners: { [evt: string]: Function[] }; // Event listeners for chain, peers, mempool
  mining: boolean;                         // Is this node currently mining?
  minerAbort: { killed: boolean };        // Abort signal for mining
  difficulty: number                     // Mining difficulty
  keyPair: { publicKey: string, privateKey: string }; // Key pair for signing transactions

  constructor() {
    // --- identity & peers ----------------------------------------------------
    this.id = 'node_' + uid() + '_' + Date.now().toString(36);
    this.peers = new Set([this.id]);
    // --- persistence ---------------------------------------------------------
    this.chain = JSON.parse(localStorage.getItem('chain') || '[]');
    this.mempool = [];
    this.contracts = {};
    this.balances = JSON.parse(localStorage.getItem('balances') || '{}');
    if (!this.balances[this.id]) this.balances[this.id] = 100;
    localStorage.setItem('balances', JSON.stringify(this.balances));
    this.peerLastSeen = new Map([[this.id, Date.now()]]);
    // --- infra ---------------------------------------------------------------
    this.bus = new LocalStorageBus(this.id, this._onBusMessage.bind(this));
    this.consensus = new PoAConsensus(this.id, m => this.bus.broadcast(m), () => this.peers);
    this.consensus.onCommit(this._commitBlock.bind(this));
    // --- events --------------------------------------------------------------
    this.listeners = {
      chain: [],
      peers: [],
      mempool: [],
      contracts: [],
      difficulty: [],
      balances: []
    };
    // --- mining --------------------------------------------------------------
    this.mining = false;
    this.minerAbort = { killed: false };
    this.difficulty = parseInt(localStorage.getItem('networkDifficulty') || '4');

    // --- Cryptographic keys --------------------------------
    this.keyPair = this._loadOrGenerateKeys();

    // announce
    this.bus.broadcast({ type: 'HELLO', from: this.id });

    // Handle page unload to notify peers
    window.addEventListener('beforeunload', () => {
      this.bus.broadcast({ type: 'GOODBYE', from: this.id });
    });

    // Periodic heartbeat to detect disconnected peers
    setInterval(() => {
      this.bus.broadcast({ type: 'HEARTBEAT', from: this.id });
    }, 5 * 1000); // every 5 seconds

    // Cleanup stale peers
    setInterval(() => {
      const now = Date.now();
      for (const [peer, ts] of this.peerLastSeen.entries()) {
        if (peer === this.id) continue;
        if (now - ts > 15 * 1000) {
          this.peers.delete(peer);
          this.peerLastSeen.delete(peer);
          this._emit('peers');
          addActivityLog('network', `Removed inactive peer ${peer}`);
        }
      }
    }, 5 * 1000);
  }



  /* ============================================================================ */
  /*
  /* PUBLIC API (exposed to UI)
  /*
  /* ============================================================================ */
  on(evt: string, cb: (state: any) => void) {
    (this.listeners[evt] || []).push(cb);
  }
  getState() {
    return {
      chain: clone(this.chain),
      mempool: clone(this.mempool),
      peers: new Set(this.peers),
      difficulty: this.difficulty,
      contracts: { ...this.contracts }, // shallow copy of contracts
      balances: { ...this.balances }
    };
  }

  async createTx(payload: any, to: string = '', amount: number = 0): Promise<string> {
    const tx = new Transaction({
      type: 'transfer',
      from: this.id,
      payload,
      to,
      amount
    });

    // Sign the transaction
    await this._signTransaction(tx);

    this.mempool.push(tx);
    this._emit('mempool');
    this.bus.broadcast({ type: 'TX', from: this.id, tx });
    return tx.id;
  }


  async deployContract(code: string): Promise<string> {
    const tx = new Transaction({
      type: 'deploy',
      from: this.id,
      payload: code,
      to: '' // no recipient for deploy
    });

    // Sign the transaction
    await this._signTransaction(tx);

    this.mempool.push(tx);
    this._emit('mempool');
    this.bus.broadcast({ type: 'TX', from: this.id, tx });
    return tx.id;
  }

  async callContract(address: string, input: any): Promise<string> {
    const tx = new Transaction({
      type: 'call',
      from: this.id,
      to: address,
      payload: input
    });

    // Sign the transaction
    await this._signTransaction(tx);

    this.mempool.push(tx);
    this._emit('mempool');
    this.bus.broadcast({ type: 'TX', from: this.id, tx });
    return tx.id;
  }

  // Listen for difficulty updates from the UI
  updateDifficulty(newDifficulty: number) {
    this.difficulty = newDifficulty;
    localStorage.setItem('networkDifficulty', newDifficulty.toString());
    this.bus.broadcast({ type: 'DIFFICULTY_UPDATE', from: this.id, difficulty: newDifficulty });
    addActivityLog('network', `Node ${this.id} updated difficulty to ${newDifficulty}`);
  }

  startMining(difficulty?: number) {
    if (this.mining) return;

    // Use network difficulty if not specified
    const targetDifficulty = difficulty || this.difficulty;

    // Broadcast difficulty update if it's different
    if (targetDifficulty !== this.difficulty) {
      this.updateDifficulty(targetDifficulty);
    }

    this.mining = true;
    this.minerAbort = { killed: false };
    this._mineLoop(targetDifficulty);
  }

  stopMining() {
    if (this.mining) {
      this.minerAbort.killed = true; this.mining = false;
    }
  }

  resetBlockchain() {
    // Stop mining if active
    if (this.mining) {
      this.stopMining();
    }

    // Clear local state
    this.chain = [];
    this.mempool = [];
    this.contracts = {};

    // Clear localStorage
    localStorage.removeItem('chain');
    localStorage.removeItem('networkDifficulty');

    // Reset difficulty to default
    this.difficulty = 4;
    localStorage.setItem('networkDifficulty', '4');

    // Broadcast reset to all peers
    this.bus.broadcast({
      type: 'BLOCKCHAIN_RESET',
      from: this.id
    });

    // Emit state changes
    this._emit('chain');
    this._emit('mempool');

    addActivityLog('network', `Node ${this.id} initiated blockchain reset`);
  }

  proposeValidator(nodeId: string) {
    addActivityLog('governance', `Node ${this.id} proposed ${nodeId} as new validator`);
    this.bus.broadcast({
      type: 'PROPOSE_VALIDATOR',
      from: this.id,
      nodeId: nodeId
    });
  }

  voteValidator(nodeId: string, approve: boolean) {
    const action = approve ? 'approved' : 'rejected';
    addActivityLog('governance', `Node ${this.id} ${action} validator proposal for ${nodeId}`);
    this.bus.broadcast({
      type: 'VOTE_VALIDATOR',
      from: this.id,
      nodeId: nodeId,
      approve: approve
    });
  }


  /* ============================================================================ */
  /*
  /* MALICIOUS TRANSACTION SIMULATION
  /*
  /* ============================================================================ */

  async createMaliciousTx(type: 'invalid_signature' | 'double_spend' | 'invalid_balance' | 'malformed_data' | 'replay_attack'): Promise<string> {
    let tx: Transaction;

    switch (type) {
      case 'invalid_signature':
        tx = new Transaction({
          type: 'transfer',
          from: this.id,
          to: Array.from(this.peers)[1] || 'unknown',
          amount: 10,
          payload: 'Malicious transaction with invalid signature'
        });
        // Sign with wrong private key
        tx.signature = await sign(`fake_data`, 'wrong_private_key');
        tx.publicKey = this.keyPair.publicKey;
        break;

      case 'double_spend':
        tx = new Transaction({
          type: 'transfer',
          from: this.id,
          to: Array.from(this.peers)[1] || 'unknown',
          amount: this.balances[this.id] + 100, // Spend more than available
          payload: 'Double spend attempt'
        });
        await this._signTransaction(tx);
        break;

      case 'invalid_balance':
        tx = new Transaction({
          type: 'transfer',
          from: this.id,
          to: Array.from(this.peers)[1] || 'unknown',
          amount: -50, // Negative amount
          payload: 'Invalid negative amount'
        });
        await this._signTransaction(tx);
        break;

      case 'malformed_data':
        tx = new Transaction({
          type: 'transfer',
          from: this.id,
          to: Array.from(this.peers)[1] || 'unknown',
          amount: 10,
          payload: { malicious: true, script: '<script>alert("xss")</script>' }
        });
        await this._signTransaction(tx);
        // Corrupt the transaction data after signing
        tx.payload = null;
        break;

      case 'replay_attack':
        // Find an existing transaction and replay it
        const existingTx = this.chain.flatMap(block => block.transactions)[0];
        if (existingTx) {
          tx = new Transaction({
            type: existingTx.type,
            from: existingTx.from,
            to: existingTx.to,
            amount: existingTx.amount,
            payload: existingTx.payload
          });
          // Use the old signature
          tx.signature = existingTx.signature;
          tx.publicKey = existingTx.publicKey;
          tx.timestamp = existingTx.timestamp; // Same timestamp for replay
        } else {
          // Fallback if no existing transactions
          tx = new Transaction({
            type: 'transfer',
            from: this.id,
            to: Array.from(this.peers)[1] || 'unknown',
            amount: 10,
            payload: 'Replay attack attempt'
          });
          await this._signTransaction(tx);
        }
        break;

      default:
        throw new Error(`Unknown malicious transaction type: ${type}`);
    }

    // Broadcast the malicious transaction
    this.bus.broadcast({ type: 'TX', from: this.id, tx });
    addActivityLog('security', `Node ${this.id} sent malicious transaction: ${type}`);

    return tx.id;
  }

  async createMaliciousBlock(): Promise<void> {
    if (!this.mining) {
      addActivityLog('security', 'Cannot create malicious block - not mining');
      return;
    }

    // Create a block with invalid transactions
    const maliciousTx = new Transaction({
      type: 'transfer',
      from: 'fake_node',
      to: this.id,
      amount: 1000000, // Huge amount
      payload: 'Malicious block creation'
    });

    const block = new Block({
      index: this.chain.length,
      prevHash: 'INVALID_PREV_HASH', // Wrong previous hash
      proposer: this.id,
      difficulty: 1, // Low difficulty
      transactions: [maliciousTx],
    });

    // Force a hash without proper mining
    block.hash = await sha256('malicious_block_' + Date.now());
    block.nonce = 0;

    this.bus.broadcast({ type: 'NEW_BLOCK', from: this.id, block });
    addActivityLog('security', `Node ${this.id} sent malicious block with invalid data`);
  }


  /* ============================================================================ */
  /*
  /* PRIVATE API (internal use) 
  /*
  /* ============================================================================ */

  _emit(evt: string) {
    for (const f of this.listeners[evt]) f(this.getState());
  }

  private _loadOrGenerateKeys(): { publicKey: string, privateKey: string } {
    const stored = localStorage.getItem(`keys_${this.id}`);
    if (stored) {
      return JSON.parse(stored);
    }

    const keyPair = generateKeyPair();
    localStorage.setItem(`keys_${this.id}`, JSON.stringify(keyPair));
    return keyPair;
  }

  private async _signTransaction(tx: Transaction): Promise<void> {
    const txData = `${tx.type}|${tx.from}|${tx.to}|${tx.amount}|${JSON.stringify(tx.payload)}|${tx.timestamp}`;
    tx.signature = await sign(txData, this.keyPair.privateKey);
    tx.publicKey = this.keyPair.publicKey;
  }


  async _mineLoop(diff: number) {
    while (this.mining && !this.minerAbort.killed) {
      if (this.mempool.length === 0) {
        await new Promise(r => setTimeout(r, 500));
        continue;
      }

      const block = new Block({
        index: this.chain.length,
        prevHash: this.chain.length ? this.chain[this.chain.length - 1].hash : 'GENESIS',
        proposer: this.id,
        difficulty: diff,
        transactions: clone(this.mempool),
      });

      const ok = await PoWMiner.mine(block, diff, this.minerAbort);
      if (!ok) {
        // If mining was aborted due to new block, restart the loop
        if (this.mining && this.minerAbort.killed) {
          this.minerAbort = { killed: false };
          continue; // Start mining the next block
        }
        break; // mining stopped manually
      }

      // mined!
      this.bus.broadcast({ type: 'NEW_BLOCK', from: this.id, block });
      // Vote for own block immediately
      this.consensus.propose(block);
      // wait a bit to avoid piling up mined blocks
      await new Promise(r => setTimeout(r, 200));
    }
  }

  private async _commitBlock(block: Block): Promise<void> {
    // prevent duplicates
    if (this.chain.find(b => b.hash === block.hash)) return;

    // Verify all transactions in the block
    for (const tx of block.transactions) {
      const isValid = await this._verifyTransaction(tx);
      if (!isValid) {
        addActivityLog('security', `Block ${block.hash} rejected - contains invalid transaction ${tx.id}`);
        return;
      }
    }

    // Stop mining when a new block is committed
    if (this.mining) {
      this.minerAbort.killed = true;
    }

    // remove txs
    const ids = new Set(block.transactions.map(t => t.id));
    this.mempool = this.mempool.filter(t => !ids.has(t.id));

    // contracts and balances processing
    for (const tx of block.transactions) {
      if (tx.type === 'deploy') {
        const c = ContractEngine.deploy(tx.payload);
        this.contracts[c.address] = c;
        addActivityLog('contract', `Deployed contract ${c.address} with code: ${tx.payload.slice(0, 20)}...`);
      } else if (tx.type === 'call') {
        const c = this.contracts[tx.to];
        if (c) ContractEngine.call(c, tx.payload, this.contracts);
        addActivityLog('contract', `Called contract ${tx.to} with input: ${JSON.stringify(tx.payload)}`);
      } else if (tx.type === 'transfer') {
        if (!this.balances[tx.from]) this.balances[tx.from] = 0;
        if (!this.balances[tx.to]) this.balances[tx.to] = 0;
        if (this.balances[tx.from] >= tx.amount) {
          this.balances[tx.from] -= tx.amount;
          this.balances[tx.to] += tx.amount;
        }
      }
    }

    this.chain.push(block);

    if (this.chain.length > 100) {
      addActivityLog('network', `Node ${this.id} trimmed blockchain to last 100 blocks`);
      this.chain = this.chain.slice(-100);
    }

    localStorage.setItem('chain', JSON.stringify(this.chain));
    localStorage.setItem('balances', JSON.stringify(this.balances));
    this._emit('chain');
    this._emit('mempool');
    this._emit('balances');
    this._emit('contracts');

    // Restart mining if it was active
    if (this.mining) {
      this.minerAbort = { killed: false };
    }
  }


  private _handleHello(msg: BlockchainNodeMessage) {
    this.peers.add(msg.from);
    this.peerLastSeen.set(msg.from, Date.now());
    this._emit('peers');
    if (msg.from !== this.id) {
      this.bus.broadcast({ type: 'HELLO_ACK', from: this.id, to: msg.from });
    }
    addActivityLog('peer', `New peer ${msg.from} joined the network`);
  }

  private _handleHelloAck(msg: BlockchainNodeMessage) {
    if (msg.to === this.id) {
      this.peers.add(msg.from);
      this.peerLastSeen.set(msg.from, Date.now());
      this._emit('peers');
    }
    addActivityLog('network', `Node ${this.id} acknowledged peer ${msg.from}`);
  }


  private _handleGoodbye(msg: BlockchainNodeMessage) {
    this.peers.delete(msg.from);
    this.peerLastSeen.delete(msg.from);
    this._emit('peers');
    addActivityLog('peer', `Peer ${msg.from} left the network`);
  }

  private _handleHeartbeat(msg: BlockchainNodeMessage) {
    this.peers.add(msg.from);
    this.peerLastSeen.set(msg.from, Date.now());
  }

  private _handleDifficultyUpdate(msg: BlockchainNodeMessage) {
    if (msg.difficulty && msg.difficulty !== this.difficulty) {
      if (this.mining) {
        this.stopMining();
      }
      this.difficulty = msg.difficulty;
      localStorage.setItem('networkDifficulty', msg.difficulty.toString());
      this._emit('difficulty');
      addActivityLog('network', `Difficulty updated to ${msg.difficulty} by ${msg.from}`);
    }
  }

  private async _verifyTransaction(tx: Transaction): Promise<boolean> {
    try {
      // Check for basic transaction structure
      if (!tx.id || !tx.type || !tx.from || tx.timestamp === undefined) {
        addActivityLog('security', `Transaction ${tx.id} rejected - missing required fields`);
        return false;
      }

      // Check signature
      if (!tx.signature || !tx.publicKey) {
        addActivityLog('security', `Transaction ${tx.id} rejected - missing signature`);
        return false;
      }

      // Verify signature
      const txData = `${tx.type}|${tx.from}|${tx.to}|${tx.amount}|${JSON.stringify(tx.payload)}|${tx.timestamp}`;
      const isValidSignature = await verify(txData, tx.signature, tx.publicKey);
      if (!isValidSignature) {
        addActivityLog('security', `Transaction ${tx.id} rejected - invalid signature`);
        return false;
      }

      // Check for replay attacks (transaction too old)
      const now = Date.now();
      if (now - tx.timestamp > 60 * 60 * 1000) { // 1 hour
        addActivityLog('security', `Transaction ${tx.id} rejected - too old (replay attack)`);
        return false;
      }

      // Check for duplicate transactions
      const isDuplicate = this.chain.some(block =>
        block.transactions.some(existingTx =>
          existingTx.id === tx.id ||
          (existingTx.from === tx.from &&
            existingTx.to === tx.to &&
            existingTx.amount === tx.amount &&
            existingTx.timestamp === tx.timestamp)
        )
      );
      if (isDuplicate) {
        addActivityLog('security', `Transaction ${tx.id} rejected - duplicate transaction`);
        return false;
      }

      // Check transaction-specific rules
      if (tx.type === 'transfer') {
        // Check for negative amounts
        if (tx.amount < 0) {
          addActivityLog('security', `Transaction ${tx.id} rejected - negative amount`);
          return false;
        }

        // Check sender balance (basic check)
        if (this.balances[tx.from] !== undefined && this.balances[tx.from] < tx.amount) {
          addActivityLog('security', `Transaction ${tx.id} rejected - insufficient balance`);
          return false;
        }
      }

      // Check payload for malicious content
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

  private async _handleTransaction(msg: BlockchainNodeMessage): Promise<void> {
    if (!msg.tx || this.mempool.find(t => t.id === msg.tx!.id)) {
      return;
    }

    // Verify transaction signature
    const isValid = await this._verifyTransaction(msg.tx);
    if (!isValid) {
      addActivityLog('security', `Node ${this.id} rejected invalid transaction ${msg.tx.id} from ${msg.from}`);
      return;
    }

    this.mempool.push(msg.tx);
    this._emit('mempool');
    this.bus.broadcast(msg);
    addActivityLog('transaction', `Node ${this.id} received valid transaction ${msg.tx.id} from ${msg.from}`);
  }

  private _handleNewBlock(msg: BlockchainNodeMessage) {
    if (msg.block) {
      this._validateAndProposeBlock(msg.block);
    }
    addActivityLog('network', `Node ${this.id} received new block ${msg.block!.hash} from ${msg.from}`);
  }

  private async _validateAndProposeBlock(block: Block): Promise<void> {
    try {
      // Check block structure
      if (!block.hash || !block.prevHash || block.index === undefined) {
        addActivityLog('security', `Block ${block.hash} rejected - missing required fields`);
        return;
      }

      // Verify block hash
      const raw = `${block.index}|${block.prevHash}|${block.timestamp}|${block.nonce}|${JSON.stringify(block.transactions)}`;
      const expectedHash = await sha256(raw);

      if (expectedHash !== block.hash) {
        addActivityLog('security', `Block ${block.hash} rejected - invalid hash`);
        return;
      }

      // Check previous hash
      if (this.chain.length > 0) {
        const lastBlock = this.chain[this.chain.length - 1];
        if (block.prevHash !== lastBlock.hash) {
          addActivityLog('security', `Block ${block.hash} rejected - invalid previous hash`);
          return;
        }
      }

      // Check difficulty
      const target = '0'.repeat(block.difficulty);
      if (!block.hash.startsWith(target)) {
        addActivityLog('security', `Block ${block.hash} rejected - insufficient difficulty`);
        return;
      }

      // Verify all transactions in the block
      for (const tx of block.transactions) {
        const isValid = await this._verifyTransaction(tx);
        if (!isValid) {
          addActivityLog('security', `Block ${block.hash} rejected - contains invalid transaction ${tx.id}`);
          return;
        }
      }

      addActivityLog('validation', `Block ${block.hash} validation successful`);
      this.consensus.propose(block);
    } catch (error) {
      addActivityLog('security', `Block ${block.hash} rejected - validation error: ${error}`);
    }
  }

  private _handleBlockchainReset(msg: BlockchainNodeMessage) {
    if (msg.from === this.id) return; // Don't reset if we initiated it

    if (this.mining) {
      this.stopMining();
    }

    this._resetLocalState();
    this._emitStateChanges();
    addActivityLog('network', `Blockchain reset by ${msg.from}`);
  }

  private _resetLocalState() {
    this.chain = [];
    this.mempool = [];
    this.contracts = {};
    this.balances = { [this.id]: 100 };
    this.difficulty = 4;

    localStorage.removeItem('chain');
    localStorage.removeItem('balances');
    localStorage.setItem('networkDifficulty', '4');
  }

  private _emitStateChanges() {
    this._emit('chain');
    this._emit('mempool');
    this._emit('balances');
    this._emit('contracts');
  }

  private _handleVote(msg: BlockchainNodeMessage) {
    if (msg.block) {
      this.consensus.handleMessage({
        type: 'VOTE',
        from: msg.from,
        blockHash: msg.block.hash,
        block: msg.block
      });
    }
  }

  _onBusMessage(msg: BlockchainNodeMessage) {
    if (!msg || !msg.type || !msg.from) return;

    const handlers: { [key: string]: (msg: BlockchainNodeMessage) => void } = {
      'HELLO': this._handleHello.bind(this),
      'HELLO_ACK': this._handleHelloAck.bind(this),
      'GOODBYE': this._handleGoodbye.bind(this),
      'HEARTBEAT': this._handleHeartbeat.bind(this),
      'DIFFICULTY_UPDATE': this._handleDifficultyUpdate.bind(this),
      'TX': this._handleTransaction.bind(this),
      'NEW_BLOCK': this._handleNewBlock.bind(this),
      'BLOCKCHAIN_RESET': this._handleBlockchainReset.bind(this),
      'VOTE': this._handleVote.bind(this)
    };

    const handler = handlers[msg.type];
    if (handler) {
      handler(msg);
    }
  }
}