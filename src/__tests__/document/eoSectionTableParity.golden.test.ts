// @vitest-environment jsdom
/// <reference types="vitest/globals" />

/**
 * Golden-value-net for tabel-kanal-paritet i EO-dokumentets ctx-baserede bilag-sektioner
 * (#15 TableSpec-udredning, andet led).
 *
 * `tableChannelParity.golden.test.ts` dækker STANDALONE-generatorerne. Dette net dækker
 * de resterende tabeller, der bor inde i selve erstatningsopgørelses-dokumentet og
 * renderes af ctx-baserede sektion-renderers (loenindkomst, offentlige ydelser + midlertidig
 * EET, regulering, regulering af offentlige ydelser, SH-dage og sygeferiegodtgørelse).
 *
 * Nettet fastfryser den resolved presentation hver sektion producerer – i BEGGE kanaler –
 * så TableSpec-migreringen af sektionerne kan bevises byte-identisk: migreringen kompilerer
 * TableSpec ned til præcis de params `renderDocumentTable` allerede modtager → identitet ved
 * konstruktion. Et uændret snapshot = uændret output.
 *
 * PDF: jspdf + jspdf-autotable mockes; hver autoTable-kald fanges som (doc, options) og
 * oversættes til en serialiserbar presentation via `capturePresentation`. Word: den rigtige
 * .docx bygges via `renderWordDocument`, hvorfra `<w:tbl>`-blokkene udtrækkes.
 */

import { STAMDATA_INITIAL_VALUES } from '../../domain/stamdata/stamdataInitialValues';
import {
  createDefaultLoenindkomstAnsaettelsesforhold,
  createErstatningsopgoerelseInitialValues,
} from '../../domain/erstatningsopgoerelse/helpers/erstatningsopgoerelseInitialValues';
import { computeEoSnapshot } from '../../domain/erstatningsopgoerelse/snapshot/eoSnapshot';
import { eoSnapshotToEoDocument } from '../../domain/erstatningsopgoerelse/snapshot/eoSnapshotToEoDocument';
import type { ErstatningsopgoerelseValues, StamdataValues } from '../../schemas/formSchemas';
import type { AmountValue } from '../../schemas/amountExpressionSchema';
import type { MidlertidigtEetAfgoerelseGroup } from '../../domain/erstatningsopgoerelse/helpers/midlertidigtEetInsertRows';
import type { SelectedElements } from '../../document/generators/eo/types';
import { toISODateString } from '../../types/branded';
import { withSfggIngenForEmployments } from '../utils/sfggTestSupport';
import { createPdfDocumentSessionForTest } from '../utils/pdf/createPdfDocumentSession';
import type { DocumentGenerationSession } from '../../document/documentGenerationSession';
import type { DocumentArtifact } from '../../document/downloadArtifact';

let pdfSession: Awaited<ReturnType<typeof createPdfDocumentSessionForTest>>;
import { renderWordDocument } from '../docx/generators/wordContentHarness';
import {
  capturePresentation,
  extractWordTables,
  type CaptureDoc,
  type CapturedAutoTableOptions,
  type TablePresentation,
} from './tableGoldenCapture';

const asAmountValue = (value: number): AmountValue => ({ kind: 'number', value });

