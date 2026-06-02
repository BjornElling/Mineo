import fs from 'node:fs';
import path from 'node:path';
import { STORAGE_KEYS, UI_STORAGE_KEYS } from '../../config/storageManifest';
import { eoFileDataSchema } from '../../schemas/eoFileSchema';
import { AUTH_STORAGE_KEY, AUTH_STORAGE_VALUE } from '../../auth/authConfig';

/**
 * Håndhæver de bindende isolations-regler fra `src/contracts/auth-gate-contract.md`:
 * - auth-flaget er device-lokalt og må aldrig blande sig med sagsdata (manifest/.eo),
 * - auth-laget må ikke persistere klartekst-adgangskoder eller logge dem.
 */
describe('auth-gate contract isolation', () => {
  it('holder auth-flaget ude af sessionStorage-manifestet (sagsdata)', () => {
    const allManifestKeys = [...Object.values(STORAGE_KEYS), ...Object.values(UI_STORAGE_KEYS)];
    expect(allManifestKeys).not.toContain(AUTH_STORAGE_KEY);
    expect(allManifestKeys).not.toContain(AUTH_STORAGE_VALUE);
  });

  it('forbyder en auth-sektion i strict .eo save-schema', () => {
    const parsed = eoFileDataSchema.safeParse({
      auth: { authenticated: true },
    });
    expect(parsed.success).toBe(false);
  });

  it('auth-laget persisterer eller logger ikke klartekst-adgangskoder', () => {
    const authDir = path.resolve(process.cwd(), 'src/auth');
    for (const fileName of ['auth.ts', 'authConfig.ts', 'AuthGate.tsx']) {
      const source = fs.readFileSync(path.join(authDir, fileName), 'utf8');
      // Adgangskoden hashes og sammenlignes kun; den må aldrig skrives til storage eller console.
      expect(source).not.toMatch(/setItem\([^)]*password/i);
      expect(source).not.toMatch(/console\.(log|debug|info|warn|error)\([^)]*password/i);
    }
  });
});
