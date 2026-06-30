// Minimal Safetensors loader for the browser
export async function loadSafetensors(url: string, onProgress?: (p: number) => void): Promise<Record<string, Float32Array>> {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`Failed to fetch weights: ${response.statusText}`);

  const contentLength = +(response.headers.get('Content-Length') || 0);
  const reader = response.body?.getReader();
  if (!reader) throw new Error("ReadableStream not supported");

  let receivedLength = 0;
  const chunks: Uint8Array[] = [];

  while(true) {
    const {done, value} = await reader.read();
    if (done) break;
    chunks.push(value);
    receivedLength += value.length;
    if (onProgress && contentLength) onProgress(receivedLength / contentLength);
  }

  const buffer = new Uint8Array(receivedLength);
  let position = 0;
  for(let chunk of chunks) {
    buffer.set(chunk, position);
    position += chunk.length;
  }

  const view = new DataView(buffer.buffer);
  const headerLength = Number(view.getBigUint64(0, true));
  const headerBytes = buffer.subarray(8, 8 + headerLength);
  const header = JSON.parse(new TextDecoder().decode(headerBytes));

  const weights: Record<string, Float32Array> = {};
  const dataStart = 8 + headerLength;

  for (const [name, info] of Object.entries<any>(header)) {
    if (name === '__metadata__') continue;
    const [start, end] = info.data_offsets;
    const dtype = info.dtype;

    if (dtype === 'F32') {
        weights[name] = new Float32Array(buffer.buffer, dataStart + start, (end - start) / 4);
    } else {
        console.warn(`Unsupported dtype ${dtype} for tensor ${name}`);
    }
  }

  return weights;
}
