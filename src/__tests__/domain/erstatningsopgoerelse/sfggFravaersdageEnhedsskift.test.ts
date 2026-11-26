import type { ErstatningsopgoerelseValues, StandardLoenTableRow } from '../../../schemas/formSchemas';
import {
  createDefaultLoenindkomstAnsaettelsesforhold,
  createErstatningsopgoerelseInitialValues,
} from '../../../domain/erstatningsopgoerelse/helpers/erstatningsopgoerelseInitialValues';
import {
  formatSfggFravaersdageEnhedsskiftBesked,
  medAnsaettelsesforholdValg,
  resolveSfggFravaersdageEnhedsskift,
} from '../../../domain/erstatningsopgoerelse/sfggFravaersdageEnhedsskift';
import { toISODateString } from '../../../types/branded';

// Et valg, der skifter enheden for et indtastet antal fraværsdage uden løn, skal kunne opdages, før
// valget committes – også når valget står på et ANDET kort end tallet.

type Employment = ErstatningsopgoerelseValues['loenindkomstAnsaettelsesforhold'][number];
type SfggRow = ErstatningsopgoerelseValues['sfggAnsaettelsesforhold'][number];

const loenRaekke = (): StandardLoenTableRow => ({
  id: 'row-1',
  col0_maaned: '1',
  col1_maaned: '2023',
  col0_uge: '',
  col1_uge: '',
  col0_dag: undefined,
  col1_dag: undefined,
  col2: { kind: 'number', value: 30000 },
  col3: undefined,
  col4: undefined,
  col5: undefined,
});

const kort = (id: string, navn: string, patch: Partial<Employment> = {}): Employment => ({
  ...createDefaultLoenindkomstAnsaettelsesforhold(),
  id,
  navnPaaArbejdssted: navn,
  loenperiode: 'maaned',
  loenPaaHelligdage: 'Almindelig løn',
  fuldLoenUnderFerie: 'Ja',
  indtaegtsoplysningerTableData: [loenRaekke()],
  ...patch,
});

const sfgg = (ansaettelsesforholdId: string, fravaersdage: number | undefined, patch: Partial<SfggRow> = {}): SfggRow => ({
  ansaettelsesforholdId,
  sfggBeregningskilde: 'Ferieloven',
  sfggManuelDagssats: undefined,
  sfggManuelBeloebIHenholdTil: undefined,
  sfggManuelFoerstEfterSygeloen: 'Nej',
  sfggReferenceperiodeFra: undefined,
  sfggReferenceperiodeTil: undefined,
  sfggReferenceperiodeFravaersdageUdenLoen: fravaersdage,
  sfggSatsvalg: undefined,
  sfggAlleredeBetaltBeloeb: undefined,
  ...patch,
});

const sag = (
  ansaettelsesforhold: readonly Employment[],
  sfggRows: readonly SfggRow[],
  patch: Partial<ErstatningsopgoerelseValues> = {},
): ErstatningsopgoerelseValues => ({
  ...structuredClone(createErstatningsopgoerelseInitialValues()),
  kravPaaTabtArbejdsfortjeneste: 'Ja',
  beregnesUdFra: 'Beregningsperiode',
  tafBeregningsperiodeFra: toISODateString('2023-01-01'),
  tafBeregningsperiodeTil: toISODateString('2023-12-31'),
  loenindkomstAnsaettelsesforhold: [...ansaettelsesforhold],
  sfggAnsaettelsesforhold: [...sfggRows],
  ...patch,
});

