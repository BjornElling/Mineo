import type { ErstatningsopgoerelseValues } from '../../../schemas/formSchemas';
import type { AmountValue } from '../../../schemas/amountExpressionSchema';
import { toISODateString } from '../../../types/branded';
import { ERSTATNINGSOPGOERELSE_INITIAL_VALUES } from '../../../domain/erstatningsopgoerelse/erstatningsopgoerelseInitialValues';
import { buildEODebugSvieSmerteRows } from '../../../domain/erstatningsopgoerelse/eoDebugErstatningsopgoerelseModel';

const iso = (value: string) => toISODateString(value);

const asAmountValue = (value: number): AmountValue => ({ kind: 'number', value });

const makeValues = (patch: Partial<ErstatningsopgoerelseValues>): ErstatningsopgoerelseValues => {
  const base = structuredClone(ERSTATNINGSOPGOERELSE_INITIAL_VALUES);
  return { ...base, ...patch };
};

const isPresent = <T,>(value: T | null | undefined): value is T => value !== null && value !== undefined;

/**
 * Helper til at ekstrahere beregnet bel├©b fra debug rows
 */
const getBeregnetBeloeb = (values: ErstatningsopgoerelseValues): string => {
  const context = {
    skadesdatoISO: iso('2023-01-01'),
    erErhvervssygdom: false,
    menAfgoerelseDatoForTabel: undefined,
    verserendeKlageMen: false,
  };

  // Find min/max datoer fra svie/smerte perioder
  let minDate = iso('2024-01-01');
  let maxDate = iso('2025-12-31');

  if (values.svieSmertePerioder && values.svieSmertePerioder.length > 0) {
    const dates = values.svieSmertePerioder.flatMap((p) => [p.fra, p.til]).filter(isPresent);
    if (dates.length > 0) {
      const [firstDate, ...restDates] = dates;
      minDate = restDates.reduce((min, d) => (d < min ? d : min), firstDate);
      maxDate = restDates.reduce((max, d) => (d > max ? d : max), firstDate);
    }
  }

  // Tilf├©j vedroererPeriode hvis ikke allerede sat
  const completeValues = {
    ...values,
    vedroererPeriodeFra: values.vedroererPeriodeFra ?? minDate,
    vedroererPeriodeTil: values.vedroererPeriodeTil ?? maxDate,
  };

  const rows = buildEODebugSvieSmerteRows(completeValues, {}, context);
  const beregnetRow = rows.find((r) => r.id === 'sviesmerte.beregnetBeloeb');
  return beregnetRow?.displayValue ?? '-';
};

/**
 * Helper til at ekstrahere antal dage fra debug rows
 */
const getAntalDage = (values: ErstatningsopgoerelseValues): string => {
  const context = {
    skadesdatoISO: iso('2023-01-01'),
    erErhvervssygdom: false,
    menAfgoerelseDatoForTabel: undefined,
    verserendeKlageMen: false,
  };

  const rows = buildEODebugSvieSmerteRows(values, {}, context);
  const antalDageRow = rows.find((r) => r.id === 'sviesmerte.antalDage');
  return antalDageRow?.displayValue ?? '-';
};

