import { buildEOInspektionModel } from '../../../domain/eoInspektion/eoInspektionKontrolModel';
import { buildKontrolTabelCsv, buildKontrolTabelCsvHeaders } from '../../../domain/eoInspektion/eoInspektionCsv';
import {
  buildEOInspektionSammentaellingModel,
  buildSammentaellingDisplayTables,
  buildSvieSmerteContext,
  buildTaftContext,
  flattenSammentaellingDisplayTables,
} from '../../../domain/eoInspektion/eoInspektionSammentaelling';
import {
  collectSammentaellingControlMismatchMessages,
  getSammentaellingControlStatus,
  SAMMENTAELLING_TOM_VISNING,
} from '../../../domain/erstatningsopgoerelse/control/eoControlMismatch';
import {
  createDefaultLoenindkomstAnsaettelsesforhold,
  createErstatningsopgoerelseInitialValues,
} from '../../../domain/erstatningsopgoerelse/helpers/erstatningsopgoerelseInitialValues';
import { STAMDATA_INITIAL_VALUES } from '../../../domain/stamdata/stamdataInitialValues';
import type { ErstatningsopgoerelseValues, StandardLoenTableRow } from '../../../schemas/formSchemas';
import { toISODateString } from '../../../types/branded';

const iso = (value: string) => toISODateString(value);
const amount = (value: number): StandardLoenTableRow['col2'] => ({ kind: 'number', value });

const employment = (
  id: string,
  navn: string,
  loen: number
): ErstatningsopgoerelseValues['loenindkomstAnsaettelsesforhold'][number] => ({
  ...createDefaultLoenindkomstAnsaettelsesforhold(),
  id,
  navnPaaArbejdssted: navn,
  harOverenskomst: false,
  storeBededagPct: 0,
  tillaegAngivesSom: 'beloeb',
  loenperiode: 'dag',
  indtaegtsoplysningerTableData: [{
    id: `${id}-row`,
    col0_maaned: '',
    col1_maaned: '',
    col0_uge: '',
    col1_uge: '',
    col0_dag: iso('2024-01-08'),
    col1_dag: iso('2024-01-12'),
    col2: amount(loen),
    col3: amount(0),
    col4: amount(0),
    col5: amount(0),
    fpFvShSoBeloeb: amount(20),
    pensionBeloeb: amount(0),
  }],
});

const values = (
  patch: Partial<ErstatningsopgoerelseValues> = {}
): ErstatningsopgoerelseValues => ({
  ...createErstatningsopgoerelseInitialValues(),
  vedroererPeriodeFra: iso('2024-01-01'),
  vedroererPeriodeTil: iso('2024-01-31'),
  kravPaaTabtArbejdsfortjeneste: 'Ja',
  beregnesUdFra: 'Beregningsperiode',
  tafBeregningsperiodeFra: iso('2024-01-01'),
  tafBeregningsperiodeTil: iso('2024-01-31'),
  loenindkomstAnsaettelsesforhold: [employment('af-1', 'Fiktivt arbejdssted', 1000)],
  ...patch,
});

const employmentColumnIds = (model: ReturnType<typeof buildEOInspektionModel>): readonly string[] =>
  model.columns.map((column) => column.id).filter((id) => id.startsWith('loen:'));

