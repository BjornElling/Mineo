/**
 * Regressionstest for per-række/per-måned-periodisering i `buildIncomeForRanges`.
 *
 * Låser den bindende adfærd: beløb fra forskellige rækker/måneder periodiseres HVER
 * FOR SIG på rækkens egne dage. Der sker ingen sammenlægning før fordelingen på dage,
 * og der beregnes aldrig ét samlet beløb, som spredes ligeligt over flere måneders dage
 * ("gennemsnitsdage"). Aggregering sker først EFTER periodisering.
 *
 * Konkret scenarie (brugerens formulering): 10.000 i januar + 5.000 i februar → de 10.000
 * lander kun på januars dage, og de 5.000 kun på februars dage.
 */

import type { AmountValue } from '../../../schemas/amountExpressionSchema';
import { toISODateString } from '../../../types/branded';
import {
  createDefaultLoenindkomstAnsaettelsesforhold,
  createErstatningsopgoerelseInitialValues,
} from '../../../domain/erstatningsopgoerelse/helpers/erstatningsopgoerelseInitialValues';
import { buildIncomeForRanges } from '../../../domain/erstatningsopgoerelse/helpers/indtaegtPerioder';

const asAmount = (value: number): AmountValue => ({ kind: 'number', value });
const iso = (value: string) => toISODateString(value);

// Den forkerte "sum-derefter-gennemsnit"-adfærd, som testene bevidst udelukker:
// samlet 15.000 spredt ligeligt over jan (31) + feb (29) = 60 dage, sliced til jan 1-15.
const GENNEMSNIT_WRONG_JAN_1_15 = 15000 * (15 / 60); // = 3750

describe('buildIncomeForRanges – per-række/per-måned-periodisering (lønindkomst)', () => {
  const makeValuesWithTwoMonthlyLoenRows = () => {
    const values = createErstatningsopgoerelseInitialValues();
    // 'Angivet månedsløn' ⇒ beregningsenhed = Måneder ⇒ løn periodiseres på kalenderdage.
    values.beregnesUdFra = 'Angivet månedsløn';
    values.loenindkomstAnsaettelsesforhold = [createDefaultLoenindkomstAnsaettelsesforhold()];
    const af = values.loenindkomstAnsaettelsesforhold[0];
    af.loenperiode = 'maaned';
    af.loenPaaHelligdage = 'SH-udbetaling'; // ingen store bededag-tillæg
    af.harOverenskomst = false;
    af.tillaegAngivesSom = 'procent';
    // Alle satser 0 ⇒ samlet == grundløn, så assertions bliver rene tal.
    af.feriePct = 0;
    af.fritvalgPct = 0;
    af.shSoPct = 0;
    af.storeBededagPct = 0;
    af.pensionPct = 0;
    af.indtaegtsoplysningerTableData = [
      {
        id: 'loen-januar',
        col0_maaned: '1',
        col1_maaned: '2024',
        col0_uge: '',
        col1_uge: '',
        col0_dag: undefined,
        col1_dag: undefined,
        col2: asAmount(10000),
        col3: undefined,
        col4: undefined,
        col5: undefined,
      },
      {
        id: 'loen-februar',
        col0_maaned: '2',
        col1_maaned: '2024',
        col0_uge: '',
        col1_uge: '',
        col0_dag: undefined,
        col1_dag: undefined,
        col2: asAmount(5000),
        col3: undefined,
        col4: undefined,
        col5: undefined,
      },
    ];
    return values;
  };

  it('summerer begge måneder når hele perioden er med', () => {
    const values = makeValuesWithTwoMonthlyLoenRows();
    const income = buildIncomeForRanges(values, [{ fra: iso('2024-01-01'), til: iso('2024-02-29') }]);
    expect(income.employers).toHaveLength(1);
    expect(income.employers[0]?.amount).toBeCloseTo(15000, 8);
  });

  it('kun februar-perioden ⇒ kun februar-lønnen (januar-rækken bidrager ikke)', () => {
    const values = makeValuesWithTwoMonthlyLoenRows();
    const income = buildIncomeForRanges(values, [{ fra: iso('2024-02-01'), til: iso('2024-02-29') }]);
    expect(income.employers[0]?.amount).toBeCloseTo(5000, 8);
  });

  it('kun januar-perioden ⇒ kun januar-lønnen (februar-rækken bidrager ikke)', () => {
    const values = makeValuesWithTwoMonthlyLoenRows();
    const income = buildIncomeForRanges(values, [{ fra: iso('2024-01-01'), til: iso('2024-01-31') }]);
    expect(income.employers[0]?.amount).toBeCloseTo(10000, 8);
  });

  it('halvdelen af januar ⇒ januar-lønnen fordeles på JANUARS dage (15/31), ikke gennemsnit over jan+feb', () => {
    const values = makeValuesWithTwoMonthlyLoenRows();
    const income = buildIncomeForRanges(values, [{ fra: iso('2024-01-01'), til: iso('2024-01-15') }]);
    // Korrekt: 10.000 fordeles kun på januars 31 dage → 15 af dem.
    expect(income.employers[0]?.amount).toBeCloseTo(10000 * (15 / 31), 8);
    // Forkert ("sum 15.000 spredt over 60 dage"): må ALDRIG ske.
    expect(income.employers[0]?.amount).not.toBeCloseTo(GENNEMSNIT_WRONG_JAN_1_15, 8);
  });
});

