/// <reference types="vitest/globals" />

import fs from 'node:fs';
import path from 'node:path';

import { erhvervsevnetabSchema } from '../../schemas/formSchemas';
import { ERHVERVSEVNETAB_INITIAL_VALUES } from '../../domain/erhvervsevnetab/erhvervsevnetabInitialValues';

const SRC_ROOT = path.resolve(__dirname, '../../');
const DIFFERENCEKRAV_TAB_PATH = path.resolve(
  SRC_ROOT,
  'components/pages/erhvervsevnetab/EetDifferencekravTab.tsx'
);

const FIELD = 'indregnMerErstatningVedForhoejetPensionsalder';

describe('EET mer-erstatning ved forhøjet pensionsalder-toggle wiring', () => {
  it('er sagsdata på erhvervsevnetab-schemaet med default true', () => {
    const parsed = erhvervsevnetabSchema.parse(ERHVERVSEVNETAB_INITIAL_VALUES);
    expect(parsed.indregnMerErstatningVedForhoejetPensionsalder).toBe(true);
  });

  it('default true ved schema-evolution: ældre .eo uden feltet får true', () => {
    const utenFelt = { ...ERHVERVSEVNETAB_INITIAL_VALUES } as Record<string, unknown>;
    delete utenFelt[FIELD];
    const parsed = erhvervsevnetabSchema.parse(utenFelt);
    expect(parsed.indregnMerErstatningVedForhoejetPensionsalder).toBe(true);
  });

  it('bindes på differencekrav-fanen i "Valgmuligheder" med fieldPath-commit og name-prop', () => {
    const source = fs.readFileSync(DIFFERENCEKRAV_TAB_PATH, 'utf8');

    expect(source).toContain('Valgmuligheder');
    expect(source).toContain('Indregn mer-erstatning ved forhøjet pensionsalder');
    expect(source).toContain(`checked={values.${FIELD}}`);
    expect(source).toContain(`name="${FIELD}"`);
    expect(source).toContain(`{ fieldPath: '${FIELD}' }`);
  });
});
