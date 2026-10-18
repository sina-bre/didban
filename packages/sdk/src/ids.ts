/** UUIDv7 (RFC 9562): 48-bit Unix ms timestamp, then random bits. The server accepts v7 or ULID. */
export function uuidv7(): string {
  const bytes = new Uint8Array(16);
  const crypto = globalThis.crypto;
  if (crypto?.getRandomValues) crypto.getRandomValues(bytes);
  else for (let i = 0; i < 16; i++) bytes[i] = Math.floor(Math.random() * 256);
  let ms = Date.now();
  for (let i = 5; i >= 0; i--) {
    bytes[i] = ms % 256;
    ms = Math.floor(ms / 256);
  }
  bytes[6] = ((bytes[6] ?? 0) & 0x0f) | 0x70;
  bytes[8] = ((bytes[8] ?? 0) & 0x3f) | 0x80;
  const hex = Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
  return hex.replace(/^(.{8})(.{4})(.{4})(.{4})/, "$1-$2-$3-$4-");
}
