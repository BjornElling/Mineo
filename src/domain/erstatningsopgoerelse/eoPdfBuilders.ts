import type { ErstatningsopgoerelseValues, OevrigeKravRow, StamdataValues } from '../../schemas/formSchemas';
import type { ISODateString } from '../../types/branded';
import { isISODateString, isoToDanish, subtractOneDay } from '../../types/branded';
import { isoDateToDate } from '../dates/isoDate';
import { isTafRowEmpty } from './rowEmpty';
import { computeSvieSmerteEngine, type SvieSmerteEngineOutput } from './svieSmerteEngine';
import { erDetteFoersteErstatningsopgoerelse } from './eoNummerValidering';
import { buildTafArbejdsstatusLinje } from './tafArbejdsstatusConfig';
import type { Calculable, MoneyOre, OevrigeKravPdfModel, SvieSmertePdfModel, TabtArbejdsfortjenestePdfModel } from './eoPdfModelTypes';
import { clampMoneyOreToZero, ensureMoneyOre } from './eoPdfMoneyUtils';
import { formatDateShort, formatDateLong, getDayAfterIso } from './sharedPdfUtils';
import { parseOevrigeKravBeloeb } from './oevrigeKravAmountParser';
import { computeTafNettoBeregning, type TafNettoBeregningResult } from './tafNettoBeregning';

const asCalculable = <T>(value: T): Calculable<T> => ({ status: 'ok', value });
const notCalculable = <T>(reason: string): Calculable<T> => ({ status: 'not_calculable', reason });
const notCalculableMoney = (reason: string): Calculable<MoneyOre> => notCalculable<MoneyOre>(reason);

