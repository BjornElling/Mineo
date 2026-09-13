import { buildLoenTimeline } from '../../../domain/eoInspektion/eoInspektionLoenCoreModel';
import type { RowDay } from '../../../domain/eoRowEvaluation/eoRowTypes';
import type { LoenComponent } from '../../../domain/eoInspektion/eoInspektionLoenTypes';
import type { ErstatningsopgoerelseValues, StamdataValues } from '../../../schemas/formSchemas';
import { LOEN_PAA_HELLIGDAGE } from '../../../types/loen';
import { toISODateString } from '../../../types/branded';

const iso = (value: string) => toISODateString(value);

const values: ErstatningsopgoerelseValues = {
  eoNummer: undefined,
  eoLedsagetekst: undefined,
  'opgørelseLavetDen': undefined,
  indsaetUdkastStempel: 'Nej',
  vedroererPeriodeFra: iso('2024-03-04'),
  vedroererPeriodeTil: iso('2024-03-04'),
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
  loenindkomstAnsaettelsesforhold: [{
    id: 'td020-industri-vvs',
    navnPaaArbejdssted: 'VVS-arbejdsplads',
    harOverenskomst: true,
    overenskomstId: 'industri-og-vvs-overenskomsten',
    ansatPaaSkadestidspunktet: true,
    ansaettelsesforholdOphoert: false,
    sidsteArbejdsdag: undefined,
    fritvalgPct: undefined,
    shSoPct: undefined,
    pensionPct: undefined,
    tillaegAngivesSom: 'procent',
    loenperiode: 'maaned',
    indtaegtsoplysningerTableData: [],
    fuldLoenUnderFerie: 'Nej',
    harAnciennitetstillaegEfterSkadedatoen: false,
    anciennitetstillaegDato: undefined,
    anciennitetstillaegSatsAngivesPer: 'Måned',
    anciennitetstillaegSats: undefined,
    feriePct: 12.5,
    loenPaaHelligdage: LOEN_PAA_HELLIGDAGE.ALMINDELIG,
    beregnStoreBededagstillaeg: true,
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
    overenskomstFilter: {
      loenmodtager: undefined,
      arbejdsgiver: undefined,
    },
    storeBededagPct: undefined,
  }],
  eoAngivetLoenLoenudvikling: {
    overenskomstId: undefined,
    harAnciennitetstillaegEfterSkadedatoen: false,
    anciennitetstillaegDato: undefined,
    anciennitetstillaegSatsAngivesPer: 'Måned',
    anciennitetstillaegSats: undefined,
    feriePct: undefined,
    loenPaaHelligdage: LOEN_PAA_HELLIGDAGE.ALMINDELIG,
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
    overenskomstFilter: {
      loenmodtager: undefined,
      arbejdsgiver: undefined,
    },
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

// Lønconsumeren læser ikke stamdata, men inputtet holdes komplet og selvstændigt typed.
const stamdataValues: StamdataValues = {
  journalnr: '',
  advokat: '',
  sagsbehandler: '',
  skadelidte: '',
  skadelidteFodselsdato: undefined,
  skadestype: undefined,
  skadedato: undefined,
};

const inputDay: RowDay = {
  iso: iso('2024-03-04'),
  weekday: 1,
  isWeekend: false,
  isSognehelligdag: false,
  isArbejdsdag: true,
  tafFlags: new Set<string>(),
  svieSmerte: 'Ingen',
};

// Håndfacit fra Industri- og VVS-overenskomsten pr. 01-03-2024:
// grundløn 136,15 kr./time, fritvalg 15,5 % og arbejdsgiverpension 10,0 %.
// Valget «Almindelig løn» aktiverer overenskomstens -4 procentpoint-regel,
// så fritvalg bliver 11,5 %. Dertil kommer 12,5 % feriepenge og 0,45 %
// Store Bededag: pensionen beregnes af hele pakken før pension.
const expectedComponents = [
  { type: 'grundloen', amount: 136.15, source: 'overenskomst' },
  { type: 'feriegodtgorelse', amount: 17.01875, source: 'manuel' },
  { type: 'fritvalg', amount: 15.65725, source: 'overenskomst' },
  { type: 'storeBededag', amount: 0.612675, source: 'regel' },
  { type: 'pension', amount: 16.9438675, source: 'overenskomst' },
] satisfies readonly LoenComponent[];

describe('DATA-001/CALC-006/TD-020 – Industri- og VVS-løn som EO-consumer', () => {
  it('fører fritvalg-reglen gennem den faktiske EO-lønconsumer', () => {
    const result = buildLoenTimeline({
      inspektionDays: [inputDay],
      eoValues: values,
      stamdataValues,
    });
    const day = result.loenDays[0];

    expect(result.loenDays).toHaveLength(1);
    expect(day).toBeDefined();
    if (!day) throw new Error('Forventede en løndag fra Industri- og VVS-overenskomsten');

    // 136,15 × 0,125 = 17,01875; 136,15 × 0,115 = 15,65725;
    // 136,15 × 0,0045 = 0,612675; pension =
    // 136,15 × (1 + 0,125 + 0,115 + 0,0045) × 0,10 = 16,9438675.
    expect(day.iso).toBe(iso('2024-03-04'));
    expect(day.components.map(({ type, source }) => ({ type, source }))).toEqual(
      expectedComponents.map(({ type, source }) => ({ type, source }))
    );
    expectedComponents.forEach(({ amount }, index) => {
      expect(day.components[index]?.amount).toBeCloseTo(amount, 12);
    });
    expect(day.dailyTotal).toBeCloseTo(186.3825425, 12);
    expect(result.svieSmerteDays).toEqual([]);
  });
});
