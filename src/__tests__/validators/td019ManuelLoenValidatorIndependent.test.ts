import type { ErstatningsopgoerelseValues } from '../../schemas/formSchemas';
import { erstatningsopgoerelseValidator } from '../../validators/erstatningsopgoerelseValidator';
import { toISODateString } from '../../types/branded';

// Håndskrevet typed fixture uden schema-defaults eller produktionsfabrikker.
const INDEPENDENT_MANUEL_LOEN_VALUES: ErstatningsopgoerelseValues = {
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
    id: 'taf-manuel-loen',
    fra: toISODateString('2024-01-01'),
    til: toISODateString('2024-01-31'),
    loseFeriedage: 0,
  }],
  ferieperioder: [],
  sidsteDagAnsaettelsesforhold: undefined,
  tidligereModtagetTaf: undefined,
  komprimerBeregningEfterFoersteOpgoerelse: 'Ja',
  beregnesUdFra: 'Angivet månedsløn',
  tafBeregningsperiodeFra: toISODateString('2024-01-01'),
  tafBeregningsperiodeTil: toISODateString('2024-01-31'),
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
    overenskomstId: undefined,
    harAnciennitetstillaegEfterSkadedatoen: false,
    anciennitetstillaegDato: undefined,
    anciennitetstillaegSatsAngivesPer: 'Måned',
    anciennitetstillaegSats: undefined,
    feriePct: 12.5,
    loenPaaHelligdage: 'Almindelig løn',
    saerligFraDatoRegulering: undefined,
    loenudviklingBeregningsgrundlag: 'Manuelt angivet',
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

const INDEPENDENT_MANUEL_LOEN_MISSING_GRUNDLOEN: ErstatningsopgoerelseValues = {
  ...INDEPENDENT_MANUEL_LOEN_VALUES,
  eoAngivetLoenLoenudvikling: {
    ...INDEPENDENT_MANUEL_LOEN_VALUES.eoAngivetLoenLoenudvikling,
    loenudviklingManuelTableData: [{
      id: 'missing-grundloen',
      dato: toISODateString('2024-01-01'),
      grundloen: undefined,
      feriepenge: undefined,
      shSoSats: undefined,
      fritvalg: undefined,
      agPension: undefined,
    }],
  },
};

const INDEPENDENT_MANUEL_LOEN_ZERO_GRUNDLOEN: ErstatningsopgoerelseValues = {
  ...INDEPENDENT_MANUEL_LOEN_VALUES,
  eoAngivetLoenLoenudvikling: {
    ...INDEPENDENT_MANUEL_LOEN_VALUES.eoAngivetLoenLoenudvikling,
    loenudviklingManuelTableData: [{
      id: 'zero-grundloen',
      dato: toISODateString('2024-01-01'),
      grundloen: { kind: 'number', value: 0 },
      feriepenge: undefined,
      shSoSats: undefined,
      fritvalg: undefined,
      agPension: undefined,
    }],
  },
};

const INDEPENDENT_MANUEL_LOEN_MISSING_DATE: ErstatningsopgoerelseValues = {
  ...INDEPENDENT_MANUEL_LOEN_VALUES,
  eoAngivetLoenLoenudvikling: {
    ...INDEPENDENT_MANUEL_LOEN_VALUES.eoAngivetLoenLoenudvikling,
    loenudviklingManuelTableData: [
      {
        id: 'basis',
        dato: toISODateString('2024-01-01'),
        grundloen: { kind: 'number', value: 30000 },
        feriepenge: 12.5,
        shSoSats: 10,
        fritvalg: 5,
        agPension: 8,
      },
      {
        id: 'missing-date',
        dato: undefined,
        grundloen: { kind: 'number', value: 31000 },
        feriepenge: 12.5,
        shSoSats: 10,
        fritvalg: 5,
        agPension: 8,
      },
    ],
  },
};

describe('TD-019 – manuel løn-validator med aktiv TAF og angivet månedsløn', () => {
  it('rapporterer manglende manuel reguleringsrække med præcis feltsti, besked og severity', () => {
    const result = erstatningsopgoerelseValidator.validateParsed(INDEPENDENT_MANUEL_LOEN_VALUES);

    expect(result).toEqual({
      isValid: false,
      errors: [{
        path: 'eoAngivetLoenLoenudvikling.loenudviklingManuelTableData',
        message: 'Mindst én manuel reguleringsrække skal udfyldes',
        severity: 'error',
      }],
    });
  });

  it('rapporterer manglende grundløn på en manuel reguleringsrække med præcis feltsti, besked og severity', () => {
    const result = erstatningsopgoerelseValidator.validateParsed(INDEPENDENT_MANUEL_LOEN_MISSING_GRUNDLOEN);

    expect(result).toEqual({
      isValid: false,
      errors: [{
        path: 'eoAngivetLoenLoenudvikling.loenudviklingManuelTableData',
        message: 'Grundløn skal udfyldes på alle manuelle reguleringsrækker',
        severity: 'error',
      }],
    });
  });

  it('rapporterer grundløn på nul på en manuel reguleringsrække med præcis feltsti, besked og severity', () => {
    const result = erstatningsopgoerelseValidator.validateParsed(INDEPENDENT_MANUEL_LOEN_ZERO_GRUNDLOEN);

    expect(result).toEqual({
      isValid: false,
      errors: [{
        path: 'eoAngivetLoenLoenudvikling.loenudviklingManuelTableData',
        message: 'Grundløn skal være større end 0 på alle manuelle reguleringsrækker',
        severity: 'error',
      }],
    });
  });

  it('rapporterer manglende dato på en ellers udfyldt manuel reguleringsrække med præcis feltsti, besked og severity', () => {
    const result = erstatningsopgoerelseValidator.validateParsed(INDEPENDENT_MANUEL_LOEN_MISSING_DATE);

    expect(result).toEqual({
      isValid: false,
      errors: [{
        path: 'eoAngivetLoenLoenudvikling.loenudviklingManuelTableData',
        message: 'Dato skal udfyldes på alle manuelle reguleringsrækker',
        severity: 'error',
      }],
    });
  });
});
