import { describe, expect, it } from 'vitest';
import type { AslAfgoerelseRow } from '../../../schemas/formSchemas';
import {
  isAfgoerelseWithinTwoYearsOfFolkepension,
  validateDuplicateAfgoerelseTriplet,
  validateEetPctByPriorKapPct,
  validateKapDatoByAfgoerelsestype,
  validateKapPctByAfgoerelsestype,
  validateTidlKapDatoByAfgoerelsestype,
} from '../../../domain/erhvervsevnetab/eetAslAfgoerelser';
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
    expect(error).toContain('højere end EET %');
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

  it('afviser delvist endelig når kap % overstiger min(EET%-5, 50)', () => {
    const error = validateKapPctByAfgoerelsestype(
      buildRow({ afgoerelseType: 'Delvist endelig', eetPct: '30', kapPct: '26' })
    );
    expect(error).toContain('tilladt maksimum');
  });

  it('afviser delvist endelig når kap % mangler', () => {
    const error = validateKapPctByAfgoerelsestype(
      buildRow({ afgoerelseType: 'Delvist endelig', eetPct: '40', kapPct: undefined })
    );
    expect(error).toContain('påkrævet');
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
    expect(error).toContain('må ikke udfyldes');
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
    expect(error).toBe('Kun relevant ved tidligere kapitalisering');
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
    expect(error).toBe('Fra 1.juli 2024 sker kapitalisering fra afgørelsesdagen ved genoptagelse');
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
    expect(error).toContain('højere end EET %');
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
      afgoerelsesDato: '01-01-2028',
      afgoerelseType: 'Delvist endelig',
      eetPct: '80',
      kapPct: '20',
    });
    const current = buildRow({
      id: 'r1',
      afgoerelsesDato: '01-06-2029',
      afgoerelseType: 'Endelig',
      eetPct: '80',
      kapPct: '40',
    });

    const error = validateKapPctByAfgoerelsestype(
      current,
      [previous, current],
      toISODateString('1963-01-01')
    );
    expect(error).toBe('Ved < 2 år til folkepension kapitaliseres hele EET');
  });

  it('accepterer kap % over 50 ved endelig afgørelse < 2 år til folkepension når samlet kap % matcher EET %', () => {
    const previous = buildRow({
      id: 'r0',
      afgoerelsesDato: '01-01-2028',
      afgoerelseType: 'Delvist endelig',
      eetPct: '80',
      kapPct: '20',
    });
    const current = buildRow({
      id: 'r1',
      afgoerelsesDato: '01-06-2029',
      afgoerelseType: 'Endelig',
      eetPct: '80',
      kapPct: '60',
    });

    const error = validateKapPctByAfgoerelsestype(
      current,
      [previous, current],
      toISODateString('1963-01-01')
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

describe('validateDuplicateAfgoerelseTriplet', () => {
  it('giver fejl for nederste række når afgørelsesdato, virkningsdato og afgørelsestype er identiske', () => {
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
      afgoerelseType: 'Endelig',
    });

    const firstError = validateDuplicateAfgoerelseTriplet(first, [first, second]);
    const secondError = validateDuplicateAfgoerelseTriplet(second, [first, second]);

    expect(firstError).toBeUndefined();
    expect(secondError).toBe('Der er angivet to identiske afgørelser');
  });

  it('giver ingen fejl når kun to af tre felter matcher', () => {
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

    const secondError = validateDuplicateAfgoerelseTriplet(second, [first, second]);
    expect(secondError).toBeUndefined();
  });
});

describe('isAfgoerelseWithinTwoYearsOfFolkepension', () => {
  it('returnerer true når afgørelsesdato er inden for to år af folkepensionsdato', () => {
    const result = isAfgoerelseWithinTwoYearsOfFolkepension(
      toISODateString('2029-01-02'),
      toISODateString('1963-01-01')
    );
    expect(result).toBe(true);
  });

  it('returnerer false når afgørelsesdato er mere end to år før folkepensionsdato', () => {
    const result = isAfgoerelseWithinTwoYearsOfFolkepension(
      toISODateString('2028-12-31'),
      toISODateString('1963-01-01')
    );
    expect(result).toBe(false);
  });

  it('returnerer true for fødselsdato før første FP-interval når personen er langt over folkepensionsalder', () => {
    const result = isAfgoerelseWithinTwoYearsOfFolkepension(
      toISODateString('2025-11-01'),
      toISODateString('1900-01-08')
    );
    expect(result).toBe(true);
  });
});

