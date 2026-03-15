import { describe, expect, it } from 'vitest';
import type { AmountValue } from '../../../schemas/amountExpressionSchema';
import { ERHVERVSEVNETAB_INITIAL_VALUES } from '../../../domain/erhvervsevnetab/erhvervsevnetabInitialValues';
import { aarsloenMax } from '../../../data/regulationRates';
import { roundByMethod } from '../../../utils/rounding';
import {
  computeEetLoebendeYdelser,
  toAfgoerelseTypeLabel,
} from '../../../domain/erhvervsevnetab/eetLoebendeYdelserCalculation';

const asAmount = (value: number): AmountValue => ({ kind: 'number', value });

describe('computeEetLoebendeYdelser', () => {
  it('beregner løbende ydelser for verificeret eksempel A', () => {
    const result = computeEetLoebendeYdelser({
      erhvervsevnetab: {
        ...ERHVERVSEVNETAB_INITIAL_VALUES,
        beregningsdato: '2026-02-27',
        aslAarsloen: asAmount(489000),
        aslAfgoerelser: [
          {
            id: 'a1',
            afgoerelsesDato: '01-07-2023',
            virkningsDato: '01-02-2023',
            eetPct: '45',
            kapDato: undefined,
            kapPct: undefined,
            afgoerelseType: 'Midlertidig',
            tidlKapDato: undefined,
          },
          {
            id: 'a2',
            afgoerelsesDato: '01-11-2025',
            virkningsDato: '01-10-2025',
            eetPct: '75',
            kapDato: '15-01-2026',
            kapPct: '50',
            afgoerelseType: 'Endelig',
            tidlKapDato: undefined,
          },
        ],
      },
      skadesdato: '2019-04-01',
      fodselsdato: '1980-01-01',
    });

    expect(result.issues.some((issue) => issue.severity === 'error')).toBe(false);
    expect(result.computation).not.toBeNull();

    const computation = result.computation;
    if (!computation) throw new Error('expected computation');

    expect(computation.grundloen).toBe(332955);
    expect(computation.afgoerelser).toHaveLength(2);

    const first = computation.afgoerelser[0];
    expect(first.tilbagevirkendeKraft).toBe(true);
    expect(first.perioder).toHaveLength(3);
    expect(first.perioder[0]?.maanedligYdelse).toBe(15265);
    expect(first.perioder[1]?.maanedligYdelse).toBe(15799);
    expect(first.perioder[2]?.maanedligYdelse).toBe(16415);
    expect(first.iAltBeregnetEet).toBe(505238);

    const second = computation.afgoerelser[1];
    expect(second.restEetPct).toBe(25);
    expect(second.perioder).toHaveLength(3);
    expect(second.perioder[0]?.maanedligYdelse).toBe(27358);
    expect(second.perioder[2]?.maanedligYdelse).toBe(9558);
    expect(second.iAltBeregnetEet).toBe(109482);
  });

  it('giver fejl når kapitaliseringsdato er udfyldt uden kapitaliseringsprocent', () => {
    const result = computeEetLoebendeYdelser({
      erhvervsevnetab: {
        ...ERHVERVSEVNETAB_INITIAL_VALUES,
        beregningsdato: '2026-02-27',
        aslAarsloen: asAmount(400000),
        aslAfgoerelser: [
          {
            id: 'a1',
            afgoerelsesDato: '01-11-2025',
            virkningsDato: '01-10-2025',
            eetPct: '40',
            kapDato: '15-01-2026',
            kapPct: undefined,
            afgoerelseType: 'Endelig',
            tidlKapDato: undefined,
          },
        ],
      },
      skadesdato: '2019-04-01',
      fodselsdato: '1980-01-01',
    });

    expect(result.computation).toBeNull();
    expect(result.issues.some((issue) => issue.message === 'Der er indtastet kapitaliseringsdato men ikke -procent.')).toBe(true);
  });

  it('stopper beregning når endelig afgørelse under 50 % mangler kapitaliseringsoplysninger', () => {
    const result = computeEetLoebendeYdelser({
      erhvervsevnetab: {
        ...ERHVERVSEVNETAB_INITIAL_VALUES,
        beregningsdato: '2026-02-27',
        aslAarsloen: asAmount(400000),
        aslAfgoerelser: [
          {
            id: 'a1',
            afgoerelsesDato: '01-11-2025',
            virkningsDato: '01-10-2025',
            eetPct: '40',
            kapDato: undefined,
            kapPct: undefined,
            afgoerelseType: 'Endelig',
            tidlKapDato: undefined,
          },
        ],
      },
      skadesdato: '2019-04-01',
      fodselsdato: '1980-01-01',
    });

    expect(result.computation).toBeNull();
    expect(
      result.issues.some(
        (issue) =>
          issue.id === 'endelig-under-50-missing-kapitalisering' &&
          issue.message === 'Endelig afgørelse under 50 % mangler oplysninger om kapitalisering.'
      )
    ).toBe(true);
  });

  it('giver advarsel ved ugyldig EET-procent for regler fra 1. juli 2024', () => {
    const result = computeEetLoebendeYdelser({
      erhvervsevnetab: {
        ...ERHVERVSEVNETAB_INITIAL_VALUES,
        beregningsdato: '2026-02-27',
        aslAarsloen: asAmount(401000),
        aslAfgoerelser: [
          {
            id: 'a1',
            afgoerelsesDato: '01-08-2025',
            virkningsDato: '01-08-2025',
            eetPct: '55',
            kapDato: undefined,
            kapPct: undefined,
            afgoerelseType: 'Midlertidig',
            tidlKapDato: undefined,
          },
        ],
      },
      skadesdato: '2024-07-01',
      fodselsdato: '1980-01-01',
    });

    expect(result.computation).not.toBeNull();
    expect(
      result.issues.some(
        (issue) =>
          issue.severity === 'warning' &&
          issue.message === 'Der er indtastet en ugyldig EET-procent (55 %) for skader fra 1. juli 2024.'
      )
    ).toBe(true);
  });

  it('beregner rest-grundydelse proportionalt fra fuld grundydelse', () => {
    const result = computeEetLoebendeYdelser({
      erhvervsevnetab: {
        ...ERHVERVSEVNETAB_INITIAL_VALUES,
        beregningsdato: '2026-02-27',
        aslAarsloen: asAmount(489000),
        aslAfgoerelser: [
          {
            id: 'a1',
            afgoerelsesDato: '01-11-2025',
            virkningsDato: '01-10-2025',
            eetPct: '75',
            kapDato: '15-01-2026',
            kapPct: '50',
            afgoerelseType: 'Endelig',
            tidlKapDato: undefined,
          },
        ],
      },
      skadesdato: '2019-04-01',
      fodselsdato: '1980-01-01',
    });

    expect(result.computation).not.toBeNull();
    const computation = result.computation;
    if (!computation) throw new Error('expected computation');

    const afgoerelse = computation.afgoerelser[0];
    if (!afgoerelse) throw new Error('expected first decision');
    expect(afgoerelse.grundydelseRest).not.toBeNull();

    const expectedRest = roundByMethod(
      afgoerelse.grundydelseFuld * (afgoerelse.restEetPct / afgoerelse.eetPctFoerAktuelKap),
      2,
      'halfAwayFromZero'
    );
    expect(afgoerelse.grundydelseRest).toBe(expectedRest);
  });

  it('fradrager tidligere kapitalisering i efterfølgende afgørelse og reducerer igen ved ny kapitalisering', () => {
    const result = computeEetLoebendeYdelser({
      erhvervsevnetab: {
        ...ERHVERVSEVNETAB_INITIAL_VALUES,
        beregningsdato: '2026-12-31',
        aslAarsloen: asAmount(489000),
        aslAfgoerelser: [
          {
            id: 'a1',
            afgoerelsesDato: '01-07-2023',
            virkningsDato: '01-02-2023',
            eetPct: '60',
            kapDato: '01-10-2023',
            kapPct: '25',
            afgoerelseType: 'Endelig',
            tidlKapDato: undefined,
          },
          {
            id: 'a2',
            afgoerelsesDato: '01-11-2025',
            virkningsDato: '01-10-2025',
            eetPct: '75',
            kapDato: '15-07-2026',
            kapPct: '25',
            afgoerelseType: 'Endelig',
            tidlKapDato: undefined,
          },
        ],
      },
      skadesdato: '2019-04-01',
      fodselsdato: '1980-01-01',
    });

    expect(result.computation).not.toBeNull();
    const computation = result.computation;
    if (!computation) throw new Error('expected computation');

    const second = computation.afgoerelser[1];
    if (!second) throw new Error('expected second decision');

    expect(second.priorKapPct).toBe(25);
    expect(second.eetPctFoerAktuelKap).toBe(50);
    expect(second.restEetPct).toBe(25);
    expect(second.harRestSektion).toBe(true);
    expect(second.grundydelseFuld).toBe(roundByMethod(computation.grundloen * 0.5 * 0.83 * 0.92, 2, 'halfAwayFromZero'));

    const beforeKapRow = second.perioder.find((row) => row.til === '2026-07-14');
    const afterKapRow = second.perioder.find((row) => row.fra === '2026-07-15');
    if (!beforeKapRow || !afterKapRow) throw new Error('expected split rows around kapitaliseringsdato');

    expect(afterKapRow.maanedligYdelse).toBeLessThan(beforeKapRow.maanedligYdelse);
  });

  it('giver advarsel når midlertidig/delvist endelig ligger efter en endelig afgørelse', () => {
    const result = computeEetLoebendeYdelser({
      erhvervsevnetab: {
        ...ERHVERVSEVNETAB_INITIAL_VALUES,
        beregningsdato: '2026-02-27',
        aslAarsloen: asAmount(450000),
        aslAfgoerelser: [
          {
            id: 'a1',
            afgoerelsesDato: '01-01-2024',
            virkningsDato: '01-01-2024',
            eetPct: '60',
            kapDato: undefined,
            kapPct: undefined,
            afgoerelseType: 'Endelig',
            tidlKapDato: undefined,
          },
          {
            id: 'a2',
            afgoerelsesDato: '01-06-2024',
            virkningsDato: '01-06-2024',
            eetPct: '45',
            kapDato: undefined,
            kapPct: undefined,
            afgoerelseType: 'Midlertidig',
            tidlKapDato: undefined,
          },
        ],
      },
      skadesdato: '2019-04-01',
      fodselsdato: '1980-01-01',
    });

    expect(result.issues.some((issue) => issue.id === 'warn-non-endelig-after-endelig')).toBe(true);
  });

  it('stopper fail-closed når reguleringssats mangler for et nødvendigt år', () => {
    const result = computeEetLoebendeYdelser({
      erhvervsevnetab: {
        ...ERHVERVSEVNETAB_INITIAL_VALUES,
        beregningsdato: '2027-12-31',
        aslAarsloen: asAmount(500000),
        aslAfgoerelser: [
          {
            id: 'a1',
            afgoerelsesDato: '01-01-2027',
            virkningsDato: '01-01-2027',
            eetPct: '40',
            kapDato: undefined,
            kapPct: undefined,
            afgoerelseType: 'Midlertidig',
            tidlKapDato: undefined,
          },
        ],
      },
      skadesdato: '2024-07-01',
      fodselsdato: '1980-01-01',
    });

    expect(result.computation).toBeNull();
    expect(result.issues.some((issue) => issue.id === 'reguleringssats-missing-2027')).toBe(true);
  });

  it('samler tilbagevirkende perioder over flere år under afgørelsesårets sats', () => {
    const result = computeEetLoebendeYdelser({
      erhvervsevnetab: {
        ...ERHVERVSEVNETAB_INITIAL_VALUES,
        beregningsdato: '2026-02-01',
        aslAarsloen: asAmount(489000),
        aslAfgoerelser: [
          {
            id: 'a1',
            afgoerelsesDato: '01-06-2024',
            virkningsDato: '01-03-2022',
            eetPct: '40',
            kapDato: undefined,
            kapPct: undefined,
            afgoerelseType: 'Midlertidig',
            tidlKapDato: undefined,
          },
        ],
      },
      skadesdato: '2019-04-01',
      fodselsdato: '1980-01-01',
    });

    expect(result.computation).not.toBeNull();
    const computation = result.computation;
    if (!computation) throw new Error('expected computation');
    const afgoerelse = computation.afgoerelser[0];
    if (!afgoerelse) throw new Error('expected first decision');

    expect(afgoerelse.tilbagevirkendeKraft).toBe(true);
    expect(afgoerelse.perioder).toHaveLength(3);
    expect(afgoerelse.perioder[0]?.fra).toBe('2022-03-01');
    expect(afgoerelse.perioder[0]?.til).toBe('2024-12-31');
    expect(afgoerelse.perioder[0]?.satsAar).toBe(2024);
    expect(afgoerelse.perioder[1]?.fra).toBe('2025-01-01');
    expect(afgoerelse.perioder[1]?.satsAar).toBe(2025);
    expect(afgoerelse.perioder[2]?.fra).toBe('2026-01-01');
    expect(afgoerelse.perioder[2]?.til).toBe('2026-02-01');
    expect(afgoerelse.perioder[2]?.satsAar).toBe(2026);
  });

  it('anvender 2024-niveau grundløn for skade fra 1. juli 2024', () => {
    const result = computeEetLoebendeYdelser({
      erhvervsevnetab: {
        ...ERHVERVSEVNETAB_INITIAL_VALUES,
        beregningsdato: '2026-12-31',
        aslAarsloen: asAmount(401000),
        aslAfgoerelser: [
          {
            id: 'a1',
            afgoerelsesDato: '01-01-2026',
            virkningsDato: '01-01-2026',
            eetPct: '40',
            kapDato: undefined,
            kapPct: undefined,
            afgoerelseType: 'Midlertidig',
            tidlKapDato: undefined,
          },
        ],
      },
      skadesdato: '2024-07-01',
      fodselsdato: '1980-01-01',
    });

    expect(result.computation).not.toBeNull();
    const computation = result.computation;
    if (!computation) throw new Error('expected computation');
    const afgoerelse = computation.afgoerelser[0];
    if (!afgoerelse) throw new Error('expected first decision');

    expect(computation.grundloenNiveau).toBe('2024');
    expect(computation.grundloen).toBe(401000);
    expect(afgoerelse.grundydelseFuld).toBe(roundByMethod(401000 * 0.4 * 0.83 * 0.92, 2, 'halfAwayFromZero'));
    expect(afgoerelse.perioder[0]?.maanedligYdelse).toBe(11116);
  });

  it('anvender 80 % uden AM-bidrag for skade før 2011', () => {
    const result = computeEetLoebendeYdelser({
      erhvervsevnetab: {
        ...ERHVERVSEVNETAB_INITIAL_VALUES,
        beregningsdato: '2026-12-31',
        aslAarsloen: asAmount(401000),
        aslAfgoerelser: [
          {
            id: 'a1',
            afgoerelsesDato: '01-01-2026',
            virkningsDato: '01-01-2026',
            eetPct: '40',
            kapDato: undefined,
            kapPct: undefined,
            afgoerelseType: 'Midlertidig',
            tidlKapDato: undefined,
          },
        ],
      },
      skadesdato: '2009-01-01',
      fodselsdato: '1980-01-01',
    });

    expect(result.computation).not.toBeNull();
    const computation = result.computation;
    if (!computation) throw new Error('expected computation');
    const afgoerelse = computation.afgoerelser[0];
    if (!afgoerelse) throw new Error('expected first decision');

    expect(computation.erstatningsniveauPct).toBe(80);
    expect(computation.amBidragPct).toBe(0);
    expect(computation.grundloen).toBe(339094);
    expect(afgoerelse.grundydelseFuld).toBe(roundByMethod(339094 * 0.4 * 0.8, 2, 'halfAwayFromZero'));
  });

  it('opregulerer præ-2024-skade til 2024-niveau uden ekstra 2024-sats i periodefaktoren', () => {
    const result = computeEetLoebendeYdelser({
      erhvervsevnetab: {
        ...ERHVERVSEVNETAB_INITIAL_VALUES,
        beregningsdato: '2024-12-31',
        aslAarsloen: asAmount(489000),
        aslAfgoerelser: [
          {
            id: 'a1',
            afgoerelsesDato: '01-01-2024',
            virkningsDato: '01-01-2024',
            eetPct: '40',
            kapDato: undefined,
            kapPct: undefined,
            afgoerelseType: 'Midlertidig',
            tidlKapDato: undefined,
          },
        ],
      },
      skadesdato: '2019-04-01',
      fodselsdato: '1980-01-01',
    });

    expect(result.issues.some((issue) => issue.severity === 'error')).toBe(false);
    const periode = result.computation?.afgoerelser[0]?.perioder[0];
    expect(periode?.satsAar).toBe(2024);
    expect(periode?.reguleringPct).toBe(0);
    expect(periode?.grundydelseAfrundet).toBe(168513.22);
    expect(periode?.maanedligYdelse).toBe(14043);
  });

  it('fastsaetter tvungen kapitalisering ud fra bekendtgoerelsen paa afgoerelsestidspunktet', () => {
    const result = computeEetLoebendeYdelser({
      erhvervsevnetab: {
        ...ERHVERVSEVNETAB_INITIAL_VALUES,
        beregningsdato: '2021-12-31',
        aslAarsloen: asAmount(401000),
        aslAfgoerelser: [
          {
            id: 'a1',
            afgoerelsesDato: '01-08-2021',
            virkningsDato: '01-08-2021',
            eetPct: '60',
            kapDato: undefined,
            kapPct: undefined,
            afgoerelseType: 'Endelig',
            tidlKapDato: undefined,
          },
        ],
      },
      skadesdato: '2019-04-01',
      fodselsdato: '1955-07-01',
    });

    expect(result.computation).not.toBeNull();
    const computation = result.computation;
    if (!computation) throw new Error('expected computation');
    const afgoerelse = computation.afgoerelser[0];
    if (!afgoerelse) throw new Error('expected first decision');

    expect(afgoerelse.ophoerAarsag).toBe('tvungen-kapitalisering');
    expect(afgoerelse.ophoerDato).toBe('2020-06-30');
  });
});

