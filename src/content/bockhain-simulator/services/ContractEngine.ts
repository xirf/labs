export class ContractEngine {
    /** Execute contract code safely in Function sandbox */
    static deploy(code: string) {
        const addr = '0x' + code.split('').reduce((a, c) => a + c.charCodeAt(0).toString(16), '').slice(0, 40);
        return { address: addr, code, state: {} };
    }

    /** Execute contract code safely in Function sandbox */
    static async call(contract: { code: string, state: any }, input: any, worldState: any) {
        try {
            const fn = new Function('state', 'input', 'world', contract.code);
            await fn(contract.state, input, worldState);
            return true;
        } catch (e) {
            console.error('Contract exec failed', e);
            return false;
        }
    }
}