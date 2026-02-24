import { describe, expect, it, vi } from 'vitest';
import { createErstatningsopgoerelseInitialValues } from '../../../domain/erstatningsopgoerelse/erstatningsopgoerelseInitialValues';
import { STAMDATA_INITIAL_VALUES } from '../../../domain/stamdata/stamdataInitialValues';
import { toISODateString } from '../../../types/branded';
import type { AmountValue } from '../../../schemas/amountExpressionSchema';

const MockJsPDF = vi.hoisted(() =>
  class MockJsPDF {
    static lastInstance: MockJsPDF | null = null;
    internal = { pageSize: { width: 210, height: 297 } };
    text = vi.fn();
    private currentFontName = 'helvetica';
    private currentFontStyle = 'normal';
    setFont = vi.fn((fontName: string, fontStyle: string) => {
      this.currentFontName = fontName;
      this.currentFontStyle = fontStyle;
    });
    getFont = vi.fn(() => ({ fontName: this.currentFontName, fontStyle: this.currentFontStyle }));
    setFontSize = vi.fn();
    setTextColor = vi.fn();
    setDisplayMode = vi.fn();
    setProperties = vi.fn();
    splitTextToSize = vi.fn((text: string) => [text]);
    getTextWidth = vi.fn((text: string) => text.length);
    getNumberOfPages = vi.fn(() => 1);
    setPage = vi.fn();
    line = vi.fn();
    setLineWidth = vi.fn();
    addPage = vi.fn();
    save = vi.fn();

    constructor() {
      MockJsPDF.lastInstance = this;
    }
  }
);

vi.mock('jspdf', () => ({ default: MockJsPDF }));

const iso = (value: string) => toISODateString(value);
const asAmountValue = (value: number): AmountValue => ({ kind: 'number', value });

const selected = {
  opgoerelse: true,
  loenindkomst: false,
  offentligeYdelser: false,
  shDage: false,
  regulering: false,
  okSatser: false,
  sygeferiegodtgoerelse: false,
};

const collectTextStrings = (instance: MockJsPDF | null): string[] => {
  if (!instance) return [];
  const values: string[] = [];
  for (const call of instance.text.mock.calls) {
    const [firstArg] = call;
    if (typeof firstArg === 'string') {
      values.push(firstArg);
      continue;
    }
    if (Array.isArray(firstArg)) {
      for (const item of firstArg) {
        if (typeof item === 'string') values.push(item);
      }
    }
  }
  return values;
};

const hasTextAfterHeader = (texts: readonly string[], header: string, expected: string): boolean => {
  const index = texts.indexOf(header);
  if (index === -1) return false;
  return texts.slice(index + 1).some((text) => text === expected);
};

const findTextY = (instance: MockJsPDF | null, text: string): number | null => {
  if (!instance) return null;
  for (const call of instance.text.mock.calls) {
    const [firstArg, , y] = call;
    if (firstArg === text && typeof y === 'number') return y;
  }
  return null;
};

const EET_KLAGE_REGULERINGSLINJE =
  'Hvis der som følge af den verserende klagesag over erhvervsevnetab sker ændringer i ydelse eller virkningstidspunkt, vil kravet blive reguleret tilsvarende.';

const buildBaseInput = () => {
  const stamdata = {
    ...structuredClone(STAMDATA_INITIAL_VALUES),
    skadestype: 'Arbejdsulykke' as const,
    skadesdato: iso('2024-01-01'),
  };

  const eo = createErstatningsopgoerelseInitialValues();
  eo.beregnesUdFra = 'Beregningsperiode';
  eo.vedroererPeriodeFra = iso('2024-01-01');
  eo.vedroererPeriodeTil = iso('2024-01-31');
  eo.periodeTilBeregningFra = iso('2024-01-01');
  eo.periodeTilBeregningTil = iso('2024-01-31');
  eo.tafPerioder = [{ id: 'taf-1', fra: iso('2024-01-01'), til: iso('2024-01-31'), loseFeriedage: undefined }];

  eo.loenindkomstAnsaettelsesforhold = [
    {
      ...eo.loenindkomstAnsaettelsesforhold[0],
      id: 'af-1',
      navnPaaArbejdssted: 'AAB',
      loenudviklingBeregningsgrundlag: 'Ingen',
      indtaegtsoplysningerTableData: [
        {
          id: 'row-1',
          col0_maaned: '1',
          col1_maaned: '2024',
          col0_uge: '',
          col1_uge: '',
          col0_dag: '',
          col1_dag: '',
          col2: asAmountValue(10000),
          col3: undefined,
          col4: undefined,
          col5: undefined,
        },
      ],
    },
  ];

  return { stamdata, eo };
};