export const buildSvieSmerteModel = (
  values: ErstatningsopgoerelseValues,
  stamdataValues: StamdataValues,
  options: Readonly<{ engine?: SvieSmerteEngineOutput }> = {}
): SvieSmertePdfModel => {
  const beregnes = values.beregnesSvieSmerteGodtgoerelse === 'Ja';
  const statusLinjer: string[] = [];
  const periodeTilISO = values.vedroererPeriodeTil;

  // Kanonisk brug: engine er allerede beregnet i computeEoSnapshot og sendes via options.
  // Fallback-beregning her sikrer at builderen kan bruges isoleret (fx i tests).
  const engine = options.engine ?? computeSvieSmerteEngine({
    erstatningsopgoerelse: values,
    stamdata: {
      skadesdato: stamdataValues.skadesdato,
      skadestype: stamdataValues.skadestype,
    },
  });

  const constrained = engine.constrainedPeriods.map((p) => ({
    fra: isoDateToDate(p.fra),
    til: isoDateToDate(p.til),
    isDelvist: p.isDelvist,
  }));

  const varigeMenAfgorelse = values.varigeMenAfgorelse;
  const opgLavetDen = values.opgørelseLavetDen;
  const menDato = values.menAfgoerelseDato;
  const verserendeKlageMen = values.verserendeKlageMen;
  const opgjortFremTilPeriodeTil = engine.opgjortFremTilPeriodeTil;

  if (values.svieSmerteHelbredsstatus && periodeTilISO) {
    const dagenEfter = formatDateLong(getDayAfterIso(periodeTilISO));
    if (values.svieSmerteHelbredsstatus === 'Sygemeldt') {
      statusLinjer.push(`Den ${dagenEfter} var skadelidte fortsat sygemeldt.`);
    } else if (values.svieSmerteHelbredsstatus === 'Delvist Sygemeldt') {
      statusLinjer.push(`Den ${dagenEfter} var skadelidte fortsat delvist sygemeldt.`);
    } else if (values.svieSmerteHelbredsstatus === 'Raskmeldt') {
      statusLinjer.push(
        opgjortFremTilPeriodeTil
          ? `Den ${dagenEfter} blev skadelidte raskmeldt.`
          : `Den ${dagenEfter} var skadelidte raskmeldt.`
      );
    }
  }

  if (varigeMenAfgorelse === 'Nej' && opgLavetDen) {
    const dato = formatDateLong(opgLavetDen);
    const tekst = `Der er den ${dato} ikke truffet afgørelse om varige mén.`;
    statusLinjer.push(verserendeKlageMen === 'Ja' ? `${tekst} Afgørelsen er påklaget.` : tekst);
  } else if (varigeMenAfgorelse === 'Ja' && menDato) {
    const dato = formatDateLong(menDato);
    const tekst = `Der er den ${dato} truffet afgørelse om varige mén.`;
    statusLinjer.push(verserendeKlageMen === 'Ja' ? `${tekst} Afgørelsen er påklaget.` : tekst);
  }

  if (varigeMenAfgorelse === 'Ja' && verserendeKlageMen === 'Nej' && menDato && isISODateString(menDato)) {
    const ophoerDato = subtractOneDay(menDato);
    if (ophoerDato && perioderCoverDate(constrained, ophoerDato)) {
      statusLinjer.push('Afgørelsen bringer retten til svie- og smertegodtgørelse til ophør.');
    }
  }

  const periodeLinjer = engine.constrainedPeriods.flatMap((p) => {
    const fraDisplay = isoToDanish(p.fra);
    const tilDisplay = isoToDanish(p.til);
    if (!fraDisplay || !tilDisplay) return [];
    const suffix = p.isDelvist ? ' (delvist syg)' : '';
    if (fraDisplay === tilDisplay) return [`${fraDisplay}${suffix}`];
    return [`${fraDisplay} - ${tilDisplay}${suffix}`];
  });

  const satserPerDag: Calculable<MoneyOre> = engine.satserPerDagOre === null
    ? notCalculableMoney('Satser kan ikke beregnes')
    : asCalculable(ensureMoneyOre(engine.satserPerDagOre));
  const satserMax: Calculable<MoneyOre> = engine.satserMaxOre === null
    ? notCalculableMoney('Satser kan ikke beregnes')
    : asCalculable(ensureMoneyOre(engine.satserMaxOre));
  const satserPerDagFoerForlig: Calculable<MoneyOre> = engine.satserPerDagFoerForligOre === null
    ? notCalculableMoney('Satser kan ikke beregnes')
    : asCalculable(ensureMoneyOre(engine.satserPerDagFoerForligOre));
  const satserMaxFoerForlig: Calculable<MoneyOre> = engine.satserMaxFoerForligOre === null
    ? notCalculableMoney('Satser kan ikke beregnes')
    : asCalculable(ensureMoneyOre(engine.satserMaxFoerForligOre));
  const tidligere: Calculable<MoneyOre> = engine.tidligereOre === null
    ? notCalculableMoney('Ikke angivet')
    : asCalculable(ensureMoneyOre(engine.tidligereOre));
  const aktuel: Calculable<MoneyOre> = engine.aktuelOre === null
    ? notCalculableMoney('Ikke angivet')
    : asCalculable(ensureMoneyOre(engine.aktuelOre));

  const periodeHeading =
    engine.constrainedPeriods.length > 1
      ? 'Sygeperioder, hvor der beregnes svie- og smertegodtgørelse'
      : 'Sygeperiode, hvor der beregnes svie- og smertegodtgørelse';

  return {
    beregnes,
    statusLinjer,
    opgjortFremTilPeriodeTil,
    periodeHeading,
    periodeLinjer,
    harPerioder: engine.harPerioder,
    satserAar: engine.satserAar,
    satserPerDag,
    satserMax,
    forligLabel: engine.forligLabel,
    forligSatserSuffix: engine.forligSatserSuffix,
    forligFactor: engine.forligFactor,
    satserPerDagFoerForlig,
    satserMaxFoerForlig,
    tidligere,
    aktuel,
    sygedage: engine.sygedage,
    delviseSygedage: engine.delviseSygedage,
    delvisFaktor: engine.delvisFaktor,
    maxApplied: engine.maxApplied,
    totalOre: clampMoneyOreToZero(ensureMoneyOre(engine.totalOre)),
  };
};

const perioderCoverDate = (perioder: Array<{ fra: Date; til: Date }>, target: ISODateString): boolean => {
  const targetDate = isoDateToDate(target);
  for (const periode of perioder) {
    if (periode.fra <= targetDate && periode.til >= targetDate) return true;
  }
  return false;
};

