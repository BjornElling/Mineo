import {
  getToday,
  MIN_YEAR,
  getCurrentYear,
  MIN_SVIESMERTE_YEAR,
  dateRanges_stamdata,
  dateRanges_erstatningsopgoerelse,
  dateRanges_offentligeYdelser,
  dateRanges_aarsloen,
  dateRanges_varigemen,
  computeSkadedatoMinRule,
} from '../../config/dateRanges';
import { toISODateString } from '../../types/branded';
import { varigeMenPrGradYearBounds } from '../../data/lovbestemteRates';

const iso = (s: string) => toISODateString(s);

// ─── Globale konstanter ───────────────────────────────────────────────────────

describe('dateRanges – globale konstanter', () => {
  it('getToday() er en gyldig ISO-dato (YYYY-MM-DD)', () => {
    expect(getToday()).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it('MIN_YEAR svarer til årstallet i systemets nedre datogrænse (2005-01-01)', () => {
    expect(MIN_YEAR).toBe(2005);
  });

  it('getCurrentYear() svarer til det aktuelle år i getToday()', () => {
    const currentYear = Number(getToday().slice(0, 4));
    expect(getCurrentYear()).toBe(currentYear);
  });

  it('MIN_YEAR ≤ getCurrentYear()', () => {
    expect(MIN_YEAR).toBeLessThanOrEqual(getCurrentYear());
  });

  it('MIN_SVIESMERTE_YEAR er et positivt heltal ≥ MIN_YEAR', () => {
    expect(Number.isInteger(MIN_SVIESMERTE_YEAR)).toBe(true);
    expect(MIN_SVIESMERTE_YEAR).toBeGreaterThanOrEqual(MIN_YEAR);
  });
});

// ─── Dags dato læses på opslagstidspunktet (ikke ved modulets import) ─────────

describe('dateRanges – dags dato er live, ikke et import-øjebliksbillede', () => {
  // Disse tests er værnet mod at `getToday`/`getCurrentYear` bliver lavet til `const` igen.
  // De ville ALLE fejle på den tidligere form, hvor værdien blev låst ved modulets import:
  // en session der står åben over midnat validerede fortsat mod gårsdagens maksimum.
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('getToday() følger med over midnat', () => {
    vi.setSystemTime(new Date(2026, 5, 15, 23, 59, 30));
    expect(getToday()).toBe('2026-06-15');

    vi.setSystemTime(new Date(2026, 5, 16, 0, 0, 30));
    expect(getToday()).toBe('2026-06-16');
  });

  it('getCurrentYear() følger med over et årsskifte', () => {
    vi.setSystemTime(new Date(2026, 11, 31, 23, 59, 30));
    expect(getCurrentYear()).toBe(2026);

    vi.setSystemTime(new Date(2027, 0, 1, 0, 0, 30));
    expect(getCurrentYear()).toBe(2027);
  });

  it('«i dag»-afgrænsede maksima følger med over midnat', () => {
    // Skadedato og «Opgørelse lavet den» har begge max = i dag. Var maksimum frosset,
    // kunne brugeren ikke indtaste dagens dato efter midnat uden at genindlæse appen.
    vi.setSystemTime(new Date(2026, 5, 15, 23, 59, 30));
    expect(dateRanges_stamdata.skadedato.max).toBe('2026-06-15');
    expect(dateRanges_erstatningsopgoerelse.opgoerelse.max).toBe('2026-06-15');

    vi.setSystemTime(new Date(2026, 5, 16, 0, 0, 30));
    expect(dateRanges_stamdata.skadedato.max).toBe('2026-06-16');
    expect(dateRanges_erstatningsopgoerelse.opgoerelse.max).toBe('2026-06-16');
  });

  it('årsafledte maksima følger med over et årsskifte', () => {
    // Årsløn-tabellens til-dato er 31-12 i AKTUELT år; EO-perioden går ét år frem.
    vi.setSystemTime(new Date(2026, 11, 31, 12, 0, 0));
    expect(dateRanges_aarsloen.tabelAarsloenTil.max).toBe('2026-12-31');
    expect(dateRanges_erstatningsopgoerelse.periodeTil.max).toBe('2027-12-31');

    vi.setSystemTime(new Date(2027, 0, 1, 12, 0, 0));
    expect(dateRanges_aarsloen.tabelAarsloenTil.max).toBe('2027-12-31');
    expect(dateRanges_erstatningsopgoerelse.periodeTil.max).toBe('2028-12-31');
  });

  it('MIN_SVIESMERTE_YEAR ≤ getCurrentYear()', () => {
    expect(MIN_SVIESMERTE_YEAR).toBeLessThanOrEqual(getCurrentYear());
  });
});

// ─── dateRanges_stamdata ──────────────────────────────────────────────────────

describe('dateRanges_stamdata', () => {
  it('skadedato er static type', () => {
    expect(dateRanges_stamdata.skadedato.type).toBe('static');
  });

  it('skadedato min er 2005-01-01', () => {
    expect(dateRanges_stamdata.skadedato.min).toBe(toISODateString('2005-01-01'));
  });

  it('skadedato max er getToday()', () => {
    expect(dateRanges_stamdata.skadedato.max).toBe(getToday());
  });

  // Bemærk: der er ingen placeholder-assertion længere. Intervallerne bar tidligere et
  // `placeholder`-felt, som INGEN kode læste; denne test og dens søster i varige mén var det eneste,
  // der holdt det i live. Formvejledningen ejes af dato-feltfamilien, og
  // `fieldFormatPlaceholders.test.ts` måler den dér.
});

// ─── dateRanges_erstatningsopgoerelse ────────────────────────────────────────

describe('dateRanges_erstatningsopgoerelse', () => {
  it('periodeFra er dynamic-max', () => {
    expect(dateRanges_erstatningsopgoerelse.periodeFra.type).toBe('dynamic-max');
    expect(dateRanges_erstatningsopgoerelse.periodeFra.max).toBe('DYNAMIC');
  });

  it('periodeFra min er 2005-01-01', () => {
    expect(dateRanges_erstatningsopgoerelse.periodeFra.min).toBe(toISODateString('2005-01-01'));
  });

  it('periodeTil er dynamic-min', () => {
    expect(dateRanges_erstatningsopgoerelse.periodeTil.type).toBe('dynamic-min');
    expect(dateRanges_erstatningsopgoerelse.periodeTil.min).toBe('DYNAMIC');
  });

  it('opgoerelse er dynamic-min', () => {
    expect(dateRanges_erstatningsopgoerelse.opgoerelse.type).toBe('dynamic-min');
    expect(dateRanges_erstatningsopgoerelse.opgoerelse.min).toBe('DYNAMIC');
    expect(dateRanges_erstatningsopgoerelse.opgoerelse.fallbackMin).toBe(toISODateString('2005-01-01'));
    expect(dateRanges_erstatningsopgoerelse.opgoerelse.max).toBe(getToday());
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

describe('dateRanges_offentligeYdelser', () => {
  it('afgrænser fra-dato til seneste fælles startdato for sygedagpenge og ATP', () => {
    expect(dateRanges_offentligeYdelser.fraDato.min).toBe(toISODateString('2005-01-03'));
    expect(dateRanges_offentligeYdelser.fraDato.fallbackMax).toBe(toISODateString('2027-01-03'));
  });

  it('afgrænser til-dato til tidligste fælles slutdato for sygedagpenge og ATP', () => {
    expect(dateRanges_offentligeYdelser.tilDato.fallbackMin).toBe(toISODateString('2005-01-03'));
    expect(dateRanges_offentligeYdelser.tilDato.max).toBe(toISODateString('2027-01-03'));
  });
});

// ─── dateRanges_varigemen ────────────────────────────────────────────────────

describe('dateRanges_varigemen', () => {
  it('beregningsdato er static type', () => {
    expect(dateRanges_varigemen.beregningsdato.type).toBe('static');
  });

  it('beregningsdato min/max er byte-identiske med den tidligere inline-afledning fra varigeMenPrGradYearBounds', () => {
    // Den oprindelige inline-form i MenberegningTab byggede grænserne direkte fra
    // year-bounds. Den centrale dateRanges-entry skal producere præcis samme strenge.
    expect(dateRanges_varigemen.beregningsdato.min).toBe(
      toISODateString(`${varigeMenPrGradYearBounds.minYear}-01-01`)
    );
    expect(dateRanges_varigemen.beregningsdato.max).toBe(
      toISODateString(`${varigeMenPrGradYearBounds.maxYear}-12-31`)
    );
  });

});

// ─── computeSkadedatoMinRule ─────────────────────────────────────────────────

describe('computeSkadedatoMinRule', () => {
  const fallbackMin = iso('2005-01-01');

  it('ingen skadedato → returnerer fallbackMin', () => {
    const rule = computeSkadedatoMinRule({
      skadedatoISO: undefined,
      erErhvervssygdom: false,
      fallbackMin,
    });
    expect(rule.minDate).toBe(toISODateString('2005-01-01'));
    expect(rule.minBoundKind).toBeUndefined();
  });

  it('arbejdsulykke med skadedato → minDate er skadedato', () => {
    const skadedato = iso('2020-06-15');
    const rule = computeSkadedatoMinRule({
      skadedatoISO: skadedato,
      erErhvervssygdom: false,
      fallbackMin,
    });
    expect(rule.minDate).toBe(toISODateString('2020-06-15'));
    expect(rule.minBoundKind).toBe('skadedato');
    expect(rule.minBoundReferenceISO).toBe(toISODateString('2020-06-15'));
  });

  it('arbejdsulykke med skadedato før fallback → bruger fallback', () => {
    // Skadedato er 2004 men fallback er 2005-01-01
    const skadedato = iso('2004-06-01');
    const rule = computeSkadedatoMinRule({
      skadedatoISO: skadedato,
      erErhvervssygdom: false,
      fallbackMin,
    });
    // max(2004-06-01, 2005-01-01) = 2005-01-01
    expect(rule.minDate).toBe(toISODateString('2005-01-01'));
  });

  it('erhvervssygdom → minBoundKind er anmeldelsesdatoMinus5Aar', () => {
    const skadedato = iso('2020-06-15');
    const rule = computeSkadedatoMinRule({
      skadedatoISO: skadedato,
      erErhvervssygdom: true,
      fallbackMin,
    });
    expect(rule.minBoundKind).toBe('anmeldelsesdatoMinus5Aar');
    expect(rule.minBoundReferenceISO).toBe(toISODateString('2020-06-15'));
  });

  it('erhvervssygdom 2020 → minDate er 2015-06-15 (5 år tilbage)', () => {
    const skadedato = iso('2020-06-15');
    const rule = computeSkadedatoMinRule({
      skadedatoISO: skadedato,
      erErhvervssygdom: true,
      fallbackMin,
    });
    expect(rule.minDate).toBe(toISODateString('2015-06-15'));
  });

  it('erhvervssygdom 2008 → minDate er 2005-01-01 (5 år minus = 2003, begrænset af 2005)', () => {
    const skadedato = iso('2008-03-01');
    const rule = computeSkadedatoMinRule({
      skadedatoISO: skadedato,
      erErhvervssygdom: true,
      fallbackMin,
    });
    // minus5Years = 2003-03-01, DATE_2005_01_01 er grænse → max(2003-03-01, 2005-01-01) = 2005-01-01
    expect(rule.minDate).toBe(toISODateString('2005-01-01'));
  });

  it('erhvervssygdom med 29. feb → håndterer skudår korrekt', () => {
    const skadedato = iso('2024-02-29'); // Skudår
    const rule = computeSkadedatoMinRule({
      skadedatoISO: skadedato,
      erErhvervssygdom: true,
      fallbackMin,
    });
    // 2024-02-29 minus 5 år → 2019 har ikke 29. feb → 2019-02-28
    expect(rule.minDate).toBe(toISODateString('2019-02-28'));
  });
});
