import type { ErstatningsopgoerelseValues } from '../../../schemas/formSchemas';
import type { ISODateString } from '../../../types/branded';
import { isISODateString, isoToDanish } from '../../../types/branded';
import { TAF_MIDLERTIDIG_EET_SKAERINGSDATO } from '../engines/periodiseringsMotor';
import { isoDateToDate } from '../../dates/isoDate';
import { isTafRowEmpty } from '../helpers/rowEmpty';
import type { SvieSmerteEngineOutput } from '../engines/svieSmerteEngine';
import { erDetteFoersteErstatningsopgoerelse } from '../validation/eoNummerValidering';
import { buildTafArbejdsstatusLinje } from '../tables/tafArbejdsstatusConfig';
import type { Calculable, OevrigeKravCanonicalInput, SvieSmerteSectionPresentation, TabtArbejdsfortjenesteSectionPresentation } from '../shared/eoTypes';
import type { MoneyOre } from '../../money/money';
import { moneyOre, zeroMoneyOre } from '../../money/money';
import { asCalculable } from '../shared/eoTypes';
import { getDayAfterIso, perioderCoverDate } from '../helpers/eoSharedUtils';
import { formatISOToDanish as formatDateShort, formatIsoDateLong as formatDateLong } from '../../../utils/dateFormatting';
import { parseOevrigeKravBeloeb } from '../helpers/oevrigeKravAmountParser';
import type { TafNettoBeregningResult } from '../engines/tafNettoBeregning';
import { buildTafFerieFravaerSummary } from '../engines/tafDaySets';
import { formatCountWithUnit } from '../../../utils/formatUtils';
import { TAF_BEREGNES_SOM } from '../helpers/tafBeregningsenhed';
import { getDayBeforeIso } from '../../../utils/isoDateHelpers';
import { roundByMethod } from '../../../utils/rounding';
import { formatDanishList } from '../../../utils/danishListFormatting';

const notCalculable = <T>(reason: string): Calculable<T> => ({ status: 'not_calculable', reason });
const notCalculableMoney = (reason: string): Calculable<MoneyOre> => notCalculable<MoneyOre>(reason);

const buildTafFerieFravaerLinje = (
  values: ErstatningsopgoerelseValues,
  tafRanges: readonly { fra: ISODateString; til: ISODateString }[]
): string | null => {
  const summary = buildTafFerieFravaerSummary(values.tafPerioder ?? [], values.ferieperioder ?? [], tafRanges);
  if (summary.totalFeriedage <= 0) return null;

  const periodTexts = summary.ferieperioder.map((range) => `${formatDateShort(range.fra)} - ${formatDateShort(range.til)}`);
  const periodPart = periodTexts.length === 0
    ? null
    : `ferie i ${periodTexts.length === 1 ? 'perioden' : 'perioderne'} ${formatDanishList(periodTexts)}`;
  const loosePart = summary.loseFeriedage > 0
    ? `${formatCountWithUnit(summary.loseFeriedage, 'løs ferie-/feriefridag', 'løse ferie-/feriefridage')}`
    : null;

  if (periodPart && loosePart) {
    return `I perioden blev der afholdt ${periodPart} samt ${loosePart}.`;
  }
  if (periodPart) {
    return `I perioden blev der afholdt ${periodPart}.`;
  }
  if (loosePart) {
    return `I perioden blev der afholdt ${loosePart}.`;
  }
  return null;
};

