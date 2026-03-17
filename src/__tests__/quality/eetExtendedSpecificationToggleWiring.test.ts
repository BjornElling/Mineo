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
const LOEBENDE_YDELSER_TAB_PATH = path.resolve(
  SRC_ROOT,
  'components/pages/erhvervsevnetab/EetLoebendeYdelserTab.tsx'
);

describe('EET udvidet specifikation toggle wiring', () => {
  it('persisterer begge toggles i erhvervsevnetab-schemaet med default false', () => {
    const parsed = erhvervsevnetabSchema.parse(ERHVERVSEVNETAB_INITIAL_VALUES);

    expect(parsed.eetDifferencekravBilagSelection.visUdvidetSpecifikation).toBe(false);
    expect(parsed.eetDifferencekravBilagSelection.visUdvidetSpecifikationLoebendeYdelserBilag).toBe(false);
  });

  it('binder differencekrav-tabben til sit eget persisted felt', () => {
    const source = fs.readFileSync(DIFFERENCEKRAV_TAB_PATH, 'utf8');

    expect(source).toContain('Medtag udvidet specifikation på løbende ydelser');
    expect(source).toContain('checked={bilagSelection.visUdvidetSpecifikationLoebendeYdelserBilag}');
    expect(source).toContain('visUdvidetSpecifikationLoebendeYdelserBilag: event.target.value');
  });

  it('binder løbende ydelser-tabben til det eksisterende, separate persisted felt', () => {
    const source = fs.readFileSync(LOEBENDE_YDELSER_TAB_PATH, 'utf8');

    expect(source).toContain('const showExtendedSpecification = values.eetDifferencekravBilagSelection.visUdvidetSpecifikation;');
    expect(source).toContain('visUdvidetSpecifikation: event.target.value');
    expect(source).toContain('visUdvidetSpecifikation: showExtendedSpecification');
    expect(source).not.toContain('visUdvidetSpecifikationLoebendeYdelserBilag: event.target.value');
  });
});
