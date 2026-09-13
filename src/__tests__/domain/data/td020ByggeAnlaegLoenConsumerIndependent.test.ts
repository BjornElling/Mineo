import { buildLoenTimeline } from '../../../domain/eoInspektion/eoInspektionLoenCoreModel';
import type { RowDay } from '../../../domain/eoRowEvaluation/eoRowTypes';
import type { LoenComponent } from '../../../domain/eoInspektion/eoInspektionLoenTypes';
import type { ErstatningsopgoerelseValues, StamdataValues } from '../../../schemas/formSchemas';
import type { ISODateString } from '../../../types/branded';
import { toISODateString } from '../../../types/branded';

const iso = (value: string): ISODateString => toISODateString(value);

const values: ErstatningsopgoerelseValues = {
  eoNummer: undefined,
  eoLedsagetekst: undefined,
  'opgørelseLavetDen': undefined,
  indsaetUdkastStempel: 'Nej',
  vedroererPeriodeFra: iso('2024-02-29'),
  vedroererPeriodeTil: iso('2024-03-01'),
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
    id: 'td020-bygge-anlaeg',
    navnPaaArbejdssted: 'Byggeplads',
    harOverenskomst: true,
    overenskomstId: 'bygge-anlaeg',
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
    loenPaaHelligdage: 'Almindelig løn',
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

const inputDays: readonly RowDay[] = [
  {
    iso: iso('2024-02-29'),
    weekday: 4,
    isWeekend: false,
    isSognehelligdag: false,
    isArbejdsdag: true,
    tafFlags: new Set<string>(),
    svieSmerte: 'Ingen',
  },
  {
    iso: iso('2024-03-01'),
    weekday: 5,
    isWeekend: false,
    isSognehelligdag: false,
    isArbejdsdag: true,
    tafFlags: new Set<string>(),
    svieSmerte: 'Ingen',
  },
];

// Håndfacit for Bygge-/anlægsoverenskomsten:
// 29. februar bruger 01-01-2024-satsen 138,15 kr. og 12,9 % SH/SO.
// Almindelig løn reducerer SH/SO med 5,9 procentpoint til 7,0 %.
// 1. marts bruger 01-03-2024-satsen 142,65 kr. og 14,7 % SH/SO,
// som reduceres til 8,8 %. Fritvalg er 0 % i begge perioder.
const expectedComponentsByDay: readonly (readonly LoenComponent[])[] = [
  [
    { type: 'grundloen', amount: 138.15, source: 'overenskomst' },
    { type: 'feriegodtgorelse', amount: 17.26875, source: 'manuel' },
    { type: 'shSo', amount: 9.6705, source: 'overenskomst' },
    { type: 'storeBededag', amount: 0.621675, source: 'regel' },
    { type: 'pension', amount: 16.8196588875, source: 'overenskomst' },
  ],
  [
    { type: 'grundloen', amount: 142.65, source: 'overenskomst' },
    { type: 'feriegodtgorelse', amount: 17.83125, source: 'manuel' },
    { type: 'shSo', amount: 12.5532, source: 'overenskomst' },
    { type: 'storeBededag', amount: 0.641925, source: 'regel' },
    { type: 'pension', amount: 17.6281520625, source: 'overenskomst' },
  ],
];

const expectedDailyTotals = [182.5305838875, 191.3045270625] as const;

describe('DATA-001/CALC-006/TD-020 – Bygge-/anlægsoverenskomstens løn som EO-consumer', () => {
  it('fører satsbrud og Almindelig løn-reglen gennem den faktiske EO-lønconsumer', () => {
    const result = buildLoenTimeline({
      inspektionDays: inputDays,
      eoValues: values,
      stamdataValues,
    });

    expect(result.loenDays).toHaveLength(2);
    result.loenDays.forEach((day, index) => {
      const expectedComponents = expectedComponentsByDay[index];
      const expectedTotal = expectedDailyTotals[index];
      expect(expectedComponents).toBeDefined();
      expect(expectedTotal).toBeDefined();
      if (!expectedComponents || expectedTotal === undefined) {
        throw new Error(`Mangler håndfacit for løndag ${index}`);
      }

      expect(day.iso).toBe(inputDays[index]?.iso);
      expect(day.components.map(({ type, source }) => ({ type, source }))).toEqual(
        expectedComponents.map(({ type, source }) => ({ type, source }))
      );
      expectedComponents.forEach(({ amount }, componentIndex) => {
        expect(day.components[componentIndex]?.amount).toBeCloseTo(amount, 12);
      });
      expect(day.dailyTotal).toBeCloseTo(expectedTotal, 12);
    });
    expect(result.svieSmerteDays).toEqual([]);
  });
});
