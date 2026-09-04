import type { AmountValue } from '../../../schemas/amountExpressionSchema';
import { computeForsoergertabCalculation } from '../../../domain/forsoergertab/forsoergertabCalculation';
import { computeForsoergertabAslYdelser } from '../../../domain/forsoergertab/forsoergertabAslYdelser';
import { computeForsoergertabEalKrav } from '../../../domain/forsoergertab/forsoergertabEalKrav';
import { opregulerMedAslAarsloensmaksimum } from '../../../domain/satser/opreguleringsmotorer';
import { aarsloenAslMax, erhvervsevnetabEalMax, foersoergertabEalMin } from '../../../data/lovbestemteRates';
import { round0, round2, round4 } from '../../../utils/roundingShortcuts';
import { toISODateString } from '../../../types/branded';
import { toKroner } from '../../../domain/money/money';

const asAmount = (value: number): AmountValue => ({ kind: 'number', value });

/**
 * Disse tests måler motorens egen beregning på GYLDIGT input, så ingen dependency-gruppe er blokeret.
 * Gate-flagene er påkrævede (§3.9), netop for at et udeladt flag ikke lydløst kan åbne motoren igen.
 */
const NOT_BLOCKED = { ealBlocked: false, aslBlocked: false } as const;

describe('computeForsoergertabCalculation', () => {
  it('beregner den løbende ASL-ydelse som 30 pct. af den opregulerede ASL-årsløn', () => {
    const result = computeForsoergertabCalculation({ ...NOT_BLOCKED,
      skadedato: toISODateString('2020-05-01'),
      skadelidteFodselsdato: toISODateString('1980-01-01'),
      efterladteFodselsdato: toISODateString('1973-01-01'),
      beregningsdato: toISODateString('2026-03-19'),
      virkningsdato: toISODateString('2025-01-01'),
      koen: 'Kvinde',
      tilkendtForPeriodeAar: 10,
      aslAarsloen: asAmount(450000),
      ealAarsloen: asAmount(450000),
    });

    expect(result.aslComputation).not.toBeNull();
    const computation = result.aslComputation!;
    const expectedBenyttetAarsloen = 450000;
    const expectedOpreguleringsfaktor = aarsloenAslMax[2026] / aarsloenAslMax[2020];
    const expectedOpreguleretAarligYdelse = round2(0.3 * expectedBenyttetAarsloen * expectedOpreguleringsfaktor);

    expect(computation.benyttetAarsloen).toBe(expectedBenyttetAarsloen);
    expect(computation.aarsloenMaxSkadesaar).toBe(aarsloenAslMax[2020]);
    expect(computation.aarsloenMaxBeregningsaar).toBe(aarsloenAslMax[2026]);
    expect(computation.opreguleringsfaktor).toBe(expectedOpreguleringsfaktor);
    expect(computation.opreguleretAarligYdelse).toBe(expectedOpreguleretAarligYdelse);
    // Delegerings-identitet: faktoren skal være tal-identisk med den fælles motors
    // output (ikke kun den manuelt reproducerede formel). Låser at callsite og motor
    // ikke kan drive fra hinanden – fx hvis motorens afrunding ændres.
    expect(computation.opreguleringsfaktor).toBe(
      opregulerMedAslAarsloensmaksimum({ kildeAar: 2020, maalAar: 2026 }).faktor
    );
  });

  it('blokerer direkte ASL-beregning når årslønnen overstiger skadesårets maksimum', () => {
    const result = computeForsoergertabCalculation({ ...NOT_BLOCKED,
      skadedato: toISODateString('2020-05-01'),
      skadelidteFodselsdato: toISODateString('1980-01-01'),
      efterladteFodselsdato: toISODateString('1973-01-01'),
      beregningsdato: toISODateString('2026-03-19'),
      virkningsdato: toISODateString('2025-01-01'),
      koen: 'Kvinde',
      tilkendtForPeriodeAar: 10,
      aslAarsloen: asAmount(aarsloenAslMax[2020]! + 1000),
      ealAarsloen: asAmount(450000),
    });

    expect(result.aslComputation).toBeNull();
    expect(result.issues).toContainEqual({
      id: 'asl-aarsloen-over-max',
      severity: 'error',
      message: 'Skadelidtes årsløn (efter ASL) kan ikke overstige maks årslønnen i skadesåret (551.000 kr.)',
    });
  });

  it('kræver køn og slår korrekt op i kønsafhængige tabeller før 1. marts 2015', () => {
    const commonInput = {
      skadedato: toISODateString('2008-01-10'),
      skadelidteFodselsdato: toISODateString('1980-01-01'),
      efterladteFodselsdato: toISODateString('1973-01-01'),
      beregningsdato: toISODateString('2014-02-15'),
      virkningsdato: toISODateString('2013-01-01'),
      tilkendtForPeriodeAar: 10,
      aslAarsloen: asAmount(400000),
      ealAarsloen: asAmount(400000),
    };

    const missingKoen = computeForsoergertabCalculation({ ...NOT_BLOCKED,
      ...commonInput,
      koen: undefined,
    });
    expect(missingKoen.result).toBeNull();
    expect(missingKoen.issues.some((issue) => issue.id === 'missing-koen')).toBe(true);

    const mand = computeForsoergertabCalculation({ ...NOT_BLOCKED,
      ...commonInput,
      koen: 'Mand',
    });
    const kvinde = computeForsoergertabCalculation({ ...NOT_BLOCKED,
      ...commonInput,
      koen: 'Kvinde',
    });

    expect(mand.aslComputation?.kapitaliseringsbekendtgoerelseId).toBe('1403/2011');
    expect(mand.aslComputation?.kapitaliseringsTabel).toBe('F');
    expect(kvinde.aslComputation?.kapitaliseringsTabel).toBe('G');
    expect(mand.aslComputation?.kapitalbelob).not.toBe(kvinde.aslComputation?.kapitalbelob);
  });

  it('giver blokerende fejl når beregningsdato er før virkningsdato', () => {
    const result = computeForsoergertabCalculation({ ...NOT_BLOCKED,
      skadedato: toISODateString('2020-01-01'),
      skadelidteFodselsdato: toISODateString('1980-01-01'),
      efterladteFodselsdato: toISODateString('1980-01-01'),
      beregningsdato: toISODateString('2020-01-01'),
      virkningsdato: toISODateString('2020-02-01'),
      koen: 'Mand',
      tilkendtForPeriodeAar: 5,
      aslAarsloen: asAmount(400000),
      ealAarsloen: asAmount(400000),
    });

    expect(result.result).toBeNull();
    expect(result.issues).toContainEqual({
      id: 'beregningsdato-before-virkningsdato',
      severity: 'error',
      message: 'Beregningsdato må ikke være før virkningsdato.',
    });
  });

  it('sætter ASL-kapitalbeløbet til 0 når folkepensionsalderen er nået på beregningsdatoen', () => {
    const result = computeForsoergertabCalculation({ ...NOT_BLOCKED,
      skadedato: toISODateString('2025-01-01'),
      skadelidteFodselsdato: toISODateString('1980-01-01'),
      efterladteFodselsdato: toISODateString('1950-01-01'),
      beregningsdato: toISODateString('2026-03-01'),
      virkningsdato: toISODateString('2025-01-01'),
      koen: 'Kvinde',
      tilkendtForPeriodeAar: 10,
      aslAarsloen: asAmount(500000),
      ealAarsloen: asAmount(500000),
    });

    expect(result.aslComputation?.harNaaetFolkepensionsalder).toBe(true);
    expect(result.aslComputation?.kapitalbelob).toBe(0);
    expect(result.result?.aslKapitalbelob).toBe(0);
  });

  it('kræver eksakt aldersmatch i forsørgertabstabellen', () => {
    const result = computeForsoergertabCalculation({ ...NOT_BLOCKED,
      skadedato: toISODateString('2008-01-01'),
      skadelidteFodselsdato: toISODateString('1980-01-01'),
      efterladteFodselsdato: toISODateString('1997-06-01'),
      beregningsdato: toISODateString('2014-02-15'),
      virkningsdato: toISODateString('2013-01-01'),
      koen: 'Mand',
      tilkendtForPeriodeAar: 5,
      aslAarsloen: asAmount(400000),
      ealAarsloen: asAmount(400000),
    });

    expect(result.result).toBeNull();
    expect(result.issues.some((issue) => issue.id === 'forsoergertab-alder-missing')).toBe(true);
  });

  it('bruger kønsneutral forsørgertabstabel fra og med 1. marts 2015 uden køn', () => {
    const result = computeForsoergertabCalculation({ ...NOT_BLOCKED,
      skadedato: toISODateString('2014-01-10'),
      skadelidteFodselsdato: toISODateString('1980-01-01'),
      efterladteFodselsdato: toISODateString('1970-01-01'),
      beregningsdato: toISODateString('2015-03-01'),
      virkningsdato: toISODateString('2014-03-01'),
      koen: undefined,
      tilkendtForPeriodeAar: 5,
      aslAarsloen: asAmount(400000),
      ealAarsloen: asAmount(400000),
    });

    expect(result.issues.some((issue) => issue.id === 'missing-koen')).toBe(false);
    expect(result.aslComputation?.kapitaliseringsTabelKoensopdelt).toBe(false);
    expect(result.aslComputation?.kapitaliseringsTabel).toBeTruthy();
  });

  it('clamp er nettokrav til 0 når ASL-kapitalbeløbet overstiger EAL-kravet', () => {
    const result = computeForsoergertabCalculation({ ...NOT_BLOCKED,
      skadedato: toISODateString('2020-05-01'),
      skadelidteFodselsdato: toISODateString('1980-01-01'),
      efterladteFodselsdato: toISODateString('1976-01-01'),
      beregningsdato: toISODateString('2026-03-19'),
      virkningsdato: toISODateString('2025-01-01'),
      koen: undefined,
      tilkendtForPeriodeAar: 10,
      aslAarsloen: asAmount(aarsloenAslMax[2020]!),
      ealAarsloen: asAmount(100000),
    });

    expect(result.result).not.toBeNull();
    expect(result.result?.aslKapitalbelob).toBeGreaterThan(result.result?.ealKrav ?? 0);
    expect(result.result?.nettokrav).toBe(0);
  });
});

