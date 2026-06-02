import type { AmountValue } from '../../../schemas/amountExpressionSchema';
import { computeForsoergertabCalculation } from '../../../domain/forsoergertab/forsoergertabCalculation';
import { computeForsoergertabAslYdelser } from '../../../domain/forsoergertab/forsoergertabAslYdelser';
import { aarsloenAslMax } from '../../../data/lovbestemteRates';
import { round2 } from '../../../utils/roundingShortcuts';
import { toISODateString } from '../../../types/branded';

const asAmount = (value: number): AmountValue => ({ kind: 'number', value });

describe('computeForsoergertabCalculation', () => {
  it('beregner den løbende ASL-ydelse som 30 pct. af den opregulerede ASL-årsløn', () => {
    const result = computeForsoergertabCalculation({
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
  });

  it('kræver køn og slår korrekt op i kønsafhængige tabeller før 1. marts 2015', () => {
    const commonInput = {
      skadedato: toISODateString('2008-01-10') as const,
      skadelidteFodselsdato: toISODateString('1980-01-01') as const,
      efterladteFodselsdato: toISODateString('1973-01-01') as const,
      beregningsdato: toISODateString('2014-02-15') as const,
      virkningsdato: toISODateString('2013-01-01') as const,
      tilkendtForPeriodeAar: 10,
      aslAarsloen: asAmount(400000),
      ealAarsloen: asAmount(400000),
    };

    const missingKoen = computeForsoergertabCalculation({
      ...commonInput,
      koen: undefined,
    });
    expect(missingKoen.result).toBeNull();
    expect(missingKoen.issues.some((issue) => issue.id === 'missing-koen')).toBe(true);

    const mand = computeForsoergertabCalculation({
      ...commonInput,
      koen: 'Mand',
    });
    const kvinde = computeForsoergertabCalculation({
      ...commonInput,
      koen: 'Kvinde',
    });

    expect(mand.aslComputation?.kapitaliseringsbekendtgoerelseId).toBe('1403/2011');
    expect(mand.aslComputation?.kapitaliseringsTabel).toBe('F');
    expect(kvinde.aslComputation?.kapitaliseringsTabel).toBe('G');
    expect(mand.aslComputation?.kapitalbelob).not.toBe(kvinde.aslComputation?.kapitalbelob);
  });

  it('giver blokerende fejl når beregningsdato er før virkningsdato', () => {
    const result = computeForsoergertabCalculation({
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
    const result = computeForsoergertabCalculation({
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
    const result = computeForsoergertabCalculation({
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
    const result = computeForsoergertabCalculation({
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
    const result = computeForsoergertabCalculation({
      skadedato: toISODateString('2020-05-01'),
      skadelidteFodselsdato: toISODateString('1980-01-01'),
      efterladteFodselsdato: toISODateString('1976-01-01'),
      beregningsdato: toISODateString('2026-03-19'),
      virkningsdato: toISODateString('2025-01-01'),
      koen: undefined,
      tilkendtForPeriodeAar: 10,
      aslAarsloen: asAmount(700000),
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
        message: 'Årslønsmaksimum mangler for år 2020.',
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

  it('tæller virkningsdato og beregningsdato i samme måned som 1 allerede udbetalt måned', () => {
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
    expect(result.computation?.alleredeUdbetaltMaaneder).toBe(1);
    expect(result.computation?.resterendeMaanederTotal).toBe(11);
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

describe('computeForsoergertabCalculation — minimumssats', () => {
  it('forhøjer EAL-krav til minimumssats når beregnet forsørgertab er under minimumsbeløbet', () => {
    // Med ealAarsloen=100000 og kapitaliseringsfaktor ~3 bliver eetBeregnet langt under
    // foersoergertabEalMin[2026]=1239000, så forhøjelse skal ske.
    const result = computeForsoergertabCalculation({
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
    expect(result.foersoergertabEalMinSats).toBe(1239000);
    // eetAnvendt skal være sat til minimumssatsen
    expect(result.ealComputation!.eetAnvendt).toBe(1239000);
    // ealKrav skal være >= 0
    expect(result.result?.ealKrav ?? result.ealComputation!.ealKrav).toBeGreaterThanOrEqual(0);
  });
});

describe('computeForsoergertabAslYdelser — inputvalidering (fail-closed grænser)', () => {
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
      message: 'Årsløn efter ASL må ikke være 0 kr.',
    });
    // Må IKKE samtidig rapportere "mangler".
    expect(result.issues.some((i) => i.id === 'asl-aarsloen-missing')).toBe(false);
  });

  it('manglende årsløn (undefined) afvises med "mangler"-issue', () => {
    const result = computeForsoergertabAslYdelser({ ...validInput, aslAarsloen: undefined });
    expect(result.computation).toBeNull();
    expect(result.issues.some((i) => i.id === 'asl-aarsloen-missing')).toBe(true);
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
    // Ingen dubletter (dedupeIssuesBySeverityAndMessage).
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
