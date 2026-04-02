import type { ErstatningsopgoerelseValues, OevrigeKravRow } from '../../../schemas/formSchemas';
import type { ISODateString } from '../../../types/branded';
import { isISODateString, isoToDanish, subtractOneDay } from '../../../types/branded';
import { TAF_MIDLERTIDIG_EET_SKAERINGSDATO } from '../engines/periodiseringsMotor';
import { isoDateToDate } from '../../dates/isoDate';
import { isTafRowEmpty } from '../helpers/rowEmpty';
import type { SvieSmerteEngineOutput } from '../engines/svieSmerteEngine';
import { erDetteFoersteErstatningsopgoerelse } from '../validation/eoNummerValidering';
import { buildTafArbejdsstatusLinje } from '../tables/tafArbejdsstatusConfig';
import type { Calculable, MoneyOre, OevrigeKravModel, SvieSmerteModel, TabtArbejdsfortjenesteModel } from '../shared/eoTypes';
import { clampMoneyOreToZero, ensureMoneyOre } from '../shared/eoMoney';
import { getDayAfterIso, perioderCoverDate } from '../helpers/eoSharedUtils';
import { formatIsoDateShort as formatDateShort, formatIsoDateLong as formatDateLong } from '../../../utils/dateFormatting';
import { parseOevrigeKravBeloeb } from '../helpers/oevrigeKravAmountParser';
import type { TafNettoBeregningResult } from '../engines/tafNettoBeregning';

const asCalculable = <T>(value: T): Calculable<T> => ({ status: 'ok', value });
const notCalculable = <T>(reason: string): Calculable<T> => ({ status: 'not_calculable', reason });
const notCalculableMoney = (reason: string): Calculable<MoneyOre> => notCalculable<MoneyOre>(reason);

