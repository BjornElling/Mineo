import type { ErstatningsopgoerelseValues } from '../../schemas/formSchemas';
import { erstatningsopgoerelseValidator } from '../../validators/erstatningsopgoerelseValidator';
import { toISODateString } from '../../types/branded';

// Håndskrevet typed fixture uden schema-defaults eller produktionsfabrikker.
// Perioden er bevidst aktiv, så den manglende satsårsværdi skal ramme den synlige
// required-field-branch i svie/smerte-validatoren.
const INDEPENDENT_SVIE_SMERTE_VALUES: ErstatningsopgoerelseValues = {
  eoNummer: undefined,
  eoLedsagetekst: undefined,
  'opgørelseLavetDen': undefined,
  indsaetUdkastStempel: 'Nej',
  vedroererPeriodeFra: toISODateString('2024-01-01'),
  vedroererPeriodeTil: toISODateString('2024-01-31'),
  revideretOpgoerelse: 'Nej',
  midlertidigtEetFraEetSiden: 'Nej',
  regulerOffentligeYdelser: 'Nej',
  erstatningsopgoerelseAfsluttesMed: 'Ingen',
  forligAnsvarsgradProcent: undefined,
  forligAnsvarsgradBroek: undefined,
  forligDato: undefined,
  kravPaaOevrigeErstatningskrav: 'Nej',
  oevrigeKravPerioder: [],
  offentligeYdelserRows: [],
  offentligeYdelserKommentarer: undefined,
  saerligeKommentarer: undefined,
  eoBilagSelection: {
    opgoerelse: false,
    loenindkomst: false,
    offentligeYdelser: false,
    midlertidigEet: false,
    shDage: false,
    regulering: false,
    okSatser: false,
    sygeferiegodtgoerelse: false,
  },
  eoBilagLoenindkomstOgOffentligeYdelserIndgaar: 'Perioden',
  varigeMenAfgorelse: 'Nej',
  menAfgoerelseDato: undefined,
  verserendeKlageMen: 'Nej',
  midlertidigtEETAfgorelse: 'Nej',
  midlertidigEETAfgoerelseDato: undefined,
  midlertidigEETVirkningsdato: undefined,
  endeligtEETAfgorelse: 'Nej',
  endeligEETAfgoerelseDato: undefined,
  endeligEETVirkningsdato: undefined,
  verserendeKlageEet: 'Nej',
  differencekravDato: undefined,
  kravPaaSvieSmerteGodtgoerelse: 'Ja',
  svieSmerteHelbredsstatus: undefined,
  tidligereSsMax: 'Nej',
  svieSmertePerioder: [{
    id: 'ss-literal',
    fra: toISODateString('2024-01-01'),
    til: toISODateString('2024-01-10'),
    tilstand: 'sygemeldt',
  }],
  svieSmerteSatserAar: undefined,
  svieSmerteDelvisSygemeldingSats: 'halv',
  svieSmerteTidligereTotal: undefined,
  svieSmerteAktuelPeriode: undefined,
  kravPaaTabtArbejdsfortjeneste: 'Nej',
  tafArbejdsstatus: undefined,
  tafPerioder: [],
  ferieperioder: [],
  sidsteDagAnsaettelsesforhold: undefined,
  tidligereModtagetTaf: undefined,
  komprimerBeregningEfterFoersteOpgoerelse: 'Ja',
  beregnesUdFra: 'Beregningsperiode',
  tafBeregningsperiodeFra: undefined,
  tafBeregningsperiodeTil: undefined,
  fravaerPerioder: [],
  uspecificeredeFerieFridage: undefined,
  oevrigtFravaerUdenLoen: 'Nej',
  oevrigeFravaersdage: undefined,
  oevrigeFravaersdageBeskrivelse: undefined,
  maanedsloenenUdgoer: undefined,
  dagsloenenUdgoer: undefined,
  angivetMaanedsloenBaseretPaa: undefined,
  angivetMaanedsloenOpreguleresFraDato: undefined,
  angivetDagsloenBaseretPaa: undefined,
  angivetDagsloenOpreguleresFraDato: undefined,
  sfggAnsaettelsesforhold: [],
  loenindkomstAnsaettelsesforhold: [],
  eoAngivetLoenLoenudvikling: {
    overenskomstId: undefined,
    harAnciennitetstillaegEfterSkadedatoen: false,
    anciennitetstillaegDato: undefined,
    anciennitetstillaegSatsAngivesPer: 'Måned',
    anciennitetstillaegSats: undefined,
    feriePct: undefined,
    loenPaaHelligdage: 'Almindelig løn',
    saerligFraDatoRegulering: undefined,
    loenudviklingBeregningsgrundlag: undefined,
    loenudviklingStatistikModel: undefined,
    loenudviklingKRLSatstabel: undefined,
    loenudviklingManuelNavn: undefined,
    loenudviklingManuelTableData: [],
    loenudviklingManuelProcentsatsTableData: [],
    offentligLoenType: undefined,
    offentligLoenTrin: undefined,
    offentligLoenGruppe: undefined,
    offentligLoenEkstraGrundloen: undefined,
    overenskomstFilter: { loenmodtager: undefined, arbejdsgiver: undefined },
  },
  visBilagsnumre: 'Nej',
  bilagsnumreMenAfgoerelse: undefined,
  bilagsnumreEetAfgoerelser: undefined,
  bilagsnumreSvieSmerteDokumentation: undefined,
  bilagsnumreBeregningsgrundlagTaf: undefined,
  bilagsnumreLoenISygeperioden: undefined,
  bilagsnumreOffentligeYdelser: undefined,
  bilagsnumreOevrigeErstatningskrav: undefined,
};

describe('TD-019 – svie/smerte-validator med aktiv periode', () => {
  it('rapporterer manglende satsår med præcis feltsti, besked og severity', () => {
    const result = erstatningsopgoerelseValidator.validateParsed(INDEPENDENT_SVIE_SMERTE_VALUES);

    expect(result).toEqual({
      isValid: false,
      errors: [{
        path: 'svieSmerteSatserAar',
        message: 'År for svie/smerte-sats mangler',
        severity: 'error',
      }],
    });
  });

  it('rapporterer manglende tilstand på en svie/smerte-række med præcis feltsti, besked og severity', () => {
    const result = erstatningsopgoerelseValidator.validateParsed({
      ...INDEPENDENT_SVIE_SMERTE_VALUES,
      svieSmerteSatserAar: 2024,
      svieSmertePerioder: [{
        ...INDEPENDENT_SVIE_SMERTE_VALUES.svieSmertePerioder[0],
        tilstand: undefined,
      }],
    });

    expect(result).toEqual({
      isValid: false,
      errors: [{
        path: 'svieSmertePerioder[0].tilstand',
        message: 'Tilstand mangler',
        severity: 'error',
      }],
    });
  });

  it('rapporterer manglende fra-dato på en svie/smerte-række med præcis feltsti, besked og severity', () => {
    const result = erstatningsopgoerelseValidator.validateParsed({
      ...INDEPENDENT_SVIE_SMERTE_VALUES,
      svieSmerteSatserAar: 2024,
      svieSmertePerioder: [{
        ...INDEPENDENT_SVIE_SMERTE_VALUES.svieSmertePerioder[0],
        fra: undefined,
      }],
    });

    expect(result).toEqual({
      isValid: false,
      errors: [{
        path: 'svieSmertePerioder[0].fra',
        message: 'Fra-dato mangler',
        severity: 'error',
      }],
    });
  });
});