const { autoTableMock, captured, MockJsPDF } = vi.hoisted(() => {
  type CapturedCall = { doc: unknown; options: unknown };
  const capturedCalls: CapturedCall[] = [];

  class MockJsPDF {
    static instances: MockJsPDF[] = [];
    internal = { pageSize: { width: 210, height: 297 } };
    lastAutoTable?: { finalY?: number };
    private currentFontName = 'helvetica';
    private currentFontStyle = 'normal';
    private currentFontSize = 8;

    constructor() {
      MockJsPDF.instances.push(this);
    }

    setFont = vi.fn((name: string, style: string) => {
      this.currentFontName = name;
      this.currentFontStyle = style;
    });
    getFont = vi.fn(() => ({ fontName: this.currentFontName, fontStyle: this.currentFontStyle }));
    setFontSize = vi.fn((size: number) => {
      this.currentFontSize = size;
    });
    getFontSize = vi.fn(() => this.currentFontSize);
    setTextColor = vi.fn();
    setDisplayMode = vi.fn();
    setProperties = vi.fn();
    splitTextToSize = vi.fn((text: string) => [text]);
    getTextWidth = vi.fn((text: string) => {
      if (/^\d{1,3}(?:\.\d{3})+,\d{2}$/.test(text)) {
        return text.length * 3.2 * (this.currentFontSize / 8);
      }
      return text.length * (this.currentFontStyle === 'bold' ? 0.95 : 0.8) * (this.currentFontSize / 8);
    });
    getNumberOfPages = vi.fn(() => 1);
    setPage = vi.fn();
    text = vi.fn();
    line = vi.fn();
    setLineWidth = vi.fn();
    setDrawColor = vi.fn();
    addPage = vi.fn();
    addImage = vi.fn();
    save = vi.fn();
  }

  return {
    captured: capturedCalls,
    MockJsPDF,
    autoTableMock: vi.fn((doc: Record<string, unknown>, options: { startY?: number }) => {
      doc.lastAutoTable = { finalY: (options.startY ?? 0) + 10 };
      capturedCalls.push({ doc, options });
    }),
  };
});

vi.mock('jspdf', () => ({ default: MockJsPDF }));
vi.mock('jspdf-autotable', () => ({ default: autoTableMock }));

// Dynamisk import EFTER mocks, så generatoren binder til den mockede jspdf.
const { generateErstatningsopgoerelseDocument } = await import(
  '../../document/generators/eo/erstatningsopgoerelseDocument'
);

type EoFixture = Readonly<{
  stamdata: StamdataValues;
  eo: ErstatningsopgoerelseValues;
  selected: SelectedElements;
}>;

const buildDocumentAndGroups = (
  fixture: EoFixture
): Readonly<{ document: ReturnType<typeof eoSnapshotToEoDocument>; groups: readonly MidlertidigtEetAfgoerelseGroup[] }> => {
  const snapshot = computeEoSnapshot({
    revision: 'eo-section-golden',
    stamdataValues: fixture.stamdata,
    eoValues: fixture.eo,
  });
  const projection = eoSnapshotToEoDocument(snapshot);
  if (projection.kind === 'blocked') {
    throw new Error(`Fixture blokeret: ${projection.message}`);
  }
  return { document: projection, groups: snapshot.data?.midlertidigtEetGroups ?? [] };
};

const runGenerator = (session: DocumentGenerationSession, fixture: EoFixture): Promise<DocumentArtifact> => {
  const { document, groups } = buildDocumentAndGroups(fixture);
  if (document.kind === 'blocked') throw new Error(document.message);
  return generateErstatningsopgoerelseDocument(session, fixture.stamdata, fixture.eo, fixture.selected, {
    visBrevhoved: false,
    visUdkastStempel: false,
    document: document.document,
    midlertidigtEetGroups: groups,
  });
};

const collectPdfTables = async (fixture: EoFixture): Promise<TablePresentation[]> => {
  captured.length = 0;
  MockJsPDF.instances = [];
  autoTableMock.mockClear();
  await runGenerator(pdfSession, fixture);
  return captured.map(({ doc, options }) =>
    capturePresentation(doc as CaptureDoc, options as CapturedAutoTableOptions)
  );
};

const collectWordTables = async (fixture: EoFixture): Promise<string[]> => {
  const { documentXml } = await renderWordDocument((session) => runGenerator(session, fixture));
  return extractWordTables(documentXml);
};

const allBilag: SelectedElements = {
  opgoerelse: true,
  loenindkomst: true,
  offentligeYdelser: true,
  shDage: true,
  regulering: true,
  okSatser: true,
  sygeferiegodtgoerelse: true,
  midlertidigEet: true,
};

// ── Fixtures ─────────────────────────────────────────────────────────────────

