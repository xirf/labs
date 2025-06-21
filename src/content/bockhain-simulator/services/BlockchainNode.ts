import { uid, clone, sha256 } from '../utils/crypto';
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
  bus: LocalStorageBus;                       // Local storage-based message bus
  consensus: PoAConsensus;                   // Proof of Authority consensus instance
  listeners: { [evt: string]: Function[] }; // Event listeners for chain, peers, mempool
  mining: boolean;                         // Is this node currently mining?
  minerAbort: { killed: boolean };        // Abort signal for mining
  difficulty: number                     // Mining difficulty

  constructor() {
    // --- identity & peers ----------------------------------------------------
    this.id = 'node_' + uid() + '_' + Date.now().toString(36);
    this.peers = new Set([this.id]);
    // --- persistence ---------------------------------------------------------
    this.chain = JSON.parse(localStorage.getItem('chain') || '[]');
    this.mempool = [];
    this.contracts = {};
    // --- infra ---------------------------------------------------------------
    this.bus = new LocalStorageBus(this.id, this._onBusMessage.bind(this));
    this.consensus = new PoAConsensus(this.id,
      m => this.bus.broadcast(m),
      () => this.peers);
    this.consensus.onCommit(this._commitBlock.bind(this));
    // --- events --------------------------------------------------------------
    this.listeners = {
      chain: [],
      peers: [],
      mempool: [],
      contracts: [],
      difficulty: []
    };
    // --- mining --------------------------------------------------------------
    this.mining = false;
    this.minerAbort = { killed: false };
    this.difficulty = parseInt(localStorage.getItem('networkDifficulty') || '4');
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
  }



  /* =============== PUBLIC API (UI) =============== */
  on(evt: string, cb: (state: any) => void) {
    (this.listeners[evt] || []).push(cb);
  }
  getState() {
    return {
      chain: clone(this.chain),
      mempool: clone(this.mempool),
      peers: new Set(this.peers),
      difficulty: this.difficulty,
      contracts: { ...this.contracts } // shallow copy of contracts
    };
  }

  createTx(payload: any, to: string = '') {
    const tx = new Transaction({
      type: 'transfer',
      from: this.id,
      payload,
      to
    });
    this.mempool.push(tx); this._emit('mempool');
    this.bus.broadcast({ type: 'TX', from: this.id, tx });
    return tx.id;
  }

  deployContract(code: string) {
    const tx = new Transaction({
      type: 'deploy',
      from: this.id,
      payload: code,
      to: '' // no recipient for deploy
    });
    this.mempool.push(tx); this._emit('mempool');
    this.bus.broadcast({ type: 'TX', from: this.id, tx });
    return tx.id;
  }

  callContract(address: string, input: any) {
    const tx = new Transaction({
      type: 'call',
      from: this.id,
      to: address,
      payload: input
    });
    this.mempool.push(tx); this._emit('mempool');
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

  /* =============== PRIVATE =============== 
  /* This is a private method to emit events to listeners */
  _emit(evt: string) {
    for (const f of this.listeners[evt]) f(this.getState());
  }

  async _mineLoop(diff: number) {
    while (this.mining && !this.minerAbort.killed) {
      if (this.mempool.length === 0) { await new Promise(r => setTimeout(r, 500)); continue; }

      const block = new Block({
        index: this.chain.length,
        prevHash: this.chain.length ? this.chain[this.chain.length - 1].hash : 'GENESIS',
        proposer: this.id,
        difficulty: diff,
        transactions: clone(this.mempool),
      });

      const ok = await PoWMiner.mine(block, diff, this.minerAbort);
      if (!ok) break; // mining stopped

      // mined!
      this.bus.broadcast({ type: 'NEW_BLOCK', from: this.id, block });
      // Vote for own block immediately
      this.consensus.propose(block);
      // wait a bit to avoid piling up mined blocks
      await new Promise(r => setTimeout(r, 200));
    }
  }

  _commitBlock(block: Block) {
    // prevent duplicates
    if (this.chain.find(b => b.hash === block.hash)) return;

    // remove txs
    const ids = new Set(block.transactions.map(t => t.id));
    this.mempool = this.mempool.filter(t => !ids.has(t.id));

    // contracts
    for (const tx of block.transactions) {
      if (tx.type === 'deploy') {
        const c = ContractEngine.deploy(tx.payload);
        this.contracts[c.address] = c;
      } else if (tx.type === 'call') {
        const c = this.contracts[tx.to];
        if (c) ContractEngine.call(c, tx.payload, this.contracts);
      }
    }

    this.chain.push(block);
    localStorage.setItem('chain', JSON.stringify(this.chain));
    this._emit('chain'); this._emit('mempool');
  }

  _onBusMessage(msg: BlockchainNodeMessage) {
    if (!msg || !msg.type || !msg.from) return; // Fixed: removed incorrect validation

    switch (msg.type) {
      case 'HELLO':
        this.peers.add(msg.from);
        this._emit('peers');
        // handshake
        if (msg.from !== this.id) this.bus.broadcast({ type: 'HELLO_ACK', from: this.id, to: msg.from });
        addActivityLog('network', `Node ${this.id} connected to peer ${msg.from}`);
        break;
      case 'HELLO_ACK':
        if (msg.to === this.id) {
          this.peers.add(msg.from);
          this._emit('peers');
        }
        addActivityLog('network', `Node ${this.id} acknowledged peer ${msg.from}`);
        break;
      case 'GOODBYE':
        this.peers.delete(msg.from);
        this._emit('peers');
        addActivityLog('network', `Node ${msg.from} disconnected`);
        break;

      case 'HEARTBEAT':
        this.peers.add(msg.from);
        // Clean up old peers if they haven't sent a heartbeat in a while
        setTimeout(() => {
          if (!this.peers.has(msg.from)) {
            this.peers.delete(msg.from);
            this._emit('peers');
            addActivityLog('network', `Removed inactive peer ${msg.from}`);
          }
        }, 10 * 1000); // 10 seconds grace period
        break;
      case 'DIFFICULTY_UPDATE':
        if (msg.difficulty && msg.difficulty !== this.difficulty) {
          // Stop all mining if difficulty changes
          if (this.mining) {
            this.stopMining();
          }

          this.difficulty = msg.difficulty;
          localStorage.setItem('networkDifficulty', msg.difficulty.toString());
          this._emit('difficulty');
          addActivityLog('network', `Difficulty updated to ${msg.difficulty} by ${msg.from}`);
        }
        break;
      case 'TX':
        if (msg.tx && !this.mempool.find(t => t.id === msg.tx!.id)) {
          this.mempool.push(msg.tx);
          this._emit('mempool');
          // further relay
          this.bus.broadcast(msg);
        }
        addActivityLog('transaction', `Node ${this.id} received transaction ${msg.tx!.id} from ${msg.from}`);
        break;
      case 'NEW_BLOCK':
        if (msg.block) {
          // verify PoW quickly
          (async () => {
            const raw = `${msg.block!.index}|${msg.block!.prevHash}|${msg.block!.timestamp}|${msg.block!.nonce}|${JSON.stringify(msg.block!.transactions)}`;
            const h = await sha256(raw);
            if (h !== msg.block!.hash) return; // invalid
            this.consensus.propose(msg.block!); // vote
          })();
        }
        addActivityLog('network', `Node ${this.id} received new block ${msg.block!.hash} from ${msg.from}`);
        break;
      case 'BLOCKCHAIN_RESET':
        if (msg.from !== this.id) { // Don't reset if we initiated it
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

          // Reset difficulty to default
          this.difficulty = 4;
          localStorage.setItem('networkDifficulty', '4');

          // Emit state changes
          this._emit('chain');
          this._emit('mempool');

          addActivityLog('network', `Blockchain reset by ${msg.from}`);
        }
        break;
      case 'VOTE':
        if (msg.block) {
          this.consensus.handleMessage({
            type: 'VOTE',
            from: msg.from,
            blockHash: msg.block.hash,
            block: msg.block
          });
        }
        break;
    }
  }
}