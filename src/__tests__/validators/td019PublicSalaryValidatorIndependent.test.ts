import type { ErstatningsopgoerelseValues } from '../../schemas/formSchemas';
import { erstatningsopgoerelseValidator } from '../../validators/erstatningsopgoerelseValidator';
import { toISODateString } from '../../types/branded';

// Håndskrevet typed fixture uden schema-defaults eller produktionsfabrikker.
const INDEPENDENT_PUBLIC_SALARY_VALUES: ErstatningsopgoerelseValues = {
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
  kravPaaSvieSmerteGodtgoerelse: 'Nej',
  svieSmerteHelbredsstatus: undefined,
  tidligereSsMax: 'Nej',
  svieSmertePerioder: [],
  svieSmerteSatserAar: undefined,
  svieSmerteDelvisSygemeldingSats: 'halv',
  svieSmerteTidligereTotal: undefined,
  svieSmerteAktuelPeriode: undefined,
  kravPaaTabtArbejdsfortjeneste: 'Ja',
  tafArbejdsstatus: 'Uarbejdsdygtig',
  tafPerioder: [{
    id: 'taf-public-salary',
    fra: toISODateString('2024-01-01'),
    til: toISODateString('2024-01-31'),
    loseFeriedage: 0,
  }],
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
  maanedsloenenUdgoer: { kind: 'number', value: 30000 },
  dagsloenenUdgoer: undefined,
  angivetMaanedsloenBaseretPaa: undefined,
  angivetMaanedsloenOpreguleresFraDato: undefined,
  angivetDagsloenBaseretPaa: undefined,
  angivetDagsloenOpreguleresFraDato: undefined,
  sfggAnsaettelsesforhold: [],
  loenindkomstAnsaettelsesforhold: [],
  eoAngivetLoenLoenudvikling: {
    overenskomstId: 'kl-overenskomst',
    harAnciennitetstillaegEfterSkadedatoen: false,
    anciennitetstillaegDato: undefined,
    anciennitetstillaegSatsAngivesPer: 'Måned',
    anciennitetstillaegSats: undefined,
    feriePct: 12.5,
    loenPaaHelligdage: 'Almindelig løn',
    beregnStoreBededagstillaeg: false,
    saerligFraDatoRegulering: undefined,
    loenudviklingBeregningsgrundlag: 'Overenskomst',
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

describe('TD-019 – offentlig løn-validator med KL-overenskomst', () => {
  it('rapporterer manglende offentlig løntype med præcis feltsti, besked og severity', () => {
    const result = erstatningsopgoerelseValidator.validateParsed(INDEPENDENT_PUBLIC_SALARY_VALUES);

    expect(result).toEqual({
      isValid: false,
      errors: [{
        path: 'eoAngivetLoenLoenudvikling.offentligLoenType',
        message: 'Ansættelse skal vælges',
        severity: 'error',
      }],
    });
  });

  it('rapporterer manglende offentlig løntrin med præcis feltsti, besked og severity', () => {
    const result = erstatningsopgoerelseValidator.validateParsed({
      ...INDEPENDENT_PUBLIC_SALARY_VALUES,
      eoAngivetLoenLoenudvikling: {
        ...INDEPENDENT_PUBLIC_SALARY_VALUES.eoAngivetLoenLoenudvikling,
        offentligLoenType: 'Månedsløn',
        offentligLoenTrin: undefined,
        offentligLoenGruppe: 2,
      },
    });

    expect(result).toEqual({
      isValid: false,
      errors: [{
        path: 'eoAngivetLoenLoenudvikling.offentligLoenTrin',
        message: 'Løntrin skal udfyldes',
        severity: 'error',
      }],
    });
  });

  it('rapporterer manglende offentlig løngruppe med præcis feltsti, besked og severity', () => {
    const result = erstatningsopgoerelseValidator.validateParsed({
      ...INDEPENDENT_PUBLIC_SALARY_VALUES,
      eoAngivetLoenLoenudvikling: {
        ...INDEPENDENT_PUBLIC_SALARY_VALUES.eoAngivetLoenLoenudvikling,
        offentligLoenType: 'Månedsløn',
        offentligLoenTrin: 30,
        offentligLoenGruppe: undefined,
      },
    });

    expect(result).toEqual({
      isValid: false,
      errors: [{
        path: 'eoAngivetLoenLoenudvikling.offentligLoenGruppe',
        message: 'Gruppe skal udfyldes',
        severity: 'error',
      }],
    });
  });
});
