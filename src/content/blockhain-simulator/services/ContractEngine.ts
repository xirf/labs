import { addActivityLog } from '../utils/log'; // Make sure this path is correct

export class ContractEngine {
    static deploy(code: string) {
        const addr = '0x' + code.split('').reduce((a, c) => a + c.charCodeAt(0).toString(16), '').slice(0, 40);
        return { address: addr, code, state: {} };
    }

    static async call(contract: { code: string, state: any }, input: any, worldState: any) {
        try {
            const fn = new Function('state', 'input', 'world', 'log', contract.code);

            const log = (msg: any) => {
                addActivityLog('contract', `[${contract.code.slice(0, 10)}...] ${msg}`);
            };

            await fn(contract.state, input, worldState, log);
            return true;
        } catch (e) {
            console.error('Contract exec failed', e);
            addActivityLog('error', `Contract exec failed: ${e}`);
            return false;
        }
    }
}