describe('computeForsoergertabAslYdelser', () => {
  it('afviser ikke-positive ASL-årslønsmaksimum før opreguleringsdivision', () => {
    const original = aarsloenAslMax[2020];
    aarsloenAslMax[2020] = 0;

    try {
      const result = computeForsoergertabAslYdelser({
        skadedato: toISODateString('2020-05-01'),
        beregningsdato: toISODateString('2026-03-19'),
        virkningsdato: toISODateString('2025-01-01'),
        efterladteFodselsdato: toISODateString('1976-01-01'),
        koen: undefined,
        tilkendtForPeriodeAar: 10,
        aslAarsloen: asAmount(450000),
      });

      expect(result.computation).toBeNull();
      expect(result.issues).toContainEqual({
        id: 'aarsloen-max-missing-skadesaar',
        severity: 'error',
        message: 'ASL-maks-sats mangler for år 2020 (satser findes kun for 2005–2026).',
      });
    } finally {
      aarsloenAslMax[2020] = original;
    }
  });

  it('sætter kapitalbeløbet til 0 når resterende periode er 0 måneder', () => {
    const result = computeForsoergertabAslYdelser({
      skadedato: toISODateString('2020-05-01'),
      beregningsdato: toISODateString('2026-01-01'),
      virkningsdato: toISODateString('2025-01-01'),
      efterladteFodselsdato: toISODateString('1976-01-01'),
      koen: undefined,
      tilkendtForPeriodeAar: 1,
      aslAarsloen: asAmount(450000),
    });

    expect(result.computation).not.toBeNull();
    expect(result.computation?.resterendeMaanederTotal).toBe(0);
    expect(result.computation?.kapitalfaktor).toBeNull();
    expect(result.computation?.kapitalbelob).toBe(0);
  });

  it('interpolerer lineært for 0 år og 9 måneder', () => {
    // De konkrete faktorværdier følger de nuværende kapitaliseringstabeller og skal opdateres,
    // hvis datagrundlaget ændres legitimt.
    const exactOneYear = computeForsoergertabAslYdelser({
      skadedato: toISODateString('2020-05-01'),
      beregningsdato: toISODateString('2026-03-19'),
      virkningsdato: toISODateString('2025-04-01'),
      efterladteFodselsdato: toISODateString('1976-01-01'),
      koen: undefined,
      tilkendtForPeriodeAar: 2,
      aslAarsloen: asAmount(450000),
    });
    const result = computeForsoergertabAslYdelser({
      skadedato: toISODateString('2020-05-01'),
      beregningsdato: toISODateString('2026-03-19'),
      virkningsdato: toISODateString('2026-01-01'),
      efterladteFodselsdato: toISODateString('1976-01-01'),
      koen: undefined,
      tilkendtForPeriodeAar: 1,
      aslAarsloen: asAmount(450000),
    });

    expect(result.computation).not.toBeNull();
    expect(exactOneYear.computation?.kapitalfaktor).not.toBeNull();
    expect(result.computation?.resterendeAar).toBe(0);
    expect(result.computation?.resterendeMaaneder).toBe(9);
    expect(result.computation?.kapitalfaktor).toBe(0.469);
    expect(result.computation?.kapitalfaktor).toBe(
      Number(((exactOneYear.computation?.kapitalfaktor ?? 0) * (9 / 12)).toFixed(3))
    );
  });

  it('interpolerer lineært for 2 år og 6 måneder', () => {
    // De konkrete faktorværdier følger de nuværende kapitaliseringstabeller og skal opdateres,
    // hvis datagrundlaget ændres legitimt.
    const exactTwoYears = computeForsoergertabAslYdelser({
      skadedato: toISODateString('2020-05-01'),
      beregningsdato: toISODateString('2026-03-19'),
      virkningsdato: toISODateString('2025-04-01'),
      efterladteFodselsdato: toISODateString('1976-01-01'),
      koen: undefined,
      tilkendtForPeriodeAar: 3,
      aslAarsloen: asAmount(450000),
    });
    const exactThreeYears = computeForsoergertabAslYdelser({
      skadedato: toISODateString('2020-05-01'),
      beregningsdato: toISODateString('2026-03-19'),
      virkningsdato: toISODateString('2025-04-01'),
      efterladteFodselsdato: toISODateString('1976-01-01'),
      koen: undefined,
      tilkendtForPeriodeAar: 4,
      aslAarsloen: asAmount(450000),
    });
    const result = computeForsoergertabAslYdelser({
      skadedato: toISODateString('2020-05-01'),
      beregningsdato: toISODateString('2026-03-19'),
      virkningsdato: toISODateString('2025-10-01'),
      efterladteFodselsdato: toISODateString('1976-01-01'),
      koen: undefined,
      tilkendtForPeriodeAar: 3,
      aslAarsloen: asAmount(450000),
    });

    expect(result.computation).not.toBeNull();
    expect(exactTwoYears.computation?.kapitalfaktor).not.toBeNull();
    expect(exactThreeYears.computation?.kapitalfaktor).not.toBeNull();
    expect(result.computation?.resterendeAar).toBe(2);
    expect(result.computation?.resterendeMaaneder).toBe(6);
    expect(result.computation?.kapitalfaktor).toBe(1.572);
    expect(result.computation?.kapitalfaktor).toBe(
      Number(
        (
          (exactTwoYears.computation?.kapitalfaktor ?? 0) +
          ((exactThreeYears.computation?.kapitalfaktor ?? 0) - (exactTwoYears.computation?.kapitalfaktor ?? 0)) * 0.5
        ).toFixed(3)
      )
    );
  });

  it('afrunder kapitalbeløbet opad med ceil0', () => {
    const result = computeForsoergertabAslYdelser({
      skadedato: toISODateString('2020-05-01'),
      beregningsdato: toISODateString('2026-03-19'),
      virkningsdato: toISODateString('2025-10-01'),
      efterladteFodselsdato: toISODateString('1976-01-01'),
      koen: undefined,
      tilkendtForPeriodeAar: 3,
      aslAarsloen: asAmount(450000),
    });

    expect(result.computation).not.toBeNull();
    const computation = result.computation!;
    const nonRounded = computation.opreguleretAarligYdelse * (computation.kapitalfaktor ?? 0);

    expect(nonRounded % 1).not.toBe(0);
    expect(computation.kapitalbelob).toBe(Math.ceil(nonRounded));
  });

  it('tæller allerede udbetalte måneder dagbaseret – én dag er 1/31 måned, ikke en hel måned', () => {
    // TÆLLEMETODE (afgjort 2026-09-04): de udbetalte måneder er tabellens egen dagbaserede sum.
    // Virkningsdato = beregningsdato = 1. marts er ÉN dag af martsʼ 31, altså 0,0323 måneder – ikke
    // den hele kalendermåned, den tidligere optælling gav.
    const result = computeForsoergertabAslYdelser({
      skadedato: toISODateString('2020-05-01'),
      beregningsdato: toISODateString('2026-03-01'),
      virkningsdato: toISODateString('2026-03-01'),
      efterladteFodselsdato: toISODateString('1976-01-01'),
      koen: undefined,
      tilkendtForPeriodeAar: 1,
      aslAarsloen: asAmount(450000),
    });

    expect(result.computation).not.toBeNull();
    expect(result.computation?.alleredeUdbetaltMaaneder).toBe(round4(1 / 31));
    expect(result.computation?.resterendeMaanederTotal).toBe(round4(12 - 1 / 31));
  });

  it('læser de udbetalte måneder af tabellens egen sum, så de to halvdele ikke kan drifte', () => {
    // Fladens to halvdele brugte før hver sin læsning: tabellen dagbaseret, kapitalfaktoren hele
    // kalendermåneder. Denne test låser, at der nu kun er ÉN kilde til tallet.
    const result = computeForsoergertabAslYdelser({
      skadedato: toISODateString('2020-06-10'),
      beregningsdato: toISODateString('2025-07-01'),
      virkningsdato: toISODateString('2020-06-10'),
      efterladteFodselsdato: toISODateString('1978-08-20'),
      koen: undefined,
      tilkendtForPeriodeAar: 10,
      aslAarsloen: asAmount(400000),
    });

    expect(result.computation).not.toBeNull();
    const computation = result.computation!;
    const tabelSum = round4(computation.lobendeYdelser.reduce((sum, r) => sum + r.maaneder, 0));

    expect(computation.alleredeUdbetaltMaaneder).toBe(tabelSum);
    // Den målte sag fra brugerblik-gennemgangen: 60,7323 udbetalt, 59,2677 tilbage – ikke 62/58.
    expect(computation.alleredeUdbetaltMaaneder).toBe(60.7323);
    expect(computation.resterendeMaanederTotal).toBe(59.2677);
    // Tabelopslaget afkorter til hele år og måneder: 4 år og 11 måneder.
    expect(computation.resterendeAar).toBe(4);
    expect(computation.resterendeMaaneder).toBe(11);
  });

  it('afviser ugyldig tilkendt periode i domænelaget', () => {
    const result = computeForsoergertabAslYdelser({
      skadedato: toISODateString('2020-05-01'),
      beregningsdato: toISODateString('2026-03-19'),
      virkningsdato: toISODateString('2026-01-01'),
      efterladteFodselsdato: toISODateString('1976-01-01'),
      koen: undefined,
      tilkendtForPeriodeAar: 0,
      aslAarsloen: asAmount(450000),
    });

    expect(result.computation).toBeNull();
    expect(result.issues).toContainEqual({
      id: 'tilkendt-for-periode-invalid',
      severity: 'error',
      message: 'Tilkendt periode skal være mindst 1 år.',
    });
  });

  it('afkorter lobendeYdelser ved periodens naturlige slutdato når den falder før beregningsdato', () => {
    // virkningsdato 2025-01-01 + 1 år = periodens slutdato 2025-12-31
    // beregningsdato 2026-03-19 er efter periodens slutdato
    // lobendeYdelser skal stoppe ved 2025-12-31, ikke ved 2026-03-18
    const result = computeForsoergertabAslYdelser({
      skadedato: toISODateString('2020-05-01'),
      beregningsdato: toISODateString('2026-03-19'),
      virkningsdato: toISODateString('2025-01-01'),
      efterladteFodselsdato: toISODateString('1976-01-01'),
      koen: undefined,
      tilkendtForPeriodeAar: 1,
      aslAarsloen: asAmount(450000),
    });

    expect(result.computation).not.toBeNull();
    const ydelser = result.computation!.lobendeYdelser;
    expect(ydelser.length).toBeGreaterThan(0);
    const sidsteRaekke = ydelser[ydelser.length - 1];
    expect(sidsteRaekke!.tilDato).toBe(toISODateString('2025-12-31'));
    // resterendeMaanederTotal skal være 0 fordi perioden er udløbet
    expect(result.computation!.resterendeMaanederTotal).toBe(0);
  });

  it('beregner korrekt delvis første måned når virkningsdato er midt i måneden', () => {
    // virkningsdato 2025-03-15: 17 dage ud af 31 i marts = 17/31 måneder (afrundet til 4 decimaler)
    // beregningsdato 2025-03-31 (samme måned): 17 dage ud af 31
    const result = computeForsoergertabAslYdelser({
      skadedato: toISODateString('2020-05-01'),
      beregningsdato: toISODateString('2025-03-31'),
      virkningsdato: toISODateString('2025-03-15'),
      efterladteFodselsdato: toISODateString('1976-01-01'),
      koen: undefined,
      tilkendtForPeriodeAar: 1,
      aslAarsloen: asAmount(450000),
    });

    expect(result.computation).not.toBeNull();
    const ydelser = result.computation!.lobendeYdelser;
    expect(ydelser.length).toBe(1);
    const raekke = ydelser[0]!;
    expect(raekke.fraDato).toBe(toISODateString('2025-03-15'));
    expect(raekke.tilDato).toBe(toISODateString('2025-03-31'));
    // 17 dage ud af 31 dage i marts
    const forventetMaaneder = Math.round((17 / 31) * 10000) / 10000;
    expect(raekke.maaneder).toBe(forventetMaaneder);
  });
});

