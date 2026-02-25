import type { ErstatningsopgoerelseValues, OevrigeKravRow, StamdataValues } from '../../schemas/formSchemas';
import type { ISODateString } from '../../types/branded';
import { isISODateString, isoToDanish, subtractOneDay } from '../../types/branded';
import { amountValueToNumber } from '../../utils/expressionAmount';
import { buildTafRanges, buildIncomeForRanges, type IsoRange } from './indtaegtPerioder';
import { computeTafBeregningsenhed } from './tafBeregningsenhed';
import { isoDateToDate } from '../dates/isoDate';
import { isOevrigeKravRowEmpty, isTafRowEmpty } from './rowEmpty';
import { computeSvieSmerteEngine, getDayAfterIso } from './svieSmerteEngine';
import { erDetteFoersteErstatningsopgoerelse } from './eoNummerValidering';
import { buildTafArbejdsstatusLinje } from './tafArbejdsstatusConfig';
import { buildIndkomstSkadestidspunkt } from './eoPdfIndkomstSkadestidspunkt';
import { buildLoenudviklingModelV3 } from './eoPdfLoenudvikling';
import type { Calculable, MoneyOre, OevrigeKravPdfModel, SvieSmertePdfModel, TabtArbejdsfortjenestePdfModel, TafIndtaegterPdfModel } from './eoPdfModelTypes';
import { clampMoneyOreToZero, ensureMoneyOre, roundKroner, toOre } from './eoPdfMoneyUtils';
import { formatDateShort, formatDateLong } from './sharedPdfUtils';

const asCalculable = <T>(value: T): Calculable<T> => ({ status: 'ok', value });
const notCalculable = <T>(reason: string): Calculable<T> => ({ status: 'not_calculable', reason });
const notCalculableMoney = (reason: string): Calculable<MoneyOre> => notCalculable<MoneyOre>(reason);

