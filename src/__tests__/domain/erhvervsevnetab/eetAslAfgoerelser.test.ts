import { describe, expect, it } from 'vitest';
import type { AslAfgoerelseRow } from '../../../schemas/formSchemas';
import {
  collectEetAslAfgoerelseValidationIssues,
  validateAslAarsloenDivisibleBy1000,
  validateAslAarsloenBySkadesaarMax,
  validateDuplicateAfgoerelse,
  validateEetPctByPriorKapPct,
  validateKapDatoByAfgoerelsestype,
  validateKapPctByAfgoerelsestype,
  validateTidlKapDatoByAfgoerelsestype,
} from '../../../domain/erhvervsevnetab/eetAslAfgoerelser';
import {
  isUnderOrEqualTwoYearsToFpByBekendtgoerelse,
  resolveKapitaliseringTabelvalg,
} from '../../../domain/erhvervsevnetab/eetKapitaliseringOpslag';
import { getKapitaliseringsTabelData } from '../../../data/kapitalisering/kapitaliseringsTabeller';
import { toISODateString } from '../../../types/branded';

const buildRow = (patch: Partial<AslAfgoerelseRow>): AslAfgoerelseRow => ({
  id: 'r1',
  afgoerelsesDato: undefined,
  virkningsDato: undefined,
  eetPct: undefined,
  kapDato: undefined,
  kapPct: undefined,
  afgoerelseType: undefined,
  tidlKapDato: undefined,
  ...patch,
});

