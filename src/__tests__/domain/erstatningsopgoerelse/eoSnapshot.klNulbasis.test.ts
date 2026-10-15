import { computeEoSnapshot } from '../../../domain/erstatningsopgoerelse/snapshot/eoSnapshot';
import { createErstatningsopgoerelseInitialValues } from '../../../domain/erstatningsopgoerelse/helpers/erstatningsopgoerelseInitialValues';
import { STAMDATA_INITIAL_VALUES } from '../../../domain/stamdata/stamdataInitialValues';
import { asSfggAmount, createSfggEmployment, createSfggIngenRow, sfggIso as iso } from '../../utils/sfggTestSupport';

describe('EO-snapshot – KL-lønaftaler med afrundet nulbasis', () => {
  it.each([
    { loen: 0.01, sfggBeregningskilde: 'Ingen' },
    { loen: 0.01, sfggBeregningskilde: 'Ferieloven' },
    { loen: 0.07, sfggBeregningskilde: 'Ingen' },
    { loen: 0.07, sfggBeregningskilde: 'Ferieloven' },
  ] as const)('beregner nul ved løn $loen og SFGG $sfggBeregningskilde', ({ loen, sfggBeregningskilde }) => {
    const eo = createErstatningsopgoerelseInitialValues();
    eo.kravPaaTabtArbejdsfortjeneste = 'Ja';
    eo.kravPaaSvieSmerteGodtgoerelse = 'Nej';
    eo.kravPaaOevrigeErstatningskrav = 'Nej';
    eo.vedroererPeriodeFra = iso('2024-01-01');
    eo.vedroererPeriodeTil = iso('2024-12-31');
    eo.opgørelseLavetDen = iso('2024-12-31');
    eo.tafBeregningsperiodeFra = iso('2017-06-01');
    eo.tafBeregningsperiodeTil = iso('2018-05-31');
    eo.tafPerioder = [{ id: 'taf', fra: iso('2024-01-01'), til: iso('2024-12-31'), loseFeriedage: 0 }];
    eo.loenindkomstAnsaettelsesforhold = [createSfggEmployment({
      fuldLoenUnderFerie: 'Nej', feriePct: 12.5, fritvalgPct: 0, shSoPct: 0,
      loenudviklingBeregningsgrundlag: 'KL-lønaftaler',
      indtaegtsoplysningerTableData: Array.from({ length: 12 }, (_, index) => ({
        id: `loen-${index}`, col0_maaned: String(index < 7 ? index + 6 : index - 6),
        col1_maaned: String(index < 7 ? 2017 : 2018), col0_uge: '', col1_uge: '',
        col0_dag: undefined, col1_dag: undefined, col2: asSfggAmount(loen),
        col3: undefined, col4: undefined, col5: undefined,
      })),
    })];
    eo.sfggAnsaettelsesforhold = [{
      ...createSfggIngenRow('af-1'), sfggBeregningskilde,
      sfggReferenceperiodeFra: eo.tafBeregningsperiodeFra,
      sfggReferenceperiodeTil: eo.tafBeregningsperiodeTil,
    }];

    const snapshot = computeEoSnapshot({
      revision: 'kl-nulbasis', eoValues: eo,
      stamdataValues: { ...STAMDATA_INITIAL_VALUES, skadestype: 'Arbejdsulykke', skadedato: iso('2018-06-01') },
    });

    expect(snapshot.failClosedReason).toBeUndefined();
    expect(snapshot.data).not.toBeNull();
    const segments = snapshot.data?.canonicalOutput.regulering.loenudviklingSegmenter;
    expect(segments?.length).toBeGreaterThan(0);
    for (const segment of segments ?? []) {
      expect(segment.amountOre).toBe(0);
      expect(segment.regulering).toMatchObject({
        kind: 'klLoenaftaler', referenceValue: 0, periodValue: 0,
        rawFactor: 1, rawDeltaPct: 0, appliedDeltaPct: 0,
      });
    }
  });
});
