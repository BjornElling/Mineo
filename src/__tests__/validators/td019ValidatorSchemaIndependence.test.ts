import type { ErstatningsopgoerelseValues } from '../../schemas/formSchemas';
import { erstatningsopgoerelseValidator } from '../../validators/erstatningsopgoerelseValidator';
import { toISODateString } from '../../types/branded';

// Denne fixture er bevidst komplet og håndskrevet. Den skal kontrollere validatorens domænelag
// uden at hente manglende felter fra schema-defaults eller en produktionsfabrik.
const INDEPENDENT_RUNTIME_VALUES: ErstatningsopgoerelseValues = {
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

describe('TD-019 – validatorens domænelag uden schema-fixture', () => {
  it('validerer en domænegrænse på en håndskrevet typed runtime-værdi', () => {
    const result = erstatningsopgoerelseValidator.validateParsed({
      ...INDEPENDENT_RUNTIME_VALUES,
      forligAnsvarsgradProcent: 101,
    });

    expect(result).toEqual({
      isValid: false,
      errors: [{
        path: 'forligAnsvarsgradProcent',
        message: 'Procent skal være mellem 0 og 100',
        severity: 'error',
      }],
    });
  });

  it('afviser omvendt vedrører-periode på håndskrevet typed runtime-værdi', () => {
    const result = erstatningsopgoerelseValidator.validateParsed({
      ...INDEPENDENT_RUNTIME_VALUES,
      vedroererPeriodeFra: toISODateString('2024-02-01'),
      vedroererPeriodeTil: toISODateString('2024-01-01'),
    });

    expect(result).toEqual({
      isValid: false,
      errors: [{
        path: 'vedroererPeriodeFra',
        message: 'Til-dato skal være efter fra-dato',
        severity: 'error',
      }],
    });
  });

  it('kræver satsvalg for differentieret overenskomst ved aktiv TAF', () => {
    const result = erstatningsopgoerelseValidator.validateParsed({
      ...INDEPENDENT_RUNTIME_VALUES,
      kravPaaTabtArbejdsfortjeneste: 'Ja',
      tafPerioder: [{
        id: 'taf-1',
        fra: toISODateString('2024-01-01'),
        til: toISODateString('2024-01-31'),
        loseFeriedage: 0,
      }],
      tafBeregningsperiodeFra: toISODateString('2024-01-01'),
      tafBeregningsperiodeTil: toISODateString('2024-01-31'),
      loenindkomstAnsaettelsesforhold: [{
        id: 'af-1',
        navnPaaArbejdssted: undefined,
        harOverenskomst: true,
        overenskomstId: 'bygge-anlaeg',
        ansatPaaSkadestidspunktet: true,
        ansaettelsesforholdOphoert: false,
        sidsteArbejdsdag: undefined,
        harAnciennitetstillaegEfterSkadedatoen: false,
        anciennitetstillaegDato: undefined,
        anciennitetstillaegSatsAngivesPer: 'Måned',
        anciennitetstillaegSats: undefined,
        feriePct: undefined,
        fritvalgPct: undefined,
        shSoPct: undefined,
        storeBededagPct: 0,
        pensionPct: undefined,
        tillaegAngivesSom: 'procent',
        loenperiode: 'maaned',
        indtaegtsoplysningerTableData: [],
        fuldLoenUnderFerie: 'Nej',
        loenPaaHelligdage: 'Almindelig løn',
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
      }],
      sfggAnsaettelsesforhold: [{
        ansaettelsesforholdId: 'af-1',
        sfggBeregningskilde: 'Overenskomst',
        sfggReferenceperiodeFra: undefined,
        sfggReferenceperiodeTil: undefined,
        sfggReferenceperiodeFravaersdageUdenLoen: 0,
        sfggManuelDagssats: undefined,
        sfggManuelBeloebIHenholdTil: undefined,
        sfggManuelFoerstEfterSygeloen: 'Nej',
        sfggSatsvalg: undefined,
        sfggAlleredeBetaltBeloeb: undefined,
      }],
    });

    expect(result).toEqual({
      isValid: false,
      errors: [{
        path: 'sfggAnsaettelsesforhold[0].sfggSatsvalg',
        message: 'Satsvalg mangler',
        severity: 'error',
      }],
    });
  });

  it('kræver manuel dagssats for sygeferiegodtgørelse ved aktiv TAF', () => {
    const result = erstatningsopgoerelseValidator.validateParsed({
      ...INDEPENDENT_RUNTIME_VALUES,
      kravPaaTabtArbejdsfortjeneste: 'Ja',
      tafPerioder: [{
        id: 'taf-1',
        fra: toISODateString('2024-01-01'),
        til: toISODateString('2024-01-31'),
        loseFeriedage: 0,
      }],
      tafBeregningsperiodeFra: toISODateString('2024-01-01'),
      tafBeregningsperiodeTil: toISODateString('2024-01-31'),
      loenindkomstAnsaettelsesforhold: [{
        id: 'af-1',
        navnPaaArbejdssted: undefined,
        harOverenskomst: false,
        overenskomstId: undefined,
        ansatPaaSkadestidspunktet: true,
        ansaettelsesforholdOphoert: false,
        sidsteArbejdsdag: undefined,
        harAnciennitetstillaegEfterSkadedatoen: false,
        anciennitetstillaegDato: undefined,
        anciennitetstillaegSatsAngivesPer: 'Måned',
        anciennitetstillaegSats: undefined,
        feriePct: undefined,
        fritvalgPct: undefined,
        shSoPct: undefined,
        storeBededagPct: 0,
        pensionPct: undefined,
        tillaegAngivesSom: 'procent',
        loenperiode: 'maaned',
        indtaegtsoplysningerTableData: [],
        fuldLoenUnderFerie: 'Nej',
        loenPaaHelligdage: 'Almindelig løn',
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
      }],
      sfggAnsaettelsesforhold: [{
        ansaettelsesforholdId: 'af-1',
        sfggBeregningskilde: 'Manuelt angivet',
        sfggReferenceperiodeFra: undefined,
        sfggReferenceperiodeTil: undefined,
        sfggReferenceperiodeFravaersdageUdenLoen: undefined,
        sfggManuelDagssats: undefined,
        sfggManuelBeloebIHenholdTil: undefined,
        sfggManuelFoerstEfterSygeloen: 'Nej',
        sfggSatsvalg: undefined,
        sfggAlleredeBetaltBeloeb: undefined,
      }],
    });

    expect(result).toEqual({
      isValid: false,
      errors: [{
        path: 'sfggAnsaettelsesforhold[0].sfggManuelDagssats',
        message: 'Dagssats for sygeferiegodtgørelse mangler',
        severity: 'error',
      }],
    });
  });

  it('kræver lønregulering for beregningsperiode ved aktiv TAF', () => {
    const result = erstatningsopgoerelseValidator.validateParsed({
      ...INDEPENDENT_RUNTIME_VALUES,
      kravPaaTabtArbejdsfortjeneste: 'Ja',
      tafBeregningsperiodeFra: toISODateString('2024-01-01'),
      tafBeregningsperiodeTil: toISODateString('2024-01-31'),
      loenindkomstAnsaettelsesforhold: [{
        id: 'af-1',
        navnPaaArbejdssted: undefined,
        harOverenskomst: false,
        overenskomstId: undefined,
        ansatPaaSkadestidspunktet: true,
        ansaettelsesforholdOphoert: false,
        sidsteArbejdsdag: undefined,
        harAnciennitetstillaegEfterSkadedatoen: false,
        anciennitetstillaegDato: undefined,
        anciennitetstillaegSatsAngivesPer: 'Måned',
        anciennitetstillaegSats: undefined,
        feriePct: undefined,
        fritvalgPct: undefined,
        shSoPct: undefined,
        storeBededagPct: 0,
        pensionPct: undefined,
        tillaegAngivesSom: 'procent',
        loenperiode: 'maaned',
        indtaegtsoplysningerTableData: [],
        fuldLoenUnderFerie: 'Nej',
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
      }],
      sfggAnsaettelsesforhold: [{
        ansaettelsesforholdId: 'af-1',
        sfggBeregningskilde: 'Ingen',
        sfggReferenceperiodeFra: undefined,
        sfggReferenceperiodeTil: undefined,
        sfggReferenceperiodeFravaersdageUdenLoen: undefined,
        sfggManuelDagssats: undefined,
        sfggManuelBeloebIHenholdTil: undefined,
        sfggManuelFoerstEfterSygeloen: 'Nej',
        sfggSatsvalg: undefined,
        sfggAlleredeBetaltBeloeb: undefined,
      }],
    });

    expect(result).toEqual({
      isValid: false,
      errors: [{
        path: 'loenindkomstAnsaettelsesforhold[0].loenudviklingBeregningsgrundlag',
        message: 'Lønregulering skal vælges, evt. "Ingen"',
        severity: 'error',
      }],
    });
  });

  it('fanger manglende statistikmodel for aktiv TAF med angivet månedsløn', () => {
    const result = erstatningsopgoerelseValidator.validateParsed({
      ...INDEPENDENT_RUNTIME_VALUES,
      kravPaaTabtArbejdsfortjeneste: 'Ja',
      beregnesUdFra: 'Angivet månedsløn',
      maanedsloenenUdgoer: { kind: 'number', value: 30000 },
      tafPerioder: [{
        id: 'taf-1',
        fra: toISODateString('2024-01-01'),
        til: toISODateString('2024-01-31'),
        loseFeriedage: 0,
      }],
      eoAngivetLoenLoenudvikling: {
        ...INDEPENDENT_RUNTIME_VALUES.eoAngivetLoenLoenudvikling,
        loenudviklingBeregningsgrundlag: 'Statistik',
        loenudviklingStatistikModel: undefined,
      },
    });

    expect(result).toEqual({
      isValid: false,
      errors: [{
        path: 'eoAngivetLoenLoenudvikling.loenudviklingStatistikModel',
        message: 'Statistisk beregningsmodel skal vælges',
        severity: 'error',
      }],
    });
  });

  it('afviser svie/smerte-række uden til-dato på håndskrevet typed runtime-værdi', () => {
    const result = erstatningsopgoerelseValidator.validateParsed({
      ...INDEPENDENT_RUNTIME_VALUES,
      kravPaaSvieSmerteGodtgoerelse: 'Ja',
      svieSmertePerioder: [{
        id: 'ss-1',
        fra: toISODateString('2024-01-01'),
        til: undefined,
        tilstand: 'sygemeldt',
      }],
      vedroererPeriodeFra: toISODateString('2024-01-01'),
      vedroererPeriodeTil: toISODateString('2024-01-31'),
      svieSmerteSatserAar: 2024,
      svieSmerteDelvisSygemeldingSats: 'fuld',
    });

    expect(result).toEqual({
      isValid: false,
      errors: [{
        path: 'svieSmertePerioder[0].til',
        message: 'Til-dato mangler',
        severity: 'error',
      }],
    });
  });
});