export const buildSvieSmerteModel = (
  values: ErstatningsopgoerelseValues,
  stamdataValues: StamdataValues
): SvieSmertePdfModel => {
  const beregnes = values.beregnesSvieSmerteGodtgoerelse === 'Ja';
  const statusLinjer: string[] = [];
  const periodeTilISO = values.vedroererPeriodeTil;

  const engine = computeSvieSmerteEngine({
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

  if (varigeMenAfgorelse === 'Ja' && verserendeKlageMen !== 'Ja' && menDato && isISODateString(menDato)) {
    const ophoerDato = subtractOneDay(menDato);
    if (ophoerDato && perioderCoverDate(constrained, ophoerDato)) {
      statusLinjer.push('Afgørelsen bringer retten til svie- og smertegodtgørelse til ophør.');
    }
  }

  const periodeLinjer = engine.constrainedPeriods.map((p) => {
    const fraDisplay = isoToDanish(p.fra);
    const tilDisplay = isoToDanish(p.til);
    if (!fraDisplay || !tilDisplay) throw new Error('Ugyldig periode for svie/smerte');
    const suffix = p.isDelvist ? ' (delvist syg)' : '';
    if (fraDisplay === tilDisplay) return `${fraDisplay}${suffix}`;
    return `${fraDisplay} - ${tilDisplay}${suffix}`;
  });

  const satserPerDag: Calculable<MoneyOre> = engine.satserPerDagOre === null
    ? notCalculableMoney('Satser kan ikke beregnes')
    : asCalculable(ensureMoneyOre(engine.satserPerDagOre));
  const satserMax: Calculable<MoneyOre> = engine.satserMaxOre === null
    ? notCalculableMoney('Satser kan ikke beregnes')
    : asCalculable(ensureMoneyOre(engine.satserMaxOre));
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

const buildTafPerioderLinjer = (values: ErstatningsopgoerelseValues): string[] => {
  const rows = values.tafPerioder ?? [];
  const nonEmpty = rows.filter((row) => !isTafRowEmpty(row));
  if (nonEmpty.length === 0) return [];

  for (const row of nonEmpty) {
    const fra = row.fra;
    const til = row.til;
    if (!fra || !til) {
      throw new Error('TAF-periode mangler fra/til'); // invariant: dækket af validator
    }
    if (!isISODateString(fra) || !isISODateString(til) || fra > til) {
      throw new Error('TAF-periode er ugyldig'); // invariant: dækket af validator
    }
  }

  const ranges = buildTafRanges(values);
  const lines: string[] = [];
  for (const range of ranges) {
    const fraText = formatDateShort(range.fra);
    const tilText = formatDateShort(range.til);
    if (!fraText || !tilText) {
      throw new Error('TAF-periode er ugyldig'); // invariant: dækket af validator
    }
    lines.push(`${fraText} - ${tilText}`);
  }
  return lines;
};
const buildTafIndtaegterModel = (values: ErstatningsopgoerelseValues, ranges: readonly IsoRange[]): TafIndtaegterPdfModel => {
  const indtaegter = buildIncomeForRanges(values, ranges);
  const employerEntries: Array<{ label: string; amountOre: MoneyOre }> = [];
  indtaegter.employers.forEach((entry) => {
    const label = entry.name !== '' ? entry.name : 'Arbejdssted';
    employerEntries.push({ label, amountOre: toOre(roundKroner(entry.amount)) });
  });
  const benefitEntries = indtaegter.benefits
    .map((entry) => ({ label: entry.label, amountOre: toOre(roundKroner(entry.amount)) }))
    // Stabil, brugervendt rækkefølge i PDF-output uafhængigt af input-rækkefølge.
    .sort((a, b) => a.label.localeCompare(b.label, 'da-DK', { sensitivity: 'base' }));
  const entries = [...employerEntries, ...benefitEntries];
  const oevrigeKravForbeholdYdelsestyper = Array.from(
    new Set(
      indtaegter.benefits
        .map((entry) => entry.typeKey)
        .filter((typeKey) => typeKey === 'kontanthjaelp' || typeKey === 'ressourceforloebsydelse')
    )
  );

  // Ingen indtægter i TAF-perioden er gyldigt og opgøres som 0 kr.
  const totalOre = clampMoneyOreToZero(ensureMoneyOre(entries.reduce((acc, entry) => acc + entry.amountOre, 0)));
  return {
    entries,
    oevrigeKravForbeholdYdelsestyper,
    total: asCalculable(totalOre),
  };
};
export const buildTabtArbejdsfortjenesteModel = (
  values: ErstatningsopgoerelseValues,
  stamdataValues: StamdataValues
): TabtArbejdsfortjenestePdfModel => {
  const statusLinjer: string[] = [];
  const periodeTilISO = values.vedroererPeriodeTil;
  const tafRanges = buildTafRanges(values);
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

  const tafPerioderLinjer = buildTafPerioderLinjer(values);
  const harTafPerioder = tafPerioderLinjer.length > 0;
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

  const tafBeregningsenhed = computeTafBeregningsenhed(values);

  const erFoersteOpgoerelse = erDetteFoersteErstatningsopgoerelse(values.eoNummer);
  const skalKomprimereIndkomstBeregning =
    !erFoersteOpgoerelse && values.komprimerBeregningEfterFoersteOpgoerelse === 'Ja';

  const indkomstSkadestidspunkt = harTafPerioder
    ? buildIndkomstSkadestidspunkt(values, stamdataValues, tafBeregningsenhed)
    : null;
  const loenudvikling = harTafPerioder
    ? buildLoenudviklingModelV3(values, stamdataValues, tafBeregningsenhed, indkomstSkadestidspunkt)
    : null;

  const tafIndtaegter = harTafPerioder ? buildTafIndtaegterModel(values, tafRanges) : null;
  const tidligereModtagetTafKroner = amountValueToNumber(values.tidligereModtagetTaf);
  const tidligereModtagetTaf =
    tidligereModtagetTafKroner !== undefined
      ? asCalculable(toOre(tidligereModtagetTafKroner))
      : notCalculableMoney('Ikke angivet');

  let tabtArbejdsfortjenesteOre = ensureMoneyOre(0);
  if (harTafPerioder) {
    if (!loenudvikling) {
      throw new Error('Lønudvikling kunne ikke beregnes');
    }
    if (!tafIndtaegter) {
      throw new Error('Indtægter i TAF-perioden kunne ikke beregnes');
    }
    if (loenudvikling.loenudviklingTotal.status !== 'ok') {
      throw new Error('Loenudvikling kan ikke beregnes');
    }
    if (tafIndtaegter.total.status !== 'ok') {
      throw new Error('Indtaegter i TAF-perioden kan ikke beregnes');
    }
    const tidligereModtagetTafOre = tidligereModtagetTaf.status === 'ok' ? tidligereModtagetTaf.value : ensureMoneyOre(0);
    tabtArbejdsfortjenesteOre = clampMoneyOreToZero(
      ensureMoneyOre(loenudvikling.loenudviklingTotal.value - tafIndtaegter.total.value - tidligereModtagetTafOre)
    );
  }

  return {
    statusLinjer,
    eetLinjer,
    differencekravLinje,
    tafPerioderLinjer,
    harTafPerioder,
    tafBeregningsenhed,
    skalKomprimereIndkomstBeregning,
    indkomstSkadestidspunkt,
    loenudvikling,
    tafIndtaegter,
    tidligereModtagetTaf,
    tabtArbejdsfortjenesteOre,
  };
};

export const buildOevrigeKravModel = (rows: OevrigeKravRow[]): OevrigeKravPdfModel => {
  const entries: Array<{ dateText: string; udgiftTil: string; amountOre: MoneyOre }> = [];
  for (const row of rows) {
    if (isOevrigeKravRowEmpty(row)) continue;
    const dateText = row.dato ? formatDateShort(row.dato) : '';
    const udgiftTil = (row.udgiftTil ?? '').trim();
    const amountValue = amountValueToNumber(row.beloeb);
    if (dateText === '' || udgiftTil === '' || amountValue === undefined) {
      throw new Error('Øvrige krav er ikke fuldt udfyldt'); // invariant: dækket af validator
    }
    if (amountValue < 0) {
      throw new Error('Øvrige krav kan ikke være negativt'); // invariant: dækket af validator
    }
    const amountOre = toOre(amountValue);
    entries.push({ dateText, udgiftTil, amountOre });
  }

  const totalOre = clampMoneyOreToZero(ensureMoneyOre(entries.reduce((acc, entry) => acc + entry.amountOre, 0)));
  return { entries, totalOre };
};