describe('computeForsoergertabAslYdelser – de-regulering af løbende ydelser før skadeår', () => {
  // De løbende ydelser opreguleres direkte (idx[år] / idx[skadeår]) og IKKE via
  // opreguleringsmotorens "kun frem i tid"-clamp, netop fordi et ydelsesår kan
  // ligge FØR skadeåret. I så fald er faktoren < 1 (de-regulering). Denne test
  // låser at de-reguleringen bevares og ikke clampes til 1.
  it('anvender faktor < 1 for et løbende-ydelses-år der ligger før skadeåret', () => {
    const benyttetAarsloen = 450000; // < aarsloenAslMax[skadeår], så benyttes uændret
    const skadesaar = 2023;
    const ydelsesAar = 2021; // før skadeår
    const result = computeForsoergertabAslYdelser({
      skadedato: toISODateString('2023-06-01'),
      beregningsdato: toISODateString('2024-06-01'),
      virkningsdato: toISODateString('2021-01-01'),
      efterladteFodselsdato: toISODateString('1976-01-01'),
      koen: undefined,
      tilkendtForPeriodeAar: 10,
      aslAarsloen: asAmount(benyttetAarsloen),
    });

    expect(result.computation).not.toBeNull();
    const ydelser = result.computation!.lobendeYdelser;
    const raekke2021 = ydelser.find((r) => r.fraDato.startsWith('2021'));
    expect(raekke2021).toBeDefined();

    // De-reguleret månedlig ydelse: 30 % af benyttet årsløn skaleret med idx[2021]/idx[2023] (< 1).
    const deRegFaktor = aarsloenAslMax[ydelsesAar]! / aarsloenAslMax[skadesaar]!;
    expect(deRegFaktor).toBeLessThan(1);
    const ceilNearest12 = (v: number) => Math.ceil(v / 12) * 12;
    const forventetMaanedlig = ceilNearest12(0.3 * benyttetAarsloen * deRegFaktor) / 12;
    expect(raekke2021!.maanedligYdelse).toBe(forventetMaanedlig);

    // Skadeårets række bruger den u-regulerede grundydelse – bekræfter at 2021-rækken er lavere.
    const raekke2023 = ydelser.find((r) => r.fraDato.startsWith('2023'));
    expect(raekke2023).toBeDefined();
    expect(raekke2021!.maanedligYdelse).toBeLessThan(raekke2023!.maanedligYdelse);
  });
});