describe('validateKapPctByAfgoerelsestype', () => {
  it('afviser kap % over 50 uanset afgørelsestype', () => {
    const error = validateKapPctByAfgoerelsestype(
      buildRow({ afgoerelseType: 'Endelig', eetPct: '80', kapPct: '55' })
    );
    expect(error).toContain('50 %');
  });

  it('afviser endelig når kap % er højere end EET %', () => {
    const error = validateKapPctByAfgoerelsestype(
      buildRow({ afgoerelseType: 'Endelig', eetPct: '40', kapPct: '45' })
    );
    expect(error).toContain('mere end det samlede EET');
  });

  it('afviser endelig når EET % < 50 og kap % er lavere end EET %', () => {
    const error = validateKapPctByAfgoerelsestype(
      buildRow({ afgoerelseType: 'Endelig', eetPct: '40', kapPct: '35' })
    );
    expect(error).toContain('under 50 %');
  });

  it('afviser delvist endelig når kap % er under 5 %', () => {
    const error = validateKapPctByAfgoerelsestype(
      buildRow({ afgoerelseType: 'Delvist endelig', eetPct: '40', kapPct: '4' })
    );
    expect(error).toContain('5 %');
  });

  it('afviser delvist endelig når kap % overstiger EET %', () => {
    const error = validateKapPctByAfgoerelsestype(
      buildRow({ afgoerelseType: 'Delvist endelig', eetPct: '30', kapPct: '31' })
    );
    expect(error).toContain('mere end det samlede EET');
  });

  it('accepterer delvist endelig når kap % mangler (fejl vises på andre faner)', () => {
    const error = validateKapPctByAfgoerelsestype(
      buildRow({ afgoerelseType: 'Delvist endelig', eetPct: '40', kapPct: undefined })
    );
    expect(error).toBeUndefined();
  });

  it('afviser midlertidig eller tom type når kap % er over 0', () => {
    const error = validateKapPctByAfgoerelsestype(
      buildRow({ afgoerelseType: undefined, eetPct: '40', kapPct: '5' })
    );
    expect(error).toContain('må ikke udfyldes');
  });

  it('afviser midlertidig eller tom type når kap % er udfyldt (også 0)', () => {
    const error = validateKapPctByAfgoerelsestype(
      buildRow({ afgoerelseType: 'Midlertidig', eetPct: '40', kapPct: '0' })
    );
    expect(error).toContain('må ikke udfyldes');
  });

  it('afviser midlertidig eller tom type når kap.dato er udfyldt', () => {
    const error = validateKapDatoByAfgoerelsestype(
      buildRow({ afgoerelseType: undefined, kapDato: '2024-01-10' })
    );
    expect(error).toContain('må kun udfyldes ved endelig');
  });

  it('afviser midlertidig eller tom type når tidl. kap.dato er udfyldt', () => {
    const error = validateTidlKapDatoByAfgoerelsestype(
      buildRow({ afgoerelseType: 'Midlertidig', tidlKapDato: '2024-01-10', kapDato: '2024-01-10' })
    );
    expect(error).toContain('må ikke udfyldes');
  });

  it('afviser tidl. kap.dato når kap.dato ikke er udfyldt', () => {
    const error = validateTidlKapDatoByAfgoerelsestype(
      buildRow({ afgoerelseType: 'Endelig', tidlKapDato: '2024-01-10', kapDato: undefined })
    );
    expect(error).toBe('Kun relevant ved tidligere kapitalisering.');
  });

  it('afviser kap.dato ved genoptagelse fra 1. juli 2024 når kap.dato afviger fra afgørelsesdato', () => {
    const error = validateKapDatoByAfgoerelsestype(
      buildRow({
        afgoerelseType: 'Endelig',
        afgoerelsesDato: '01-07-2024',
        kapDato: '02-07-2024',
        tidlKapDato: '01-01-2024',
      })
    );
    expect(error).toBe('Fra 1. juli 2024 sker kapitalisering fra afgørelsesdagen ved genoptagelse.');
  });

  it('afviser kap.dato ved endelig afgørelse < 2 år til folkepension når kap.dato afviger fra afgørelsesdato', () => {
    const error = validateKapDatoByAfgoerelsestype(
      buildRow({
        afgoerelseType: 'Endelig',
        afgoerelsesDato: '01-07-2025',
        virkningsDato: '01-07-2025',
        kapDato: '01-10-2025',
      }),
      toISODateString('2025-01-01'),
      toISODateString('1959-01-01')
    );
    expect(error).toBe('Ved < 2 år til folkepension sker kapitalisering fra afgørelsesdagen.');
  });

  it('afviser kap.dato når den ligger før virkningsdato', () => {
    const error = validateKapDatoByAfgoerelsestype(
      buildRow({
        afgoerelseType: 'Endelig',
        afgoerelsesDato: '10-01-2025',
        virkningsDato: '15-01-2025',
        kapDato: '14-01-2025',
      })
    );
    expect(error).toBe('Kapitaliseringsdato er før virkningsdato.');
  });

  it('accepterer gyldig endelig under 50 når kap % matcher EET %', () => {
    const error = validateKapPctByAfgoerelsestype(
      buildRow({ afgoerelseType: 'Endelig', eetPct: '40', kapPct: '40' })
    );
    expect(error).toBeUndefined();
  });

  it('suspenderer EET-afhængige kap %-regler ved EET % = 0', () => {
    const error = validateKapPctByAfgoerelsestype(
      buildRow({ afgoerelseType: 'Endelig', eetPct: '0', kapPct: '15' })
    );
    expect(error).toBeUndefined();
  });

  it('accepterer endelig under 50 når samlet kap % (inkl. tidligere) matcher EET %', () => {
    const previous = buildRow({
      id: 'r0',
      afgoerelsesDato: '01-01-2024',
      afgoerelseType: 'Endelig',
      eetPct: '25',
      kapPct: '25',
    });
    const current = buildRow({
      id: 'r1',
      afgoerelsesDato: '01-01-2025',
      afgoerelseType: 'Endelig',
      eetPct: '40',
      kapPct: '15',
    });

    const error = validateKapPctByAfgoerelsestype(current, [previous, current]);
    expect(error).toBeUndefined();
  });

  it('afviser når senere kap % + tidligere kap % overstiger 50 %', () => {
    const previous = buildRow({
      id: 'r0',
      afgoerelsesDato: '01-01-2024',
      afgoerelseType: 'Endelig',
      eetPct: '80',
      kapPct: '30',
    });
    const current = buildRow({
      id: 'r1',
      afgoerelsesDato: '01-03-2024',
      afgoerelseType: 'Endelig',
      eetPct: '80',
      kapPct: '25',
    });

    const error = validateKapPctByAfgoerelsestype(current, [previous, current]);
    expect(error).toContain('50 %');
  });

  it('afviser når senere kap % + tidligere kap % overstiger EET % ved endelig', () => {
    const previous = buildRow({
      id: 'r0',
      afgoerelsesDato: '01-01-2024',
      afgoerelseType: 'Endelig',
      eetPct: '40',
      kapPct: '20',
    });
    const current = buildRow({
      id: 'r1',
      afgoerelsesDato: '01-03-2024',
      afgoerelseType: 'Endelig',
      eetPct: '40',
      kapPct: '25',
    });

    const error = validateKapPctByAfgoerelsestype(current, [previous, current]);
    expect(error).toContain('fradrag for tidligere kapitalisering');
  });

  it('medregner kap % fra alle tidligere afgørelser (ikke kun én)', () => {
    const previousA = buildRow({
      id: 'r0',
      afgoerelsesDato: '01-01-2024',
      afgoerelseType: 'Endelig',
      eetPct: '80',
      kapPct: '10',
    });
    const previousB = buildRow({
      id: 'r1',
      afgoerelsesDato: '01-02-2024',
      afgoerelseType: 'Endelig',
      eetPct: '80',
      kapPct: '20',
    });
    const current = buildRow({
      id: 'r2',
      afgoerelsesDato: '01-03-2024',
      afgoerelseType: 'Endelig',
      eetPct: '80',
      kapPct: '25',
    });

    const error = validateKapPctByAfgoerelsestype(current, [previousA, previousB, current]);
    expect(error).toContain('50 %');
  });

  it('accepterer når kun senere afgørelser har kap % (de tæller ikke med)', () => {
    const later = buildRow({
      id: 'r2',
      afgoerelsesDato: '01-05-2024',
      afgoerelseType: 'Endelig',
      eetPct: '50',
      kapPct: '20',
    });
    const current = buildRow({
      id: 'r1',
      afgoerelsesDato: '01-03-2024',
      afgoerelseType: 'Endelig',
      eetPct: '50',
      kapPct: '35',
    });

    const error = validateKapPctByAfgoerelsestype(current, [current, later]);
    expect(error).toBeUndefined();
  });

  it('kræver fuld kapitalisering ved endelig afgørelse < 2 år til folkepension (inkl. tidligere kapitalisering)', () => {
    const previous = buildRow({
      id: 'r0',
      afgoerelsesDato: '01-01-2024',
      afgoerelseType: 'Delvist endelig',
      eetPct: '80',
      kapPct: '20',
    });
    const current = buildRow({
      id: 'r1',
      afgoerelsesDato: '01-07-2025',
      afgoerelseType: 'Endelig',
      eetPct: '80',
      kapPct: '40',
    });

    const error = validateKapPctByAfgoerelsestype(
      current,
      [previous, current],
      toISODateString('2025-01-01'),
      toISODateString('1959-01-01')
    );
    expect(error).toBe('Ved < 2 år til folkepension kapitaliseres hele EET.');
  });

  it('accepterer kap % over 50 ved endelig afgørelse < 2 år til folkepension når samlet kap % matcher EET %', () => {
    const previous = buildRow({
      id: 'r0',
      afgoerelsesDato: '01-01-2024',
      afgoerelseType: 'Delvist endelig',
      eetPct: '80',
      kapPct: '20',
    });
    const current = buildRow({
      id: 'r1',
      afgoerelsesDato: '01-07-2025',
      afgoerelseType: 'Endelig',
      eetPct: '80',
      kapPct: '60',
    });

    const error = validateKapPctByAfgoerelsestype(
      current,
      [previous, current],
      toISODateString('2025-01-01'),
      toISODateString('1959-01-01')
    );
    expect(error).toBeUndefined();
  });
});

