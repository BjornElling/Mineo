import { reguleringCanonicalForloebBoundary } from './rules/formRules';
import { makeSyntheticEntry } from './sourceGraph';

describe('ARCH-002 – reguleringsgrænsens CommonJS-importmodprøve', () => {
  it('afviser reguleringsserie hentet gennem require', () => {
    const entry = makeSyntheticEntry(
      'src/domain/eoInspektion/eoInspektionRegulationCore.ts',
      "const serier = require('../../../data/klLoenaftaler');",
    );

    const findings = reguleringCanonicalForloebBoundary.evaluate([entry]);

    expect(findings).toHaveLength(1);
    expect(findings[0]?.message).toContain('Direkte import af reguleringsserie');
  });
});
