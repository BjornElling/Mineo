import fs from 'node:fs';
import path from 'node:path';
import { STORAGE_KEYS, UI_STORAGE_KEYS } from '../../config/storageManifest';
import { eoFileDataSchema } from '../../schemas/eoFileSchema';
import { LOCAL_STORAGE_KEY } from '../../settings/appSettingsStorage';

describe('appSettings contract isolation', () => {
  it('keeps app settings localStorage key out of session-storage manifests', () => {
    const allManifestKeys = [...Object.values(STORAGE_KEYS), ...Object.values(UI_STORAGE_KEYS)];
    expect(allManifestKeys).not.toContain(LOCAL_STORAGE_KEY);
  });

  it('forbyder appSettings-sektion i strict .eo save-schema', () => {
    const parsed = eoFileDataSchema.safeParse({
      appSettings: {
        debugMode: true,
      },
    });

    expect(parsed.success).toBe(false);
  });

  it('forhindrer hardcoded app-settings nøgle i save-pipelinen', () => {
    const fileSavePath = path.resolve(process.cwd(), 'src/utils/fileSave.ts');
    const source = fs.readFileSync(fileSavePath, 'utf8');

    expect(source).not.toContain(LOCAL_STORAGE_KEY);
    expect(source).not.toMatch(/\bLOCAL_STORAGE_KEY\b/);
  });
});