// Beregningsperiode med lønindkomst-tabel, offentlige ydelser og SH-dage.
const buildLoenOgYdelserFixture = (): EoFixture => {
  const stamdata: StamdataValues = {
    ...structuredClone(STAMDATA_INITIAL_VALUES),
    skadestype: 'Arbejdsulykke',
    skadedato: toISODateString('2024-01-01'),
    skadelidte: 'Test Testesen',
  };
  const eo = createErstatningsopgoerelseInitialValues();
  eo.kravPaaTabtArbejdsfortjeneste = 'Ja';
  // Angivet månedsløn driver TAF; indkomst-tabellen (indkomst uden skade) driver
  // lønindkomst-bilaget. De afstemmes ikke mod hinanden, så projektionens kontrol-
  // invariant (indkomst-uoverensstemmelse) blokerer ikke.
  eo.beregnesUdFra = 'Angivet månedsløn';
  eo.maanedsloenenUdgoer = asAmountValue(40000);
  eo.eoAngivetLoenLoenudvikling.loenudviklingBeregningsgrundlag = 'Ingen';
  eo.eoNummer = '1';
  eo.vedroererPeriodeFra = toISODateString('2024-01-01');
  eo.vedroererPeriodeTil = toISODateString('2024-03-31');
  eo.tafBeregningsperiodeFra = toISODateString('2024-01-01');
  eo.tafBeregningsperiodeTil = toISODateString('2024-03-31');
  eo.tafPerioder = [
    { id: 'taf-1', fra: toISODateString('2024-01-01'), til: toISODateString('2024-03-31'), loseFeriedage: undefined },
  ];
  eo.loenindkomstAnsaettelsesforhold = [
    {
      ...createDefaultLoenindkomstAnsaettelsesforhold(),
      id: 'af-1',
      navnPaaArbejdssted: 'Kerteminde Kommune',
      loenperiode: 'maaned',
      loenudviklingBeregningsgrundlag: 'Ingen',
      indtaegtsoplysningerTableData: [
        {
          id: 'row-1',
          col0_maaned: '1',
          col1_maaned: '2024',
          col0_uge: '',
          col1_uge: '',
          col0_dag: undefined,
          col1_dag: undefined,
          col2: asAmountValue(30000),
          col3: asAmountValue(1000),
          col4: undefined,
          col5: undefined,
        },
        {
          id: 'row-2',
          col0_maaned: '2',
          col1_maaned: '2024',
          col0_uge: '',
          col1_uge: '',
          col0_dag: undefined,
          col1_dag: undefined,
          col2: asAmountValue(31000),
          col3: undefined,
          col4: undefined,
          col5: undefined,
        },
      ],
    },
  ];
  eo.offentligeYdelserRows = [
    {
      id: 'oy-1',
      ydelsestype: 'sygedagpenge',
      fraDato: toISODateString('2024-02-01'),
      tilDato: toISODateString('2024-02-29'),
      ydelse: asAmountValue(15000),
      tillaeg: asAmountValue(500),
    },
  ];
  eo.offentligeYdelserKommentarer = 'En kommentar til de offentlige ydelser.';
  // Regulering af offentlige ydelser (bilagets inline-tabel med fast højre-inset).
  eo.regulerOffentligeYdelser = 'Ja';
  const prepared = withSfggIngenForEmployments(eo);
  return { stamdata, eo: prepared, selected: allBilag };
};