describe('computeForsoergertabCalculation – minimumssats', () => {
  it('forhøjer EAL-krav til minimumssats når beregnet forsørgertab er under minimumsbeløbet', () => {
    // Med ealAarsloen=100000 bliver forsørgertabets andel langt under
    // foersoergertabEalMin[2026]=1239000, så forhøjelse skal ske.
    const result = computeForsoergertabCalculation({ ...NOT_BLOCKED,
      skadedato: toISODateString('2020-05-01'),
      skadelidteFodselsdato: toISODateString('1980-01-01'),
      efterladteFodselsdato: toISODateString('1976-01-01'),
      beregningsdato: toISODateString('2026-03-19'),
      virkningsdato: toISODateString('2025-01-01'),
      koen: undefined,
      tilkendtForPeriodeAar: 10,
      aslAarsloen: asAmount(100000),
      ealAarsloen: asAmount(100000),
    });

    expect(result.ealComputation).not.toBeNull();
    expect(result.foersoergertabForhoejtetTilMin).toBe(true);
    expect(toKroner(result.foersoergertabEalMinSatsOre!)).toBe(1239000);
    expect(result.foersoergertabEalMinSatsOre).toBe(123900000);
    // Det anvendte forsørgertab skal være sat til minimumssatsen
    expect(toKroner(result.ealComputation!.forsoergertabAnvendtOre)).toBe(1239000);
    expect(result.ealComputation).not.toHaveProperty('eetAnvendt');
    // ealKrav skal være >= 0
    expect(result.result?.ealKrav ?? toKroner(result.ealComputation!.ealKravOre)).toBeGreaterThanOrEqual(0);
  });
});

