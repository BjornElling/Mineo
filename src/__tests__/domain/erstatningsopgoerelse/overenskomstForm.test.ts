import type { AmountValue } from '../../../schemas/amountExpressionSchema';
import type { StandardLoenTableRow } from '../../../schemas/formSchemas';
import { createDefaultLoenindkomstAnsaettelsesforhold } from '../../../domain/erstatningsopgoerelse/helpers/erstatningsopgoerelseInitialValues';
import { TAF_BEREGNES_SOM } from '../../../domain/erstatningsopgoerelse/helpers/tafBeregningsenhed';
import { overenskomstForm } from '../../../domain/erstatningsopgoerelse/engines/regulering/forms/overenskomstForm';
import type {
  FormKonsoliderContext,
  KonsolideretLoenudvikling,
} from '../../../domain/erstatningsopgoerelse/engines/regulering/reguleringForm';
import { LOEN_PAA_HELLIGDAGE } from '../../../types/loen';
import { toISODateString, type ISODateString } from '../../../types/branded';

const iso = (value: string): ISODateString => toISODateString(value);
const amount = (value: number): AmountValue => ({ kind: 'number', value });

type Source = ReturnType<typeof createDefaultLoenindkomstAnsaettelsesforhold>;

const createSource = (overrides: Partial<Source> = {}): Source => ({
  ...createDefaultLoenindkomstAnsaettelsesforhold(),
  id: 'af-1',
  loenudviklingBeregningsgrundlag: 'Overenskomst',
  overenskomstId: 'bygge-anlaeg',
  loenPaaHelligdage: LOEN_PAA_HELLIGDAGE.INGEN,
  beregnStoreBededagstillaeg: false,
  ...overrides,
});

const tafRanges = [{ fra: iso('2024-04-01'), til: iso('2025-03-31') }];

const createContext = (
  active: readonly Source[],
  overrides: Partial<FormKonsoliderContext> = {}
): FormKonsoliderContext => ({
  active,
  angivetLoen: true,
  anvendtReguleringsdato: iso('2024-04-01'),
  tafRanges,
  tafBeregningsenhed: TAF_BEREGNES_SOM.MAANEDER,
  kraeverFeriePctVedBeregningsperiode: false,
  activeMedSynligeSatserOgLoenoplysninger: [],
  ...overrides,
});

const incomeRow = (): StandardLoenTableRow => ({
  id: 'indkomst-1',
  col0_maaned: '',
  col1_maaned: '',
  col0_uge: '',
  col1_uge: '',
  col0_dag: undefined,
  col1_dag: undefined,
  col2: amount(100),
  col3: undefined,
  col4: undefined,
  col5: undefined,
  fpFvShSoBeloeb: undefined,
  pensionBeloeb: undefined,
});

const createPrivateKonsolideret = (
  overrides: Partial<Extract<KonsolideretLoenudvikling, { strategi: 'overenskomst' }>> = {}
): Extract<KonsolideretLoenudvikling, { strategi: 'overenskomst' }> => ({
  strategi: 'overenskomst',
  label: 'Overenskomst',
  reguleringsdato: iso('2024-04-01'),
  overenskomstId: 'bygge-anlaeg',
  loenPaaHelligdage: LOEN_PAA_HELLIGDAGE.INGEN,
  beregnStoreBededagstillaeg: false,
  feriePct: 0,
  fritvalgPct: 0,
  shSoPct: 0,
  pensionPct: 0,
  tafBeregningsenhed: TAF_BEREGNES_SOM.MAANEDER,
  harAnciennitetstillaegEfterSkadedatoen: false,
  anciennitetstillaegDato: undefined,
  anciennitetstillaegSatsAngivesPer: 'Måned',
  anciennitetstillaegSatsValue: undefined,
  offentligLoenEkstraGrundloen: 0,
  offentlig: null,
  tafRanges,
  ...overrides,
});