describe('validateEetPctByPriorKapPct', () => {
  it('afviser når EET % ikke overstiger summen af tidligere kap %', () => {
    const previousA = buildRow({
      id: 'r0',
      afgoerelsesDato: '01-01-2024',
      kapPct: '10',
    });
    const previousB = buildRow({
      id: 'r1',
      afgoerelsesDato: '01-02-2024',
      kapPct: '20',
    });
    const current = buildRow({
      id: 'r2',
      afgoerelsesDato: '01-03-2024',
      eetPct: '30',
    });

    const error = validateEetPctByPriorKapPct(current, [previousA, previousB, current]);
    expect(error).toContain('større end summen');
  });

  it('accepterer når EET % overstiger summen af tidligere kap %', () => {
    const previousA = buildRow({
      id: 'r0',
      afgoerelsesDato: '01-01-2024',
      kapPct: '10',
    });
    const previousB = buildRow({
      id: 'r1',
      afgoerelsesDato: '01-02-2024',
      kapPct: '20',
    });
    const current = buildRow({
      id: 'r2',
      afgoerelsesDato: '01-03-2024',
      eetPct: '35',
    });

    const error = validateEetPctByPriorKapPct(current, [previousA, previousB, current]);
    expect(error).toBeUndefined();
  });

  it('ser bort fra senere afgørelser ved beregning af tidligere kap %-sum', () => {
    const later = buildRow({
      id: 'r3',
      afgoerelsesDato: '01-05-2024',
      kapPct: '40',
    });
    const current = buildRow({
      id: 'r2',
      afgoerelsesDato: '01-03-2024',
      eetPct: '10',
    });

    const error = validateEetPctByPriorKapPct(current, [current, later]);
    expect(error).toBeUndefined();
  });
});

