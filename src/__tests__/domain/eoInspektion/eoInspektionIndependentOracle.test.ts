import { buildEOInspektionModel } from '../../../domain/eoInspektion/eoInspektionKontrolModel';
import { buildEOInspektionPageViewModel } from '../../../domain/eoInspektion/eoInspektionPageViewModel';
import { buildIncomeForRanges } from '../../../domain/erstatningsopgoerelse/helpers/indtaegtPerioder';
import {
  createDefaultLoenindkomstAnsaettelsesforhold,
  createErstatningsopgoerelseInitialValues,
} from '../../../domain/erstatningsopgoerelse/helpers/erstatningsopgoerelseInitialValues';
import { DEFAULT_APP_SETTINGS } from '../../../settings/appSettingsSchema';
import { STAMDATA_INITIAL_VALUES } from '../../../domain/stamdata/stamdataInitialValues';
import type { EoSnapshot } from '../../../domain/erstatningsopgoerelse/snapshot/eoSnapshot';
import type { EoInspektionViewReady } from '../../../domain/erstatningsopgoerelse/snapshot/eoSnapshotToInspektionView';
import type { EoRowModel } from '../../../domain/eoRowEvaluation/eoRowTypes';
import type { SectionId } from '../../../domain/eoRowEvaluation/eoRowNavigationMap';
import type { RegulationInspektionSection } from '../../../domain/eoInspektion/eoInspektionRegulationViewModel';
import type { ErstatningsopgoerelseValues } from '../../../schemas/formSchemas';
import type { AmountValue } from '../../../schemas/amountExpressionSchema';
import { toISODateString } from '../../../types/branded';

const iso = (value: string) => toISODateString(value);
const amount = (value: number): AmountValue => ({ kind: 'number', value });

const row = (overrides: Partial<EoRowModel>): EoRowModel => ({
  id: 'row',
  label: 'Række',
  displayValue: 'værdi',
  status: 'ok',
  ...overrides,
});

const tableRow = (employmentId: string): EoRowModel => row({
  id: `sfgg.${employmentId}.tabel`,
  label: 'Sygeferiegodtgørelse tabel',
  displayValue: 'Gammel tekst uden tabellen',
  employmentId,
  table: {
    columns: ['Dato', 'Beløb'],
    rows: [
      { cells: ['01-01-2024', '100,00'] },
      { cells: ['I alt', '100,00'], isTotal: true },
    ],
  },
});

const regulationSection = (id: string): RegulationInspektionSection => ({
  id,
  header: id,
  rows: [],
});

