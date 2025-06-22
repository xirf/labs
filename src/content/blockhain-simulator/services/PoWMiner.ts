import type { Block, BlockData } from '../models/Block';
import { sha256 } from '../utils/crypto';
import { addActivityLog } from '../utils/log';

export class PoWMiner {
    /** Mine until hash starts with `nZeros` leading zeros */
    static async mine(block: Block, nZeros: number, abortSignal: { killed: boolean; }): Promise<boolean> {
        const target = '0'.repeat(nZeros);
        while (!abortSignal.killed) {
            block.nonce++;
            const raw = `${block.index}|${block.prevHash}|${block.timestamp}|${block.nonce}|${JSON.stringify(block.transactions)}`;
            block.hash = await sha256(raw);
            if (block.hash.startsWith(target)) {
                // Found a valid hash
                addActivityLog('found', `Found valid hash for block #${block.index}: ${block.hash}`);
                break;
            };

            // throttle a little to keep the tab responsive
            if (block.nonce % 100 === 0) {
                await new Promise(r => setTimeout(r, 1000))
            };
            addActivityLog('mining', `Mining block #${block.index} dif: ${nZeros} with nonce ${block.nonce} Current hash: ${block.hash}`);
        }
        return !abortSignal.killed;
    }
}