import { uid, clone } from '../utils/crypto';
import { Transaction } from '../models/Transaction';
import { Block } from '../models/Block';
import { PoAConsensus } from './PoAConsensus';
import { LocalStorageBus } from './LocalStorageBus';
import { addActivityLog } from '../utils/log';
import * as NodePublic from './node/public';
import * as NodePrivate from './node/private';

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
    return NodePublic.createTx(this, payload, to, amount);
  }


  async deployContract(code: string): Promise<string> {
    return NodePublic.deployContract(this, code);
  }

  async callContract(address: string, input: any): Promise<string> {
    return NodePublic.callContract(this, address, input);
  }

  updateDifficulty(newDifficulty: number) {
    NodePublic.updateDifficulty(this, newDifficulty);
    addActivityLog('network', `Node ${this.id} updated difficulty to ${newDifficulty}`);
  }

  startMining(difficulty?: number) {
    NodePublic.startMining(this, difficulty);
  }

  stopMining() {
    NodePublic.stopMining(this);
  }

  resetBlockchain() {
    NodePublic.resetBlockchain(this);
    addActivityLog('network', `Node ${this.id} initiated blockchain reset`);
  }

  proposeValidator(nodeId: string) {
    addActivityLog('governance', `Node ${this.id} proposed ${nodeId} as new validator`);
    NodePublic.proposeValidator(this, nodeId);
  }

  voteValidator(nodeId: string, approve: boolean) {
    const action = approve ? 'approved' : 'rejected';
    addActivityLog('governance', `Node ${this.id} ${action} validator proposal for ${nodeId}`);
    NodePublic.voteValidator(this, nodeId, approve);
  }


  /* ============================================================================ */
  /*
  /* MALICIOUS TRANSACTION SIMULATION
  /*
  /* ============================================================================ */

  async createMaliciousTx(type: 'invalid_signature' | 'double_spend' | 'invalid_balance' | 'malformed_data' | 'replay_attack'): Promise<string> {
    return NodePublic.createMaliciousTx(this, type);
  }

  async createMaliciousBlock(): Promise<void> {
    NodePublic.createMaliciousBlock(this);
  }


  /* ============================================================================ */
  /*
  /* PRIVATE API (internal use) 
  /*
  /* ============================================================================ */

  _emit(evt: string) {
    NodePrivate.emit(this, evt);
  }

  private _loadOrGenerateKeys(): { publicKey: string, privateKey: string } {
    return NodePrivate.loadOrGenerateKeys(this);
  }

  private async _signTransaction(tx: Transaction): Promise<void> {
    await NodePrivate.signTransaction(this, tx);
  }


  async _mineLoop(diff: number) {
    await NodePrivate.mineLoop(this, diff);
  }

  private async _commitBlock(block: Block): Promise<void> {
    await NodePrivate.commitBlock(this, block);
  }


  private _handleHello(msg: BlockchainNodeMessage) {
    NodePrivate.handleHello(this, msg);
  }

  private _handleHelloAck(msg: BlockchainNodeMessage) {
    NodePrivate.handleHelloAck(this, msg);
  }


  private _handleGoodbye(msg: BlockchainNodeMessage) {
    NodePrivate.handleGoodbye(this, msg);
  }

  private _handleHeartbeat(msg: BlockchainNodeMessage) {
    NodePrivate.handleHeartbeat(this, msg);
  }

  private _handleDifficultyUpdate(msg: BlockchainNodeMessage) {
    NodePrivate.handleDifficultyUpdate(this, msg);
  }

  private async _verifyTransaction(tx: Transaction): Promise<boolean> {
    return NodePrivate.verifyTransaction(this, tx);
  }

  private async _handleTransaction(msg: BlockchainNodeMessage): Promise<void> {
    await NodePrivate.handleTransaction(this, msg);
  }

  private _handleNewBlock(msg: BlockchainNodeMessage) {
    NodePrivate.handleNewBlock(this, msg);
  }

  private async _validateAndProposeBlock(block: Block): Promise<void> {
    await NodePrivate.validateAndProposeBlock(this, block);
  }

  private _handleBlockchainReset(msg: BlockchainNodeMessage) {
    NodePrivate.handleBlockchainReset(this, msg);
  }

  private _resetLocalState() {
    NodePrivate.resetLocalState(this);
  }

  private _emitStateChanges() {
    NodePrivate.emitStateChanges(this);
  }

  private _handleVote(msg: BlockchainNodeMessage) {
    NodePrivate.handleVote(this, msg);
  }

  _onBusMessage(msg: BlockchainNodeMessage) {
    NodePrivate.onBusMessage(this, msg);
  }
}