// Regulering med ASL-årslønsmaksimum (statistik-model → Reguleringsværdier + Beregnet
// regulering med indeksberegning som grow-kolonne + dynamisk højre-inset).
const buildAslReguleringFixture = (): EoFixture => {
  const stamdata: StamdataValues = {
    ...structuredClone(STAMDATA_INITIAL_VALUES),
    skadestype: 'Arbejdsulykke',
    skadedato: toISODateString('2022-05-31'),
  };
  const eo = createErstatningsopgoerelseInitialValues();
  eo.kravPaaTabtArbejdsfortjeneste = 'Ja';
  eo.beregnesUdFra = 'Angivet månedsløn';
  eo.maanedsloenenUdgoer = asAmountValue(41593.87);
  eo.eoAngivetLoenLoenudvikling.loenudviklingBeregningsgrundlag = 'Statistik';
  eo.eoAngivetLoenLoenudvikling.loenudviklingStatistikModel = 'ASL-årslønsmaksimum';
  eo.vedroererPeriodeFra = toISODateString('2022-06-01');
  eo.vedroererPeriodeTil = toISODateString('2025-06-30');
  eo.tafBeregningsperiodeFra = toISODateString('2022-06-01');
  eo.tafBeregningsperiodeTil = toISODateString('2025-06-30');
  eo.tafPerioder = [
    { id: 'taf-1', fra: toISODateString('2022-06-01'), til: toISODateString('2025-06-30'), loseFeriedage: undefined },
  ];
  const prepared = withSfggIngenForEmployments(eo);
  return { stamdata, eo: prepared, selected: { ...allBilag, loenindkomst: false, offentligeYdelser: false, shDage: false } };
};

// Regulering med KL-lønaftaler (kæde-opregulering → Beregnet regulering med "Reguleret månedsløn").
const buildKlReguleringFixture = (): EoFixture => {
  const stamdata: StamdataValues = {
    ...structuredClone(STAMDATA_INITIAL_VALUES),
    skadestype: 'Arbejdsulykke',
    skadedato: toISODateString('2024-04-01'),
  };
  const eo = createErstatningsopgoerelseInitialValues();
  eo.kravPaaTabtArbejdsfortjeneste = 'Ja';
  eo.beregnesUdFra = 'Angivet månedsløn';
  eo.maanedsloenenUdgoer = asAmountValue(30000);
  eo.angivetMaanedsloenOpreguleresFraDato = toISODateString('2024-04-01');
  eo.eoAngivetLoenLoenudvikling.loenudviklingBeregningsgrundlag = 'KL-lønaftaler';
  eo.vedroererPeriodeFra = toISODateString('2024-04-01');
  eo.vedroererPeriodeTil = toISODateString('2026-03-31');
  eo.tafBeregningsperiodeFra = toISODateString('2024-04-01');
  eo.tafBeregningsperiodeTil = toISODateString('2026-03-31');
  eo.tafPerioder = [
    { id: 'taf-1', fra: toISODateString('2024-04-01'), til: toISODateString('2026-03-31'), loseFeriedage: undefined },
  ];
  const prepared = withSfggIngenForEmployments(eo);
  return { stamdata, eo: prepared, selected: { ...allBilag, loenindkomst: false, offentligeYdelser: false, shDage: false } };
};

const fixtures: ReadonlyArray<Readonly<{ name: string; build: () => EoFixture }>> = [
  { name: 'loenindkomst + offentlige ydelser + SH-dage + regulering af offentlige ydelser', build: buildLoenOgYdelserFixture },
  { name: 'regulering: ASL-årslønsmaksimum (grow + dynamisk inset)', build: buildAslReguleringFixture },
  { name: 'regulering: KL-lønaftaler (reguleret løn-tabel)', build: buildKlReguleringFixture },
];

describe('EO-sektion tabel-kanal-paritet: PDF resolved presentation (golden)', () => {
  beforeEach(async () => {
    pdfSession = await createPdfDocumentSessionForTest();
  });

  for (const { name, build } of fixtures) {
    it(`${name} → uændret PDF-presentation`, async () => {
      const presentations = await collectPdfTables(build());
      expect(presentations.length).toBeGreaterThan(0);
      expect(presentations).toMatchSnapshot();
    }, 20000);
  }
});

describe('EO-sektion tabel-kanal-paritet: Word document.xml (golden)', () => {
  for (const { name, build } of fixtures) {
    it(`${name} → uændret Word-tabel-XML`, async () => {
      const tables = await collectWordTables(build());
      expect(tables.length).toBeGreaterThan(0);
      expect(tables).toMatchSnapshot();
    }, 20000);
  }
});
