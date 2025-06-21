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