import { describe, expect, it } from 'vitest';
import {
  TODAY,
  MIN_YEAR,
  CURRENT_YEAR,
  MIN_SVIESMERTE_YEAR,
  dateRanges_stamdata,
  dateRanges_erstatningsopgoerelse,
  computeSkadesdatoMinRule,
} from '../../config/dateRanges';
import { toISODateString } from '../../types/branded';

const iso = (s: string) => toISODateString(s);

// ─── Globale konstanter ───────────────────────────────────────────────────────

describe('dateRanges – globale konstanter', () => {
  it('TODAY er en gyldig ISO-dato (YYYY-MM-DD)', () => {
    expect(TODAY).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it('MIN_YEAR svarer til årstallet i systemets nedre datogrænse (2005-01-01)', () => {
    expect(MIN_YEAR).toBe(2005);
  });

  it('CURRENT_YEAR svarer til det aktuelle år i TODAY', () => {
    const currentYear = Number(TODAY.slice(0, 4));
    expect(CURRENT_YEAR).toBe(currentYear);
  });

  it('MIN_YEAR ≤ CURRENT_YEAR', () => {
    expect(MIN_YEAR).toBeLessThanOrEqual(CURRENT_YEAR);
  });

  it('MIN_SVIESMERTE_YEAR er et positivt heltal ≥ MIN_YEAR', () => {
    expect(Number.isInteger(MIN_SVIESMERTE_YEAR)).toBe(true);
    expect(MIN_SVIESMERTE_YEAR).toBeGreaterThanOrEqual(MIN_YEAR);
  });

  it('MIN_SVIESMERTE_YEAR ≤ CURRENT_YEAR', () => {
    expect(MIN_SVIESMERTE_YEAR).toBeLessThanOrEqual(CURRENT_YEAR);
  });
});

// ─── dateRanges_stamdata ──────────────────────────────────────────────────────

describe('dateRanges_stamdata', () => {
  it('skadesdato er static type', () => {
    expect(dateRanges_stamdata.skadesdato.type).toBe('static');
  });

  it('skadesdato min er 2005-01-01', () => {
    expect(dateRanges_stamdata.skadesdato.min).toBe('2005-01-01');
  });

  it('skadesdato max er TODAY', () => {
    expect(dateRanges_stamdata.skadesdato.max).toBe(TODAY);
  });

  it('skadesdato har placeholder', () => {
    expect(dateRanges_stamdata.skadesdato.placeholder).toBeTruthy();
  });
});

// ─── dateRanges_erstatningsopgoerelse ────────────────────────────────────────

describe('dateRanges_erstatningsopgoerelse', () => {
  it('periodeFra er dynamic-max', () => {
    expect(dateRanges_erstatningsopgoerelse.periodeFra.type).toBe('dynamic-max');
    expect(dateRanges_erstatningsopgoerelse.periodeFra.max).toBe('DYNAMIC');
  });

  it('periodeFra min er 2005-01-01', () => {
    expect(dateRanges_erstatningsopgoerelse.periodeFra.min).toBe('2005-01-01');
  });

  it('periodeTil er dynamic-min', () => {
    expect(dateRanges_erstatningsopgoerelse.periodeTil.type).toBe('dynamic-min');
    expect(dateRanges_erstatningsopgoerelse.periodeTil.min).toBe('DYNAMIC');
  });

  it('opgoerelse er dynamic-min', () => {
    expect(dateRanges_erstatningsopgoerelse.opgoerelse.type).toBe('dynamic-min');
    expect(dateRanges_erstatningsopgoerelse.opgoerelse.min).toBe('DYNAMIC');
    expect(dateRanges_erstatningsopgoerelse.opgoerelse.fallbackMin).toBe('2005-01-01');
    expect(dateRanges_erstatningsopgoerelse.opgoerelse.max).toBe(TODAY);
  });

  it('tabelFerieFra er unconstrained', () => {
    expect(dateRanges_erstatningsopgoerelse.tabelFerieFra.type).toBe('unconstrained');
    expect(dateRanges_erstatningsopgoerelse.tabelFerieFra.min).toBeNull();
    expect(dateRanges_erstatningsopgoerelse.tabelFerieFra.max).toBeNull();
  });

  it('tabelFerieTil er unconstrained', () => {
    expect(dateRanges_erstatningsopgoerelse.tabelFerieTil.type).toBe('unconstrained');
  });

  it('alle dynamic-min felter har fallbackMin', () => {
    const dynamicMinFields = [
      'periodeTil',
      'forligDato',
      'menAfgoerelseDato',
      'midlertidigEETAfgoerelseDato',
      'midlertidigEETVirkningsdato',
      'endeligEETAfgoerelseDato',
      'endeligEETVirkningsdato',
      'differencekravDato',
      'tabelSvieSmerteTil',
      'tabelOevrigeKravDato',
    ] as const;
    for (const field of dynamicMinFields) {
      const range = dateRanges_erstatningsopgoerelse[field];
      if (range.type === 'dynamic-min') {
        expect(range.fallbackMin).toBeTruthy();
      }
    }
  });

  it('tabelSvieSmerteFra er dynamic-both', () => {
    expect(dateRanges_erstatningsopgoerelse.tabelSvieSmerteFra.type).toBe('dynamic-both');
  });

  it('tabelTAFFra er dynamic-both', () => {
    expect(dateRanges_erstatningsopgoerelse.tabelTAFFra.type).toBe('dynamic-both');
  });
});

// ─── computeSkadesdatoMinRule ─────────────────────────────────────────────────

describe('computeSkadesdatoMinRule', () => {
  const fallbackMin = iso('2005-01-01');

  it('ingen skadesdato → returnerer fallbackMin', () => {
    const rule = computeSkadesdatoMinRule({
      skadesdatoISO: undefined,
      erErhvervssygdom: false,
      fallbackMin,
    });
    expect(rule.minDate).toBe('2005-01-01');
    expect(rule.minBoundKind).toBeUndefined();
  });

  it('arbejdsulykke med skadesdato → minDate er skadesdato', () => {
    const skadesdato = iso('2020-06-15');
    const rule = computeSkadesdatoMinRule({
      skadesdatoISO: skadesdato,
      erErhvervssygdom: false,
      fallbackMin,
    });
    expect(rule.minDate).toBe('2020-06-15');
    expect(rule.minBoundKind).toBe('skadesdato');
    expect(rule.minBoundReferenceISO).toBe('2020-06-15');
  });

  it('arbejdsulykke med skadesdato før fallback → bruger fallback', () => {
    // Skadesdato er 2004 men fallback er 2005-01-01
    const skadesdato = iso('2004-06-01');
    const rule = computeSkadesdatoMinRule({
      skadesdatoISO: skadesdato,
      erErhvervssygdom: false,
      fallbackMin,
    });
    // max(2004-06-01, 2005-01-01) = 2005-01-01
    expect(rule.minDate).toBe('2005-01-01');
  });

  it('erhvervssygdom → minBoundKind er anmeldedatoMinus5Aar', () => {
    const skadesdato = iso('2020-06-15');
    const rule = computeSkadesdatoMinRule({
      skadesdatoISO: skadesdato,
      erErhvervssygdom: true,
      fallbackMin,
    });
    expect(rule.minBoundKind).toBe('anmeldedatoMinus5Aar');
    expect(rule.minBoundReferenceISO).toBe('2020-06-15');
  });

  it('erhvervssygdom 2020 → minDate er 2015-06-15 (5 år tilbage)', () => {
    const skadesdato = iso('2020-06-15');
    const rule = computeSkadesdatoMinRule({
      skadesdatoISO: skadesdato,
      erErhvervssygdom: true,
      fallbackMin,
    });
    expect(rule.minDate).toBe('2015-06-15');
  });

  it('erhvervssygdom 2008 → minDate er 2005-01-01 (5 år minus = 2003, begrænset af 2005)', () => {
    const skadesdato = iso('2008-03-01');
    const rule = computeSkadesdatoMinRule({
      skadesdatoISO: skadesdato,
      erErhvervssygdom: true,
      fallbackMin,
    });
    // minus5Years = 2003-03-01, DATE_2005_01_01 er grænse → max(2003-03-01, 2005-01-01) = 2005-01-01
    expect(rule.minDate).toBe('2005-01-01');
  });

  it('erhvervssygdom med 29. feb → håndterer skudår korrekt', () => {
    const skadesdato = iso('2024-02-29'); // Skudår
    const rule = computeSkadesdatoMinRule({
      skadesdatoISO: skadesdato,
      erErhvervssygdom: true,
      fallbackMin,
    });
    // 2024-02-29 minus 5 år → 2019 har ikke 29. feb → 2019-02-28
    expect(rule.minDate).toBe('2019-02-28');
  });
});