describe('buildIncomeForRanges – per-række/per-måned-periodisering (offentlige ydelser)', () => {
  // Kontanthjælp periodiseres på kalenderdage (jf. ydelsestyper.ts).
  const makeValuesWithTwoMonthlyBenefitRows = () => {
    const values = createErstatningsopgoerelseInitialValues();
    values.loenindkomstAnsaettelsesforhold = [];
    values.offentligeYdelserRows = [
      {
        id: 'ydelse-januar',
        fraDato: iso('2024-01-01'),
        tilDato: iso('2024-01-31'),
        ydelse: asAmount(10000),
        tillaeg: undefined,
        ydelsestype: 'kontanthjaelp',
      },
      {
        id: 'ydelse-februar',
        fraDato: iso('2024-02-01'),
        tilDato: iso('2024-02-29'),
        ydelse: asAmount(5000),
        tillaeg: undefined,
        ydelsestype: 'kontanthjaelp',
      },
    ];
    return values;
  };

  it('summerer begge måneder (samme ydelsestype aggregeres EFTER periodisering) når hele perioden er med', () => {
    const values = makeValuesWithTwoMonthlyBenefitRows();
    const income = buildIncomeForRanges(values, [{ fra: iso('2024-01-01'), til: iso('2024-02-29') }]);
    const kontanthjaelp = income.benefits.find((b) => b.typeKey === 'kontanthjaelp');
    expect(kontanthjaelp?.amount).toBeCloseTo(15000, 8);
  });

  it('kun februar-perioden ⇒ kun februar-ydelsen', () => {
    const values = makeValuesWithTwoMonthlyBenefitRows();
    const income = buildIncomeForRanges(values, [{ fra: iso('2024-02-01'), til: iso('2024-02-29') }]);
    const kontanthjaelp = income.benefits.find((b) => b.typeKey === 'kontanthjaelp');
    expect(kontanthjaelp?.amount).toBeCloseTo(5000, 8);
  });

  it('halvdelen af januar ⇒ januar-ydelsen fordeles på JANUARS dage (15/31), ikke gennemsnit over jan+feb', () => {
    const values = makeValuesWithTwoMonthlyBenefitRows();
    const income = buildIncomeForRanges(values, [{ fra: iso('2024-01-01'), til: iso('2024-01-15') }]);
    const kontanthjaelp = income.benefits.find((b) => b.typeKey === 'kontanthjaelp');
    // Korrekt: hver række periodiseres på sit eget interval FØR aggregering →
    // kun januar-rækken (10.000/31) rammer januar 1-15; februar-rækken bidrager 0.
    expect(kontanthjaelp?.amount).toBeCloseTo(10000 * (15 / 31), 8);
    // Forkert ("sum 15.000 spredt over 60 dage"): må ALDRIG ske.
    expect(kontanthjaelp?.amount).not.toBeCloseTo(GENNEMSNIT_WRONG_JAN_1_15, 8);
  });
});