describe('validateDuplicateAfgoerelse', () => {
  it('giver fejl for nederste række når afgørelsesdato og virkningsdato er identiske', () => {
    const first = buildRow({
      id: 'r1',
      afgoerelsesDato: '01-11-2025',
      virkningsDato: '01-10-2025',
    });
    const second = buildRow({
      id: 'r2',
      afgoerelsesDato: '01-11-2025',
      virkningsDato: '01-10-2025',
    });

    const firstError = validateDuplicateAfgoerelse(first, [first, second]);
    const secondError = validateDuplicateAfgoerelse(second, [first, second]);

    expect(firstError).toBeUndefined();
    expect(secondError).toBe('Der er angivet to identiske afgørelser med samme afgørelsesdato og virkningsdato.');
  });

  it('giver fejl selvom afgørelsestype er forskellig', () => {
    const first = buildRow({
      id: 'r1',
      afgoerelsesDato: '01-11-2025',
      virkningsDato: '01-10-2025',
      afgoerelseType: 'Endelig',
    });
    const second = buildRow({
      id: 'r2',
      afgoerelsesDato: '01-11-2025',
      virkningsDato: '01-10-2025',
      afgoerelseType: 'Delvist endelig',
    });

    const secondError = validateDuplicateAfgoerelse(second, [first, second]);
    expect(secondError).toBe('Der er angivet to identiske afgørelser med samme afgørelsesdato og virkningsdato.');
  });

  it('giver ingen fejl når virkningsdato er forskellig', () => {
    const first = buildRow({
      id: 'r1',
      afgoerelsesDato: '01-11-2025',
      virkningsDato: '01-10-2025',
    });
    const second = buildRow({
      id: 'r2',
      afgoerelsesDato: '01-11-2025',
      virkningsDato: '01-11-2025',
    });

    const secondError = validateDuplicateAfgoerelse(second, [first, second]);
    expect(secondError).toBeUndefined();
  });
});

describe('validateAslAarsloenBySkadesaarMax', () => {
  it('giver fejl når årsløn overstiger maks årsløn i skadesåret', () => {
    const error = validateAslAarsloenBySkadesaarMax(539001, toISODateString('2019-04-01'));
    expect(error).toBe('Årsløn kan ikke overstige maks årslønnen i skadesåret (539.000 kr.)');
  });

  it('giver ikke fejl når årsløn er lig eller under maks årsløn i skadesåret', () => {
    expect(validateAslAarsloenBySkadesaarMax(539000, toISODateString('2019-04-01'))).toBeUndefined();
    expect(validateAslAarsloenBySkadesaarMax(538999, toISODateString('2019-04-01'))).toBeUndefined();
  });
});

describe('validateAslAarsloenDivisibleBy1000', () => {
  it('giver fejl når årsløn ikke er delelig med 1000', () => {
    const error = validateAslAarsloenDivisibleBy1000(539500);
    expect(error).toBe('Årsløn skal være deleligt med 1.000.');
  });

  it('giver ikke fejl når årsløn er delelig med 1000', () => {
    expect(validateAslAarsloenDivisibleBy1000(539000)).toBeUndefined();
  });
});

