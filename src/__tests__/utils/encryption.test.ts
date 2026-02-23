// @vitest-environment jsdom
import { beforeAll, describe, expect, it } from 'vitest';
import { webcrypto } from 'node:crypto';
import { decryptFromString, encryptToString, EncryptionError } from '../../utils/encryption';

beforeAll(() => {
  if (!globalThis.crypto) {
    globalThis.crypto = webcrypto as unknown as Crypto;
  }
});

const flipLastChar = (value: string): string => {
  if (value.length === 0) return 'A';
  const last = value[value.length - 1];
  const next = last === 'A' ? 'B' : 'A';
  return value.slice(0, -1) + next;
};

describe('encryption (AES-GCM)', () => {
  it('roundtrips data', async () => {
    const payload = {
      a: 1,
      b: 'tekst',
      nested: { arr: [1, 2, 3], flag: true },
    };

    const encrypted = await encryptToString(payload);
    const decrypted = await decryptFromString(encrypted);

    expect(decrypted).toEqual(payload);
  });

  it('produces different output for the same input', async () => {
    const payload = { ok: true, n: 1 };
    const encryptedA = await encryptToString(payload);
    const encryptedB = await encryptToString(payload);

    expect(encryptedA).not.toEqual(encryptedB);

    const parsedA = JSON.parse(encryptedA) as { ivB64: string; ctB64: string };
    const parsedB = JSON.parse(encryptedB) as { ivB64: string; ctB64: string };
    expect(parsedA.ivB64).not.toEqual(parsedB.ivB64);
    expect(parsedA.ctB64).not.toEqual(parsedB.ctB64);
  });

  it('rejects tampered ciphertext', async () => {
    const encrypted = await encryptToString({ ok: true });
    const parsed = JSON.parse(encrypted) as { ctB64: string };
    parsed.ctB64 = flipLastChar(parsed.ctB64);

    await expect(decryptFromString(JSON.stringify(parsed))).rejects.toBeInstanceOf(EncryptionError);
  });

  it('rejects invalid iv length', async () => {
    const encrypted = await encryptToString({ ok: true });
    const parsed = JSON.parse(encrypted) as { ivB64: string };
    const shortIv = btoa(String.fromCharCode(...new Uint8Array(8)));
    parsed.ivB64 = shortIv;

    await expect(decryptFromString(JSON.stringify(parsed))).rejects.toBeInstanceOf(EncryptionError);
  });

  it('rejects random JSON payload', async () => {
    await expect(decryptFromString('{"hello":1}')).rejects.toBeInstanceOf(EncryptionError);
  });

  it('rejects wrong-shape container', async () => {
    const bad = JSON.stringify({ version: 1, alg: 'A256GCM', ivB64: 'AAA=', ctB64: 'BBB=' });
    await expect(decryptFromString(bad)).rejects.toBeInstanceOf(EncryptionError);
  });

  it('rejects version !== 1', async () => {
    // Valid schema-shape but wrong version
    const encrypted = await encryptToString({ ok: true });
    const parsed = JSON.parse(encrypted) as { version: number };
    parsed.version = 2;
    await expect(decryptFromString(JSON.stringify(parsed))).rejects.toBeInstanceOf(EncryptionError);
  });

  it('rejects non-JSON string', async () => {
    await expect(decryptFromString('ikke json {')).rejects.toBeInstanceOf(EncryptionError);
  });

  it('roundtrips via resetKeyCache (nulstiller nøgle-cache uden fejl)', async () => {
    const { resetKeyCache } = await import('../../utils/encryption');
    const payload = { x: 42 };
    const encrypted = await encryptToString(payload);
    resetKeyCache();
    const decrypted = await decryptFromString(encrypted);
    expect(decrypted).toEqual(payload);
  });
});