describe('Svie/smerte beregning', () => {
  describe('Basis beregning uden forlig', () => {
    it('beregner korrekt uden tidligere krav eller betalinger', () => {
      // Max: 96.000 kr., sats per dag: 250 kr. (├Ñr 2024)
      // 100 sygedage ├ù 250 kr. = 25.000 kr.
      const values = makeValues({
        tidligereSsMax: 'Nej',
        svieSmertePerioder: [
          { id: '1', fra: iso('2024-01-01'), til: iso('2024-04-09'), tilstand: 'sygemeldt' },
        ],
        svieSmerteSatserAar: 2026,
        svieSmerteDelvisSygemeldingSats: 'fuld',
        svieSmerteTidligereTotal: asAmountValue(0),
        svieSmerteAktuelPeriode: asAmountValue(0),
      });

      const result = getBeregnetBeloeb(values);
      expect(result).toBe('25.000,00 kr.');
    });

    it('begr├ªnser til max n├Ñr r├Ñbel├©b overstiger', () => {
      // Max: 96.000 kr., sats per dag: 250 kr.
      // 400 sygedage ├ù 250 kr. = 100.000 kr. ÔåÆ begr├ªnset til 96.000 kr.
      const values = makeValues({
        tidligereSsMax: 'Nej',
        svieSmertePerioder: [
          { id: '1', fra: iso('2024-01-01'), til: iso('2025-02-04'), tilstand: 'sygemeldt' },
        ],
        svieSmerteSatserAar: 2026,
        svieSmerteDelvisSygemeldingSats: 'fuld',
        svieSmerteTidligereTotal: asAmountValue(0),
        svieSmerteAktuelPeriode: asAmountValue(0),
      });

      const result = getBeregnetBeloeb(values);
      expect(result).toBe('96.000,00 kr.');
    });
  });

  describe('Antal dage', () => {
    it('counts days inclusively across DST for sygemeldt period', () => {
      const values = makeValues({
        vedroererPeriodeFra: iso('2024-01-26'),
        vedroererPeriodeTil: iso('2024-10-20'),
        svieSmertePerioder: [
          { id: '1', fra: iso('2024-01-26'), til: iso('2024-10-20'), tilstand: 'sygemeldt' },
        ],
        svieSmerteSatserAar: 2024,
        svieSmerteDelvisSygemeldingSats: 'fuld',
      });

      const result = getAntalDage(values);
      expect(result).toBe('269 sygedage');
    });
  });

  describe('Forlig - procent', () => {
    it('beregner korrekt med 50% forlig', () => {
      // Max: 96.000 kr. ├ù 50% = 48.000 kr.
      // 100 sygedage ├ù 250 kr. ├ù 50% = 12.500 kr.
      const values = makeValues({
        forligAnsvarsgradProcent: 50,
        tidligereSsMax: 'Nej',
        svieSmertePerioder: [
          { id: '1', fra: iso('2024-01-01'), til: iso('2024-04-09'), tilstand: 'sygemeldt' },
        ],
        svieSmerteSatserAar: 2026,
        svieSmerteDelvisSygemeldingSats: 'fuld',
        svieSmerteTidligereTotal: asAmountValue(0),
        svieSmerteAktuelPeriode: asAmountValue(0),
      });

      const result = getBeregnetBeloeb(values);
      expect(result).toBe('12.500,00 kr.');
    });

    it('begr├ªnser til reduceret max ved 50% forlig', () => {
      // Max: 96.000 kr. ├ù 50% = 48.000 kr.
      // 400 sygedage ├ù 250 kr. ├ù 50% = 50.000 kr. ÔåÆ begr├ªnset til 48.000 kr.
      const values = makeValues({
        forligAnsvarsgradProcent: 50,
        tidligereSsMax: 'Nej',
        svieSmertePerioder: [
          { id: '1', fra: iso('2024-01-01'), til: iso('2025-02-04'), tilstand: 'sygemeldt' },
        ],
        svieSmerteSatserAar: 2026,
        svieSmerteDelvisSygemeldingSats: 'fuld',
        svieSmerteTidligereTotal: asAmountValue(0),
        svieSmerteAktuelPeriode: asAmountValue(0),
      });

      const result = getBeregnetBeloeb(values);
      expect(result).toBe('48.000,00 kr.');
    });

    it('beregner korrekt med 25% forlig', () => {
      // Max: 96.000 kr. ├ù 25% = 24.000 kr.
      // 100 sygedage ├ù 250 kr. ├ù 25% = 6.250 kr.
      const values = makeValues({
        forligAnsvarsgradProcent: 25,
        tidligereSsMax: 'Nej',
        svieSmertePerioder: [
          { id: '1', fra: iso('2024-01-01'), til: iso('2024-04-09'), tilstand: 'sygemeldt' },
        ],
        svieSmerteSatserAar: 2026,
        svieSmerteDelvisSygemeldingSats: 'fuld',
        svieSmerteTidligereTotal: asAmountValue(0),
        svieSmerteAktuelPeriode: asAmountValue(0),
      });

      const result = getBeregnetBeloeb(values);
      expect(result).toBe('6.250,00 kr.');
    });
  });

  describe('Forlig - br├©k', () => {
    it('beregner korrekt med 2/7 forlig', () => {
      // Max: 96.000 kr. ├ù (2/7) = 27.428,57 kr.
      // Sats: 250 kr. ├ù (2/7) = 71,43 kr.
      // 100 sygedage ├ù 71,43 kr. = 7.142,86 kr.
      const values = makeValues({
        forligAnsvarsgradBroek: '2/7',
        tidligereSsMax: 'Nej',
        svieSmertePerioder: [
          { id: '1', fra: iso('2024-01-01'), til: iso('2024-04-09'), tilstand: 'sygemeldt' },
        ],
        svieSmerteSatserAar: 2026,
        svieSmerteDelvisSygemeldingSats: 'fuld',
        svieSmerteTidligereTotal: asAmountValue(0),
        svieSmerteAktuelPeriode: asAmountValue(0),
      });

      const result = getBeregnetBeloeb(values);
      expect(result).toBe('7.142,86 kr.');
    });

    it('beregner korrekt med 1/3 forlig', () => {
      // Max: 96.000 kr. ├ù (1/3) = 32.000 kr.
      // Sats: 250 kr. ├ù (1/3) = 83,33 kr.
      // 100 sygedage ├ù 83,33 kr. = 8.333,33 kr.
      const values = makeValues({
        forligAnsvarsgradBroek: '1/3',
        tidligereSsMax: 'Nej',
        svieSmertePerioder: [
          { id: '1', fra: iso('2024-01-01'), til: iso('2024-04-09'), tilstand: 'sygemeldt' },
        ],
        svieSmerteSatserAar: 2026,
        svieSmerteDelvisSygemeldingSats: 'fuld',
        svieSmerteTidligereTotal: asAmountValue(0),
        svieSmerteAktuelPeriode: asAmountValue(0),
      });

      const result = getBeregnetBeloeb(values);
      expect(result).toBe('8.333,33 kr.');
    });

    it('begr├ªnser til reduceret max ved 2/7 forlig', () => {
      // Max: 96.000 kr. ├ù (2/7) = 27.428,57 kr.
      // Sats: 250 kr. ├ù (2/7) = 71,43 kr.
      // 400 sygedage ├ù 71,43 kr. = 28.571,43 kr. ÔåÆ begr├ªnset til 27.428,57 kr.
      const values = makeValues({
        forligAnsvarsgradBroek: '2/7',
        tidligereSsMax: 'Nej',
        svieSmertePerioder: [
          { id: '1', fra: iso('2024-01-01'), til: iso('2025-02-04'), tilstand: 'sygemeldt' },
        ],
        svieSmerteSatserAar: 2026,
        svieSmerteDelvisSygemeldingSats: 'fuld',
        svieSmerteTidligereTotal: asAmountValue(0),
        svieSmerteAktuelPeriode: asAmountValue(0),
      });

      const result = getBeregnetBeloeb(values);
      expect(result).toBe('27.428,57 kr.');
    });
  });

  describe('Tidligere opgjorte krav', () => {
    it('reducerer restplads med tidligere opgjort uden forlig', () => {
      // Max: 96.000 kr.
      // Tidligere opgjort: 70.000 kr. ÔåÆ restplads: 26.000 kr.
      // R├Ñbel├©b: 120 sygedage ├ù 250 kr. = 30.000 kr. ÔåÆ begr├ªnset til 26.000 kr.
      const values = makeValues({
        tidligereSsMax: 'Nej',
        svieSmertePerioder: [
          { id: '1', fra: iso('2024-01-01'), til: iso('2024-04-28'), tilstand: 'sygemeldt' },
        ],
        svieSmerteSatserAar: 2026,
        svieSmerteDelvisSygemeldingSats: 'fuld',
        svieSmerteTidligereTotal: asAmountValue(70000),
        svieSmerteAktuelPeriode: asAmountValue(0),
      });

      const result = getBeregnetBeloeb(values);
      expect(result).toBe('26.000,00 kr.');
    });

    it('reducerer restplads med tidligere opgjort ved 50% forlig', () => {
      // Max: 96.000 kr. ├ù 50% = 48.000 kr.
      // Tidligere opgjort: 30.000 kr. ÔåÆ restplads: 18.000 kr.
      // R├Ñbel├©b: 100 sygedage ├ù 125 kr. = 12.500 kr. (under restplads)
      const values = makeValues({
        forligAnsvarsgradProcent: 50,
        tidligereSsMax: 'Nej',
        svieSmertePerioder: [
          { id: '1', fra: iso('2024-01-01'), til: iso('2024-04-09'), tilstand: 'sygemeldt' },
        ],
        svieSmerteSatserAar: 2026,
        svieSmerteDelvisSygemeldingSats: 'fuld',
        svieSmerteTidligereTotal: asAmountValue(30000),
        svieSmerteAktuelPeriode: asAmountValue(0),
      });

      const result = getBeregnetBeloeb(values);
      expect(result).toBe('12.500,00 kr.');
    });

    it('returnerer 0 n├Ñr tidligere opgjort overstiger max', () => {
      // Max: 96.000 kr.
      // Tidligere opgjort: 100.000 kr. ÔåÆ restplads: 0 kr.
      const values = makeValues({
        tidligereSsMax: 'Nej',
        svieSmertePerioder: [
          { id: '1', fra: iso('2024-01-01'), til: iso('2024-04-09'), tilstand: 'sygemeldt' },
        ],
        svieSmerteSatserAar: 2026,
        svieSmerteDelvisSygemeldingSats: 'fuld',
        svieSmerteTidligereTotal: asAmountValue(100000),
        svieSmerteAktuelPeriode: asAmountValue(0),
      });

      const result = getBeregnetBeloeb(values);
      expect(result).toBe('0,00 kr.');
    });

    it('returnerer 0 n├Ñr tidligere opgjort matcher max pr├ªcist', () => {
      // Max: 96.000 kr.
      // Tidligere opgjort: 96.000 kr. ÔåÆ restplads: 0 kr.
      const values = makeValues({
        tidligereSsMax: 'Nej',
        svieSmertePerioder: [
          { id: '1', fra: iso('2024-01-01'), til: iso('2024-04-09'), tilstand: 'sygemeldt' },
        ],
        svieSmerteSatserAar: 2026,
        svieSmerteDelvisSygemeldingSats: 'fuld',
        svieSmerteTidligereTotal: asAmountValue(96000),
        svieSmerteAktuelPeriode: asAmountValue(0),
      });

      const result = getBeregnetBeloeb(values);
      expect(result).toBe('0,00 kr.');
    });
  });

  describe('Allerede modtaget i nuv├ªrende periode', () => {
    it('fratr├ªkker allerede modtaget fra beregnet bel├©b', () => {
      // R├Ñbel├©b: 100 sygedage ├ù 250 kr. = 25.000 kr.
      // Allerede modtaget: 10.000 kr.
      // Endeligt: 25.000 - 10.000 = 15.000 kr.
      const values = makeValues({
        tidligereSsMax: 'Nej',
        svieSmertePerioder: [
          { id: '1', fra: iso('2024-01-01'), til: iso('2024-04-09'), tilstand: 'sygemeldt' },
        ],
        svieSmerteSatserAar: 2026,
        svieSmerteDelvisSygemeldingSats: 'fuld',
        svieSmerteTidligereTotal: asAmountValue(0),
        svieSmerteAktuelPeriode: asAmountValue(10000),
      });

      const result = getBeregnetBeloeb(values);
      expect(result).toBe('15.000,00 kr.');
    });

    it('returnerer 0 n├Ñr allerede modtaget overstiger beregnet bel├©b', () => {
      // R├Ñbel├©b: 100 sygedage ├ù 250 kr. = 25.000 kr.
      // Allerede modtaget: 30.000 kr.
      // Endeligt: max(0, 25.000 - 30.000) = 0 kr.
      const values = makeValues({
        tidligereSsMax: 'Nej',
        svieSmertePerioder: [
          { id: '1', fra: iso('2024-01-01'), til: iso('2024-04-09'), tilstand: 'sygemeldt' },
        ],
        svieSmerteSatserAar: 2026,
        svieSmerteDelvisSygemeldingSats: 'fuld',
        svieSmerteTidligereTotal: asAmountValue(0),
        svieSmerteAktuelPeriode: asAmountValue(30000),
      });

      const result = getBeregnetBeloeb(values);
      expect(result).toBe('0,00 kr.');
    });

    it('returnerer 0 n├Ñr allerede modtaget matcher beregnet bel├©b pr├ªcist', () => {
      // R├Ñbel├©b: 100 sygedage ├ù 250 kr. = 25.000 kr.
      // Allerede modtaget: 25.000 kr.
      // Endeligt: 0 kr.
      const values = makeValues({
        tidligereSsMax: 'Nej',
        svieSmertePerioder: [
          { id: '1', fra: iso('2024-01-01'), til: iso('2024-04-09'), tilstand: 'sygemeldt' },
        ],
        svieSmerteSatserAar: 2026,
        svieSmerteDelvisSygemeldingSats: 'fuld',
        svieSmerteTidligereTotal: asAmountValue(0),
        svieSmerteAktuelPeriode: asAmountValue(25000),
      });

      const result = getBeregnetBeloeb(values);
      expect(result).toBe('0,00 kr.');
    });
  });

  describe('Komplekse scenarier - kombination af forlig, tidligere opgjort og allerede modtaget', () => {
    it('scenarie fra Bj├©rns eksempel: max 96.000, ingen forlig, tidligere 70.000, r├Ñbel├©b 30.000, allerede betalt 10.000', () => {
      // Max: 96.000 kr.
      // Tidligere opgjort: 70.000 kr. ÔåÆ restplads: 26.000 kr.
      // R├Ñbel├©b: 120 sygedage ├ù 250 kr. = 30.000 kr. ÔåÆ begr├ªnset til 26.000 kr.
      // Allerede modtaget: 10.000 kr.
      // Endeligt: 26.000 - 10.000 = 16.000 kr.
      const values = makeValues({
        tidligereSsMax: 'Nej',
        svieSmertePerioder: [
          { id: '1', fra: iso('2024-01-01'), til: iso('2024-04-28'), tilstand: 'sygemeldt' },
        ],
        svieSmerteSatserAar: 2026,
        svieSmerteDelvisSygemeldingSats: 'fuld',
        svieSmerteTidligereTotal: asAmountValue(70000),
        svieSmerteAktuelPeriode: asAmountValue(10000),
      });

      const result = getBeregnetBeloeb(values);
      expect(result).toBe('16.000,00 kr.');
    });

    it('scenarie fra Bj├©rns eksempel: max 96.000, forlig 50%, tidligere 30.000, r├Ñbel├©b 25.000, allerede betalt 10.000', () => {
      // Max: 96.000 kr. ├ù 50% = 48.000 kr.
      // Tidligere opgjort: 30.000 kr. ÔåÆ restplads: 18.000 kr.
      // R├Ñbel├©b: 200 sygedage ├ù 125 kr. = 25.000 kr. ÔåÆ begr├ªnset til 18.000 kr.
      // Allerede modtaget: 10.000 kr.
      // Endeligt: 18.000 - 10.000 = 8.000 kr.
      const values = makeValues({
        forligAnsvarsgradProcent: 50,
        tidligereSsMax: 'Nej',
        svieSmertePerioder: [
          { id: '1', fra: iso('2024-01-01'), til: iso('2024-07-17'), tilstand: 'sygemeldt' },
        ],
        svieSmerteSatserAar: 2026,
        svieSmerteDelvisSygemeldingSats: 'fuld',
        svieSmerteTidligereTotal: asAmountValue(30000),
        svieSmerteAktuelPeriode: asAmountValue(10000),
      });

      const result = getBeregnetBeloeb(values);
      expect(result).toBe('8.000,00 kr.');
    });

    it('komplekst scenarie med 2/7 forlig, tidligere opgjort, og allerede betalt', () => {
      // Max: 96.000 kr. ├ù (2/7) = 27.428,57 kr.
      // Sats: 250 kr. ├ù (2/7) = 71,43 kr.
      // Tidligere opgjort: 15.000 kr. ÔåÆ restplads: 12.428,57 kr.
      // R├Ñbel├©b: 200 sygedage ├ù 71,43 kr. = 14.285,71 kr. ÔåÆ begr├ªnset til 12.428,57 kr.
      // Allerede modtaget: 5.000 kr.
      // Endeligt: 12.428,57 - 5.000 = 7.428,57 kr.
      const values = makeValues({
        forligAnsvarsgradBroek: '2/7',
        tidligereSsMax: 'Nej',
        svieSmertePerioder: [
          { id: '1', fra: iso('2024-01-01'), til: iso('2024-07-17'), tilstand: 'sygemeldt' },
        ],
        svieSmerteSatserAar: 2026,
        svieSmerteDelvisSygemeldingSats: 'fuld',
        svieSmerteTidligereTotal: asAmountValue(15000),
        svieSmerteAktuelPeriode: asAmountValue(5000),
      });

      const result = getBeregnetBeloeb(values);
      expect(result).toBe('7.428,57 kr.');
    });

    it('edge case: tidligere + allerede betalt overstiger max med forlig', () => {
      // Max: 96.000 kr. ├ù (1/3) = 32.000 kr.
      // Tidligere opgjort: 30.000 kr. ÔåÆ restplads: 2.000 kr.
      // R├Ñbel├©b: 100 sygedage ├ù 83,33 kr. = 8.333,33 kr. ÔåÆ begr├ªnset til 2.000 kr.
      // Allerede modtaget: 3.000 kr.
      // Endeligt: max(0, 2.000 - 3.000) = 0 kr.
      const values = makeValues({
        forligAnsvarsgradBroek: '1/3',
        tidligereSsMax: 'Nej',
        svieSmertePerioder: [
          { id: '1', fra: iso('2024-01-01'), til: iso('2024-04-09'), tilstand: 'sygemeldt' },
        ],
        svieSmerteSatserAar: 2026,
        svieSmerteDelvisSygemeldingSats: 'fuld',
        svieSmerteTidligereTotal: asAmountValue(30000),
        svieSmerteAktuelPeriode: asAmountValue(3000),
      });

      const result = getBeregnetBeloeb(values);
      expect(result).toBe('0,00 kr.');
    });

    it('edge case: pr├ªcist max med alle faktorer', () => {
      // Max: 96.000 kr. ├ù 25% = 24.000 kr.
      // Tidligere opgjort: 20.000 kr. ÔåÆ restplads: 4.000 kr.
      // R├Ñbel├©b: 100 sygedage ├ù 62,50 kr. = 6.250 kr. ÔåÆ begr├ªnset til 4.000 kr.
      // Allerede modtaget: 4.000 kr.
      // Endeligt: 4.000 - 4.000 = 0 kr.
      const values = makeValues({
        forligAnsvarsgradProcent: 25,
        tidligereSsMax: 'Nej',
        svieSmertePerioder: [
          { id: '1', fra: iso('2024-01-01'), til: iso('2024-04-09'), tilstand: 'sygemeldt' },
        ],
        svieSmerteSatserAar: 2026,
        svieSmerteDelvisSygemeldingSats: 'fuld',
        svieSmerteTidligereTotal: asAmountValue(20000),
        svieSmerteAktuelPeriode: asAmountValue(4000),
      });

      const result = getBeregnetBeloeb(values);
      expect(result).toBe('0,00 kr.');
    });

    it('minimal restplads scenarie med 1 krone tilbage', () => {
      // Max: 96.000 kr.
      // Tidligere opgjort: 95.999 kr. ÔåÆ restplads: 1 kr.
      // R├Ñbel├©b: 100 sygedage ├ù 250 kr. = 25.000 kr. ÔåÆ begr├ªnset til 1 kr.
      // Allerede modtaget: 0 kr.
      // Endeligt: 1 kr.
      const values = makeValues({
        tidligereSsMax: 'Nej',
        svieSmertePerioder: [
          { id: '1', fra: iso('2024-01-01'), til: iso('2024-04-09'), tilstand: 'sygemeldt' },
        ],
        svieSmerteSatserAar: 2026,
        svieSmerteDelvisSygemeldingSats: 'fuld',
        svieSmerteTidligereTotal: asAmountValue(95999),
        svieSmerteAktuelPeriode: asAmountValue(0),
      });

      const result = getBeregnetBeloeb(values);
      expect(result).toBe('1,00 kr.');
    });
  });

  describe('Delvis sygemelding', () => {
    it('beregner med halv sats for delvise sygedage', () => {
      // 100 delvise sygedage ├ù 250 kr. ├ù 0,5 = 12.500 kr.
      const values = makeValues({
        tidligereSsMax: 'Nej',
        svieSmertePerioder: [
          { id: '1', fra: iso('2024-01-01'), til: iso('2024-04-09'), tilstand: 'delvist-sygemeldt' },
        ],
        svieSmerteSatserAar: 2026,
        svieSmerteDelvisSygemeldingSats: 'halv',
        svieSmerteTidligereTotal: asAmountValue(0),
        svieSmerteAktuelPeriode: asAmountValue(0),
      });

      const result = getBeregnetBeloeb(values);
      expect(result).toBe('12.500,00 kr.');
    });

    it('beregner med fuld sats for delvise sygedage n├Ñr valgt', () => {
      // 100 delvise sygedage ├ù 250 kr. ├ù 1,0 = 25.000 kr.
      const values = makeValues({
        tidligereSsMax: 'Nej',
        svieSmertePerioder: [
          { id: '1', fra: iso('2024-01-01'), til: iso('2024-04-09'), tilstand: 'delvist-sygemeldt' },
        ],
        svieSmerteSatserAar: 2026,
        svieSmerteDelvisSygemeldingSats: 'fuld',
        svieSmerteTidligereTotal: asAmountValue(0),
        svieSmerteAktuelPeriode: asAmountValue(0),
      });

      const result = getBeregnetBeloeb(values);
      expect(result).toBe('25.000,00 kr.');
    });

    it('kombinerer fuld og delvis sygemelding med forlig', () => {
      // 50 fuldtidssygedage + 50 delvise sygedage
      // Forlig 50%: sats = 125 kr., delvis faktor = 0,5
      // (50 ├ù 125) + (50 ├ù 0,5 ├ù 125) = 6.250 + 3.125 = 9.375 kr.
      const values = makeValues({
        forligAnsvarsgradProcent: 50,
        tidligereSsMax: 'Nej',
        svieSmertePerioder: [
          { id: '1', fra: iso('2024-01-01'), til: iso('2024-02-19'), tilstand: 'sygemeldt' },
          { id: '2', fra: iso('2024-02-20'), til: iso('2024-04-09'), tilstand: 'delvist-sygemeldt' },
        ],
        svieSmerteSatserAar: 2026,
        svieSmerteDelvisSygemeldingSats: 'halv',
        svieSmerteTidligereTotal: asAmountValue(0),
        svieSmerteAktuelPeriode: asAmountValue(0),
      });

      const result = getBeregnetBeloeb(values);
      expect(result).toBe('9.375,00 kr.');
    });
  });
});