const buildReadyView = (values: ErstatningsopgoerelseValues): EoInspektionViewReady => {
  const rowsBySection = new Map<SectionId, readonly EoRowModel[]>([
    ['loenindkomst', [
      row({
        id: 'loenindkomst.af-visible.navn',
        label: 'Navn på arbejdssted',
        displayValue: '  Kontor A  ',
        employmentId: 'af-visible',
      }),
      row({
        id: 'loenindkomst.af-visible.loen',
        label: 'Angivet løn',
        displayValue: '10.000,00 kr.',
        employmentId: 'af-visible',
      }),
      row({
        id: 'loenindkomst.af-visible.regulering.0',
        label: 'Regulering',
        displayValue: '3,9 %',
        employmentId: 'af-visible',
      }),
      row({ id: 'loenindkomst.fælles', label: 'Fælles række', displayValue: 'Ja' }),
      row({ id: 'loenindkomst.af-empty.loen', label: 'Skjult løn', displayValue: '0', employmentId: 'af-empty' }),
    ]],
    ['sygeferiegodtgoerelse', [
      row({ id: 'sfgg.af-visible.status', label: 'Status', displayValue: 'Aktiv', employmentId: 'af-visible' }),
      tableRow('af-visible'),
      row({ id: 'sfgg.af-orphan.status', label: 'Forældreløs status', displayValue: 'Aktiv', employmentId: 'af-orphan' }),
    ]],
    ['sviesmerte', [
      row({ id: 'sviesmerte.tidligereSsMax', label: 'Tidligere S/S max', displayValue: 'Ja' }),
      row({ id: 'sviesmerte.dagssats', label: 'Dagssats', displayValue: '100,00 kr.' }),
    ]],
    ['aes', [
      row({ id: 'aes.midlertidigtEETAfgorelse', label: 'Midlertidigt EET-afgørelse', displayValue: 'Nej', group: 'aes.midlertidigtEet' }),
      row({ id: 'aes.midlertidigtEet.dato', label: 'Midlertidigt EET-dato', displayValue: '01-01-2024', group: 'aes.midlertidigtEet' }),
      row({ id: 'aes.endeligtEETAfgorelse', label: 'Endeligt EET-afgørelse', displayValue: 'Nej', group: 'aes.endeligtEet' }),
      row({ id: 'aes.endeligtEet.dato', label: 'Endeligt EET-dato', displayValue: '01-01-2024', group: 'aes.endeligtEet' }),
      row({ id: 'aes.varigeMen', label: 'Varige mén', displayValue: '5 %', group: 'aes.varigeMen' }),
    ]],
    ['oevrige-krav', [row({ id: 'oevrige-krav.0', label: 'Øvrigt krav', displayValue: '500,00 kr.' })]],
  ]);

  return {
    kind: 'ready',
    canonicalOutput: undefined,
    inspektionSnapshot: {} as NonNullable<EoSnapshot['inspektionSnapshot']>,
    stamdataValues: STAMDATA_INITIAL_VALUES,
    erstatningsopgoerelseValues: values,
    rowsBySection,
    regulationSections: [
      regulationSection('regulation.af-visible'),
      regulationSection('regulation.af-empty'),
      regulationSection('ikke-en-regulering'),
    ],
  };
};

const buildPageValues = (): ErstatningsopgoerelseValues => ({
  ...createErstatningsopgoerelseInitialValues(),
  kravPaaSvieSmerteGodtgoerelse: 'Ja',
  tidligereSsMax: 'Ja',
  kravPaaTabtArbejdsfortjeneste: 'Ja',
  kravPaaOevrigeErstatningskrav: 'Ja',
  loenindkomstAnsaettelsesforhold: [
    {
      ...createDefaultLoenindkomstAnsaettelsesforhold(),
      id: 'af-visible',
      navnPaaArbejdssted: 'Kontor A',
    },
    {
      ...createDefaultLoenindkomstAnsaettelsesforhold(),
      id: 'af-empty',
    },
  ],
});