describe('computeForsoergertabEalKrav', () => {
  // Skadedato og beregningsdato i samme år, så der ikke opreguleres: den regulerede årsløn er
  // årslønnen selv, og de to lovbestemte grænser kan læses direkte af tallene.
  const ealInput = {
    beregningsdato: toISODateString('2026-03-19'),
    skadedato: toISODateString('2026-01-01'),
    skadelidteFodselsdato: toISODateString('1980-01-01'),
    aslAarsloen: undefined,
    ealAarsloen: asAmount(1500000),
  };

  it('reducerer det FULDE erhvervsevnetab til årets maksimum, før forsørgertabets andel tages', () => {
    const result = computeForsoergertabEalKrav(ealInput);

    expect(result.computation).not.toBeNull();
    const eal = result.computation!;
    expect(eal.eetPct).toBe(100);
    expect(toKroner(eal.eetBeregnetOre)).toBe(15000000);
    expect(toKroner(eal.eetMaksOre)).toBe(erhvervsevnetabEalMax[2026]);
    expect(eal.eetReduceretTilMaks).toBe(true);
    expect(toKroner(eal.eetAnvendtOre)).toBe(erhvervsevnetabEalMax[2026]);

    // Andelen tages af det maksimumsreducerede beløb – ikke af de 15.000.000 kr.
    expect(eal.forsoergertabPct).toBe(30);
    expect(toKroner(eal.forsoergertabBeregnetOre)).toBe(round0(erhvervsevnetabEalMax[2026]! * 0.3));
    expect(result.foersoergertabForhoejtetTilMin).toBe(false);
    expect(toKroner(eal.forsoergertabAnvendtOre)).toBe(toKroner(eal.forsoergertabBeregnetOre));
  });

  it('regner aldersreduktion og EAL-krav af forsørgertabets andel, ikke af erhvervsevnetabet', () => {
    const result = computeForsoergertabEalKrav(ealInput);
    const eal = result.computation!;

    expect(eal.aldersreduktionPct).toBe(17);
    expect(toKroner(eal.aldersreduktionBeloebOre)).toBe(
      round0(toKroner(eal.forsoergertabAnvendtOre) * 0.17)
    );
    expect(toKroner(eal.ealKravOre)).toBe(
      toKroner(eal.forsoergertabAnvendtOre) - toKroner(eal.aldersreduktionBeloebOre)
    );
  });

  it('holder mindstebeløbet op mod andelen – ikke mod det fulde erhvervsevnetab', () => {
    // 100 % erhvervsevnetab er 4.000.000 kr. og ligger LANGT over mindstebeløbet, men de 30 %
    // udgør 1.200.000 kr. og ligger under. Mindstebeløbet skal derfor slå til.
    const result = computeForsoergertabEalKrav({ ...ealInput, ealAarsloen: asAmount(400000) });
    const eal = result.computation!;

    expect(eal.eetReduceretTilMaks).toBe(false);
    expect(toKroner(eal.eetBeregnetOre)).toBe(4000000);
    expect(toKroner(eal.forsoergertabBeregnetOre)).toBe(1200000);
    expect(result.foersoergertabForhoejtetTilMin).toBe(true);
    expect(toKroner(eal.forsoergertabAnvendtOre)).toBe(foersoergertabEalMin[2026]);
  });
});

