/// <reference types="vitest/globals" />

import type { ErstatningsopgoerelseValues } from '../../../schemas/formSchemas';
import type { AmountValue } from '../../../schemas/amountExpressionSchema';
import { toISODateString } from '../../../types/branded';
import { createErstatningsopgoerelseInitialValues } from '../../../domain/erstatningsopgoerelse/erstatningsopgoerelseInitialValues';
import { buildEODebugSvieSmerteRows } from '../../../domain/erstatningsopgoerelse/eoDebugErstatningsopgoerelseModel';

const iso = (value: string) => toISODateString(value);

const asAmountValue = (value: number): AmountValue => ({ kind: 'number', value });

const makeValues = (patch: Partial<ErstatningsopgoerelseValues>): ErstatningsopgoerelseValues => {
  const base = structuredClone(createErstatningsopgoerelseInitialValues());
  return { ...base, ...patch };
};

const isPresent = <T,>(value: T | null | undefined): value is T => value !== null && value !== undefined;

/**
 * Helper til at ekstrahere beregnet beløb fra debug rows
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

  // Tilføj vedroererPeriode hvis ikke allerede sat
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

const getSvieSmerteOphoerRow = (values: ErstatningsopgoerelseValues) => {
  const context = {
    skadesdatoISO: iso('2023-01-01'),
    erErhvervssygdom: false,
    menAfgoerelseDatoForTabel: values.varigeMenAfgorelse === 'Ja' ? values.menAfgoerelseDato : undefined,
    verserendeKlageMen: values.verserendeKlageMen === 'Ja',
  };
  const rows = buildEODebugSvieSmerteRows(values, {}, context);
  return rows.find((row) => row.id === 'sviesmerte.ophoerSkyldes');
};

describe('Svie/smerte beregning', () => {
  describe('Svie/smerte ophør skyldes', () => {
    it('viser "Ingen krav i perioden" med ok når beregning er Nej', () => {
      const row = getSvieSmerteOphoerRow(
        makeValues({
          beregnesSvieSmerteGodtgoerelse: 'Nej',
          tidligereSsMax: 'Ja',
        })
      );
      expect(row?.displayValue).toBe('Ingen krav i perioden');
      expect(row?.status).toBe('ok');
    });

    it('viser "Tidligere beregnet til max" når tidligereSsMax er Ja', () => {
      const row = getSvieSmerteOphoerRow(
        makeValues({
          beregnesSvieSmerteGodtgoerelse: 'Ja',
          tidligereSsMax: 'Ja',
        })
      );
      expect(row?.displayValue).toBe('Tidligere beregnet til max');
      expect(row?.status).toBe('ok');
    });

    it('viser "-" når sidste svie/smerte-dato er lig vedrørerPeriodeTil', () => {
      const row = getSvieSmerteOphoerRow(
        makeValues({
          beregnesSvieSmerteGodtgoerelse: 'Ja',
          tidligereSsMax: 'Nej',
          vedroererPeriodeTil: iso('2024-03-31'),
          svieSmertePerioder: [{ id: '1', fra: iso('2024-03-01'), til: iso('2024-03-31'), tilstand: 'sygemeldt' }],
        })
      );
      expect(row?.displayValue).toBe('-');
      expect(row?.status).toBe('ok');
    });

    it('viser "Ménafgørelse" når mén-dato er dagen efter sidste svie/smerte-dato', () => {
      const row = getSvieSmerteOphoerRow(
        makeValues({
          beregnesSvieSmerteGodtgoerelse: 'Ja',
          tidligereSsMax: 'Nej',
          varigeMenAfgorelse: 'Ja',
          verserendeKlageMen: 'Nej',
          menAfgoerelseDato: iso('2024-04-01'),
          svieSmertePerioder: [{ id: '1', fra: iso('2024-03-01'), til: iso('2024-03-31'), tilstand: 'sygemeldt' }],
          vedroererPeriodeTil: iso('2024-12-31'),
        })
      );
      expect(row?.displayValue).toBe('Ménafgørelse');
      expect(row?.status).toBe('ok');
    });

    it('viser "Raskmeldt" når helbredsforhold er Raskmeldt', () => {
      const row = getSvieSmerteOphoerRow(
        makeValues({
          beregnesSvieSmerteGodtgoerelse: 'Ja',
          tidligereSsMax: 'Nej',
          svieSmerteHelbredsstatus: 'Raskmeldt',
          vedroererPeriodeTil: iso('2024-12-31'),
          svieSmertePerioder: [{ id: '1', fra: iso('2024-03-01'), til: iso('2024-03-15'), tilstand: 'sygemeldt' }],
        })
      );
      expect(row?.displayValue).toBe('Raskmeldt');
      expect(row?.status).toBe('ok');
    });

    it('viser "Nået max i denne periode" når beregnet svie/smerte er begrænset af max', () => {
      const row = getSvieSmerteOphoerRow(
        makeValues({
          beregnesSvieSmerteGodtgoerelse: 'Ja',
          tidligereSsMax: 'Nej',
          svieSmerteHelbredsstatus: 'Sygemeldt',
          svieSmerteSatserAar: 2026,
          svieSmerteDelvisSygemeldingSats: 'fuld',
          svieSmerteTidligereTotal: asAmountValue(0),
          svieSmerteAktuelPeriode: asAmountValue(0),
          vedroererPeriodeFra: iso('2024-01-01'),
          vedroererPeriodeTil: iso('2025-12-31'),
          svieSmertePerioder: [{ id: '1', fra: iso('2024-01-01'), til: iso('2025-02-04'), tilstand: 'sygemeldt' }],
        })
      );
      expect(row?.displayValue).toBe('Nået max i denne periode');
      expect(row?.status).toBe('ok');
    });

    it('prioriterer "Nået max i denne periode" før "Raskmeldt"', () => {
      const row = getSvieSmerteOphoerRow(
        makeValues({
          beregnesSvieSmerteGodtgoerelse: 'Ja',
          tidligereSsMax: 'Nej',
          svieSmerteHelbredsstatus: 'Raskmeldt',
          svieSmerteSatserAar: 2026,
          svieSmerteDelvisSygemeldingSats: 'fuld',
          svieSmerteTidligereTotal: asAmountValue(0),
          svieSmerteAktuelPeriode: asAmountValue(0),
          vedroererPeriodeFra: iso('2024-01-01'),
          vedroererPeriodeTil: iso('2025-12-31'),
          svieSmertePerioder: [{ id: '1', fra: iso('2024-01-01'), til: iso('2025-02-04'), tilstand: 'sygemeldt' }],
        })
      );
      expect(row?.displayValue).toBe('Nået max i denne periode');
      expect(row?.status).toBe('ok');
    });

    it('viser warning med "Ikke rejst svie/smerte-krav for hele perioden" i fallback', () => {
      const row = getSvieSmerteOphoerRow(
        makeValues({
          beregnesSvieSmerteGodtgoerelse: 'Ja',
          tidligereSsMax: 'Nej',
          svieSmerteHelbredsstatus: 'Sygemeldt',
          vedroererPeriodeTil: iso('2024-12-31'),
          svieSmertePerioder: [{ id: '1', fra: iso('2024-03-01'), til: iso('2024-03-15'), tilstand: 'sygemeldt' }],
        })
      );
      expect(row?.displayValue).toBe('Ikke rejst svie/smerte-krav for hele perioden');
      expect(row?.status).toBe('warning');
    });
  });

  describe('Basis beregning uden forlig', () => {
    it('beregner korrekt uden tidligere krav eller betalinger', () => {
      // Max: 96.000 kr., sats per dag: 250 kr. (år 2024)
      // 100 sygedage × 250 kr. = 25.000 kr.
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

    it('begrænser til max når råbeløb overstiger', () => {
      // Max: 96.000 kr., sats per dag: 250 kr.
      // 400 sygedage × 250 kr. = 100.000 kr. → begrænset til 96.000 kr.
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

    it('marks beregnet periode as error when periods overlap with different tilstand', () => {
      const values = makeValues({
        vedroererPeriodeFra: iso('2023-06-22'),
        vedroererPeriodeTil: iso('2024-09-16'),
        svieSmertePerioder: [
          { id: '1', fra: iso('2023-06-22'), til: iso('2024-07-31'), tilstand: 'sygemeldt' },
          { id: '2', fra: iso('2024-09-01'), til: iso('2024-09-16'), tilstand: 'sygemeldt' },
          { id: '3', fra: iso('2024-07-15'), til: iso('2024-08-15'), tilstand: 'delvist-sygemeldt' },
        ],
      });
      const context = {
        skadesdatoISO: iso('2023-01-01'),
        erErhvervssygdom: false,
        menAfgoerelseDatoForTabel: undefined,
        verserendeKlageMen: false,
      };

      const rows = buildEODebugSvieSmerteRows(values, {}, context);
      const beregnetPeriode = rows.find((row) => row.id === 'sviesmerte.beregnetPeriode');
      const overlapPeriode = rows.find((row) => row.id === 'sviesmerte.periode.1');
      expect(beregnetPeriode?.status).toBe('error');
      expect(beregnetPeriode?.displayValue).toContain('Fejl (Der er overlappende perioder)');
      expect(overlapPeriode?.label).toBe('Periode (22-06-2023 - 31-07-2024)');
    });
  });

  describe('Forlig - procent', () => {
    it('beregner korrekt med 50% forlig', () => {
      // Max: 96.000 kr. × 50% = 48.000 kr.
      // 100 sygedage × 250 kr. × 50% = 12.500 kr.
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

    it('begrænser til reduceret max ved 50% forlig', () => {
      // Max: 96.000 kr. × 50% = 48.000 kr.
      // 400 sygedage × 250 kr. × 50% = 50.000 kr. → begrænset til 48.000 kr.
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
      // Max: 96.000 kr. × 25% = 24.000 kr.
      // 100 sygedage × 250 kr. × 25% = 6.250 kr.
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

  describe('Forlig - brøk', () => {
    it('beregner korrekt med 2/7 forlig', () => {
      // Max: 96.000 kr. × (2/7) = 27.428,57 kr.
      // Sats: 250 kr. × (2/7) = 71,43 kr.
      // 100 sygedage × 71,43 kr. = 7.142,86 kr.
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
      // Max: 96.000 kr. × (1/3) = 32.000 kr.
      // Sats: 250 kr. × (1/3) = 83,33 kr.
      // 100 sygedage × 83,33 kr. = 8.333,33 kr.
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

    it('begrænser til reduceret max ved 2/7 forlig', () => {
      // Max: 96.000 kr. × (2/7) = 27.428,57 kr.
      // Sats: 250 kr. × (2/7) = 71,43 kr.
      // 400 sygedage × 71,43 kr. = 28.571,43 kr. → begrænset til 27.428,57 kr.
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
      // Tidligere opgjort: 70.000 kr. → restplads: 26.000 kr.
      // Råbeløb: 120 sygedage × 250 kr. = 30.000 kr. → begrænset til 26.000 kr.
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
      // Max: 96.000 kr. × 50% = 48.000 kr.
      // Tidligere opgjort: 30.000 kr. → restplads: 18.000 kr.
      // Råbeløb: 100 sygedage × 125 kr. = 12.500 kr. (under restplads)
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

    it('returnerer 0 når tidligere opgjort overstiger max', () => {
      // Max: 96.000 kr.
      // Tidligere opgjort: 100.000 kr. → restplads: 0 kr.
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

    it('returnerer 0 når tidligere opgjort matcher max præcist', () => {
      // Max: 96.000 kr.
      // Tidligere opgjort: 96.000 kr. → restplads: 0 kr.
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

  describe('Allerede modtaget i nuværende periode', () => {
    it('fratrækker allerede modtaget fra beregnet beløb', () => {
      // Råbeløb: 100 sygedage × 250 kr. = 25.000 kr.
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

    it('returnerer 0 når allerede modtaget overstiger beregnet beløb', () => {
      // Råbeløb: 100 sygedage × 250 kr. = 25.000 kr.
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

    it('returnerer 0 når allerede modtaget matcher beregnet beløb præcist', () => {
      // Råbeløb: 100 sygedage × 250 kr. = 25.000 kr.
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
    it('scenarie fra Bjørns eksempel: max 96.000, ingen forlig, tidligere 70.000, råbeløb 30.000, allerede betalt 10.000', () => {
      // Max: 96.000 kr.
      // Tidligere opgjort: 70.000 kr. → restplads: 26.000 kr.
      // Råbeløb: 120 sygedage × 250 kr. = 30.000 kr. → begrænset til 26.000 kr.
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

    it('scenarie fra Bjørns eksempel: max 96.000, forlig 50%, tidligere 30.000, råbeløb 25.000, allerede betalt 10.000', () => {
      // Max: 96.000 kr. × 50% = 48.000 kr.
      // Tidligere opgjort: 30.000 kr. → restplads: 18.000 kr.
      // Råbeløb: 200 sygedage × 125 kr. = 25.000 kr. → begrænset til 18.000 kr.
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
      // Max: 96.000 kr. × (2/7) = 27.428,57 kr.
      // Sats: 250 kr. × (2/7) = 71,43 kr.
      // Tidligere opgjort: 15.000 kr. → restplads: 12.428,57 kr.
      // Råbeløb: 200 sygedage × 71,43 kr. = 14.285,71 kr. → begrænset til 12.428,57 kr.
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
      // Max: 96.000 kr. × (1/3) = 32.000 kr.
      // Tidligere opgjort: 30.000 kr. → restplads: 2.000 kr.
      // Råbeløb: 100 sygedage × 83,33 kr. = 8.333,33 kr. → begrænset til 2.000 kr.
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

    it('edge case: præcist max med alle faktorer', () => {
      // Max: 96.000 kr. × 25% = 24.000 kr.
      // Tidligere opgjort: 20.000 kr. → restplads: 4.000 kr.
      // Råbeløb: 100 sygedage × 62,50 kr. = 6.250 kr. → begrænset til 4.000 kr.
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
      // Tidligere opgjort: 95.999 kr. → restplads: 1 kr.
      // Råbeløb: 100 sygedage × 250 kr. = 25.000 kr. → begrænset til 1 kr.
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
      // 100 delvise sygedage × 250 kr. × 0,5 = 12.500 kr.
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

    it('beregner med fuld sats for delvise sygedage når valgt', () => {
      // 100 delvise sygedage × 250 kr. × 1,0 = 25.000 kr.
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
      // (50 × 125) + (50 × 0,5 × 125) = 6.250 + 3.125 = 9.375 kr.
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
