import { reguleringCanonicalForloebBoundary } from './rules/formRules';
import { makeSyntheticEntry } from './sourceGraph';

describe('ARCH-002 – reguleringsgrænsens re-export-modprøve', () => {
  it('afviser wildcard-re-export af reguleringsserie', () => {
    const entry = makeSyntheticEntry(
      'src/domain/eoInspektion/eoInspektionRegulationCore.ts',
      "export * from '../../data/klLoenaftaler';",
    );

    const findings = reguleringCanonicalForloebBoundary.evaluate([entry]);

    expect(findings).toHaveLength(1);
    expect(findings[0]?.message).toContain('Direkte import af reguleringsserie');
  });
});