describe('computeForsoergertabAslYdelser – inputvalidering (fail-closed grænser)', () => {
  const validInput = {
    skadedato: toISODateString('2020-05-01'),
    beregningsdato: toISODateString('2026-03-19'),
    virkningsdato: toISODateString('2026-01-01'),
    efterladteFodselsdato: toISODateString('1976-01-01'),
    koen: undefined,
    tilkendtForPeriodeAar: 5,
    aslAarsloen: asAmount(450000),
  };

  it('årsløn på præcis 0 afvises med dedikeret issue (adskilt fra "mangler")', () => {
    const result = computeForsoergertabAslYdelser({ ...validInput, aslAarsloen: asAmount(0) });
    expect(result.computation).toBeNull();
    expect(result.issues).toContainEqual({
      id: 'asl-aarsloen-zero',
      severity: 'error',
      message: 'Skadelidtes årsløn (efter ASL) skal være større end 0 kr.',
    });
    // Må IKKE samtidig rapportere "mangler".
    expect(result.issues.some((i) => i.id === 'asl-aarsloen-missing')).toBe(false);
  });

  it('blokerer en canonical negativ årsløn med samme afledte domæneissue', () => {
    const result = computeForsoergertabAslYdelser({ ...validInput, aslAarsloen: asAmount(-1000) });

    expect(result.computation).toBeNull();
    expect(result.issues).toContainEqual({
      id: 'asl-aarsloen-zero',
      severity: 'error',
      message: 'Skadelidtes årsløn (efter ASL) skal være større end 0 kr.',
    });
  });

  it('manglende årsløn (undefined) afvises med "mangler"-issue', () => {
    const result = computeForsoergertabAslYdelser({ ...validInput, aslAarsloen: undefined });
    expect(result.computation).toBeNull();
    expect(result.issues.some((i) => i.id === 'asl-aarsloen-missing')).toBe(true);
  });

  it('bruger anmeldelsesdato i den manglende stamdata-dato ved erhvervssygdom', () => {
    const result = computeForsoergertabAslYdelser({
      ...validInput,
      skadedato: undefined,
      skadestype: 'Erhvervssygdom',
    });

    expect(result.issues).toContainEqual({
      id: 'skadedato-missing',
      severity: 'error',
      message: 'Anmeldelsesdato er ikke udfyldt.',
    });
  });

  it('tilkendt periode over 10 år afvises (øvre grænse)', () => {
    const result = computeForsoergertabAslYdelser({ ...validInput, tilkendtForPeriodeAar: 11 });
    expect(result.computation).toBeNull();
    expect(result.issues).toContainEqual({
      id: 'tilkendt-for-periode-invalid',
      severity: 'error',
      message: 'Tilkendt periode må højst være 10 år.',
    });
  });

  it('ikke-heltallig tilkendt periode afvises', () => {
    const result = computeForsoergertabAslYdelser({ ...validInput, tilkendtForPeriodeAar: 5.5 });
    expect(result.computation).toBeNull();
    expect(result.issues).toContainEqual({
      id: 'tilkendt-for-periode-invalid',
      severity: 'error',
      message: 'Tilkendt periode skal være et heltal.',
    });
  });

  it('grænseværdierne 1 og 10 år accepteres (ingen periode-issue)', () => {
    const lav = computeForsoergertabAslYdelser({ ...validInput, tilkendtForPeriodeAar: 1 });
    const hoej = computeForsoergertabAslYdelser({ ...validInput, tilkendtForPeriodeAar: 10 });
    expect(lav.issues.some((i) => i.id === 'tilkendt-for-periode-invalid')).toBe(false);
    expect(hoej.issues.some((i) => i.id === 'tilkendt-for-periode-invalid')).toBe(false);
  });

  it('flere manglende felter samtidig rapporteres som distinkte issues (ingen dubletter)', () => {
    const result = computeForsoergertabAslYdelser({
      skadedato: undefined,
      beregningsdato: undefined,
      virkningsdato: undefined,
      efterladteFodselsdato: undefined,
      koen: undefined,
      tilkendtForPeriodeAar: undefined,
      aslAarsloen: undefined,
    });
    expect(result.computation).toBeNull();
    const ids = result.issues.map((i) => i.id);
    // Hver mangel er sin egen issue.
    expect(ids).toEqual(expect.arrayContaining([
      'asl-aarsloen-missing',
      'skadedato-missing',
      'beregningsdato-missing',
      'virkningsdato-missing',
      'efterladte-fodselsdato-missing',
      'tilkendt-for-periode-missing',
    ]));
    // Ingen dubletter (dedupeIssuesByIdentity).
    const messages = result.issues.map((i) => `${i.severity}|${i.message}`);
    expect(new Set(messages).size).toBe(messages.length);
  });

  it('beregningsdato før virkningsdato giver blokerende ordens-issue', () => {
    const result = computeForsoergertabAslYdelser({
      ...validInput,
      beregningsdato: toISODateString('2025-01-01'),
      virkningsdato: toISODateString('2026-01-01'),
    });
    expect(result.computation).toBeNull();
    expect(result.issues).toContainEqual({
      id: 'beregningsdato-before-virkningsdato',
      severity: 'error',
      message: 'Beregningsdato må ikke være før virkningsdato.',
    });
  });
});

