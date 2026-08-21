/**
 * Stateless signed session tokens.
 * Cookie value: "<uuid>.<hmac-sha256-hex>"
 * Works in both Edge Runtime (middleware) and Node.js (API routes).
 */

function getSecret(): string {
  const s = process.env.SESSION_SECRET;
  if (!s) throw new Error('SESSION_SECRET env var is not set');
  return s;
}

async function hmac(data: string, secret: string): Promise<string> {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey(
    'raw', enc.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false, ['sign'],
  );
  const sig = await crypto.subtle.sign('HMAC', key, enc.encode(data));
  return Array.from(new Uint8Array(sig)).map(b => b.toString(16).padStart(2, '0')).join('');
}

/** Create a signed session token. */
export async function createSessionToken(): Promise<string> {
  const uuid = crypto.randomUUID();
  const sig  = await hmac(uuid, getSecret());
  return `${uuid}.${sig}`;
}

/** Verify a session token. Returns true if valid. */
export async function verifySessionToken(token: string): Promise<boolean> {
  if (!token) return false;
  const dot = token.lastIndexOf('.');
  if (dot < 0) return false;
  const uuid = token.slice(0, dot);
  const sig  = token.slice(dot + 1);
  if (!uuid || !sig) return false;
  try {
    const expected = await hmac(uuid, getSecret());
    // Constant-time compare to prevent timing attacks
    if (expected.length !== sig.length) return false;
    let diff = 0;
    for (let i = 0; i < expected.length; i++) diff |= expected.charCodeAt(i) ^ sig.charCodeAt(i);
    return diff === 0;
  } catch {
    return false;
  }
}