describe('EOInspektion – uafhængigt page-view-model-facit', () => {
  it('projicerer sektioner, tilhørsforhold, tabeller og orphan-sektioner uden id-gæt', () => {
    const result = buildEOInspektionPageViewModel(buildReadyView(buildPageValues()), DEFAULT_APP_SETTINGS);

    expect(result.showSvieSmerteSection).toBe(true);
    expect(result.showTabtArbejdsfortjenesteSections).toBe(true);
    expect(result.svieSmerteRows.map((item) => item.id)).toEqual(['sviesmerte.tidligereSsMax']);
    expect(result.aesRows.map((item) => item.id)).toEqual([
      'aes.midlertidigtEETAfgorelse',
      'aes.endeligtEETAfgorelse',
      'aes.varigeMen',
    ]);
    expect(result.oevrigeKravRows.map((item) => item.id)).toEqual(['oevrige-krav.0']);

    expect(result.loenindkomstRows.map((item) => item.id)).toEqual([
      'loenindkomst.af-visible.navn',
      'loenindkomst.af-visible.loen',
      'loenindkomst.af-visible.regulering.0',
      'loenindkomst.fælles',
    ]);
    expect(result.employmentSections).toHaveLength(1);
    expect(result.employmentSections[0]).toMatchObject({
      id: 'af-visible',
      title: 'Kontor A',
      ansatPaaSkadestidspunktet: true,
      loenRows: [
        expect.objectContaining({ id: 'loenindkomst.af-visible.loen' }),
      ],
      regulationRows: [
        expect.objectContaining({ id: 'loenindkomst.af-visible.regulering.0' }),
      ],
      regulationSection: expect.objectContaining({ id: 'regulation.af-visible' }),
      sfggRows: [
        expect.objectContaining({ id: 'sfgg.af-visible.status' }),
      ],
      sfggTables: [{
        id: 'sfgg.af-visible.tabel',
        title: 'Sygeferiegodtgørelse tabel',
        columns: ['Dato', 'Beløb'],
        rows: [
          { id: 'sfgg.af-visible.tabel.row.1', cells: ['01-01-2024', '100,00'] },
          { id: 'sfgg.af-visible.tabel.row.2', cells: ['I alt', '100,00'] },
        ],
      }],
    });
    expect(result.orphanSfggSections.map((section) => section.id)).toEqual(['af-orphan']);
    expect(result.orphanRegulationSections.map((section) => section.id)).toEqual([
      'regulation.af-empty',
      'ikke-en-regulering',
    ]);
    expect(result.offentligeYdelserRows).toEqual([]);
    expect(result.offentligeYdelserTables).toEqual([]);
  });

  it('tømmer valgstyrede visninger når kravene er slået fra', () => {
    const values = buildPageValues();
    values.kravPaaSvieSmerteGodtgoerelse = 'Nej';
    values.kravPaaTabtArbejdsfortjeneste = 'Nej';
    values.kravPaaOevrigeErstatningskrav = 'Nej';
    values.midlertidigtEETAfgorelse = 'Nej';
    values.endeligtEETAfgorelse = 'Nej';

    const result = buildEOInspektionPageViewModel(buildReadyView(values), DEFAULT_APP_SETTINGS);

    expect(result.showSvieSmerteSection).toBe(false);
    expect(result.showTabtArbejdsfortjenesteSections).toBe(false);
    expect(result.svieSmerteRows).toEqual([]);
    expect(result.tafRows).toEqual([]);
    expect(result.tafBeregningsgrundlagRows).toEqual([]);
    expect(result.loenindkomstRows).toEqual([]);
    expect(result.employmentSections).toEqual([]);
    expect(result.orphanSfggSections).toEqual([]);
    expect(result.orphanRegulationSections).toEqual([]);
    expect(result.offentligeYdelserRows).toEqual([]);
    expect(result.oevrigeKravRows).toEqual([]);
    expect(result.aesRows.map((item) => item.id)).toEqual([
      'aes.midlertidigtEETAfgorelse',
      'aes.endeligtEETAfgorelse',
      'aes.varigeMen',
    ]);
  });
});

const buildControlValues = (overrides: Partial<ErstatningsopgoerelseValues> = {}): ErstatningsopgoerelseValues => ({
  ...createErstatningsopgoerelseInitialValues(),
  vedroererPeriodeFra: iso('2024-07-01'),
  vedroererPeriodeTil: iso('2024-07-07'),
  kravPaaTabtArbejdsfortjeneste: 'Ja',
  beregnesUdFra: 'Angivet dagsløn',
  loenindkomstAnsaettelsesforhold: [
    {
      ...createDefaultLoenindkomstAnsaettelsesforhold(),
      id: 'af-control',
      harOverenskomst: false,
      loenperiode: 'dag',
    },
  ],
  tafPerioder: [{ id: 'taf-control', fra: iso('2024-07-01'), til: iso('2024-07-07'), loseFeriedage: 0 }],
  ...overrides,
});

