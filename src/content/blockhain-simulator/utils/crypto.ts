const textEncoder = new TextEncoder();

/** SHA‑256 → hex */
export async function sha256(str: string): Promise<string> {
  const buf = await crypto.subtle.digest('SHA-256', textEncoder.encode(str));
  return [...new Uint8Array(buf)].map(b => b.toString(16).padStart(2, '0')).join('');
}

/** Random ID (8 hex chars) */
export function uid() {
  return Math.random().toString(16).slice(2, 10);
}

/** Deep‑clone (structuredClone poly if needed) */
export const clone = globalThis.structuredClone || (obj => JSON.parse(JSON.stringify(obj)));

export function generateKeyPair(): { publicKey: string, privateKey: string } {
  // Simple key generation for demo purposes
  const privateKey = uid() + uid();
  const publicKey = 'pub_' + privateKey.slice(0, 32);
  return { publicKey, privateKey };
}

export async function sign(data: string, privateKey: string): Promise<string> {
  // Simple signature for demo - in real blockchain, use proper cryptographic signing
  const combined = data + privateKey;
  const signature = await sha256(combined);
  return signature;
}

export async function verify(data: string, signature: string, publicKey: string): Promise<boolean> {
  // Simple verification for demo - reconstruct signature and compare
  const privateKey = publicKey.replace('pub_', '');
  const combined = data + privateKey;
  const expectedSignature = await sha256(combined);
  return signature === expectedSignature;
}