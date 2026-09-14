import { reguleringCanonicalForloebBoundary } from './rules/formRules';
import { makeSyntheticEntry } from './sourceGraph';

describe('ARCH-002 – reguleringsgrænsens namespace-import modprøve', () => {
  it('afviser reguleringsserie hentet gennem namespace-import', () => {
    const entry = makeSyntheticEntry(
      'src/domain/eoInspektion/eoInspektionRegulationCore.ts',
      "import * as serier from '../../data/statistiskeRates';",
    );

    const findings = reguleringCanonicalForloebBoundary.evaluate([entry]);

    expect(findings).toHaveLength(1);
    expect(findings[0]?.message).toContain('Direkte import af reguleringsserie');
  });
});