export const buildSvieSmerteModel = (
  values: ErstatningsopgoerelseValues,
  options: Readonly<{ engine: SvieSmerteEngineOutput }>
): SvieSmerteSectionPresentation => {
  const beregnes = values.kravPaaSvieSmerteGodtgoerelse === 'Ja' && values.tidligereSsMax === 'Nej';
  const skjul = values.kravPaaSvieSmerteGodtgoerelse === 'Skjul';
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
    const ophoerDato = getDayBeforeIso(menDato);
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

  // Delvis-dagssatsen = per-dag-satsen (i øre) × delvisFaktor, afrundet til hel øre.
  // Beregnes her i præsentationslaget (ikke i PDF-/UI-rendereren), så den viste
  // delvis-dagssats er konsistent på tværs af kanaler og med totalberegningen.
  const roundDelvisSatsOre = (perDagOre: number): MoneyOre =>
    moneyOre(roundByMethod(perDagOre * engine.delvisFaktor, 0, 'halfAwayFromZero'));

  const satserPerDag: Calculable<MoneyOre> = engine.satserPerDagOre === null
    ? notCalculableMoney('Satser kan ikke beregnes')
    : asCalculable(engine.satserPerDagOre);
  const delvisSatsPerDag: Calculable<MoneyOre> = engine.satserPerDagOre === null
    ? notCalculableMoney('Satser kan ikke beregnes')
    : asCalculable(roundDelvisSatsOre(engine.satserPerDagOre));
  const satserMax: Calculable<MoneyOre> = engine.satserMaxOre === null
    ? notCalculableMoney('Satser kan ikke beregnes')
    : asCalculable(engine.satserMaxOre);
  const satserPerDagFoerForlig: Calculable<MoneyOre> = engine.satserPerDagFoerForligOre === null
    ? notCalculableMoney('Satser kan ikke beregnes')
    : asCalculable(engine.satserPerDagFoerForligOre);
  const delvisSatsPerDagFoerForlig: Calculable<MoneyOre> = engine.satserPerDagFoerForligOre === null
    ? notCalculableMoney('Satser kan ikke beregnes')
    : asCalculable(roundDelvisSatsOre(engine.satserPerDagFoerForligOre));
  const satserMaxFoerForlig: Calculable<MoneyOre> = engine.satserMaxFoerForligOre === null
    ? notCalculableMoney('Satser kan ikke beregnes')
    : asCalculable(engine.satserMaxFoerForligOre);
  const tidligere: Calculable<MoneyOre> = engine.tidligereOre === null
    ? notCalculableMoney('Ikke angivet')
    : asCalculable(engine.tidligereOre);
  const aktuel: Calculable<MoneyOre> = engine.aktuelOre === null
    ? notCalculableMoney('Ikke angivet')
    : asCalculable(engine.aktuelOre);

  const periodeHeading =
    engine.constrainedPeriods.length > 1
      ? 'Sygeperioder med svie- og smertegodtgørelse'
      : 'Sygeperiode med svie- og smertegodtgørelse';

  return {
    beregnes,
    skjul,
    statusLinjer,
    opgjortFremTilPeriodeTil,
    periodeHeading,
    periodeLinjer,
    harPerioder: engine.harPerioder,
    satserAar: engine.satserAar,
    satserPerDag,
    delvisSatsPerDag,
    satserMax,
    forligLabel: engine.forligLabel,
    forligSatserSuffix: engine.forligSatserSuffix,
    forligFactor: engine.forligFactor,
    satserPerDagFoerForlig,
    delvisSatsPerDagFoerForlig,
    satserMaxFoerForlig,
    tidligere,
    aktuel,
    sygedage: engine.sygedage,
    delviseSygedage: engine.delviseSygedage,
    delvisFaktor: engine.delvisFaktor,
    maxApplied: engine.maxApplied,
    // totalOre bæres bevidst IKKE her: canonical (`buildEoComputedTotals`) udleder svie/smerte-totalen
    // fra engine-outputtet, og PDF-modellen injicerer den derfra (B8-grænsen, eo-snapshot-contract.md §1).
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
    skadedatoISO?: ISODateString;
  }>
): TabtArbejdsfortjenesteSectionPresentation => {
  const beregnes = values.kravPaaTabtArbejdsfortjeneste === 'Ja';
  const skjul = values.kravPaaTabtArbejdsfortjeneste === 'Skjul';
  if (!beregnes) {
    return {
      beregnes,
      skjul,
      statusLinjer: [],
      eetLinjer: [],
      differencekravLinje: null,
      ferieFravaerLinje: null,
      tafPerioderLinjer: [],
      harTafPerioder: false,
      tafBeregningsenhed: options.tafNetto.tafBeregningsenhed,
      skalKomprimereIndkomstBeregning: false,
      indkomstSkadestidspunkt: null,
      loenudvikling: null,
      offentligeYdelserUdvikling: null,
      tafIndtaegter: null,
      tidligereModtagetTaf: asCalculable(zeroMoneyOre()),
      sygeferiegodtgoerelse: { totalOre: zeroMoneyOre(), perAnsaettelsesforhold: [], perYear: [], firstExcludedDate: null },
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

  // Afgør om midlertidig EET er aktiv som TAF-afgrænsning (skadedato < 2011-06-16).
  const midlertidigEetErTafRelevant =
    values.verserendeKlageEet !== 'Ja' &&
    values.midlertidigtEETAfgorelse === 'Ja' &&
    !!options.skadedatoISO &&
    options.skadedatoISO < TAF_MIDLERTIDIG_EET_SKAERINGSDATO;

  const harTafDagenFoer = (dato: ISODateString | undefined): boolean => {
    if (!dato) return false;
    const dagenFoer = getDayBeforeIso(dato);
    return Boolean(dagenFoer && perioderCoverDate(tafRangesAsDates, dagenFoer));
  };

  // Byg de potentielle afgrænsningskilder med beregnede referencedatoer og linjetekster.
  let endeligtEetLinje: string | null = null;
  let endeligtEetReferenceDato: ISODateString | undefined;
  if (values.endeligtEETAfgorelse === 'Ja') {
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
    } else {
      // Uden dato kan afgørelsen ikke afgrænse TAF (ingen referencedato), men den ER truffet
      // og skal derfor stadig oplyses — ellers påstår dokumentet det modsatte.
      const tekst = 'Der er truffet endelig afgørelse om erhvervsevnetab med 15 % eller derover.';
      endeligtEetLinje = values.verserendeKlageEet === 'Ja' ? `${tekst} Afgørelsen er påklaget.` : tekst;
    }
  }

  let midlertidigEetLinje: string | null = null;
  let midlertidigEetReferenceDato: ISODateString | undefined;
  if (values.midlertidigtEETAfgorelse === 'Ja') {
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
    } else {
      // Se kommentaren i den endelige blok ovenfor: datoløs afgørelse oplyses uden referencedato.
      const tekst = 'Der er truffet midlertidig afgørelse om erhvervsevnetab med 15 % eller derover.';
      midlertidigEetLinje = values.verserendeKlageEet === 'Ja' ? `${tekst} Afgørelsen er påklaget.` : tekst;
    }
  }

  const differencekravLinjeBase = values.differencekravDato
    ? `Der er opgjort differencekrav i sagen den ${formatDateLong(values.differencekravDato)}.`
    : null;
  const differencekravReferenceDato = values.differencekravDato;

  const tafMonetary = options.tafNetto;
  const tafPerioderLinjer = buildTafPerioderLinjer(values, tafRanges);
  const ferieFravaerLinje = tafMonetary.tafBeregningsenhed === TAF_BEREGNES_SOM.ARBEJDSDAGE
    ? buildTafFerieFravaerLinje(values, tafRanges)
    : null;
  const harTafPerioder = tafMonetary.harTafPerioder;

  const endeligtEetBringTilOphoer =
    values.verserendeKlageEet !== 'Ja' && harTafDagenFoer(endeligtEetReferenceDato);
  const midlertidigEetBringTilOphoer =
    midlertidigEetErTafRelevant && harTafDagenFoer(midlertidigEetReferenceDato);
  const differencekravBringTilOphoer = harTafDagenFoer(differencekravReferenceDato);

  type AfgraensningsKilde = 'endeligtEet' | 'midlertidigEet' | 'differencekrav';
  const OPHOERSGRUND_PRIORITY: Record<AfgraensningsKilde, number> = {
    differencekrav: 0,
    endeligtEet: 1,
    midlertidigEet: 2,
  };

  type OphoersgrundKandidat = Readonly<{
    kilde: AfgraensningsKilde;
    referenceDato: ISODateString;
  }>;

  const ophoersgrundKandidater: OphoersgrundKandidat[] = [];
  if (differencekravBringTilOphoer && differencekravReferenceDato) {
    ophoersgrundKandidater.push({ kilde: 'differencekrav', referenceDato: differencekravReferenceDato });
  }
  if (endeligtEetBringTilOphoer && endeligtEetReferenceDato) {
    ophoersgrundKandidater.push({ kilde: 'endeligtEet', referenceDato: endeligtEetReferenceDato });
  }
  if (midlertidigEetBringTilOphoer && midlertidigEetReferenceDato) {
    ophoersgrundKandidater.push({ kilde: 'midlertidigEet', referenceDato: midlertidigEetReferenceDato });
  }

  ophoersgrundKandidater.sort((a, b) => {
    if (a.referenceDato < b.referenceDato) return -1;
    if (a.referenceDato > b.referenceDato) return 1;
    return OPHOERSGRUND_PRIORITY[a.kilde] - OPHOERSGRUND_PRIORITY[b.kilde];
  });

  const valgtOphoersgrund = ophoersgrundKandidater[0]?.kilde;

  let differencekravLinje: string | null = null;

  const appendEetLinje = (
    kilde: Extract<AfgraensningsKilde, 'endeligtEet' | 'midlertidigEet'>,
    linje: string | null
  ): void => {
    if (!linje) return;
    eetLinjer.push(linje);
    if (kilde === 'endeligtEet' && valgtOphoersgrund === 'endeligtEet' && endeligtEetBringTilOphoer) {
      eetLinjer.push('Afgørelsen bringer retten til tabt arbejdsfortjeneste til ophør.');
    }
    if (kilde === 'midlertidigEet' && valgtOphoersgrund === 'midlertidigEet' && midlertidigEetBringTilOphoer) {
      eetLinjer.push('Da skaden er sket før 16. juni 2011, bringer afgørelsen retten til tabt arbejdsfortjeneste til ophør.');
    }
  };

  if (valgtOphoersgrund === 'differencekrav' && differencekravLinjeBase) {
    differencekravLinje = `${differencekravLinjeBase} Differencekravet bringer retten til tabt arbejdsfortjeneste til ophør.`;
  } else if (valgtOphoersgrund === 'endeligtEet') {
    appendEetLinje('endeligtEet', endeligtEetLinje);
  } else if (valgtOphoersgrund === 'midlertidigEet') {
    appendEetLinje('midlertidigEet', midlertidigEetLinje);
  }

  const harMidlertidigEetAfgorelse = midlertidigEetLinje !== null;
  const harEndeligtEetAfgorelse = endeligtEetLinje !== null;
  const skalViseInformativEetLinje =
    (harMidlertidigEetAfgorelse || harEndeligtEetAfgorelse)
    && valgtOphoersgrund !== 'endeligtEet'
    && valgtOphoersgrund !== 'midlertidigEet';

  if (skalViseInformativEetLinje) {
    eetLinjer.push(endeligtEetLinje ?? midlertidigEetLinje ?? '');
  } else if (!harEndeligtEetAfgorelse && !harMidlertidigEetAfgorelse && values.opgørelseLavetDen) {
    const dato = formatDateLong(values.opgørelseLavetDen);
    const tekst = `Der er den ${dato} ikke truffet afgørelse om erhvervsevnetab med 15 % eller derover.`;
    eetLinjer.push(values.verserendeKlageEet === 'Ja' ? `${tekst} Afgørelsen er påklaget.` : tekst);
  }

  const erFoersteOpgoerelse = erDetteFoersteErstatningsopgoerelse(values.eoNummer);
  const skalKomprimereIndkomstBeregning =
    !erFoersteOpgoerelse && values.komprimerBeregningEfterFoersteOpgoerelse === 'Ja';

  return {
    beregnes,
    skjul,
    statusLinjer,
    eetLinjer,
    differencekravLinje,
    ferieFravaerLinje,
    tafPerioderLinjer,
    harTafPerioder,
    tafBeregningsenhed: tafMonetary.tafBeregningsenhed,
    skalKomprimereIndkomstBeregning,
    indkomstSkadestidspunkt: tafMonetary.indkomstSkadestidspunkt,
    loenudvikling: tafMonetary.loenudvikling,
    offentligeYdelserUdvikling: tafMonetary.offentligeYdelserUdvikling,
    tafIndtaegter: tafMonetary.tafIndtaegter,
    tidligereModtagetTaf: tafMonetary.tidligereModtagetTaf,
    sygeferiegodtgoerelse: tafMonetary.sygeferiegodtgoerelse,
    // TAF-totalerne (FoerForlig + post-forlig) ejes udelukkende af canonical (buildEoComputedTotals)
    // og injiceres i PDF-modellen af buildErstatningsopgoerelsePdfModelFromComputed. Section-byggeren
    // bærer dem derfor IKKE — returtypen er TabtArbejdsfortjenesteSectionPresentation (Omit), så et
    // section-afledt total ikke kan lække til output (B8, jf. eo-snapshot-contract.md §1).
  };
};

