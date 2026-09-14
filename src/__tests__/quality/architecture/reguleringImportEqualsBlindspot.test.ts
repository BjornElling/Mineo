import { reguleringCanonicalForloebBoundary } from './rules/formRules';
import { makeSyntheticEntry } from './sourceGraph';

describe('ARCH-002 – reguleringsgrænsens import-equals-modprøve', () => {
  it('afviser reguleringsserie hentet gennem TypeScript import-equals', () => {
    const entry = makeSyntheticEntry(
      'src/domain/eoInspektion/eoInspektionRegulationCore.ts',
      "import serier = require('../../../data/klLoenaftaler'); void serier;",
    );

    const findings = reguleringCanonicalForloebBoundary.evaluate([entry]);

    expect(findings).toHaveLength(1);
    expect(findings[0]?.message).toContain('Direkte import af reguleringsserie');
  });
});
