import type { DocumentBlock } from '../../document/model/documentModel';
import type {
  DocumentGenerationSession,
  DocumentRenderRequest,
} from '../../document/documentGenerationSession';
import { generateAarsloenDocument } from '../../document/generators/aarsloen/aarsloenDocument';
import type { AarsloenValues } from '../../schemas/formSchemas';
import type { AarsloenBeregningResult } from '../../types/calculation';
import { LOEN_PAA_HELLIGDAGE, LOENPERIODE, TILLAEG_ANGIVES_SOM } from '../../types/loen';
import { createDate } from '../../utils/dateUtils';
import { toISODateString } from '../../types/branded';
import type { PeriodeResult } from '../../utils/periodeBeregning';

const values: AarsloenValues = {
  feriePct: 10,
  fritvalgPct: undefined,
  shSoPct: undefined,
  storeBededagPct: undefined,
  pensionPct: 5,
  loenperiode: LOENPERIODE.MAANED,
  tillaegAngivesSom: TILLAEG_ANGIVES_SOM.PROCENT,
  tableData: [
    {
      id: 'januar-2024',
      col0_maaned: '1',
      col1_maaned: '2024',
      col0_uge: '',
      col1_uge: '',
      col0_dag: undefined,
      col1_dag: undefined,
      col2: { kind: 'number', value: 20_000 },
      col3: undefined,
      col4: undefined,
      col5: undefined,
      fpFvShSoBeloeb: undefined,
      pensionBeloeb: undefined,
    },
    {
      id: 'februar-2024',
      col0_maaned: '2',
      col1_maaned: '2024',
      col0_uge: '',
      col1_uge: '',
      col0_dag: undefined,
      col1_dag: undefined,
      col2: { kind: 'number', value: 10_000 },
      col3: undefined,
      col4: undefined,
      col5: undefined,
      fpFvShSoBeloeb: undefined,
      pensionBeloeb: undefined,
    },
  ],
  omregningTilFuldtAar: true,
  fuldLoenUnderFerie: true,
  retTilSjetteFerieuge: true,
  antalFeriedage: undefined,
  loenPaaHelligdage: LOEN_PAA_HELLIGDAGE.ALMINDELIG,
};

const periodeData: PeriodeResult = {
  periodeTekst: 'jan 2024 - feb 2024',
  totalEnheder: 2,
  unikkeEnheder: 2,
  enhedNavn: 'måneder',
  datoSet: new Set([
    toISODateString('2024-01-01'),
    toISODateString('2024-02-01'),
  ]),
  perioder: [
    { start: createDate(2024, 0, 1), end: createDate(2024, 0, 31) },
    { start: createDate(2024, 1, 1), end: createDate(2024, 1, 29) },
  ],
};

const beregningsData: AarsloenBeregningResult = {
  metode: 'C',
  erEtAar: false,
  hverdageIPeriode: 44,
  feriedageFraInput: 0,
  arbejdsdageIPeriode: 0,
  feriedagePaaAar: 30,
  arbejdsdagePaaAar: 0,
  hverdagePaaAar: 0,
  antalEnheder: 2,
  antalHeleKalendermaaneder: null,
  omregnetAarsloen: 207_900,
};

const createFixtureSession = (): Readonly<{
  session: DocumentGenerationSession;
  requests: DocumentRenderRequest[];
}> => {
  const requests: DocumentRenderRequest[] = [];
  const session: DocumentGenerationSession = Object.freeze({
    format: 'pdf',
    render: async (request): Promise<Blob> => {
      requests.push(request);
      return new Blob();
    },
  });

  return { session, requests };
};

const labelValues = (blocks: readonly DocumentBlock[]): ReadonlyArray<Readonly<{
  label: string;
  value: string;
}>> => blocks.flatMap((block) =>
  block.kind === 'labelValue' ? [{ label: block.label, value: block.value }] : []
);

describe('Årsløn – uafhængigt downstream-facit for dokumentgeneratoren', () => {
  it('skriver håndberegnede række-, total- og omregningsværdier i dokumentmodellen', async () => {
    // Håndfacit pr. række: 20.000 + 10 % + 5 % af lønnen = 23.100 kr. og 11.550 kr.
    // Samlet: 34.650 kr.; 34.650 / 2 måneder × 12 = 207.900 kr. om året.
    const { session, requests } = createFixtureSession();
    const artifact = await generateAarsloenDocument(session, {
      satser: {
        feriePct: values.feriePct,
        fritvalgPct: values.fritvalgPct,
        shSoPct: values.shSoPct,
        storeBededagPct: values.storeBededagPct,
        pensionPct: values.pensionPct,
      },
      loenperiode: values.loenperiode,
      tillaegAngivesSom: values.tillaegAngivesSom,
      tableData: values.tableData,
      beregnetAarsloen: 34_650,
      omregningTilFuldtAar: values.omregningTilFuldtAar,
      periodeData,
      fuldLoenUnderFerie: values.fuldLoenUnderFerie,
      retTilSjetteFerieuge: values.retTilSjetteFerieuge,
      antalFeriedage: values.antalFeriedage,
      loenPaaHelligdage: values.loenPaaHelligdage,
      shDageAntal: null,
      beregningsData,
    });

    expect(requests).toHaveLength(1);
    const model = requests[0]?.model;
    expect(model).toBeDefined();
    if (model === undefined) throw new Error('Dokumentmodellen mangler');

    expect(model.blocks.filter((block) => block.kind === 'title').map((block) => block.text)).toEqual([
      'Årslønsberegning',
    ]);
    expect(model.blocks.filter((block) => block.kind === 'boldSubheader').map((block) => block.text)).toEqual([
      'Satser',
      'Indtægtsoplysninger',
      'Beregningsprincipper',
      'Beregning',
    ]);

    const valuesInDocument = labelValues(model.blocks);
    expect(valuesInDocument).toEqual(expect.arrayContaining([
      { label: 'Feriegodtgørelse/-tillæg', value: '10 %' },
      { label: 'Arbejdsgivers pensionsbidrag', value: '5 %' },
      { label: 'Antal måneder i de indtastede perioder', value: '2 måneder' },
      { label: 'Sammentælling af løn fra tabellen', value: '34.650,00 kr.' },
      { label: 'Beregnet årsløn (34.650,00 / 2 x 12)', value: '207.900,00 kr.' },
    ]));

    const tables = model.blocks.filter((block) => block.kind === 'table');
    expect(tables).toHaveLength(1);
    const table = tables[0];
    if (table?.kind !== 'table') throw new Error('Indtægtstabellen mangler');

    expect(table.spec.rows.map((row) => row.cells.map((cell) => cell.text))).toEqual([
      [
        'Måned',
        'År',
        'Løn',
        'Løn (2)',
        'Ikke-pens.\ngiv. løn',
        'ATP mv.\nu. tillæg',
        'FP/FV/SH/\nSO/St.B.',
        'Arb.g.\nPension',
        'Samlet løn',
      ],
      ['1', '2024', '20.000,00', '', '', '', '2.000,00', '1.100,00', '23.100,00'],
      ['2', '2024', '10.000,00', '', '', '', '1.000,00', '550,00', '11.550,00'],
      ['I alt', '34.650,00'],
    ]);
    expect(table.spec.rows.at(-1)?.cells[1]).toMatchObject({
      colSpan: 8,
      separatorAbove: true,
    });

    expect(model.blocks.at(-1)?.kind).toBe('footer');
    expect(artifact.filename).toBe('Årslønsberegning.pdf');
  });
});