describe('overenskomstForm', () => {
  it('konsoliderer privat overenskomst og bruger sikre standardværdier', () => {
    const source = createSource({
      feriePct: 12,
      fritvalgPct: 3,
      shSoPct: 2,
      pensionPct: 8,
      offentligLoenEkstraGrundloen: amount(125),
    });

    expect(overenskomstForm.konsolider(createContext([source, { ...source, id: 'af-2' }]))).toEqual({
      strategi: 'overenskomst',
      label: 'Overenskomst',
      konsolideret: {
        strategi: 'overenskomst',
        label: 'Overenskomst',
        reguleringsdato: iso('2024-04-01'),
        overenskomstId: 'bygge-anlaeg',
        loenPaaHelligdage: LOEN_PAA_HELLIGDAGE.INGEN,
        beregnStoreBededagstillaeg: false,
        feriePct: 12,
        fritvalgPct: 3,
        shSoPct: 2,
        pensionPct: 8,
        tafBeregningsenhed: TAF_BEREGNES_SOM.MAANEDER,
        harAnciennitetstillaegEfterSkadedatoen: false,
        anciennitetstillaegDato: undefined,
        anciennitetstillaegSatsAngivesPer: 'Måned',
        anciennitetstillaegSatsValue: undefined,
        offentligLoenEkstraGrundloen: 125,
        offentlig: null,
        tafRanges,
      },
    });
  });

  it('konsoliderer offentlig indplacering og normaliserer ekstra grundløn', () => {
    const source = createSource({
      overenskomstId: 'kl-overenskomst',
      offentligLoenType: 'Månedsløn',
      offentligLoenTrin: 1,
      offentligLoenGruppe: 0,
      offentligLoenEkstraGrundloen: amount(250),
    });

    const result = overenskomstForm.konsolider(createContext([source, { ...source, id: 'af-2' }]));

    expect(result.konsolideret).toMatchObject({
      overenskomstId: 'kl-overenskomst',
      offentligLoenEkstraGrundloen: 250,
      offentlig: {
        overenskomstType: 'KL',
        loenType: 'maanedsLoen',
        loentrin: 1,
        loengruppe: 0,
      },
    });
  });

  it('bevarer et gyldigt anciennitetstillæg og bruger Måned som manglende enhedsstandard', () => {
    const source = createSource({
      harAnciennitetstillaegEfterSkadedatoen: true,
      anciennitetstillaegDato: iso('2024-06-01'),
      anciennitetstillaegSatsAngivesPer: undefined,
      anciennitetstillaegSats: amount(125),
    });

    expect(overenskomstForm.konsolider(createContext([source])).konsolideret).toMatchObject({
      harAnciennitetstillaegEfterSkadedatoen: true,
      anciennitetstillaegDato: iso('2024-06-01'),
      anciennitetstillaegSatsAngivesPer: 'Måned',
      anciennitetstillaegSatsValue: 125,
    });
  });

  it('afviser manglende overenskomst, manglende feriepct og ugyldigt helligdagsvalg', () => {
    const base = createSource();

    expect(() => overenskomstForm.konsolider(createContext([
      { ...base, overenskomstId: undefined },
    ]))).toThrow('Loenudvikling kan ikke beregnes: overenskomst mangler');

    expect(() => overenskomstForm.konsolider(createContext([
      { ...base, indtaegtsoplysningerTableData: [incomeRow()] },
    ], {
      kraeverFeriePctVedBeregningsperiode: true,
    }))).toThrow('Loenudvikling kan ikke beregnes: feriepct mangler');

    expect(() => overenskomstForm.konsolider(createContext([
      { ...base, loenPaaHelligdage: 'Ugyldigt valg' as Source['loenPaaHelligdage'] },
    ]))).toThrow('Loenudvikling kan ikke beregnes: loen paa helligdage er ugyldig');

  });

  it('håndhæver fælles feriepct-uniformitet, når beregningsperioden bruger synlige satser', () => {
    const first = createSource({ feriePct: 12 });
    const second = createSource({ id: 'af-2', feriePct: 13 });

    expect(() => overenskomstForm.konsolider(createContext([first, second], {
      angivetLoen: false,
      activeMedSynligeSatserOgLoenoplysninger: [first, second],
    }))).toThrow('Inkonsistente loenudviklingsindstillinger: feriepct');
  });

  it('bygger privat og offentlig resultat samt afviser forkert strategi', () => {
    const privat = overenskomstForm.byggResultat(createPrivateKonsolideret());
    expect(privat.segmenter.length).toBeGreaterThan(0);
    expect(privat.forloeb).toBeUndefined();

    const offentligSource = createSource({
      overenskomstId: 'kl-overenskomst',
      offentligLoenType: 'Månedsløn',
      offentligLoenTrin: 1,
      offentligLoenGruppe: 0,
    });
    const offentligKonsolideret = overenskomstForm.konsolider(createContext([offentligSource])).konsolideret;
    expect(offentligKonsolideret).not.toBeNull();
    if (!offentligKonsolideret) throw new Error('Offentlig overenskomst blev ikke konsolideret');
    const offentlig = overenskomstForm.byggResultat(offentligKonsolideret);
    expect(offentlig.segmenter.length).toBeGreaterThan(0);
    expect(offentlig.forloeb).toBeUndefined();

    expect(() => overenskomstForm.byggResultat({
      ...createPrivateKonsolideret(),
      strategi: 'manual',
    } as never)).toThrow('Loenudvikling kan ikke beregnes: overenskomststrategi mangler');
  });

  it('projicerer kendt dækning og returnerer ingen dækning for ukendt overenskomst', () => {
    const source = createSource();
    expect(overenskomstForm.coverageInterval(source)).toMatchObject({
      fraIso: expect.any(String),
      tilIso: expect.any(String),
    });
    expect(overenskomstForm.coverageInterval({ ...source, overenskomstId: 'ukendt-overenskomst' })).toBeUndefined();
    expect(overenskomstForm.coverageInterval({ ...source, overenskomstId: undefined })).toBeUndefined();
  });
});