export const buildOevrigeKravModel = (
  values: Pick<ErstatningsopgoerelseValues, 'kravPaaOevrigeErstatningskrav' | 'oevrigeKravPerioder'>
): OevrigeKravCanonicalInput => {
  const beregnes = values.kravPaaOevrigeErstatningskrav === 'Ja';
  const skjul = values.kravPaaOevrigeErstatningskrav === 'Skjul';
  if (!beregnes) {
    return { beregnes, skjul, entries: [], totalFoerForligOre: zeroMoneyOre() };
  }

  const parsed = parseOevrigeKravBeloeb(values.oevrigeKravPerioder ?? []);
  if (!parsed) {
    return { beregnes, skjul, entries: [], totalFoerForligOre: zeroMoneyOre() };
  }

  const entries: Array<{ dateText: string; udgiftTil: string; amountOre: MoneyOre }> = [];
  for (const row of parsed.rows) {
    const dateText = row.original.dato ? formatDateShort(row.original.dato) : '';
    const udgiftTil = (row.original.udgiftTil ?? '').trim();
    if (dateText === '' || udgiftTil === '') continue;
    entries.push({ dateText, udgiftTil, amountOre: row.amountOre });
  }

  // Kun pre-forlig-totalen bæres som canonical-input; post-forlig-totalen re-deriveres af canonical.
  return { beregnes, skjul, entries, totalFoerForligOre: parsed.totalOre };
};
