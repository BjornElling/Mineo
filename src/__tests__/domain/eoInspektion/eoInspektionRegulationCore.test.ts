import { buildRegulationTimeline } from '../../../domain/eoInspektion/eoInspektionRegulationCore';
import { createDefaultLoenindkomstAnsaettelsesforhold, createErstatningsopgoerelseInitialValues } from '../../../domain/erstatningsopgoerelse/helpers/erstatningsopgoerelseInitialValues';
import { STAMDATA_INITIAL_VALUES } from '../../../domain/stamdata/stamdataInitialValues';
import { buildReguleringsbevis } from '../../../domain/erstatningsopgoerelse/engines/regulering/reguleringsbevis';
import type { LoenudviklingModel } from '../../../domain/erstatningsopgoerelse/shared/eoTypes';
import { asCalculable } from '../../../domain/erstatningsopgoerelse/shared/eoTypes';
import { zeroMoneyOre } from '../../../domain/money/money';
import { toISODateString as iso } from '../../../types/branded';

const fixture = () => {
  const eoValues = createErstatningsopgoerelseInitialValues();
  eoValues.beregnesUdFra = 'Beregningsperiode';
  eoValues.tafBeregningsperiodeTil = iso('2024-01-01');
  eoValues.vedroererPeriodeFra = iso('1900-01-01');
  eoValues.vedroererPeriodeTil = iso('2099-12-31');
  eoValues.loenindkomstAnsaettelsesforhold = [{ ...createDefaultLoenindkomstAnsaettelsesforhold(), id: 'af',
    loenudviklingBeregningsgrundlag: 'Overenskomst', overenskomstId: 'kl-overenskomst' }];
  const bevis = buildReguleringsbevis(100, 123.45, {
    kind: 'pakke', referenceDate: iso('2024-01-01'), periodRateDate: iso('2024-10-01'), wageUnit: 'Måned',
    referenceComponents: { baseValue: 100, feriePct: 0, shSoPct: 0, fritvalgPct: 0, pensionPct: 0, storeBededagPct: 0 },
    periodComponents: { baseValue: 123.45, feriePct: 0, shSoPct: 0, fritvalgPct: 0, pensionPct: 0, storeBededagPct: 0 },
  });
  const loenudvikling: LoenudviklingModel = {
    loenudviklingLabel: 'Overenskomst', loenudviklingTotal: asCalculable(zeroMoneyOre()), beregningsenhed: 'Måneder',
    beregnedeSegmenter: [], perAnsaettelse: [{ ansaettelsesforholdId: 'af', ansaettelsesforholdNavn: '',
      loenudviklingLabel: 'Overenskomst', loenudviklingTotal: asCalculable(zeroMoneyOre()),
      beregnedeSegmenter: [{ kind: 'maaneder', fra: iso('2024-10-01'), til: iso('2024-10-31'), maaneder: 1,
        maanedsloenOre: zeroMoneyOre(), amountOre: zeroMoneyOre(), deltaPct: 23.45, regulering: bevis }],
    }],
  };
  return { eoValues, stamdataValues: STAMDATA_INITIAL_VALUES, loenudvikling };
};

describe('eoInspektionRegulationCore', () => {
  it('viser motorens faktiske tal uden satskrav uden for de beregnede perioder (C3)', () => {
    // De bevidst afvigende pakketal beviser, at kontrollen ikke genlæser KL-satser eller EO-periodens 1900–2099.
    const result = buildRegulationTimeline(fixture());
    expect(result.ansaettelser).toHaveLength(1);
    expect(result.ansaettelser[0]).toMatchObject({ referenceIso: iso('2024-01-01'), referenceValue: 100,
      entries: [{ effectiveFrom: iso('2024-10-01'), grundloen: 123.45, packageValue: 123.45, index: 123.45, maaneder: 1 }],
    });
  });

  it('viser ingen alternativ genberegning, når motorens resultat mangler', () => {
    expect(buildRegulationTimeline({ ...fixture(), loenudvikling: null }).ansaettelser).toEqual([]);
  });

  it('bruger ikke en anden ansættelsesforholds segmenter som fallback', () => {
    const input = fixture();
    input.eoValues.loenindkomstAnsaettelsesforhold[0].id = 'andet-job';
    expect(buildRegulationTimeline(input).ansaettelser).toEqual([]);
  });
});
