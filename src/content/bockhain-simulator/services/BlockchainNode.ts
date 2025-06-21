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
  balances: { [addr: string]: number };          // Simple token balances
  peerLastSeen: Map<string, number>;             // Last heartbeat timestamp
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

  createTx(payload: any, to: string = '', amount: number = 0) {
    const tx = new Transaction({
      type: 'transfer',
      from: this.id,
      payload,
      to,
      amount
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
  /* PRIVATE API (internal use) 
  /*
  /* ============================================================================ */
  _emit(evt: string) {
    for (const f of this.listeners[evt]) f(this.getState());
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

  _commitBlock(block: Block) {
    // prevent duplicates
    if (this.chain.find(b => b.hash === block.hash)) return;

    // Stop mining when a new block is committed**
    if (this.mining) {
      this.minerAbort.killed = true;
    }

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
    localStorage.setItem('chain', JSON.stringify(this.chain));
    localStorage.setItem('balances', JSON.stringify(this.balances));
    this._emit('chain');
    this._emit('mempool');
    this._emit('balances');
    this._emit('contracts');

    // Restart mining if it was active**
    if (this.mining) {
      // Reset abort signal and continue mining
      this.minerAbort = { killed: false };
      // The existing mining loop will continue with the new blockchain state
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

  private _handleTransaction(msg: BlockchainNodeMessage) {
    if (msg.tx && !this.mempool.find(t => t.id === msg.tx!.id)) {
      this.mempool.push(msg.tx);
      this._emit('mempool');
      this.bus.broadcast(msg);
    }
    addActivityLog('transaction', `Node ${this.id} received transaction ${msg.tx!.id} from ${msg.from}`);
  }

  private _handleNewBlock(msg: BlockchainNodeMessage) {
    if (msg.block) {
      this._validateAndProposeBlock(msg.block);
    }
    addActivityLog('network', `Node ${this.id} received new block ${msg.block!.hash} from ${msg.from}`);
  }

  private async _validateAndProposeBlock(block: Block) {
    const raw = `${block.index}|${block.prevHash}|${block.timestamp}|${block.nonce}|${JSON.stringify(block.transactions)}`;
    const hash = await sha256(raw);

    if (hash !== block.hash) {
      addActivityLog('validation', `Block ${block.hash} failed validation - invalid hash`);
      return;
    }

    addActivityLog('validation', `Block ${block.hash} validation successful`);
    this.consensus.propose(block);
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