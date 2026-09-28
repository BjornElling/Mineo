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
    beregnStoreBededagstillaeg: true,
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

const INDEPENDENT_FERIELOVEN_VALUES: ErstatningsopgoerelseValues = {
  ...INDEPENDENT_RUNTIME_VALUES,
  kravPaaTabtArbejdsfortjeneste: 'Ja',
  tafPerioder: [{
    id: 'taf-ferieloven',
    fra: toISODateString('2024-01-01'),
    til: toISODateString('2024-01-31'),
    loseFeriedage: 0,
  }],
  tafBeregningsperiodeFra: toISODateString('2024-01-01'),
  tafBeregningsperiodeTil: toISODateString('2024-01-31'),
  loenindkomstAnsaettelsesforhold: [{
    id: 'af-ferieloven',
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
    beregnStoreBededagstillaeg: true,
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
    ansaettelsesforholdId: 'af-ferieloven',
    sfggBeregningskilde: 'Ferieloven',
    sfggReferenceperiodeFra: toISODateString('2023-12-01'),
    sfggReferenceperiodeTil: toISODateString('2023-12-31'),
    sfggReferenceperiodeFravaersdageUdenLoen: 0,
    sfggManuelDagssats: undefined,
    sfggManuelBeloebIHenholdTil: undefined,
    sfggManuelFoerstEfterSygeloen: 'Nej',
    sfggSatsvalg: undefined,
    sfggAlleredeBetaltBeloeb: undefined,
  }],
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

  it('rapporterer negativ fritvalg-procent på en håndskrevet typed runtime-værdi', () => {
    const result = erstatningsopgoerelseValidator.validateParsed({
      ...INDEPENDENT_FERIELOVEN_VALUES,
      loenindkomstAnsaettelsesforhold: [{
        ...INDEPENDENT_FERIELOVEN_VALUES.loenindkomstAnsaettelsesforhold[0],
        fritvalgPct: -1,
      }],
    });

    expect(result).toEqual({
      isValid: false,
      errors: [{
        path: 'loenindkomstAnsaettelsesforhold[0].fritvalgPct',
        message: 'Procent skal være mellem 0 og 100',
        severity: 'error',
      }],
    });
  });

  it('rapporterer fritvalg-procent over 100 på en håndskrevet typed runtime-værdi', () => {
    const result = erstatningsopgoerelseValidator.validateParsed({
      ...INDEPENDENT_FERIELOVEN_VALUES,
      loenindkomstAnsaettelsesforhold: [{
        ...INDEPENDENT_FERIELOVEN_VALUES.loenindkomstAnsaettelsesforhold[0],
        fritvalgPct: 101,
      }],
    });

    expect(result).toEqual({
      isValid: false,
      errors: [{
        path: 'loenindkomstAnsaettelsesforhold[0].fritvalgPct',
        message: 'Procent skal være mellem 0 og 100',
        severity: 'error',
      }],
    });
  });

  it('kræver beregningskilde for sygeferiegodtgørelse ved aktiv TAF', () => {
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
        beregnStoreBededagstillaeg: true,
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
        sfggBeregningskilde: undefined,
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
        path: 'sfggAnsaettelsesforhold[0].sfggBeregningskilde',
        message: 'Beregningsgrundlag for SFGG ikke valgt',
        severity: 'error',
      }],
    });
  });

  it('rapporterer manglende SFGG-række for aktivt ansættelsesforhold', () => {
    // Den matchende række-cases ovenfor rammer en indekseret sti. Denne partition
    // skal også fastholdes: et aktivt ansættelsesforhold kan mangle sin SFGG-række,
    // hvor validatoren skal rapportere relationens samlingssti uden indeks.
    const result = erstatningsopgoerelseValidator.validateParsed({
      ...INDEPENDENT_FERIELOVEN_VALUES,
      sfggAnsaettelsesforhold: [],
    });

    expect(result).toEqual({
      isValid: false,
      errors: [{
        path: 'sfggAnsaettelsesforhold.sfggBeregningskilde',
        message: 'Beregningsgrundlag for SFGG ikke valgt',
        severity: 'error',
      }],
    });
  });

  it('kræver referenceperiode til-dato for Ferieloven ved aktiv TAF', () => {
    const result = erstatningsopgoerelseValidator.validateParsed({
      ...INDEPENDENT_FERIELOVEN_VALUES,
      sfggAnsaettelsesforhold: [{
        ...INDEPENDENT_FERIELOVEN_VALUES.sfggAnsaettelsesforhold[0],
        sfggReferenceperiodeTil: undefined,
      }],
    });

    expect(result).toEqual({
      isValid: false,
      errors: [{
        path: 'sfggAnsaettelsesforhold[0].sfggReferenceperiodeTil',
        message: 'Referenceperiode til-dato mangler',
        severity: 'error',
      }],
    });
  });

  it('kræver referenceperiode fra-dato for Ferieloven ved aktiv TAF', () => {
    const result = erstatningsopgoerelseValidator.validateParsed({
      ...INDEPENDENT_FERIELOVEN_VALUES,
      sfggAnsaettelsesforhold: [{
        ...INDEPENDENT_FERIELOVEN_VALUES.sfggAnsaettelsesforhold[0],
        sfggReferenceperiodeFra: undefined,
      }],
    });

    expect(result).toEqual({
      isValid: false,
      errors: [{
        path: 'sfggAnsaettelsesforhold[0].sfggReferenceperiodeFra',
        message: 'Referenceperiode fra-dato mangler',
        severity: 'error',
      }],
    });
  });

  it('kræver aktiv overenskomst når SFGG-kilden er Overenskomst', () => {
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
        beregnStoreBededagstillaeg: true,
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
        sfggReferenceperiodeFra: toISODateString('2023-12-01'),
        sfggReferenceperiodeTil: toISODateString('2023-12-31'),
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
        path: 'sfggAnsaettelsesforhold[0].sfggBeregningskilde',
        message: 'Der skal være valgt en overenskomst på ansættelsesforholdet for at beregne sygeferiegodtgørelse ud fra overenskomst',
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
        beregnStoreBededagstillaeg: true,
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
        beregnStoreBededagstillaeg: true,
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
        beregnStoreBededagstillaeg: true,
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

  it('rapporterer manglende lønregulering på EO-angivet løn med den separate feltsti', () => {
    const result = erstatningsopgoerelseValidator.validateParsed({
      ...INDEPENDENT_RUNTIME_VALUES,
      kravPaaTabtArbejdsfortjeneste: 'Ja',
      beregnesUdFra: 'Angivet månedsløn',
      maanedsloenenUdgoer: { kind: 'number', value: 30000 },
      eoAngivetLoenLoenudvikling: {
        ...INDEPENDENT_RUNTIME_VALUES.eoAngivetLoenLoenudvikling,
        loenudviklingBeregningsgrundlag: undefined,
      },
    });

    expect(result).toEqual({
      isValid: false,
      errors: [{
        path: 'eoAngivetLoenLoenudvikling.loenudviklingBeregningsgrundlag',
        message: 'Lønregulering skal vælges, evt. "Ingen"',
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

  it('rapporterer manglende feriePct for manuel EO-løn med præcis feltsti', () => {
    const result = erstatningsopgoerelseValidator.validateParsed({
      ...INDEPENDENT_FERIELOVEN_VALUES,
      loenindkomstAnsaettelsesforhold: [{
        ...INDEPENDENT_FERIELOVEN_VALUES.loenindkomstAnsaettelsesforhold[0],
        feriePct: undefined,
        indtaegtsoplysningerTableData: [{
          id: 'loen-manuel-ferie',
          col0_maaned: '1',
          col1_maaned: '2024',
          col0_uge: '',
          col1_uge: '',
          col0_dag: undefined,
          col1_dag: undefined,
          col2: { kind: 'number', value: 30000 },
          col3: undefined,
          col4: undefined,
          col5: undefined,
        }],
        loenudviklingBeregningsgrundlag: 'Manuelt angivet',
        loenudviklingManuelTableData: [{
          id: 'manuel-ferie-basis',
          dato: toISODateString('2024-01-01'),
          grundloen: { kind: 'number', value: 30000 },
          feriepenge: 12.5,
          shSoSats: undefined,
          fritvalg: undefined,
          agPension: undefined,
        }],
      }],
    });

    expect(result).toEqual({
      isValid: false,
      errors: [{
        path: 'loenindkomstAnsaettelsesforhold[0].feriePct',
        message: 'Feriegodtgørelse/-tillæg skal udfyldes',
        severity: 'error',
      }],
    });
  });

  it('afviser omvendt referenceperiode for Ferieloven med præcis feltsti', () => {
    const result = erstatningsopgoerelseValidator.validateParsed({
      ...INDEPENDENT_FERIELOVEN_VALUES,
      sfggAnsaettelsesforhold: [{
        ...INDEPENDENT_FERIELOVEN_VALUES.sfggAnsaettelsesforhold[0],
        sfggReferenceperiodeFra: toISODateString('2023-12-31'),
        sfggReferenceperiodeTil: toISODateString('2023-12-01'),
      }],
    });

    expect(result).toEqual({
      isValid: false,
      errors: [
        {
          path: 'sfggAnsaettelsesforhold[0].sfggReferenceperiodeFra',
          message: 'Til-dato skal være efter fra-dato',
          severity: 'error',
        },
        {
          path: 'sfggAnsaettelsesforhold[0].sfggReferenceperiodeFra',
          message: 'Ingen arbejdsdage i SFGG-perioden',
          severity: 'error',
        },
      ],
    });
  });

  it('fail-closer en ukendt beregningskilde med den autoritative fejlsti', () => {
    const result = erstatningsopgoerelseValidator.validateParsed({
      ...INDEPENDENT_RUNTIME_VALUES,
      kravPaaTabtArbejdsfortjeneste: 'Ja',
      beregnesUdFra: 'ukendt' as unknown as ErstatningsopgoerelseValues['beregnesUdFra'],
      tafPerioder: [{
        id: 'taf-ukendt-beregning',
        fra: toISODateString('2024-01-01'),
        til: toISODateString('2024-01-31'),
        loseFeriedage: 0,
      }],
    });

    expect(result).toEqual({
      isValid: false,
      errors: [
        {
          path: 'beregnesUdFra',
          message: 'Ukendt beregnesUdFra-værdi: ukendt',
          severity: 'error',
        },
        {
          path: 'beregnesUdFra',
          message: 'Ukendt beregnesUdFra-værdi: ukendt',
          severity: 'error',
        },
      ],
    });
  });
});