describe('collectEetAslAfgoerelseValidationIssues', () => {
  it('producerer ingen kap.dato-issue når kap.dato er før afgørelsesdato (håndhæves af UI-range)', () => {
    const rows: AslAfgoerelseRow[] = [
      buildRow({
        id: 'r1',
        afgoerelsesDato: '10-01-2025',
        virkningsDato: '09-01-2025',
        afgoerelseType: 'Endelig',
        eetPct: '40',
        kapDato: '09-01-2025',
        kapPct: '40',
      }),
    ];

    const issues = collectEetAslAfgoerelseValidationIssues(rows, undefined, undefined);
    expect(issues.filter((issue) => issue.rowId === 'r1' && issue.field === 'kapDato')).toHaveLength(0);
  });

  it('samler krydsfeltsfejl deterministisk for den konkrete række/kolonne', () => {
    const rows: AslAfgoerelseRow[] = [
      buildRow({
        id: 'r1',
        afgoerelsesDato: '01-07-2024',
        virkningsDato: '01-07-2024',
        afgoerelseType: 'Endelig',
        eetPct: '40',
        kapDato: '02-07-2024',
        kapPct: '40',
        tidlKapDato: '01-01-2024',
      }),
    ];

    const issues = collectEetAslAfgoerelseValidationIssues(rows, undefined, undefined);
    expect(issues.some((issue) => issue.rowId === 'r1' && issue.field === 'kapDato')).toBe(true);
    expect(
      issues.some(
        (issue) =>
          issue.rowId === 'r1' &&
          issue.field === 'kapDato' &&
          issue.message === 'Fra 1. juli 2024 sker kapitalisering fra afgørelsesdagen ved genoptagelse.'
      )
    ).toBe(true);
  });

  it('prioriterer afgørelsestype-fejl i kap.dato over genoptagelses-fejl', () => {
    const rows: AslAfgoerelseRow[] = [
      buildRow({
        id: 'r1',
        afgoerelseType: 'Midlertidig',
        kapDato: '01-01-2024',
        tidlKapDato: '01-01-2024',
      }),
    ];

    const issues = collectEetAslAfgoerelseValidationIssues(rows, undefined, undefined);

    expect(issues).toContainEqual({
      rowId: 'r1',
      field: 'kapDato',
      message: 'Kapitaliseringsdato må kun udfyldes ved endelig eller delvist endelig afgørelsestype.',
    });
    expect(
      issues.some(
        (issue) =>
          issue.rowId === 'r1' &&
          issue.field === 'kapDato' &&
          issue.message === 'Ved genoptagne afgørelser skal den nye kapitaliseringsdato angives.'
      )
    ).toBe(false);
  });

  it('genberegner kap.dato-issue når fodselsdato ændrer < 2 år til folkepension-reglen', () => {
    const rows: AslAfgoerelseRow[] = [
      buildRow({
        id: 'r1',
        afgoerelsesDato: '01-07-2025',
        virkningsDato: '01-07-2025',
        afgoerelseType: 'Endelig',
        eetPct: '80',
        kapDato: '01-10-2025',
        kapPct: '80',
      }),
    ];

    const withoutFpIssue = collectEetAslAfgoerelseValidationIssues(
      rows,
      toISODateString('2025-01-01'),
      toISODateString('1990-01-01')
    );
    expect(withoutFpIssue.some((issue) => issue.rowId === 'r1' && issue.field === 'kapDato')).toBe(false);

    const withFpIssue = collectEetAslAfgoerelseValidationIssues(
      rows,
      toISODateString('2025-01-01'),
      toISODateString('1959-01-01')
    );
    expect(withFpIssue).toContainEqual({
      rowId: 'r1',
      field: 'kapDato',
      message: 'Ved < 2 år til folkepension sker kapitalisering fra afgørelsesdagen.',
    });
  });

  it('giver ikke særskilt 2-årsregel-fejl i felterne, når skadesdato mangler', () => {
    const rows: AslAfgoerelseRow[] = [
      buildRow({
        id: 'r1',
        afgoerelsesDato: '01-07-2025',
        virkningsDato: '01-07-2025',
        afgoerelseType: 'Endelig',
        eetPct: '40',
        kapDato: '01-10-2025',
        kapPct: '40',
      }),
    ];

    const issues = collectEetAslAfgoerelseValidationIssues(
      rows,
      undefined,
      toISODateString('1959-01-01')
    );
    expect(
      issues.some(
        (issue) =>
          issue.rowId === 'r1' &&
          issue.field === 'kapDato' &&
          issue.message === 'Ved < 2 år til folkepension sker kapitalisering fra afgørelsesdagen.'
      )
    ).toBe(false);
    expect(
      issues.some(
        (issue) =>
          issue.rowId === 'r1' &&
          issue.field === 'kapPct' &&
          issue.message === 'Ved < 2 år til folkepension kapitaliseres hele EET.'
      )
    ).toBe(false);
  });

  it('prioriterer den særlige < 2 år-fejl i kap. % over det almindelige 50 %-loft', () => {
    const rows: AslAfgoerelseRow[] = [
      buildRow({
        id: 'r0',
        afgoerelsesDato: '01-01-2024',
        virkningsDato: '01-01-2024',
        afgoerelseType: 'Delvist endelig',
        eetPct: '80',
        kapPct: '20',
      }),
      buildRow({
        id: 'r1',
        afgoerelsesDato: '01-07-2025',
        virkningsDato: '01-07-2025',
        afgoerelseType: 'Endelig',
        eetPct: '80',
        kapDato: '01-07-2025',
        kapPct: '40',
      }),
    ];

    const issues = collectEetAslAfgoerelseValidationIssues(
      rows,
      toISODateString('2023-01-01'),
      toISODateString('1959-01-01')
    );

    expect(issues).toContainEqual({
      rowId: 'r1',
      field: 'kapPct',
      message: 'Ved < 2 år til folkepension kapitaliseres hele EET.',
    });
    expect(
      issues.some(
        (issue) =>
          issue.rowId === 'r1' &&
          issue.field === 'kapPct' &&
          issue.message === 'Kapitaliseringsprocent kan ikke overstige 50 % (inkl. tidligere kapitaliseringsprocenter).'
      )
    ).toBe(false);
  });
});

