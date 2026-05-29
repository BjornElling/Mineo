/// <reference types="vitest/globals" />

import fs from 'node:fs';
import path from 'node:path';

import { erhvervsevnetabSchema } from '../../schemas/formSchemas';
import { ERHVERVSEVNETAB_INITIAL_VALUES } from '../../domain/erhvervsevnetab/erhvervsevnetabInitialValues';
import { appSettingsSchema } from '../../settings/appSettingsSchema';

const SRC_ROOT = path.resolve(__dirname, '../../');
const DIFFERENCEKRAV_TAB_PATH = path.resolve(
  SRC_ROOT,
  'components/pages/erhvervsevnetab/EetDifferencekravTab.tsx'
);
const INDSTILLINGER_PATH = path.resolve(SRC_ROOT, 'components/pages/Indstillinger.tsx');
const APP_SETTINGS_SCHEMA_PATH = path.resolve(SRC_ROOT, 'settings/appSettingsSchema.ts');

const FIELD = 'endeligEetGoerMidlertidigEndeligMedTilbagevirkendeKraft';

describe('EET tilbagevirkende kraft-toggle wiring', () => {
  it('er sagsdata på erhvervsevnetab-schemaet med default true', () => {
    const parsed = erhvervsevnetabSchema.parse(ERHVERVSEVNETAB_INITIAL_VALUES);
    expect(parsed.endeligEetGoerMidlertidigEndeligMedTilbagevirkendeKraft).toBe(true);
  });

  it('default true ved schema-evolution: ældre .eo uden feltet får true', () => {
    const utenFelt = { ...ERHVERVSEVNETAB_INITIAL_VALUES } as Record<string, unknown>;
    delete utenFelt[FIELD];
    const parsed = erhvervsevnetabSchema.parse(utenFelt);
    expect(parsed.endeligEetGoerMidlertidigEndeligMedTilbagevirkendeKraft).toBe(true);
  });

  it('er IKKE længere en app-setting', () => {
    // Schema er .strict(): et ukendt felt afvises, hvilket beviser at app-settings ikke ejer det længere.
    const result = appSettingsSchema.safeParse({ [FIELD]: true });
    expect(result.success).toBe(false);

    const schemaSource = fs.readFileSync(APP_SETTINGS_SCHEMA_PATH, 'utf8');
    expect(schemaSource).not.toContain(FIELD);

    const indstillingerSource = fs.readFileSync(INDSTILLINGER_PATH, 'utf8');
    expect(indstillingerSource).not.toContain(FIELD);
  });

  it('bindes på differencekrav-fanen i "Valgmuligheder" med fieldPath-commit og name-prop', () => {
    const source = fs.readFileSync(DIFFERENCEKRAV_TAB_PATH, 'utf8');

    expect(source).toContain('Valgmuligheder');
    expect(source).toContain(`checked={values.${FIELD}}`);
    expect(source).toContain(`name="${FIELD}"`);
    expect(source).toContain(`{ fieldPath: '${FIELD}' }`);
  });
});
