import { buildEOInspektionModel } from '../../../domain/eoInspektion/eoInspektionKontrolModel';
import {
  buildEOInspektionSammentaellingModel,
  buildSammentaellingDisplayTables,
  buildSvieSmerteContext,
  buildTaftContext,
  flattenSammentaellingDisplayTables,
} from '../../../domain/eoInspektion/eoInspektionSammentaelling';
import { collectSammentaellingControlMismatchMessages } from '../../../domain/erstatningsopgoerelse/control/eoControlMismatch';
import { buildTafRanges, type IsoRange } from '../../../domain/erstatningsopgoerelse/helpers/indtaegtPerioder';
import { createErstatningsopgoerelseInitialValues } from '../../../domain/erstatningsopgoerelse/helpers/erstatningsopgoerelseInitialValues';
import { STAMDATA_INITIAL_VALUES } from '../../../domain/stamdata/stamdataInitialValues';
import type { ErstatningsopgoerelseValues } from '../../../schemas/formSchemas';
import { toISODateString, type ISODateString } from '../../../types/branded';

const iso = (value: string): ISODateString => toISODateString(value);

const SKADE_FOER_2011 = iso('2010-03-01');
const SKADE_EFTER_2011 = iso('2012-03-01');

const values = (patch: Partial<ErstatningsopgoerelseValues> = {}): ErstatningsopgoerelseValues => ({
  ...createErstatningsopgoerelseInitialValues(),
  vedroererPeriodeFra: iso('2024-01-01'),
  vedroererPeriodeTil: iso('2024-01-31'),
  kravPaaTabtArbejdsfortjeneste: 'Ja',
  beregnesUdFra: 'Angivet månedsløn',
  tafPerioder: [{ id: 'taf-1', fra: iso('2024-01-01'), til: iso('2024-01-31'), loseFeriedage: undefined }],
  midlertidigtEETAfgorelse: 'Ja',
  midlertidigEETVirkningsdato: iso('2024-01-15'),
  verserendeKlageEet: 'Nej',
  ...patch,
});

const build = (eoValues: ErstatningsopgoerelseValues, skadedato: ISODateString, tafRanges?: readonly IsoRange[]) => {
  const ranges = tafRanges ?? buildTafRanges(eoValues, { skadedatoISO: skadedato });
  const stamdata = { ...STAMDATA_INITIAL_VALUES, skadedato };
  const model = buildEOInspektionModel(eoValues, { tafRanges: ranges, skadedatoISO: skadedato });
  const sammentaelling = buildEOInspektionSammentaellingModel({
    values: eoValues,
    model,
    svieSmerteContext: buildSvieSmerteContext(stamdata, eoValues),
    taftContext: buildTaftContext(stamdata, eoValues),
    tafRanges: ranges,
  });
  const mismatches = collectSammentaellingControlMismatchMessages(
    flattenSammentaellingDisplayTables(buildSammentaellingDisplayTables(sammentaelling))
  );
  const tafDag = (dato: string): string => model.tableData.tafDayStatusByIndex[model.tableData.dates.indexOf(iso(dato))] ?? '';
  return { model, mismatches, tafDag };
};

describe('Kontroltabellens TAF-afskæring ved EET', () => {
  it('skade før 16-06-2011: TAF ophører fra og med det midlertidige EET, og tabellen stemmer med beregningen', () => {
    const { model, mismatches, tafDag } = build(values(), SKADE_FOER_2011);

    expect(tafDag('2024-01-12')).toBe('Ja');
    expect(tafDag('2024-01-15')).toBe('Midlertidigt EET');
    expect(tafDag('2024-01-16')).toBe('-');
    expect(model.tafAfskaering).toEqual([
      { label: 'TAF ophører: midlertidigt EET (skade før 16-06-2011)', dato: iso('2024-01-15') },
    ]);
    expect(mismatches).toEqual([]);
  });

  it('skade før 16-06-2011: tabellen tæller ikke TAF-dage efter det midlertidige EET, selv hvis beregningen gjorde', () => {
    // Med-garantien: får tabellen TAF-perioder, der ikke er afgrænset ved afskæringen, afgrænser den dem selv.
    const uafgraenset: readonly IsoRange[] = [{ fra: iso('2024-01-01'), til: iso('2024-01-31') }];
    const { tafDag, model } = build(values(), SKADE_FOER_2011, uafgraenset);

    expect(tafDag('2024-01-15')).toBe('Midlertidigt EET');
    expect(model.tableData.dates.filter((dato, index) =>
      dato > iso('2024-01-15') && model.tableData.tafDayStatusByIndex[index] === 'Ja')).toEqual([]);
  });

  it('skade fra 16-06-2011: TAF fortsætter efter det midlertidige EET og ophører ved det endelige', () => {
    const eoValues = values({ endeligtEETAfgorelse: 'Ja', endeligEETVirkningsdato: iso('2024-01-22') });
    const { model, mismatches, tafDag } = build(eoValues, SKADE_EFTER_2011);

    expect(tafDag('2024-01-15')).toBe('Ja');
    expect(tafDag('2024-01-19')).toBe('Ja');
    expect(tafDag('2024-01-22')).toBe('Endeligt EET');
    expect(tafDag('2024-01-23')).toBe('-');
    expect(model.tafAfskaering).toEqual([
      { label: 'Midlertidigt EET – TAF fortsætter (skade fra 16-06-2011)', dato: iso('2024-01-15') },
      { label: 'TAF ophører: endeligt EET', dato: iso('2024-01-22') },
    ]);
    expect(mismatches).toEqual([]);
  });

  it('en verserende klage over EET afslutter ikke TAF', () => {
    const eoValues = values({
      verserendeKlageEet: 'Ja',
      endeligtEETAfgorelse: 'Ja',
      endeligEETVirkningsdato: iso('2024-01-22'),
    });
    const { model, mismatches, tafDag } = build(eoValues, SKADE_FOER_2011);

    expect(tafDag('2024-01-15')).toBe('Ja');
    expect(tafDag('2024-01-22')).toBe('Ja');
    expect(model.tafAfskaering.map((row) => row.label)).toEqual([
      'Midlertidigt EET – TAF fortsætter (verserende klage)',
      'Endeligt EET – TAF fortsætter (verserende klage)',
    ]);
    expect(mismatches).toEqual([]);
  });

  it('differencekravet afslutter TAF, og den tidligste afskæring markeres', () => {
    const eoValues = values({ differencekravDato: iso('2024-01-10') });
    const { tafDag, mismatches } = build(eoValues, SKADE_FOER_2011);

    expect(tafDag('2024-01-10')).toBe('Differencekrav');
    expect(tafDag('2024-01-15')).toBe('-');
    expect(mismatches).toEqual([]);
  });

  it('viser TAF-dagskolonnen med TAF-krav, også uden et ansættelsesforhold', () => {
    const { model } = build(values({ loenindkomstAnsaettelsesforhold: [] }), SKADE_EFTER_2011);

    expect(model.columns.find((column) => column.id === 'base:taf_day')?.header).toBe('TAF-dag');
  });
});
