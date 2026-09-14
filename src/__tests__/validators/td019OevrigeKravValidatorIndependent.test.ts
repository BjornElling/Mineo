import type { ErstatningsopgoerelseValues } from '../../schemas/formSchemas';
import { erstatningsopgoerelseValidator } from '../../validators/erstatningsopgoerelseValidator';
import { toISODateString } from '../../types/branded';

// Håndskrevet typed fixture uden schema-defaults eller produktionsfabrikker.
// Rækken er udfyldt bortset fra, at beløbet er negativt, så kun beløbsgrænsen rammes.
const INDEPENDENT_OEVRIGE_KRAV_VALUES: ErstatningsopgoerelseValues = {
  eoNummer: undefined,
  eoLedsagetekst: undefined,
  'opgørelseLavetDen': undefined,
  indsaetUdkastStempel: 'Nej',
  vedroererPeriodeFra: undefined,
  vedroererPeriodeTil: undefined,
  revideretOpgoerelse: 'Nej',
  midlertidigtEetFraEetSiden: 'Nej',
  regulerOffentligeYdelser: 'Nej',
  erstatningsopgoerelseAfsluttesMed: 'Ingen',
  forligAnsvarsgradProcent: undefined,
  forligAnsvarsgradBroek: undefined,
  forligDato: undefined,
  kravPaaOevrigeErstatningskrav: 'Ja',
  oevrigeKravPerioder: [{
    id: 'oevrigt-krav-negativt-beloeb',
    dato: toISODateString('2024-01-01'),
    udgiftTil: 'Transport',
    beloeb: { kind: 'number', value: -1 },
  }],
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
  kravPaaSvieSmerteGodtgoerelse: 'Nej',
  svieSmerteHelbredsstatus: undefined,
  tidligereSsMax: 'Nej',
  svieSmertePerioder: [],
  svieSmerteSatserAar: undefined,
  svieSmerteDelvisSygemeldingSats: 'halv',
  svieSmerteTidligereTotal: undefined,
  svieSmerteAktuelPeriode: undefined,
  kravPaaTabtArbejdsfortjeneste: 'Nej',
  tafArbejdsstatus: 'Uarbejdsdygtig',
  tafPerioder: [],
  ferieperioder: [],
  sidsteDagAnsaettelsesforhold: undefined,
  tidligereModtagetTaf: undefined,
  komprimerBeregningEfterFoersteOpgoerelse: 'Ja',
  beregnesUdFra: 'Angivet månedsløn',
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
    beregnStoreBededagstillaeg: false,
    saerligFraDatoRegulering: undefined,
    loenudviklingBeregningsgrundlag: 'Ingen',
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

const INDEPENDENT_OEVRIGE_KRAV_ZERO_AMOUNT_VALUES: ErstatningsopgoerelseValues = {
  ...INDEPENDENT_OEVRIGE_KRAV_VALUES,
  oevrigeKravPerioder: INDEPENDENT_OEVRIGE_KRAV_VALUES.oevrigeKravPerioder.map((row) => ({
    ...row,
    id: 'oevrigt-krav-nul-beloeb',
    beloeb: { kind: 'number', value: 0 },
  })),
};

describe('TD-019 – øvrige krav-validator uden schema-fixture', () => {
  it('rapporterer negativt beløb med præcis feltsti, dansk besked og severity', () => {
    const result = erstatningsopgoerelseValidator.validateParsed(INDEPENDENT_OEVRIGE_KRAV_VALUES);

    expect(result).toEqual({
      isValid: false,
      errors: [{
        path: 'oevrigeKravPerioder[0].beloeb',
        message: 'Beløb kan ikke være negativt',
        severity: 'error',
      }],
    });
  });

  it('rapporterer nulbeløb med præcis feltsti, dansk besked og severity', () => {
    const result = erstatningsopgoerelseValidator.validateParsed(INDEPENDENT_OEVRIGE_KRAV_ZERO_AMOUNT_VALUES);

    expect(result).toEqual({
      isValid: false,
      errors: [{
        path: 'oevrigeKravPerioder[0].beloeb',
        message: 'Beløb skal være større end 0',
        severity: 'error',
      }],
    });
  });
});