describe('Kontroltabellen – brugerblik 12m', () => {
  describe('BB-388: ansættelsesforholdskolonner kun med TAF-krav', () => {
    it('har ingen ansættelsesforholdskolonner uden TAF, men beholder TAF-dagskolonnen', () => {
      const model = buildEOInspektionModel(values({ kravPaaTabtArbejdsfortjeneste: 'Nej' }), { tafRanges: [] });

      expect(employmentColumnIds(model)).toEqual([]);
      expect(model.columns.some((column) => column.id === 'base:taf_day')).toBe(true);
    });

    it('har ansættelsesforholdets kolonner med TAF-krav', () => {
      const model = buildEOInspektionModel(values(), { tafRanges: [] });

      expect(employmentColumnIds(model)).toContain('loen:0:taf_regulering');
      expect(employmentColumnIds(model)).toContain('loen:0:wage:samlet');
    });

    it.each(['Ja', 'Nej'] as const)(
      'melder ingen uoverensstemmelse i sammentællingen med TAF «%s» og lønindkomst i beregningsperioden',
      (krav) => {
        const eoValues = values({ kravPaaTabtArbejdsfortjeneste: krav });
        const model = buildEOInspektionModel(eoValues, { tafRanges: [] });
        const sammentaelling = buildEOInspektionSammentaellingModel({
          values: eoValues,
          model,
          svieSmerteContext: buildSvieSmerteContext(STAMDATA_INITIAL_VALUES, eoValues),
          taftContext: buildTaftContext(STAMDATA_INITIAL_VALUES, eoValues),
          tafRanges: [],
        });
        const rows = flattenSammentaellingDisplayTables(buildSammentaellingDisplayTables(sammentaelling));

        expect(collectSammentaellingControlMismatchMessages(rows)).toEqual([]);
        // Ansættelsesforholdets række findes kun, når dens tabelkolonne findes.
        const harAnsaettelsesforholdRaekke = sammentaelling.beregningsperiodeIndtaegter
          .some((row) => row.label.startsWith('Ansættelsesforhold'));
        expect(harAnsaettelsesforholdRaekke).toBe(krav === 'Ja');
      }
    );
  });

  describe('Sammentællingens tom-mærke følger det viste', () => {
    it('en række er aldrig rød med «-» på begge sider, og den er kun umærket med «-» på begge sider', () => {
      const scenarier: readonly ErstatningsopgoerelseValues[] = [
        createErstatningsopgoerelseInitialValues(),
        values(),
        values({ kravPaaTabtArbejdsfortjeneste: 'Nej' }),
        values({ tafBeregningsperiodeFra: undefined, tafBeregningsperiodeTil: undefined }),
        values({
          loenindkomstAnsaettelsesforhold: [
            employment('af-1', 'Fiktivt arbejdssted', 1000),
            employment('af-2', '', 0.004),
          ],
        }),
      ];

      for (const eoValues of scenarier) {
        const model = buildEOInspektionModel(eoValues, { tafRanges: [] });
        const sammentaelling = buildEOInspektionSammentaellingModel({
          values: eoValues,
          model,
          svieSmerteContext: buildSvieSmerteContext(STAMDATA_INITIAL_VALUES, eoValues),
          taftContext: buildTaftContext(STAMDATA_INITIAL_VALUES, eoValues),
          tafRanges: [],
        });
        for (const row of flattenSammentaellingDisplayTables(buildSammentaellingDisplayTables(sammentaelling))) {
          const beggeTomme = row.control.beregnetDisplay === SAMMENTAELLING_TOM_VISNING
            && row.control.tabelDisplay === SAMMENTAELLING_TOM_VISNING;
          const status = getSammentaellingControlStatus(row.control);
          expect({ label: row.label, status: status === 'tom' }).toEqual({ label: row.label, status: beggeTomme });
          expect({ label: row.label, roed: status === 'error' && beggeTomme }).toEqual({ label: row.label, roed: false });
        }
      }
    });
  });

  describe('BB-387: dagtabellens betegnelser', () => {
    it('kalder SH- og svie/smerte-kolonnerne det samme som sammentællingen', () => {
      const model = buildEOInspektionModel(values(), { tafRanges: [] });
      const header = (id: string) => model.columns.find((column) => column.id === id);

      expect(header('base:sh_day')?.header).toBe('SH-dag');
      expect(header('base:ss_day')?.header).toBe('Svie/smerte-\ndag');
      expect(header('base:ss_day')?.name).toBe('Svie/smerte-dag');
    });
  });

  describe('BB-381/BB-382: CSV-filen', () => {
    it('sætter ansættelsesforholdets navn foran hver af dets kolonner', () => {
      const model = buildEOInspektionModel(values({
        loenindkomstAnsaettelsesforhold: [
          employment('af-1', 'Fiktivt arbejdssted', 1000),
          employment('af-2', '', 500),
        ],
      }), { tafRanges: [] });
      const navne = ['Fiktivt arbejdssted', 'Ansættelsesforhold 2'];
      const headers = buildKontrolTabelCsvHeaders(model.columns, (index) => navne[index] ?? '');

      expect(headers).toContain('Fiktivt arbejdssted – TAF-regulering');
      expect(headers).toContain('Fiktivt arbejdssted – Løn');
      expect(headers).toContain('Ansættelsesforhold 2 – Løn');
      expect(headers).toContain('Fiktivt arbejdssted – FP/FV/SH/SO/St.B.');
      expect(headers).toContain('Svie/smerte-dag');
      expect(new Set(headers).size).toBe(headers.length);
    });

    it('holder kolonnenavnene entydige, når to ansættelsesforhold hedder det samme', () => {
      const model = buildEOInspektionModel(values({
        loenindkomstAnsaettelsesforhold: [
          employment('af-1', 'Kommunen', 1000),
          employment('af-2', 'Kommunen', 500),
        ],
      }), { tafRanges: [] });
      const headers = buildKontrolTabelCsvHeaders(model.columns, () => 'Kommunen');

      expect(headers).toContain('Kommunen (1) – Løn');
      expect(headers).toContain('Kommunen (2) – Løn');
      expect(new Set(headers).size).toBe(headers.length);
    });

    it('har ingen linjeskift i kolonnenavnene og BOM, semikolon og CRLF i filen', () => {
      const model = buildEOInspektionModel(values(), { tafRanges: [] });
      const csv = buildKontrolTabelCsv(model, () => 'Fiktivt arbejdssted');
      const [header, ...lines] = csv.slice(1).split('\r\n');

      expect(csv.startsWith(String.fromCharCode(0xfeff))).toBe(true);
      expect(header).not.toMatch(/\n|SH\/ SO/);
      expect(lines).toHaveLength(model.rowCount);
      expect(header?.split(';')).toHaveLength(model.columns.length);
    });
  });
});