describe('computeForsoergertabAslYdelser – fail-closed på manglende mellemår-årslønsmaksimum', () => {
  // De løbende ydelser opreguleres pr. kalenderår mellem virknings- og beregningsår med
  // idx[år]/idx[skadeår]. Mangler ASL-maksimum for et MELLEMLIGGENDE år (hverken skade- eller
  // beregningsår), skal beregningen fejle lukket FØR opreguleringsdivisionen rammer det manglende
  // år – ikke kaste en runtime-invariant. Dette låser dækningstjekket i pre-valideringsloopen.
  it('rapporterer manglende ASL-maksimum for et mellemliggende løbende-ydelses-år', () => {
    const original = aarsloenAslMax[2024];
    // Sæt 2024 ugyldig: skadeår 2023 og beregningsår 2025 har stadig dækning, men 2024 ligger
    // imellem virknings- (2023) og beregningsår (2025), så det skal fanges af mellemår-loopen.
    aarsloenAslMax[2024] = 0;

    try {
      const result = computeForsoergertabAslYdelser({
        skadedato: toISODateString('2023-06-01'),
        beregningsdato: toISODateString('2025-06-01'),
        virkningsdato: toISODateString('2023-01-01'),
        efterladteFodselsdato: toISODateString('1976-01-01'),
        koen: undefined,
        tilkendtForPeriodeAar: 10,
        aslAarsloen: asAmount(450000),
      });

      expect(result.computation).toBeNull();
      expect(result.issues).toContainEqual({
        id: 'aarsloen-max-missing-beregningsaar',
        severity: 'error',
        message: 'ASL-maks-sats mangler for år 2024 (satser findes kun for 2005–2026).',
      });
    } finally {
      aarsloenAslMax[2024] = original;
    }
  });
});