describe('erstatningsopgoerelsePdf indkomst-breakdown synlighed', () => {
  let generateErstatningsopgoerelsePdf: typeof import('../../../utils/pdf/erstatningsopgoerelsePdf').generateErstatningsopgoerelsePdf;

  beforeAll(async () => {
    const pdfModule = await import('../../../utils/pdf/erstatningsopgoerelsePdf');
    generateErstatningsopgoerelsePdf = pdfModule.generateErstatningsopgoerelsePdf;
  });

  it('skjuler pensionslinje når beregnet værdi er 0 kr.', () => {
    const { stamdata, eo } = buildBaseInput();
    eo.loenindkomstAnsaettelsesforhold[0].feriePct = 15;
    eo.loenindkomstAnsaettelsesforhold[0].pensionPct = 0;
    eo.loenindkomstAnsaettelsesforhold[0].indtaegtsoplysningerTableData[0].col5 = asAmountValue(1500);

    generateErstatningsopgoerelsePdf(stamdata, eo, selected, { visUdkastStempel: false });
    const texts = collectTextStrings(MockJsPDF.lastInstance);

    expect(texts).not.toContain('Arbejdsgivers pensionsbidrag');
    expect(texts).toContain('Arbejdsgivers ATP-bidrag og anden indkomst uden tillæg');
  });

  it('skjuler "I alt:" når kun én del-linje vises', () => {
    const { stamdata, eo } = buildBaseInput();
    eo.loenindkomstAnsaettelsesforhold[0].feriePct = 0;
    eo.loenindkomstAnsaettelsesforhold[0].fritvalgPct = 0;
    eo.loenindkomstAnsaettelsesforhold[0].shSoPct = 0;
    eo.loenindkomstAnsaettelsesforhold[0].storeBededagPct = 0;
    eo.loenindkomstAnsaettelsesforhold[0].pensionPct = 0;
    eo.loenindkomstAnsaettelsesforhold[0].indtaegtsoplysningerTableData[0].col5 = undefined;

    generateErstatningsopgoerelsePdf(stamdata, eo, selected, { visUdkastStempel: false });
    const texts = collectTextStrings(MockJsPDF.lastInstance);

    expect(texts.filter((text) => text === 'I alt:')).toHaveLength(0);
  });

  it('viser sektionen "Tidligere betalt erstatning" når tidligere modtaget TAF er indtastet', () => {
    const { stamdata, eo } = buildBaseInput();
    eo.tidligereModtagetTaf = asAmountValue(5000);

    generateErstatningsopgoerelsePdf(stamdata, eo, selected, { visUdkastStempel: false });
    const texts = collectTextStrings(MockJsPDF.lastInstance);

    expect(texts).toContain('Tidligere betalt erstatning');
    expect(texts).toContain('Der er allerede betalt tabt arbejdsfortjeneste for perioden med');
  });

  it('skjuler sektionen "Tidligere betalt erstatning" når tidligere modtaget TAF ikke er indtastet', () => {
    const { stamdata, eo } = buildBaseInput();
    eo.tidligereModtagetTaf = undefined;

    generateErstatningsopgoerelsePdf(stamdata, eo, selected, { visUdkastStempel: false });
    const texts = collectTextStrings(MockJsPDF.lastInstance);

    expect(texts).not.toContain('Tidligere betalt erstatning');
    expect(texts).not.toContain('Der er allerede betalt tabt arbejdsfortjeneste for perioden med');
  });

  it('viser kun "kr." på sidste led i TAF-regnestykket før lighedstegnet', () => {
    const { stamdata, eo } = buildBaseInput();

    generateErstatningsopgoerelsePdf(stamdata, eo, selected, { visUdkastStempel: false });
    const texts = collectTextStrings(MockJsPDF.lastInstance);

    const regnestykkeLinje = texts.find((text) => /^[\d.]+,\d{2} - [\d.]+,\d{2}/.test(text) && text.includes(' =') && text.includes('kr.'));
    expect(regnestykkeLinje).toBeDefined();
    expect(regnestykkeLinje).not.toContain('kr. -');
    expect(regnestykkeLinje).toMatch(/ - [\d.]+,\d{2}\s*kr\. =/);
    const krForekomsterFoerLigmed = (regnestykkeLinje ?? '').split('=')[0]?.match(/kr\./g)?.length ?? 0;
    expect(krForekomsterFoerLigmed).toBe(1);
  });

  it('viser forbeholdstekst i "Øvrige krav" ved kontanthjælp i indtægter i erstatningsperioden', () => {
    const { stamdata, eo } = buildBaseInput();
    eo.offentligeYdelserRows = [
      {
        id: 'oy-1',
        fraDato: '01-01-2024',
        tilDato: '31-01-2024',
        ydelsestype: 'kontanthjaelp',
        ydelse: asAmountValue(5000),
        tillaeg: undefined,
      },
    ];

    generateErstatningsopgoerelsePdf(stamdata, eo, selected, { visUdkastStempel: false });
    const texts = collectTextStrings(MockJsPDF.lastInstance);

    expect(texts).toContain(
      'Skadelidte har modtaget kontanthjælp i erstatningsperioden. Kræves ydelsen tilbagebetalt som følge af erstatningsudbetaling, vil kravet blive forhøjet.'
    );
    expect(hasTextAfterHeader(texts, 'Øvrige krav', 'Ingen')).toBe(false);
  });

  it('viser begge ydelser adskilt med "og" i forbeholdsteksten', () => {
    const { stamdata, eo } = buildBaseInput();
    eo.offentligeYdelserRows = [
      {
        id: 'oy-1',
        fraDato: '01-01-2024',
        tilDato: '31-01-2024',
        ydelsestype: 'kontanthjaelp',
        ydelse: asAmountValue(3000),
        tillaeg: undefined,
      },
      {
        id: 'oy-2',
        fraDato: '01-01-2024',
        tilDato: '31-01-2024',
        ydelsestype: 'ressourceforloebsydelse',
        ydelse: asAmountValue(2000),
        tillaeg: undefined,
      },
    ];

    generateErstatningsopgoerelsePdf(stamdata, eo, selected, { visUdkastStempel: false });
    const texts = collectTextStrings(MockJsPDF.lastInstance);

    expect(texts).toContain(
      'Skadelidte har modtaget kontanthjælp og ressourceforløbsydelse i erstatningsperioden. Kræves ydelserne tilbagebetalt som følge af erstatningsudbetaling, vil kravet blive forhøjet.'
    );
  });

  it('viser både forbeholdstekst og brugerindtastede øvrige krav', () => {
    const { stamdata, eo } = buildBaseInput();
    eo.offentligeYdelserRows = [
      {
        id: 'oy-1',
        fraDato: '01-01-2024',
        tilDato: '31-01-2024',
        ydelsestype: 'kontanthjaelp',
        ydelse: asAmountValue(5000),
        tillaeg: undefined,
      },
    ];
    eo.oevrigeKravPerioder = [
      {
        id: 'krav-1',
        dato: iso('2024-01-15'),
        udgiftTil: 'Transport',
        beloeb: asAmountValue(1200),
      },
    ];

    generateErstatningsopgoerelsePdf(stamdata, eo, selected, { visUdkastStempel: false });
    const texts = collectTextStrings(MockJsPDF.lastInstance);

    expect(texts).toContain(
      'Skadelidte har modtaget kontanthjælp i erstatningsperioden. Kræves ydelsen tilbagebetalt som følge af erstatningsudbetaling, vil kravet blive forhøjet.'
    );
    expect(texts).toContain('15-01-2024: Transport');

    const forbeholdY = findTextY(
      MockJsPDF.lastInstance,
      'Skadelidte har modtaget kontanthjælp i erstatningsperioden. Kræves ydelsen tilbagebetalt som følge af erstatningsudbetaling, vil kravet blive forhøjet.'
    );
    const kravY = findTextY(MockJsPDF.lastInstance, '15-01-2024: Transport');
    expect(forbeholdY).not.toBeNull();
    expect(kravY).not.toBeNull();
    expect((kravY as number) - (forbeholdY as number)).toBeGreaterThanOrEqual(10);
  });

  it('viser klage-reguleringslinje i "Øvrige krav" ved midlertidig EET med verserende klage', () => {
    const { stamdata, eo } = buildBaseInput();
    eo.offentligeYdelserRows = [
      {
        id: 'oy-1',
        fraDato: '01-01-2024',
        tilDato: '31-01-2024',
        ydelsestype: 'kontanthjaelp',
        ydelse: asAmountValue(5000),
        tillaeg: undefined,
      },
    ];
    eo.midlertidigtEetAfgorelse = 'Ja';
    eo.midlertidigEETVirkningsdato = iso('2024-02-01');
    eo.verserendeKlageEet = 'Ja';
    eo.oevrigeKravPerioder = [
      {
        id: 'krav-1',
        dato: iso('2024-01-15'),
        udgiftTil: 'Transport',
        beloeb: asAmountValue(1200),
      },
    ];

    generateErstatningsopgoerelsePdf(stamdata, eo, selected, { visUdkastStempel: false });
    const texts = collectTextStrings(MockJsPDF.lastInstance);

    expect(texts).toContain(EET_KLAGE_REGULERINGSLINJE);
  });

  it('placerer klage-reguleringslinje mellem ydelsesforbehold og øvrige krav med én linjeafstand', () => {
    const { stamdata, eo } = buildBaseInput();
    eo.offentligeYdelserRows = [
      {
        id: 'oy-1',
        fraDato: '01-01-2024',
        tilDato: '31-01-2024',
        ydelsestype: 'kontanthjaelp',
        ydelse: asAmountValue(5000),
        tillaeg: undefined,
      },
    ];
    eo.endeligtEetAfgorelse = 'Ja';
    eo.endeligEETVirkningsdato = iso('2024-03-01');
    eo.verserendeKlageEet = 'Ja';
    eo.oevrigeKravPerioder = [
      {
        id: 'krav-1',
        dato: iso('2024-01-15'),
        udgiftTil: 'Transport',
        beloeb: asAmountValue(1200),
      },
    ];

    generateErstatningsopgoerelsePdf(stamdata, eo, selected, { visUdkastStempel: false });
    const texts = collectTextStrings(MockJsPDF.lastInstance);

    const ydelsesforbehold =
      'Skadelidte har modtaget kontanthjælp i erstatningsperioden. Kræves ydelsen tilbagebetalt som følge af erstatningsudbetaling, vil kravet blive forhøjet.';
    const kravLinje = '15-01-2024: Transport';
    const forbeholdIndex = texts.indexOf(ydelsesforbehold);
    const klageIndex = texts.indexOf(EET_KLAGE_REGULERINGSLINJE);
    const kravIndex = texts.indexOf(kravLinje);
    expect(forbeholdIndex).toBeGreaterThanOrEqual(0);
    expect(klageIndex).toBeGreaterThan(forbeholdIndex);
    expect(kravIndex).toBeGreaterThan(klageIndex);

    const forbeholdY = findTextY(MockJsPDF.lastInstance, ydelsesforbehold);
    const klageY = findTextY(MockJsPDF.lastInstance, EET_KLAGE_REGULERINGSLINJE);
    const kravY = findTextY(MockJsPDF.lastInstance, kravLinje);
    expect(forbeholdY).not.toBeNull();
    expect(klageY).not.toBeNull();
    expect(kravY).not.toBeNull();
    const afstandForbeholdTilKlage = (klageY as number) - (forbeholdY as number);
    const afstandKlageTilKrav = (kravY as number) - (klageY as number);
    expect(afstandForbeholdTilKlage).toBe(afstandKlageTilKrav);
    expect(afstandForbeholdTilKlage).toBeGreaterThanOrEqual(10);
  });
});