const buildTafPerioderLinjer = (
  values: ErstatningsopgoerelseValues,
  tafRanges: readonly { fra: ISODateString; til: ISODateString }[]
): string[] => {
  const rows = values.tafPerioder ?? [];
  const nonEmpty = rows.filter((row) => !isTafRowEmpty(row));
  if (nonEmpty.length === 0) return [];

  const lines: string[] = [];
  for (const range of tafRanges) {
    const fraText = formatDateShort(range.fra);
    const tilText = formatDateShort(range.til);
    if (fraText && tilText) {
      lines.push(`${fraText} - ${tilText}`);
    }
  }
  return lines;
};
export const buildTabtArbejdsfortjenesteModel = (
  values: ErstatningsopgoerelseValues,
  stamdataValues: StamdataValues,
  options: Readonly<{
    tafNetto?: TafNettoBeregningResult;
    tafRanges: readonly { fra: ISODateString; til: ISODateString }[];
  }>
): TabtArbejdsfortjenestePdfModel => {
  const statusLinjer: string[] = [];
  const periodeTilISO = values.vedroererPeriodeTil;
  const tafRanges = options.tafRanges;
  const tafRangesAsDates = tafRanges.map((range) => ({
    fra: isoDateToDate(range.fra),
    til: isoDateToDate(range.til),
  }));
  const tafOpgjortFremTilPeriodeTil = Boolean(periodeTilISO && perioderCoverDate(tafRangesAsDates, periodeTilISO));
  if (values.tafArbejdsstatus && periodeTilISO) {
    const dagenEfter = formatDateLong(getDayAfterIso(periodeTilISO));
    statusLinjer.push(
      buildTafArbejdsstatusLinje(dagenEfter, values.tafArbejdsstatus, {
        opgjortFremTilPeriodeTil: tafOpgjortFremTilPeriodeTil,
      })
    );
  }

  const eetLinjer: string[] = [];
  let endeligtEetLinje: string | null = null;
  let endeligtEetReferenceDato: ISODateString | undefined;
  if (values.endeligtEetAfgorelse === 'Ja') {
    if (values.endeligEETVirkningsdato) {
      const dato = formatDateLong(values.endeligEETVirkningsdato);
      const tekst = `Der er truffet endelig erhvervsevnetabsafgørelse med virkning fra ${dato}.`;
      endeligtEetLinje = values.verserendeKlageEet === 'Ja' ? `${tekst} Afgørelsen er påklaget.` : tekst;
      endeligtEetReferenceDato = values.endeligEETVirkningsdato;
    } else if (values.endeligEETAfgoerelseDato) {
      const dato = formatDateLong(values.endeligEETAfgoerelseDato);
      const tekst = `Der er den ${dato} truffet endelig erhvervsevnetabsafgørelse.`;
      endeligtEetLinje = values.verserendeKlageEet === 'Ja' ? `${tekst} Afgørelsen er påklaget.` : tekst;
      endeligtEetReferenceDato = values.endeligEETAfgoerelseDato;
    }
  } else if (values.midlertidigtEetAfgorelse === 'Ja') {
    if (values.midlertidigEETVirkningsdato) {
      const dato = formatDateLong(values.midlertidigEETVirkningsdato);
      const tekst = `Der er truffet midlertidig erhvervsevnetabsafgørelse med virkning fra ${dato}.`;
      eetLinjer.push(values.verserendeKlageEet === 'Ja' ? `${tekst} Afgørelsen er påklaget.` : tekst);
    } else if (values.midlertidigEETAfgoerelseDato) {
      const dato = formatDateLong(values.midlertidigEETAfgoerelseDato);
      const tekst = `Der er den ${dato} truffet midlertidig erhvervsevnetabsafgørelse.`;
      eetLinjer.push(values.verserendeKlageEet === 'Ja' ? `${tekst} Afgørelsen er påklaget.` : tekst);
    }
  } else if (values.opgørelseLavetDen) {
    const dato = formatDateLong(values.opgørelseLavetDen);
    const tekst = `Der er den ${dato} ikke truffet afgørelse om erhvervsevnetab med 15 % eller derover.`;
    eetLinjer.push(values.verserendeKlageEet === 'Ja' ? `${tekst} Afgørelsen er påklaget.` : tekst);
  }

  const differencekravLinjeBase = values.differencekravDato
    ? `Der er opgjort differencekrav i sagen den ${formatDateLong(values.differencekravDato)}.`
    : null;
  const differencekravReferenceDato = values.differencekravDato;

  const tafPerioderLinjer = buildTafPerioderLinjer(values, tafRanges);
  // tafNetto er optional (til forskel fra tafRanges): kanonisk brug sender det fra computeEoSnapshot,
  // men fallback-beregning sikrer isoleret brug (fx i tests). tafRanges er required fordi
  // det altid er tilgængeligt på kaldsstedet og clamping-semantikken er afgørende for korrekthed.
  const tafMonetary = options.tafNetto ?? computeTafNettoBeregning(values, stamdataValues);
  const harTafPerioder = tafMonetary.harTafPerioder;
  const harTafDagenFoer = (dato: ISODateString | undefined): boolean => {
    if (!dato) return false;
    const dagenFoer = subtractOneDay(dato);
    return Boolean(dagenFoer && perioderCoverDate(tafRangesAsDates, dagenFoer));
  };

  const endeligtEetBringTilOphoer =
    values.verserendeKlageEet !== 'Ja' && harTafDagenFoer(endeligtEetReferenceDato);
  const differencekravBringTilOphoer = harTafDagenFoer(differencekravReferenceDato);

  let differencekravLinje: string | null = differencekravLinjeBase;
  let viserEndeligtEetLinje = false;
  if (
    endeligtEetLinje !== null &&
    endeligtEetReferenceDato !== undefined &&
    differencekravLinjeBase !== null &&
    differencekravReferenceDato !== undefined
  ) {
    const endeligDato = endeligtEetReferenceDato;
    const differenceDato = differencekravReferenceDato;

    // ISODateString er canonical "YYYY-MM-DD", så leksikografisk sammenligning
    // giver samme orden som kronologisk sammenligning.
    const compareIsoDates = (left: ISODateString, right: ISODateString): number => {
      if (left < right) return -1;
      if (left > right) return 1;
      return 0;
    };

    const valgtKilde: 'endeligtEet' | 'differencekrav' = (() => {
      if (endeligtEetBringTilOphoer && !differencekravBringTilOphoer) return 'endeligtEet';
      if (!endeligtEetBringTilOphoer && differencekravBringTilOphoer) return 'differencekrav';
      if (endeligtEetBringTilOphoer && differencekravBringTilOphoer) {
        const endeligDagenFoer = subtractOneDay(endeligDato);
        const differenceDagenFoer = subtractOneDay(differenceDato);
        if (!endeligDagenFoer || !differenceDagenFoer) return 'endeligtEet';
        return compareIsoDates(endeligDagenFoer, differenceDagenFoer) <= 0 ? 'endeligtEet' : 'differencekrav';
      }
      return compareIsoDates(endeligDato, differenceDato) <= 0 ? 'endeligtEet' : 'differencekrav';
    })();

    if (valgtKilde === 'endeligtEet') {
      eetLinjer.push(endeligtEetLinje);
      viserEndeligtEetLinje = true;
      differencekravLinje = null;
    } else if (valgtKilde === 'differencekrav') {
      // Explicit branch: når differencekrav vælges, vises endelig EET ikke.
      differencekravLinje = differencekravLinjeBase;
    }
  } else if (endeligtEetLinje) {
    eetLinjer.push(endeligtEetLinje);
    viserEndeligtEetLinje = true;
  }

  if (viserEndeligtEetLinje && endeligtEetBringTilOphoer) {
    eetLinjer.push('Afgørelsen bringer retten til tabt arbejdsfortjeneste til ophør.');
  }
  if (differencekravLinje && differencekravBringTilOphoer) {
    differencekravLinje = `${differencekravLinje} Differencekravet bringer retten til tabt arbejdsfortjeneste til ophør.`;
  }

  const erFoersteOpgoerelse = erDetteFoersteErstatningsopgoerelse(values.eoNummer);
  const skalKomprimereIndkomstBeregning =
    !erFoersteOpgoerelse && values.komprimerBeregningEfterFoersteOpgoerelse === 'Ja';

  return {
    statusLinjer,
    eetLinjer,
    differencekravLinje,
    tafPerioderLinjer,
    harTafPerioder,
    tafBeregningsenhed: tafMonetary.tafBeregningsenhed,
    skalKomprimereIndkomstBeregning,
    indkomstSkadestidspunkt: tafMonetary.indkomstSkadestidspunkt,
    loenudvikling: tafMonetary.loenudvikling,
    tafIndtaegter: tafMonetary.tafIndtaegter,
    tidligereModtagetTaf: tafMonetary.tidligereModtagetTaf,
    // Begge felter sættes til netto-værdien. buildErstatningsopgoerelsePdfModelFromComputed
    // applicerer forligskalering på tabtArbejdsfortjenesteOre; FoerForlig bevarer udgangspunktet.
    tabtArbejdsfortjenesteFoerForligOre: tafMonetary.tabtArbejdsfortjenesteOre,
    tabtArbejdsfortjenesteOre: tafMonetary.tabtArbejdsfortjenesteOre,
  };
};

export const buildOevrigeKravModel = (rows: OevrigeKravRow[]): OevrigeKravPdfModel => {
  const parsed = parseOevrigeKravBeloeb(rows);
  if (!parsed) {
    return { entries: [], totalFoerForligOre: ensureMoneyOre(0), totalOre: ensureMoneyOre(0) };
  }

  const entries: Array<{ dateText: string; udgiftTil: string; amountOre: MoneyOre }> = [];
  for (const row of parsed.rows) {
    const dateText = row.original.dato ? formatDateShort(row.original.dato) : '';
    const udgiftTil = (row.original.udgiftTil ?? '').trim();
    if (dateText === '' || udgiftTil === '') continue;
    entries.push({ dateText, udgiftTil, amountOre: row.amountOre });
  }

  return { entries, totalFoerForligOre: parsed.totalOre, totalOre: parsed.totalOre };
};
