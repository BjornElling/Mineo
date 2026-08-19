/**
 * Regressionstest for "indkomst må aldrig forsvinde"-fald-tilbage (periodisering-contract.md §3A).
 *
 * Scenarie (brugerens formulering): en indtægt angives for en periode i beregningsperioden, hvor
 * SAMTLIGE dage er feriedage (fx hel ferie i juli). På arbejdsdags-sporet har perioden ingen
 * arbejdsdage at periodisere på. Indkomsten må ikke bare udgå – den fordeles på fald-tilbage-dage,
 * så beløbet medregnes. Dagene tælles dog ALDRIG som arbejdsdage.
 */

import type { AmountValue } from '../../../schemas/amountExpressionSchema';
import type { OffentligeYdelserRow } from '../../../schemas/formSchemas';
import { toISODateString } from '../../../types/branded';
import {
  createDefaultLoenindkomstAnsaettelsesforhold,
  createErstatningsopgoerelseInitialValues,
} from '../../../domain/erstatningsopgoerelse/helpers/erstatningsopgoerelseInitialValues';
import { buildIncomeForRanges } from '../../../domain/erstatningsopgoerelse/helpers/indtaegtPerioder';
import { buildLoenArbejdsdageSet } from '../../../domain/erstatningsopgoerelse/engines/periodiseringsMotor';

const asAmount = (value: number): AmountValue => ({ kind: 'number', value });
const iso = (value: string) => toISODateString(value);

const makeArbejdsdageSporValues = () => {
  const values = createErstatningsopgoerelseInitialValues();
  // 'Angivet dagsløn' ⇒ beregningsenhed = Arbejdsdage.
  values.beregnesUdFra = 'Angivet dagsløn';
  values.loenindkomstAnsaettelsesforhold = [createDefaultLoenindkomstAnsaettelsesforhold()];
  const af = values.loenindkomstAnsaettelsesforhold[0];
  af.loenperiode = 'maaned';
  af.loenPaaHelligdage = 'SH-udbetaling';
  af.harOverenskomst = false;
  af.tillaegAngivesSom = 'procent';
  af.feriePct = 0;
  af.fritvalgPct = 0;
  af.shSoPct = 0;
  af.storeBededagPct = 0;
  af.pensionPct = 0;
  return { values, af };
};

const julyLoenRow = () => ({
  id: 'loen-juli',
  col0_maaned: '7',
  col1_maaned: '2024',
  col2: asAmount(10000),
});

describe('buildIncomeForRanges – feriedage-fald-tilbage (lønindkomst)', () => {
  it('medregner løn for en periode hvor alle dage er feriedage (ellers ville beløbet forsvinde)', () => {
    const { values, af } = makeArbejdsdageSporValues();
    af.indtaegtsoplysningerTableData = [julyLoenRow()];
    values.ferieperioder = [{ id: 'ferie-juli', fra: iso('2024-07-01'), til: iso('2024-07-31') }];

    // Kontrol: perioden har reelt ingen arbejdsdage – så dagene tælles ikke som arbejdsdage.
    expect(buildLoenArbejdsdageSet({ fra: iso('2024-07-01'), til: iso('2024-07-31') }, values.ferieperioder).size).toBe(0);

    const result = buildIncomeForRanges(values, [{ fra: iso('2024-07-01'), til: iso('2024-07-31') }]);

    expect(result.employers).toHaveLength(1);
    expect(result.employers[0]?.amount).toBeCloseTo(10000, 6);
  });

  it('giver uændret resultat når perioden har almindelige arbejdsdage (ingen fald-tilbage)', () => {
    const { values, af } = makeArbejdsdageSporValues();
    af.indtaegtsoplysningerTableData = [julyLoenRow()];
    // Ingen ferieperioder ⇒ juli har normale arbejdsdage.

    const result = buildIncomeForRanges(values, [{ fra: iso('2024-07-01'), til: iso('2024-07-31') }]);

    expect(result.employers).toHaveLength(1);
    expect(result.employers[0]?.amount).toBeCloseTo(10000, 6);
  });
});

describe('buildIncomeForRanges – fald-tilbage for arbejdsdags-ydelse i ren weekend-periode', () => {
  it('medregner sygedagpenge angivet for en ren weekend (ellers ville beløbet forsvinde)', () => {
    const { values } = makeArbejdsdageSporValues();
    const weekendRow: OffentligeYdelserRow = {
      id: 'oy-weekend',
      fraDato: iso('2024-07-06'), // lørdag
      tilDato: iso('2024-07-07'), // søndag
      ydelsestype: 'sygedagpenge',
      ydelse: asAmount(2000),
    };
    values.offentligeYdelserRows = [weekendRow];

    const result = buildIncomeForRanges(values, [{ fra: iso('2024-07-06'), til: iso('2024-07-07') }]);

    const sygedagpenge = result.benefits.find((benefit) => benefit.typeKey === 'sygedagpenge');
    expect(sygedagpenge?.amount).toBeCloseTo(2000, 6);
  });
});