describe('resolveSfggFravaersdageEnhedsskift', () => {
  it('melder skiftet fra kalenderdage til arbejdsdage, når «Løn på helligdage» skiftes til «Ingen»', () => {
    const foer = sag([kort('a', 'Firma A')], [sfgg('a', 7)]);
    const efter = medAnsaettelsesforholdValg(foer, 'a', { loenPaaHelligdage: 'Ingen' });

    expect(resolveSfggFravaersdageEnhedsskift(foer, efter)).toEqual({
      nyEnhed: 'arbejdsdage',
      kort: [{ ansaettelsesforholdId: 'a', navn: 'Firma A', fravaersdage: 7 }],
    });
  });

  it('melder skiftet på alle kort, også det kort, valget ikke står på', () => {
    const foer = sag([kort('a', 'Firma A'), kort('b', 'Firma B')], [sfgg('a', 7), sfgg('b', 3)]);
    const efter = medAnsaettelsesforholdValg(foer, 'b', { fuldLoenUnderFerie: 'Nej' });

    const skift = resolveSfggFravaersdageEnhedsskift(foer, efter);
    expect(skift?.kort.map((entry) => entry.navn)).toEqual(['Firma A', 'Firma B']);
    expect(skift && formatSfggFravaersdageEnhedsskiftBesked(skift)).toBe(
      'Fraværsdagene uden løn (7 på Firma A og 3 på Firma B) tælles herefter som arbejdsdage. Kontrollér antallet.'
    );
  });

  it('melder skiftet tilbage til kalenderdage og bruger kortets nummer, når navnet mangler', () => {
    const foer = sag([kort('a', '', { loenPaaHelligdage: 'Ingen' })], [sfgg('a', 7)]);
    const efter = medAnsaettelsesforholdValg(foer, 'a', { loenPaaHelligdage: 'Almindelig løn' });

    const skift = resolveSfggFravaersdageEnhedsskift(foer, efter);
    expect(skift && formatSfggFravaersdageEnhedsskiftBesked(skift)).toBe(
      'Fraværsdagene uden løn (7 på Ansættelsesforhold 1) tælles herefter som kalenderdage. Kontrollér antallet.'
    );
  });

  it('melder skiftet, når «Beregnes ud fra» skifter til angivet dagsløn', () => {
    const foer = sag([kort('a', 'Firma A')], [sfgg('a', 7)]);

    expect(resolveSfggFravaersdageEnhedsskift(foer, { ...foer, beregnesUdFra: 'Angivet dagsløn' })?.nyEnhed)
      .toBe('arbejdsdage');
  });

  it('melder intet, når enheden ikke flytter sig', () => {
    // Et andet kort er allerede i arbejdsdage – sagen er det dermed også, og et skift på kort A ændrer intet.
    const foer = sag(
      [kort('a', 'Firma A'), kort('b', 'Firma B', { loenPaaHelligdage: 'Ingen' })],
      [sfgg('a', 7)],
    );
    const efter = medAnsaettelsesforholdValg(foer, 'a', { loenPaaHelligdage: 'SH-udbetaling' });

    expect(resolveSfggFravaersdageEnhedsskift(foer, efter)).toBeNull();
  });

  it('melder intet uden indtastede fraværsdage', () => {
    for (const fravaersdage of [undefined, 0]) {
      const foer = sag([kort('a', 'Firma A')], [sfgg('a', fravaersdage)]);
      const efter = medAnsaettelsesforholdValg(foer, 'a', { loenPaaHelligdage: 'Ingen' });
      expect(resolveSfggFravaersdageEnhedsskift(foer, efter)).toBeNull();
    }
  });

  it('melder intet for et skjult felt (manuelt angivet sats)', () => {
    const foer = sag([kort('a', 'Firma A')], [sfgg('a', 7, { sfggBeregningskilde: 'Manuelt angivet' })]);
    const efter = medAnsaettelsesforholdValg(foer, 'a', { loenPaaHelligdage: 'Ingen' });

    expect(resolveSfggFravaersdageEnhedsskift(foer, efter)).toBeNull();
  });

  it('melder intet, når kortets løn ikke ligger i beregningsperioden', () => {
    const foer = sag([kort('a', 'Firma A')], [sfgg('a', 7)], {
      tafBeregningsperiodeFra: toISODateString('2024-01-01'),
      tafBeregningsperiodeTil: toISODateString('2024-12-31'),
    });
    const efter = medAnsaettelsesforholdValg(foer, 'a', { loenPaaHelligdage: 'Ingen' });

    expect(resolveSfggFravaersdageEnhedsskift(foer, efter)).toBeNull();
  });
});
