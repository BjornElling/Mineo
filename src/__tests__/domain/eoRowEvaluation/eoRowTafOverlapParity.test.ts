import { createErstatningsopgoerelseInitialValues } from '../../../domain/erstatningsopgoerelse/helpers/erstatningsopgoerelseInitialValues';
import { buildEoTaftRows } from '../../../domain/eoRowEvaluation/eoRowErstatningsopgoerelseModel';
import { toISODateString } from '../../../types/branded';

const iso = (value: string) => toISODateString(value);

describe('buildEoTaftRows overlap parity', () => {
  // Regression note:
  // Denne suite dækker tidligere kendt overlap-regression og skal forblive grøn (ingen skip).
  it('marks overlapping TAF periods as error rows', () => {
    const values = {
      ...createErstatningsopgoerelseInitialValues(),
      tafPerioder: [
        { id: 'a', fra: iso('2023-10-09'), til: iso('2023-12-31'), loseFeriedage: undefined },
        { id: 'b', fra: iso('2025-01-01'), til: iso('2025-01-10'), loseFeriedage: undefined },
        { id: 'c', fra: iso('2024-12-01'), til: iso('2025-01-31'), loseFeriedage: undefined },
      ],
      ferieperioder: [],
    };

    const context = {
      skadedatoISO: iso('2023-01-01'),
      skadelidteFodselsdato: undefined,
      erErhvervssygdom: false,
      endeligEETBeregnetDato: undefined,
      midlertidigEETBeregnetDato: undefined,
      differencekravDato: undefined,
      verserendeKlageEet: false,
    };

    const errors = {} as Parameters<typeof buildEoTaftRows>[1];
    const rows = buildEoTaftRows(values, errors, context);
    const periodRows = rows.filter((row) => row.id.startsWith('taf.periode.'));

    const rowB = periodRows.find((row) => row.id === 'taf.periode.b');
    const rowC = periodRows.find((row) => row.id === 'taf.periode.c');

    expect(rowB?.status).toBe('error');
    expect(rowC?.status).toBe('error');
    expect(rowB?.displayValue).toContain('Der er overlappende perioder');
    expect(rowC?.displayValue).toContain('Der er overlappende perioder');
  });

  it('advarer ikke når TAF-periode går ud over vedrører-periodens til-dato', () => {
    const values = {
      ...createErstatningsopgoerelseInitialValues(),
      vedroererPeriodeFra: iso('2024-06-01'),
      vedroererPeriodeTil: iso('2024-06-15'),
      tafPerioder: [
        { id: 'a', fra: iso('2024-06-01'), til: iso('2024-08-31'), loseFeriedage: undefined },
      ],
      ferieperioder: [],
    };

    const context = {
      skadedatoISO: iso('2023-01-01'),
      skadelidteFodselsdato: undefined,
      erErhvervssygdom: false,
      endeligEETBeregnetDato: undefined,
      midlertidigEETBeregnetDato: undefined,
      differencekravDato: undefined,
      verserendeKlageEet: false,
    };

    const errors = {} as Parameters<typeof buildEoTaftRows>[1];
    const rows = buildEoTaftRows(values, errors, context);
    const ophoerRow = rows.find((row) => row.id === 'taf.ophoerSkyldes');

    expect(ophoerRow?.status).toBe('ok');
    expect(ophoerRow?.displayValue).toContain('Erstatningsperiodens ophør');
  });

  it('beholder EO 1-adfærd uden advarsel når TAF først starter efter EO-periodens start', () => {
    const values = {
      ...createErstatningsopgoerelseInitialValues(),
      eoNummer: '1',
      vedroererPeriodeFra: iso('2024-01-01'),
      vedroererPeriodeTil: iso('2024-12-31'),
      tafPerioder: [
        { id: 'a', fra: iso('2024-02-01'), til: iso('2024-12-31'), loseFeriedage: undefined },
      ],
      ferieperioder: [],
    };

    const context = {
      skadedatoISO: iso('2023-01-01'),
      skadelidteFodselsdato: undefined,
      erErhvervssygdom: false,
      endeligEETBeregnetDato: undefined,
      midlertidigEETBeregnetDato: undefined,
      differencekravDato: undefined,
      verserendeKlageEet: false,
    };

    const errors = {} as Parameters<typeof buildEoTaftRows>[1];
    const rows = buildEoTaftRows(values, errors, context);
    const ophoerRow = rows.find((row) => row.id === 'taf.ophoerSkyldes');

    expect(ophoerRow?.status).toBe('ok');
    expect(ophoerRow?.displayValue).toContain('Erstatningsperiodens ophør');
  });

  it('advarer ved EO 2 når TAF først starter efter EO-periodens start', () => {
    const values = {
      ...createErstatningsopgoerelseInitialValues(),
      eoNummer: '2',
      vedroererPeriodeFra: iso('2024-01-01'),
      vedroererPeriodeTil: iso('2024-12-31'),
      tafPerioder: [
        { id: 'a', fra: iso('2024-02-01'), til: iso('2024-12-31'), loseFeriedage: undefined },
      ],
      ferieperioder: [],
    };

    const context = {
      skadedatoISO: iso('2023-01-01'),
      skadelidteFodselsdato: undefined,
      erErhvervssygdom: false,
      endeligEETBeregnetDato: undefined,
      midlertidigEETBeregnetDato: undefined,
      differencekravDato: undefined,
      verserendeKlageEet: false,
    };

    const errors = {} as Parameters<typeof buildEoTaftRows>[1];
    const rows = buildEoTaftRows(values, errors, context);
    const ophoerRow = rows.find((row) => row.id === 'taf.ophoerSkyldes');

    expect(ophoerRow?.status).toBe('warning');
    expect(ophoerRow?.displayValue).toBe('Ikke rejst TAF-krav for hele perioden');
  });

  it('advarer ikke ved EO 2 når TAF-perioden starter før EO-perioden og clampes til start', () => {
    const values = {
      ...createErstatningsopgoerelseInitialValues(),
      eoNummer: '2',
      vedroererPeriodeFra: iso('2024-01-01'),
      vedroererPeriodeTil: iso('2024-12-31'),
      tafPerioder: [
        { id: 'a', fra: iso('2023-12-01'), til: iso('2024-12-31'), loseFeriedage: undefined },
      ],
      ferieperioder: [],
    };

    const context = {
      skadedatoISO: iso('2023-01-01'),
      skadelidteFodselsdato: undefined,
      erErhvervssygdom: false,
      endeligEETBeregnetDato: undefined,
      midlertidigEETBeregnetDato: undefined,
      differencekravDato: undefined,
      verserendeKlageEet: false,
    };

    const errors = {} as Parameters<typeof buildEoTaftRows>[1];
    const rows = buildEoTaftRows(values, errors, context);
    const ophoerRow = rows.find((row) => row.id === 'taf.ophoerSkyldes');

    expect(ophoerRow?.status).toBe('ok');
    expect(ophoerRow?.displayValue).toContain('Erstatningsperiodens ophør');
  });

  it('bruger flertalslabel for ferie-rækker når mere end én ferieperiode er udfyldt', () => {
    const values = {
      ...createErstatningsopgoerelseInitialValues(),
      tafPerioder: [
        { id: 'a', fra: iso('2024-01-01'), til: iso('2024-01-31'), loseFeriedage: undefined },
      ],
      ferieperioder: [
        { id: 'f1', fra: iso('2024-01-05'), til: iso('2024-01-10') },
        { id: 'f2', fra: iso('2024-01-15'), til: iso('2024-01-20') },
      ],
    };

    const context = {
      skadedatoISO: iso('2023-01-01'),
      skadelidteFodselsdato: undefined,
      erErhvervssygdom: false,
      endeligEETBeregnetDato: undefined,
      midlertidigEETBeregnetDato: undefined,
      differencekravDato: undefined,
      verserendeKlageEet: false,
    };

    const errors = {} as Parameters<typeof buildEoTaftRows>[1];
    const rows = buildEoTaftRows(values, errors, context);
    const ferieRows = rows.filter((row) => row.id.startsWith('taf.ferie.'));

    expect(ferieRows).toHaveLength(2);
    expect(ferieRows.every((row) => row.label === 'Ferieperioder')).toBe(true);
  });

  it('bruger entalslabel for ferie-række når præcis én ferieperiode er udfyldt', () => {
    const values = {
      ...createErstatningsopgoerelseInitialValues(),
      tafPerioder: [
        { id: 'a', fra: iso('2024-01-01'), til: iso('2024-01-31'), loseFeriedage: undefined },
      ],
      ferieperioder: [
        { id: 'f1', fra: iso('2024-01-05'), til: iso('2024-01-10') },
      ],
    };

    const context = {
      skadedatoISO: iso('2023-01-01'),
      skadelidteFodselsdato: undefined,
      erErhvervssygdom: false,
      endeligEETBeregnetDato: undefined,
      midlertidigEETBeregnetDato: undefined,
      differencekravDato: undefined,
      verserendeKlageEet: false,
    };

    const errors = {} as Parameters<typeof buildEoTaftRows>[1];
    const rows = buildEoTaftRows(values, errors, context);
    const ferieRows = rows.filter((row) => row.id.startsWith('taf.ferie.'));

    expect(ferieRows).toHaveLength(1);
    expect(ferieRows[0]?.label).toBe('Ferieperiode');
  });

  it('viser "Ingen" og skjuler øvrige TAF-rækker når ingen TAF-perioder er udfyldt', () => {
    const values = {
      ...createErstatningsopgoerelseInitialValues(),
      tafPerioder: [],
      ferieperioder: [
        { id: 'f1', fra: iso('2024-01-05'), til: iso('2024-01-10') },
      ],
      tidligereModtagetTaf: { kind: 'expression' as const, value: 1234, expression: '1234' },
    };

    const context = {
      skadedatoISO: iso('2023-01-01'),
      skadelidteFodselsdato: undefined,
      erErhvervssygdom: false,
      endeligEETBeregnetDato: undefined,
      midlertidigEETBeregnetDato: undefined,
      differencekravDato: undefined,
      verserendeKlageEet: false,
    };

    const errors = {} as Parameters<typeof buildEoTaftRows>[1];
    const rows = buildEoTaftRows(values, errors, context);

    expect(rows).toEqual([
      {
        id: 'taf.periode.empty',
        label: 'Perioder',
        displayValue: 'Ingen',
        status: 'ok',
      },
    ]);
  });

  it('bruger entalslabel når præcis én TAF-periode er synlig', () => {
    const values = {
      ...createErstatningsopgoerelseInitialValues(),
      tafPerioder: [
        { id: 'a', fra: iso('2024-01-01'), til: iso('2024-01-31'), loseFeriedage: undefined },
      ],
      ferieperioder: [],
    };

    const context = {
      skadedatoISO: iso('2023-01-01'),
      skadelidteFodselsdato: undefined,
      erErhvervssygdom: false,
      endeligEETBeregnetDato: undefined,
      midlertidigEETBeregnetDato: undefined,
      differencekravDato: undefined,
      verserendeKlageEet: false,
    };

    const errors = {} as Parameters<typeof buildEoTaftRows>[1];
    const rows = buildEoTaftRows(values, errors, context);
    const periodRows = rows.filter((row) => row.id.startsWith('taf.periode.'));

    expect(periodRows).toHaveLength(1);
    expect(periodRows[0]?.label).toBe('Periode (01-01-2024 - 31-01-2024)');
  });

  it('bruger flertalslabel når flere TAF-perioder er synlige', () => {
    const values = {
      ...createErstatningsopgoerelseInitialValues(),
      tafPerioder: [
        { id: 'a', fra: iso('2024-01-01'), til: iso('2024-01-31'), loseFeriedage: undefined },
        { id: 'b', fra: iso('2024-02-01'), til: iso('2024-02-29'), loseFeriedage: undefined },
      ],
      ferieperioder: [],
    };

    const context = {
      skadedatoISO: iso('2023-01-01'),
      skadelidteFodselsdato: undefined,
      erErhvervssygdom: false,
      endeligEETBeregnetDato: undefined,
      midlertidigEETBeregnetDato: undefined,
      differencekravDato: undefined,
      verserendeKlageEet: false,
    };

    const errors = {} as Parameters<typeof buildEoTaftRows>[1];
    const rows = buildEoTaftRows(values, errors, context);
    const periodRows = rows.filter((row) => row.id.startsWith('taf.periode.'));

    expect(periodRows).toHaveLength(2);
    expect(periodRows.every((row) => row.label.startsWith('Perioder'))).toBe(true);
  });

  it('bruger flertalslabel når én periode er fuldt udfyldt og en anden er delvist udfyldt', () => {
    const values = {
      ...createErstatningsopgoerelseInitialValues(),
      tafPerioder: [
        { id: 'a', fra: iso('2024-01-01'), til: iso('2024-01-31'), loseFeriedage: undefined },
        { id: 'b', fra: iso('2024-02-01'), til: undefined, loseFeriedage: undefined },
      ],
      ferieperioder: [],
    };

    const context = {
      skadedatoISO: iso('2023-01-01'),
      skadelidteFodselsdato: undefined,
      erErhvervssygdom: false,
      endeligEETBeregnetDato: undefined,
      midlertidigEETBeregnetDato: undefined,
      differencekravDato: undefined,
      verserendeKlageEet: false,
    };

    const errors = {} as Parameters<typeof buildEoTaftRows>[1];
    const rows = buildEoTaftRows(values, errors, context);
    const periodRows = rows.filter((row) => row.id.startsWith('taf.periode.'));

    expect(periodRows).toHaveLength(2);
    expect(periodRows.every((row) => row.label.startsWith('Perioder'))).toBe(true);
  });

  it('viser "Ingen" for tom ferieperiode-sektion', () => {
    const values = {
      ...createErstatningsopgoerelseInitialValues(),
      tafPerioder: [
        { id: 'a', fra: iso('2024-01-01'), til: iso('2024-01-31'), loseFeriedage: undefined },
      ],
      ferieperioder: [],
    };

    const context = {
      skadedatoISO: iso('2023-01-01'),
      skadelidteFodselsdato: undefined,
      erErhvervssygdom: false,
      endeligEETBeregnetDato: undefined,
      midlertidigEETBeregnetDato: undefined,
      differencekravDato: undefined,
      verserendeKlageEet: false,
    };

    const errors = {} as Parameters<typeof buildEoTaftRows>[1];
    const rows = buildEoTaftRows(values, errors, context);
    const ferieEmptyRow = rows.find((row) => row.id === 'taf.ferie.empty');

    expect(ferieEmptyRow).toEqual({
      id: 'taf.ferie.empty',
      label: 'Ferieperioder',
      displayValue: 'Ingen',
      status: 'ok',
    });
  });

  it('viser advarsel når TAF-periode løber efter folkepensionsalder', () => {
    const values = {
      ...createErstatningsopgoerelseInitialValues(),
      opgørelseLavetDen: iso('2024-01-01'),
      tafPerioder: [
        { id: 'a', fra: iso('2024-01-01'), til: iso('2024-12-31'), loseFeriedage: undefined },
      ],
      ferieperioder: [],
    };

    const context = {
      skadedatoISO: iso('2023-01-01'),
      skadelidteFodselsdato: iso('1950-01-01'),
      erErhvervssygdom: false,
      endeligEETBeregnetDato: undefined,
      midlertidigEETBeregnetDato: undefined,
      differencekravDato: undefined,
      verserendeKlageEet: false,
    };

    const errors = {} as Parameters<typeof buildEoTaftRows>[1];
    const rows = buildEoTaftRows(values, errors, context);
    const warningRow = rows.find((row) => row.id === 'taf.folkepensionsalder.a');

    expect(warningRow?.status).toBe('warning');
    expect(warningRow?.displayValue).toContain('folkepensionsalder');
  });

  it('viser midlertidig EET som ophørsårsag og clampet TAF-slutdato for pre-2011-sager', () => {
    const values = {
      ...createErstatningsopgoerelseInitialValues(),
      tafPerioder: [
        { id: 'taf-pre-2011', fra: iso('2010-01-01'), til: iso('2011-12-31'), loseFeriedage: undefined },
      ],
      ferieperioder: [],
      midlertidigtEETAfgorelse: 'Ja' as const,
      midlertidigEETVirkningsdato: iso('2011-07-01'),
    };

    const context = {
      skadedatoISO: iso('2010-01-01'),
      skadelidteFodselsdato: undefined,
      erErhvervssygdom: false,
      endeligEETBeregnetDato: undefined,
      midlertidigEETBeregnetDato: iso('2011-07-01'),
      differencekravDato: undefined,
      verserendeKlageEet: false,
    };

    const errors = {} as Parameters<typeof buildEoTaftRows>[1];
    const rows = buildEoTaftRows(values, errors, context);

    const ophoerRow = rows.find((row) => row.id === 'taf.ophoerSkyldes');
    const periodeRow = rows.find((row) => row.id === 'taf.periode.taf-pre-2011');

    expect(ophoerRow?.displayValue).toBe('Midlertidig EET-afgørelse (01-07-2011)');
    expect(periodeRow?.label).toContain('01-01-2010 - 30-06-2011');
  });

  it('bruger ikke midlertidig EET som TAF-afgrænsning når skadedato er efter 15-06-2011', () => {
    const values = {
      ...createErstatningsopgoerelseInitialValues(),
      tafPerioder: [
        { id: 'taf-post-2011', fra: iso('2012-01-01'), til: iso('2012-12-31'), loseFeriedage: undefined },
      ],
      ferieperioder: [],
      midlertidigtEETAfgorelse: 'Ja' as const,
      midlertidigEETVirkningsdato: iso('2012-07-01'),
    };

    const context = {
      skadedatoISO: iso('2012-01-01'),
      skadelidteFodselsdato: undefined,
      erErhvervssygdom: false,
      endeligEETBeregnetDato: undefined,
      midlertidigEETBeregnetDato: iso('2012-07-01'),
      differencekravDato: undefined,
      verserendeKlageEet: false,
    };

    const errors = {} as Parameters<typeof buildEoTaftRows>[1];
    const rows = buildEoTaftRows(values, errors, context);

    const ophoerRow = rows.find((row) => row.id === 'taf.ophoerSkyldes');
    const periodeRow = rows.find((row) => row.id === 'taf.periode.taf-post-2011');

    expect(ophoerRow?.displayValue).not.toContain('Midlertidig EET-afgørelse');
    expect(periodeRow?.label).toContain('01-01-2012 - 31-12-2012');
  });
});
