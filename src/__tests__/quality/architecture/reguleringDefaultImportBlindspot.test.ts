import { reguleringCanonicalForloebBoundary } from './rules/formRules';
import { makeSyntheticEntry } from './sourceGraph';

describe('ARCH-002 – reguleringsgrænsens default-import-modprøve', () => {
  it('afviser default-import af reguleringsserie', () => {
    const entry = makeSyntheticEntry(
      'src/domain/eoInspektion/eoInspektionRegulationCore.ts',
      "import rates from '../../data/statistiskeRates'; void rates;",
    );

    const findings = reguleringCanonicalForloebBoundary.evaluate([entry]);

    expect(findings).toEqual([
      {
        ruleId: 'domain/regulering-canonical-forloeb-boundary',
        relativePath: 'src/domain/eoInspektion/eoInspektionRegulationCore.ts',
        position: { line: 1, column: 1 },
        message:
          'Direkte import af reguleringsserie (../../data/statistiskeRates) – brug ReguleringForloeb fra motor-modellen.',
      },
    ]);
  });
});