describe('isUnderOrEqualTwoYearsToFpByBekendtgoerelse', () => {
  it('returnerer true når kontroltidspunktet er inden for eller præcis to år til folkepension', () => {
    const result = isUnderOrEqualTwoYearsToFpByBekendtgoerelse(
      toISODateString('2025-01-01'),
      toISODateString('1959-01-01'),
      toISODateString('2025-07-01')
    );
    expect(result).toBe(true);
  });

  it('returnerer false når kontroltidspunktet er mere end to år før folkepension', () => {
    const result = isUnderOrEqualTwoYearsToFpByBekendtgoerelse(
      toISODateString('2025-01-01'),
      toISODateString('1965-01-01'),
      toISODateString('2025-07-01')
    );
    expect(result).toBe(false);
  });

  it('returnerer false fail-closed når bekendtgørelse/tabelvalg ikke kan bestemmes', () => {
    const result = isUnderOrEqualTwoYearsToFpByBekendtgoerelse(
      toISODateString('1900-01-01'),
      toISODateString('1900-01-01'),
      toISODateString('2004-01-01')
    );
    expect(result).toBe(false);
  });
});

describe('resolveKapitaliseringTabelvalg', () => {
  it('resolver historisk tabelvalg uden fødselsdato for 1047/2008', () => {
    const tabeldata = getKapitaliseringsTabelData('1047/2008');
    expect(tabeldata).toBeDefined();

    const result = resolveKapitaliseringTabelvalg(
      tabeldata!,
      toISODateString('2007-07-01'),
      toISODateString('1944-01-01')
    );

    expect(result).toEqual({
      tabel: 'A',
      folkepensionsalderMaaneder: 780,
      folkepensionsalderLabel: '65 år',
      usesKoen: true,
    });
  });

  it('resolver historisk tabelvalg uden fødselsdato for 1068/2003', () => {
    const tabeldata = getKapitaliseringsTabelData('1068/2003');
    expect(tabeldata).toBeDefined();

    const result = resolveKapitaliseringTabelvalg(
      tabeldata!,
      toISODateString('2005-01-01'),
      toISODateString('1944-01-01')
    );

    expect(result).toEqual({
      tabel: 'A',
      folkepensionsalderMaaneder: 780,
      folkepensionsalderLabel: '65 år',
      usesKoen: true,
    });
  });

  it('afleder folkepensionsalder normativt for fødselsdato før laveste foedselsdatoFra i moderne tabelvalg', () => {
    const tabeldata = getKapitaliseringsTabelData('10056/2025');
    expect(tabeldata).toBeDefined();

    const result = resolveKapitaliseringTabelvalg(
      tabeldata!,
      toISODateString('2025-01-01'),
      toISODateString('1954-04-01')
    );

    expect(result).toEqual({
      tabel: 'D',
      folkepensionsalderMaaneder: 786,
      folkepensionsalderLabel: '65,5 år',
      usesKoen: false,
    });
  });

  it('afleder 66,5 år for første halvår 1955 når fødselsdato ligger før laveste foedselsdatoFra', () => {
    const tabeldata = getKapitaliseringsTabelData('10056/2025');
    expect(tabeldata).toBeDefined();

    const result = resolveKapitaliseringTabelvalg(
      tabeldata!,
      toISODateString('2025-01-01'),
      toISODateString('1955-03-01')
    );

    expect(result?.folkepensionsalderLabel).toBe('66,5 år');
    expect(result?.folkepensionsalderMaaneder).toBe(798);
  });
});