describe('EOInspektion – kontroltabel med statisk facit', () => {
  it('fordeler en arbejdsdagsydelse på de fem hverdage og summerer præcist', () => {
    const values = buildControlValues({
      offentligeYdelserRows: [{
        id: 'ydelse-juli',
        fraDato: iso('2024-07-01'),
        tilDato: iso('2024-07-05'),
        ydelsestype: 'sygedagpenge',
        ydelse: amount(1000),
      }],
    });
    const model = buildEOInspektionModel(values, {
      tafRanges: [{ fra: iso('2024-07-01'), til: iso('2024-07-07') }],
    });
    const amounts = model.columnRawValues.get('offentlig:sygedagpenge');
    const julyFirstIndex = model.tableData.dates.indexOf(iso('2024-07-01'));

    expect(model.tableData.dates).toHaveLength(31);
    expect(julyFirstIndex).toBe(0);
    expect(amounts?.slice(0, 7)).toEqual([200, 200, 200, 200, 200, 0, 0]);
    expect(amounts?.reduce((sum, value) => sum + value, 0)).toBe(1000);
    expect(model.integrityIssues).toEqual([]);
  });

  it('markerer hverdage, SH-dag, Endeligt EET og differencekrav med separat statisk dagsfacit', () => {
    const values = buildControlValues({
      vedroererPeriodeFra: iso('2024-01-01'),
      vedroererPeriodeTil: iso('2024-01-05'),
      tafPerioder: [{ id: 'taf-control', fra: iso('2024-01-01'), til: iso('2024-01-05'), loseFeriedage: 0 }],
      differencekravDato: iso('2024-01-04'),
      endeligtEETAfgorelse: 'Ja',
      verserendeKlageEet: 'Nej',
      endeligEETVirkningsdato: iso('2024-01-03'),
    });
    const model = buildEOInspektionModel(values, {
      tafRanges: [{ fra: iso('2024-01-01'), til: iso('2024-01-05') }],
    });

    const tafStatuses = [
      '2024-01-01',
      '2024-01-02',
      '2024-01-03',
      '2024-01-04',
      '2024-01-05',
    ].map((date) => model.getCell(model.tableData.dates.indexOf(iso(date)), 'base:taf_day'));

    expect(tafStatuses).toEqual(['-', 'Ja', 'Endeligt EET', '-', '-']);
    expect(model.tableData.isWorkdayByIndex.slice(0, 5)).toEqual([false, true, true, true, true]);
    expect(model.tableData.tafFlagsByIndex.slice(0, 5).map((flags) => [...flags])).toEqual([[], ['base:taf_day'], [], [], []]);
  });

  it('viser en weekendydelse via samme fald-tilbage-fordeling som beregningen', () => {
    const values = buildControlValues({
      vedroererPeriodeFra: iso('2024-07-06'),
      vedroererPeriodeTil: iso('2024-07-07'),
      tafPerioder: [{ id: 'taf-control', fra: iso('2024-07-06'), til: iso('2024-07-07'), loseFeriedage: 0 }],
      offentligeYdelserRows: [{
        id: 'ydelse-weekend',
        fraDato: iso('2024-07-06'),
        tilDato: iso('2024-07-07'),
        ydelsestype: 'sygedagpenge',
        ydelse: amount(2000),
      }],
    });
    const canonicalIncome = buildIncomeForRanges(values, [{ fra: iso('2024-07-06'), til: iso('2024-07-07') }]);
    const model = buildEOInspektionModel(values, {
      tafRanges: [{ fra: iso('2024-07-06'), til: iso('2024-07-07') }],
    });

    expect(canonicalIncome.benefits.find((benefit) => benefit.typeKey === 'sygedagpenge')?.amount).toBe(2000);
    const amounts = model.columnRawValues.get('offentlig:sygedagpenge');
    expect(amounts?.slice(0, 7)).toEqual([0, 0, 0, 0, 0, 1000, 1000]);
    expect(amounts?.reduce((sum, value) => sum + value, 0)).toBe(2000);
    expect(model.integrityIssues).toEqual([]);
  });
});