export const buildSvieSmerteModel = (
  values: ErstatningsopgoerelseValues,
  options: Readonly<{ engine: SvieSmerteEngineOutput }>
): SvieSmerteModel => {
  const beregnes = values.beregnesSvieSmerteGodtgoerelse === 'Ja' && values.tidligereSsMax === 'Nej';
  const statusLinjer: string[] = [];
  const periodeTilISO = values.vedroererPeriodeTil;

  const engine = options.engine;

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
  options: Readonly<{
    tafNetto: TafNettoBeregningResult;
    tafRanges: readonly { fra: ISODateString; til: ISODateString }[];
    skadesdatoISO?: ISODateString;
  }>
): TabtArbejdsfortjenesteModel => {
  const beregnes = values.beregnesTabtArbejdsfortjeneste === 'Ja';
  if (!beregnes) {
    return {
      beregnes,
      statusLinjer: [],
      eetLinjer: [],
      differencekravLinje: null,
      tafPerioderLinjer: [],
      harTafPerioder: false,
      tafBeregningsenhed: options.tafNetto.tafBeregningsenhed,
      skalKomprimereIndkomstBeregning: false,
      indkomstSkadestidspunkt: null,
      loenudvikling: null,
      tafIndtaegter: null,
      tidligereModtagetTaf: asCalculable(ensureMoneyOre(0)),
      sygeferiegodtgoerelse: { totalOre: ensureMoneyOre(0), perAnsaettelsesforhold: [], perYear: [], firstExcludedDate: null },
      tabtArbejdsfortjenesteFoerForligOre: ensureMoneyOre(0),
      tabtArbejdsfortjenesteOre: ensureMoneyOre(0),
    };
  }

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

  // Afgør om midlertidig EET er aktiv som TAF-afgrænsning (skadesdato < 2011-06-16).
  const midlertidigEetErTafRelevant =
    values.verserendeKlageEet !== 'Ja' &&
    values.midlertidigtEetAfgorelse === 'Ja' &&
    !!options.skadesdatoISO &&
    options.skadesdatoISO < TAF_MIDLERTIDIG_EET_SKAERINGSDATO;

  const harTafDagenFoer = (dato: ISODateString | undefined): boolean => {
    if (!dato) return false;
    const dagenFoer = subtractOneDay(dato);
    return Boolean(dagenFoer && perioderCoverDate(tafRangesAsDates, dagenFoer));
  };

  // Byg de potentielle afgrænsningskilder med beregnede referencedatoer og linjetekster.
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
  }

  let midlertidigEetLinje: string | null = null;
  let midlertidigEetReferenceDato: ISODateString | undefined;
  if (values.midlertidigtEetAfgorelse === 'Ja') {
    if (values.midlertidigEETVirkningsdato) {
      const dato = formatDateLong(values.midlertidigEETVirkningsdato);
      const tekst = `Der er truffet midlertidig erhvervsevnetabsafgørelse med virkning fra ${dato}.`;
      midlertidigEetLinje = values.verserendeKlageEet === 'Ja' ? `${tekst} Afgørelsen er påklaget.` : tekst;
      midlertidigEetReferenceDato = values.midlertidigEETVirkningsdato;
    } else if (values.midlertidigEETAfgoerelseDato) {
      const dato = formatDateLong(values.midlertidigEETAfgoerelseDato);
      const tekst = `Der er den ${dato} truffet midlertidig erhvervsevnetabsafgørelse.`;
      midlertidigEetLinje = values.verserendeKlageEet === 'Ja' ? `${tekst} Afgørelsen er påklaget.` : tekst;
      midlertidigEetReferenceDato = values.midlertidigEETAfgoerelseDato;
    }
  }

  const differencekravLinjeBase = values.differencekravDato
    ? `Der er opgjort differencekrav i sagen den ${formatDateLong(values.differencekravDato)}.`
    : null;
  const differencekravReferenceDato = values.differencekravDato;

  const tafPerioderLinjer = buildTafPerioderLinjer(values, tafRanges);
  const tafMonetary = options.tafNetto;
  const harTafPerioder = tafMonetary.harTafPerioder;

  const endeligtEetBringTilOphoer =
    values.verserendeKlageEet !== 'Ja' && harTafDagenFoer(endeligtEetReferenceDato);
  const midlertidigEetBringTilOphoer =
    midlertidigEetErTafRelevant && harTafDagenFoer(midlertidigEetReferenceDato);
  const differencekravBringTilOphoer = harTafDagenFoer(differencekravReferenceDato);

  // Vælg hvilken afgrænsningskilde der bestemmer ophørsmeddelelsen.
  // EET-afgørelser vises altid informativt, men kun den valgte kilde får den
  // supplerende ophørstekst og kan undertrykke differencekravslinjen.
  // Hvis midlertidig EET er aktiv (skadesdato < 2011-06-16), indgår den på linje med de øvrige.
  type AfgraensningsKilde = 'endeligtEet' | 'midlertidigEet' | 'differencekrav';

  const findTidligsteDato = (
    kilde: AfgraensningsKilde
  ): ISODateString | undefined => {
    if (kilde === 'endeligtEet') return endeligtEetReferenceDato;
    if (kilde === 'midlertidigEet') return midlertidigEetReferenceDato;
    return differencekravReferenceDato;
  };

  const kandidater: AfgraensningsKilde[] = [];
  if (endeligtEetLinje && endeligtEetReferenceDato) kandidater.push('endeligtEet');
  if (midlertidigEetErTafRelevant && midlertidigEetLinje && midlertidigEetReferenceDato) kandidater.push('midlertidigEet');
  if (differencekravLinjeBase && differencekravReferenceDato) kandidater.push('differencekrav');

  // Sortér: kilder der bringer til ophør før dem der ikke gør; dernæst kronologisk på referencedato.
  const bringerTilOphoer = (k: AfgraensningsKilde): boolean => {
    if (k === 'endeligtEet') return endeligtEetBringTilOphoer;
    if (k === 'midlertidigEet') return midlertidigEetBringTilOphoer;
    return differencekravBringTilOphoer;
  };

  kandidater.sort((a, b) => {
    const aOphoer = bringerTilOphoer(a);
    const bOphoer = bringerTilOphoer(b);
    if (aOphoer && !bOphoer) return -1;
    if (!aOphoer && bOphoer) return 1;
    const aDato = findTidligsteDato(a);
    const bDato = findTidligsteDato(b);
    if (!aDato && !bDato) return 0;
    if (!aDato) return 1;
    if (!bDato) return -1;
    // ISODateString er "YYYY-MM-DD" — leksikografisk = kronologisk.
    return aDato < bDato ? -1 : aDato > bDato ? 1 : 0;
  });

  const valgtKilde: AfgraensningsKilde | undefined = kandidater[0];

  let differencekravLinje: string | null = differencekravLinjeBase;

  const appendEetLinje = (
    kilde: Extract<AfgraensningsKilde, 'endeligtEet' | 'midlertidigEet'>,
    linje: string | null
  ): void => {
    if (!linje) return;
    eetLinjer.push(linje);
    if (kilde === 'endeligtEet' && valgtKilde === 'endeligtEet' && endeligtEetBringTilOphoer) {
      eetLinjer.push('Afgørelsen bringer retten til tabt arbejdsfortjeneste til ophør.');
    }
    if (kilde === 'midlertidigEet' && valgtKilde === 'midlertidigEet' && midlertidigEetBringTilOphoer) {
      eetLinjer.push('Da skaden er sket før 16. juni 2011, bringer afgørelsen retten til tabt arbejdsfortjeneste til ophør.');
    }
  };

  appendEetLinje('midlertidigEet', midlertidigEetLinje);
  appendEetLinje('endeligtEet', endeligtEetLinje);

  if (valgtKilde === 'endeligtEet' || valgtKilde === 'midlertidigEet') {
    differencekravLinje = null;
  } else if (valgtKilde === 'differencekrav') {
    if (differencekravBringTilOphoer && differencekravLinje) {
      differencekravLinje = `${differencekravLinje} Differencekravet bringer retten til tabt arbejdsfortjeneste til ophør.`;
    }
  } else if (!endeligtEetLinje && !midlertidigEetLinje && values.opgørelseLavetDen) {
    const dato = formatDateLong(values.opgørelseLavetDen);
    const tekst = `Der er den ${dato} ikke truffet afgørelse om erhvervsevnetab med 15 % eller derover.`;
    eetLinjer.push(values.verserendeKlageEet === 'Ja' ? `${tekst} Afgørelsen er påklaget.` : tekst);
    if (differencekravBringTilOphoer && differencekravLinje) {
      differencekravLinje = `${differencekravLinje} Differencekravet bringer retten til tabt arbejdsfortjeneste til ophør.`;
    }
  } else if (differencekravBringTilOphoer && differencekravLinje) {
    differencekravLinje = `${differencekravLinje} Differencekravet bringer retten til tabt arbejdsfortjeneste til ophør.`;
  }

  const erFoersteOpgoerelse = erDetteFoersteErstatningsopgoerelse(values.eoNummer);
  const skalKomprimereIndkomstBeregning =
    !erFoersteOpgoerelse && values.komprimerBeregningEfterFoersteOpgoerelse === 'Ja';

  return {
    beregnes,
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
    sygeferiegodtgoerelse: tafMonetary.sygeferiegodtgoerelse,
    // Begge felter sættes til netto-værdien. buildErstatningsopgoerelsePdfModelFromComputed
    // applicerer forligskalering på tabtArbejdsfortjenesteOre; FoerForlig bevarer udgangspunktet.
    tabtArbejdsfortjenesteFoerForligOre: tafMonetary.tabtArbejdsfortjenesteOre,
    tabtArbejdsfortjenesteOre: tafMonetary.tabtArbejdsfortjenesteOre,
  };
};

export const buildOevrigeKravModel = (rows: OevrigeKravRow[]): OevrigeKravModel => {
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