describe('toAfgoerelseTypeLabel', () => {
  it('viser korrekt label for endelig afgørelse med og uden kapitalisering', () => {
    expect(toAfgoerelseTypeLabel('Midlertidig', false, false)).toBe('Midlertidig afgørelse');
    expect(toAfgoerelseTypeLabel('Delvist endelig', true, true)).toBe('Delvist endelig afgørelse');
    expect(toAfgoerelseTypeLabel('Endelig', false, false)).toBe('Endelig afgørelse');
    expect(toAfgoerelseTypeLabel('Endelig', false, true)).toBe('Endelig afgørelse (kapitaliseret)');
    expect(toAfgoerelseTypeLabel('Endelig', true, true)).toBe('Endelig afgørelse (delvist kap.)');
  });
});

describe('warn-asl-aarsloen-is-max', () => {
  it('viser advarsel når indtastet årsløn er præcis lig maksimum for skadesåret', () => {
    const maxAarsloen2019 = aarsloenMax[2019];
    if (!Number.isFinite(maxAarsloen2019)) throw new Error('expected max salary for 2019');

    const result = computeEetLoebendeYdelser({
      erhvervsevnetab: {
        ...ERHVERVSEVNETAB_INITIAL_VALUES,
        beregningsdato: '2026-02-27',
        aslAarsloen: asAmount(maxAarsloen2019),
        aslAfgoerelser: [
          {
            id: 'a1',
            afgoerelsesDato: '01-07-2023',
            virkningsDato: '01-02-2023',
            eetPct: '20',
            kapDato: undefined,
            kapPct: undefined,
            afgoerelseType: 'Midlertidig',
            tidlKapDato: undefined,
          },
        ],
      },
      skadesdato: '2019-04-01',
      fodselsdato: '1980-01-01',
    });

    expect(result.issues.some((issue) => issue.id === 'warn-asl-aarsloen-is-max')).toBe(true);
  });

  it('viser ikke advarsel når indtastet årsløn er højere end maksimum for skadesåret', () => {
    const maxAarsloen2019 = aarsloenMax[2019];
    if (!Number.isFinite(maxAarsloen2019)) throw new Error('expected max salary for 2019');

    const result = computeEetLoebendeYdelser({
      erhvervsevnetab: {
        ...ERHVERVSEVNETAB_INITIAL_VALUES,
        beregningsdato: '2026-02-27',
        aslAarsloen: asAmount(maxAarsloen2019 + 1),
        aslAfgoerelser: [
          {
            id: 'a1',
            afgoerelsesDato: '01-07-2023',
            virkningsDato: '01-02-2023',
            eetPct: '20',
            kapDato: undefined,
            kapPct: undefined,
            afgoerelseType: 'Midlertidig',
            tidlKapDato: undefined,
          },
        ],
      },
      skadesdato: '2019-04-01',
      fodselsdato: '1980-01-01',
    });

    expect(result.issues.some((issue) => issue.id === 'warn-asl-aarsloen-is-max')).toBe(false);
  });
});
