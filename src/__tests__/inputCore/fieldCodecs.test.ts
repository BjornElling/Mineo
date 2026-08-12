import {
  booleanFieldCodec,
  createChoiceFieldCodec,
  createAmountFieldCodec,
  createDateFieldCodec,
  createFractionFieldCodec,
  createIntegerFieldCodec,
  createPercentFieldCodec,
  createRequiredChoiceFieldCodec,
  createStringBackedFieldCodec,
  createWeekFieldCodec,
  createYearFieldCodec,
  optionalTextFieldCodec,
  textFieldCodec,
} from '../../inputCore';
import {
  buildFieldIssueMessage,
  resolveFieldIssueTooltip,
  FIELD_ISSUE_GENERIC_TOOLTIP,
  type FieldIssue,
} from '../../inputCore/inputIssue';
import type { AnyFieldRef } from '../../inputCore/fieldDescriptor';

describe('fieldCodecs', () => {
  it('canonicaliserer tomhed efter codecets værditype', () => {
    expect(textFieldCodec.parseForSettle('  ')).toEqual({ status: 'valid', value: '' });
    expect(optionalTextFieldCodec.parseForSettle('  ')).toEqual({ status: 'valid', value: undefined });
    expect(booleanFieldCodec.parseForSettle('  ')).toEqual({ status: 'valid', value: false });
    expect(createChoiceFieldCodec(['a', 'b']).parseForSettle('  ')).toEqual({ status: 'valid', value: undefined });
    expect(createRequiredChoiceFieldCodec(['a', 'b'], 'a').parseForSettle('  '))
      .toEqual({ status: 'valid', value: 'a' });
  });

  it('afviser kun format; et velformet år uden for min/max committes canonical (§1.6)', () => {
    const year = createYearFieldCodec({ minYear: 2000, maxYear: 2030, twoDigitYearPolicy: 'infer' });
    expect(year.parseForSettle('x')).toMatchObject({ status: 'rejected', reason: 'format' });
    // Out-of-bounds er efter kravændringen 2026-07-18 canonical (bounds-vurderes af en feltvalidator, ikke codecet).
    expect(year.parseForSettle('1990')).toEqual({ status: 'valid', value: 1990 });
    expect(year.normalizePaste?.('1990')).toBe('1990');

    const week = createWeekFieldCodec({
      minYear: 2000, maxYear: 2030, twoDigitYearPolicy: 'infer', maxDraftLength: 8,
    });
    expect(week.parseForSettle('5/2020')).toEqual({ status: 'valid', value: '05/2020' });
    // Årsdelen uden for [minYear, maxYear] er bounds → canonical.
    expect(week.parseForSettle('5/1990')).toEqual({ status: 'valid', value: '05/1990' });
    expect(week.normalizePaste?.('5/1990')).toBe('5/1990');
    // Uge-nummeret uden for 1..52/53 er en repræsenterbarhedsgrænse → forbliver format-rejected.
    expect(week.parseForSettle('53/2021')).toMatchObject({ status: 'rejected', reason: 'format' });
  });

  it('bevarer string-backed tomhed; et out-of-bounds år committes canonical som streng (§1.6)', () => {
    const source = createYearFieldCodec({ minYear: 2000, maxYear: 2030, twoDigitYearPolicy: 'infer' });
    const codec = createStringBackedFieldCodec(source);
    expect(codec.parseForSettle('')).toEqual({ status: 'valid', value: '' });
    expect(codec.parseForSettle('2020')).toEqual({ status: 'valid', value: '2020' });
    expect(codec.parseForSettle('1990')).toEqual({ status: 'valid', value: '1990' });
    expect(codec.parseForSettle('x')).toMatchObject({ status: 'rejected', reason: 'format' });
  });

  it('committer fortegn, cifferantal og min/max som canonical bounds-værdier', () => {
    const integer = createIntegerFieldCodec({
      allowNegative: false,
      maxDigits: 2,
      minValue: 1,
      maxValue: 55,
    });
    expect(integer.parseForSettle('-1')).toEqual({ status: 'valid', value: -1 });
    expect(integer.parseForSettle('999')).toEqual({ status: 'valid', value: 999 });
    expect(integer.maxDigits).toBe(2);
    expect(integer.normalizePaste?.('123')).toBe('12');

    const amount = createAmountFieldCodec({
      allowNegative: false,
      allowDecimals: true,
      minValue: 0,
      maxValue: 100,
    });
    expect(amount.parseForSettle('-1')).toMatchObject({
      status: 'valid',
      value: { kind: 'number', value: -1 },
    });

    const percent = createPercentFieldCodec({
      allowNegative: false,
      allowDecimals: true,
      minValue: 0,
      maxValue: 100,
    });
    expect(percent.parseForSettle('-5')).toEqual({ status: 'valid', value: -5 });
    expect(percent.parseForSettle('101')).toEqual({ status: 'valid', value: 101 });
  });

  it('canonicaliserer brøker og afviser ugyldig syntaks som format', () => {
    const codec = createFractionFieldCodec({ maxDigits: 10, canonicalizeOnCommit: true });
    expect(codec.parseForSettle('6/4')).toEqual({ status: 'valid', value: '3/2' });
    expect(codec.parseForSettle('1.5/3')).toEqual({ status: 'rejected', reason: 'format' });
    expect(codec.parseForSettle('')).toEqual({ status: 'valid', value: undefined });
  });

  it('normaliserer brøkens nuller og bærer konkret nul-fejl som detail', () => {
    const codec = createFractionFieldCodec({ maxDigits: 10, canonicalizeOnCommit: false });
    expect(codec.parseForSettle('02/04')).toEqual({ status: 'valid', value: '2/4' });
    expect(codec.parseForSettle('1/0')).toEqual({
      status: 'rejected',
      reason: 'format',
      detail: { tooltip: 'Nævneren må ikke være 0' },
    });
    expect(codec.parseForSettle('0/2')).toEqual({
      status: 'rejected',
      reason: 'format',
      detail: { tooltip: 'Tælleren må ikke være 0' },
    });
  });

  it('afviser indre mellemrum uden at omskrive den fejlende brøk', () => {
    const codec = createFractionFieldCodec({ maxDigits: 10 });
    expect(codec.parseForSettle('1 / 2')).toEqual({ status: 'rejected', reason: 'format' });
    expect(codec.parseForSettle('-1/2')).toEqual({ status: 'rejected', reason: 'format' });
  });

  /**
   * Et beløbsfelt, der ikke tager imod et komma, må heller ikke VISE et. Før denne binding hardkodede
   * amount-codec'en præcision 2 i både `format` og `formatForEdit`, så et heltalsfelt viste "450.000,00" —
   * en decimalhale brugeren hverken kunne skrive eller rette. Testen holder de to sider af samme
   * `allowDecimals`-flag sammen, og kontrasten til `allowDecimals: true` sikrer, at den måler netop
   * flaget og ikke blot "formatterer uden komma altid".
   */
  it('binder beløbs-VISNING til allowDecimals, så et komma-frit felt heller ikke viser komma', () => {
    const shared = { allowNegative: false, minValue: 1000, maxValue: 9999999 } as const;
    const integerOnly = createAmountFieldCodec({ ...shared, allowDecimals: false });
    const withDecimals = createAmountFieldCodec({ ...shared, allowDecimals: true });
    const value = { kind: 'number', value: 450000 } as const;

    expect(integerOnly.format(value)).toBe('450.000');
    expect(integerOnly.formatForEdit(value)).toBe('450.000');
    // Kontrasten: samme værdi, samme codec-familie — kun flaget adskiller dem.
    expect(withDecimals.format(value)).toBe('450.000,00');
    expect(withDecimals.formatForEdit(value)).toBe('450.000,00');

    // Et komma må ikke åbne editoren i et felt, hvor tegnfilteret straks ville blokere det.
    expect(integerOnly.acceptsInitialKey(',')).toBe(false);
    expect(withDecimals.acceptsInitialKey(',')).toBe(true);
    // Cifre åbner stadig editoren i begge — reglen rammer kommaet, ikke al indtastning.
    expect(integerOnly.acceptsInitialKey('5')).toBe(true);
    expect(integerOnly.decimalPolicy).toBe('integerOnly');
    expect(withDecimals.decimalPolicy).toBe('decimal');
  });

  it('bærer procentfeltets decimalpolitik fra codec-konfigurationen', () => {
    const withDecimals = createPercentFieldCodec({ allowNegative: false, allowDecimals: true });
    const integerOnly = createPercentFieldCodec({ allowNegative: false, allowDecimals: false });

    expect(withDecimals.decimalPolicy).toBe('decimal');
    expect(withDecimals.acceptsInitialKey(',')).toBe(true);
    expect(integerOnly.decimalPolicy).toBe('integerOnly');
    expect(integerOnly.acceptsInitialKey(',')).toBe(false);
  });

  /**
   * Codec-laget er det sted, en konkret parse-besked kan gå tabt for ALLE flader på én gang: et bart
   * `rejectedResolution('format')` ville kassere den besked, parse-kernen allerede har beregnet, og både
   * formular, gridcelle, a11y-tekst og download-tooltip ville falde til den generiske «Fejl i indtastning».
   * Testene måler den strukturerede `detail.tooltip`, som `resolveFieldIssueTooltip` viser ordret
   * (`error-contract.md` §4).
   */
  describe('en format-afvisning bærer parse-kernens konkrete årsag', () => {
    const date = createDateFieldCodec({ twoDigitYearPolicy: 'infer' });

    /**
     * Datofeltet videregiver ÅRSAGEN, ikke en færdig tekst. Et codec kender ikke feltet, og en generisk
     * årstalsbesked ville modsige feltets faktiske grænse (Fødselsdato slutter ved dags dato, ikke år 2100).
     * Teksten dannes derfor af `resolveDateFormatIssueText` — se `dateFormatIssueText.test.ts`.
     */
    it('datoens urepræsenterbare årstal videregives som en maskinlæsbar årsag', () => {
      expect(date.parseForSettle('31-12-1899')).toEqual({
        status: 'rejected',
        reason: 'format',
        detail: { dateInvalidKind: 'yearOutOfRepresentableRange' },
      });
      expect(date.parseForSettle('01-01-2101'))
        .toMatchObject({ detail: { dateInvalidKind: 'yearOutOfRepresentableRange' } });
    });

    /** Ordlyds-værn: codec'et må ikke lække et årsinterval til et DATOfelt. */
    it('lader ikke codec-laget formulere en årstalsbesked', () => {
      const rejection = date.parseForSettle('31-12-1899') as { detail?: Record<string, unknown> };
      expect(rejection.detail?.tooltip).toBeUndefined();
      expect(JSON.stringify(rejection.detail)).not.toMatch(/1900|2100|årstal/i);
    });

    it('en ikke-eksisterende kalenderdag får sin egen årsag', () => {
      expect(date.parseForSettle('31-02-2026')).toMatchObject({
        status: 'rejected',
        reason: 'format',
        detail: { dateInvalidKind: 'nonexistentDay' },
      });
    });

    /**
     * Kontrasten, der gør ovenstående til mere end «alt får en tooltip»: uparsebar og delvist indtastet
     * tekst har INGEN konkret besked at give, og §4 pkt. 1 nævner netop en delvist indtastet dato som det
     * tilfælde, der skal vise den generiske tekst. Uden denne gren ville tooltippen blive støj.
     */
    it('lader uparsebar tekst falde i den generiske gren', () => {
      for (const draft of ['abc', '15-', '15-06-202']) {
        expect(date.parseForSettle(draft)).toEqual({ status: 'rejected', reason: 'format' });
      }
    });

    it('ugenummeret uden for årets uger bærer den konkrete grænse', () => {
      const week = createWeekFieldCodec({ twoDigitYearPolicy: 'infer', maxDraftLength: 9 });
      // 2021 har 52 uger, 2020 har 53 — grænsen er årsafhængig og skal stå konkret i tooltippen.
      expect(week.parseForSettle('53/2021'))
        .toMatchObject({ detail: { tooltip: 'Uge skal være mellem 1 og 52' } });
      expect(week.parseForSettle('53/2020')).toEqual({ status: 'valid', value: '53/2020' });
      expect(week.parseForSettle('0/2020')).toMatchObject({ detail: { tooltip: 'Uge skal være mindst 1' } });
      // Ren formfejl har intet konkret at sige.
      expect(week.parseForSettle('xx')).toEqual({ status: 'rejected', reason: 'format' });
    });

    /** Hele vejen til den tekst, brugeren faktisk ser ved markøren — for de UGE-fejl, codec'et selv ejer. */
    it('viser den konkrete tekst som feltets tooltip', () => {
      const week = createWeekFieldCodec({ twoDigitYearPolicy: 'infer', maxDraftLength: 9 });
      const field = { descriptor: { label: 'Uge' }, address: {} } as unknown as AnyFieldRef;
      const asIssue = (raw: string): FieldIssue => {
        const resolution = week.parseForSettle(raw);
        if (resolution.status !== 'rejected') throw new Error(`forventede en afvisning for ${raw}`);
        return {
          kind: 'field',
          code: 'uge.format',
          severity: 'error',
          field,
          reason: resolution.reason,
          message: buildFieldIssueMessage(field),
          ...(resolution.detail === undefined ? {} : { detail: resolution.detail }),
        };
      };

      expect(resolveFieldIssueTooltip(asIssue('53/2021'))).toBe('Uge skal være mellem 1 og 52');
      expect(resolveFieldIssueTooltip(asIssue('xx'))).toBe(FIELD_ISSUE_GENERIC_TOOLTIP);
      // "Fejl og advarsler" viser fortsat den FULDE besked med feltnavnet — tooltippet er den korte kanal.
      expect(asIssue('53/2021').message)
        .toBe('Der er udfyldt en ugyldig værdi i feltet \'Uge\'');
    });
  });
});
