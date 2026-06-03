import {
  resolveEgetAtpBidragPrKalenderuge,
  resolveKommunaltAtpBidragPrKalenderuge,
  resolveObligatoriskPensionProcent,
  sygedagpengeRates,
  SYGEDAGPENGE_INSERT_MAX_DATE,
  SYGEDAGPENGE_INSERT_MIN_DATE,
  SYGEDAGPENGE_OP_MAX_DATE,
  SYGEDAGPENGE_OP_MIN_DATE,
  type DatedSygedagpengeRate,
} from '../../../data/sygedagpengeRates';
import type { OffentligeYdelserRow } from '../../../schemas/formSchemas';
import { roundByMethod } from '../../../utils/rounding';
import { parseAmountInput } from '../../../utils/expressionAmount';
import { formatISOToDanish } from '../../../utils/dateFormatting';
import { maxISO, minISO } from '../../../utils/isoDateHelpers';
import {
  buildSygedagpengeArbejdsdagePrKalenderuge, countOffentligYdelsePeriodiseringsdage, } from '../engines/periodiseringsMotor';
import type { ISODateString } from '../../../types/branded';
import { generateOffentligYdelseRowId } from './eoRowInitialValues';

type SygedagpengeSegment = Readonly<{
  fraDato: ISODateString;
  tilDato: ISODateString;
  rate: DatedSygedagpengeRate;
  arbejdsdage: number;
}>;

const toExpressionAmount = (expression: string) => {
  const parsed = parseAmountInput(expression, {
    precision: 2,
    allowNegative: false,
    allowDecimals: false,
  });
  if (!parsed.ok || !parsed.value) {
    throw new Error(`CRITICAL: Kunne ikke parse sygedagpenge-udtryk "${expression}"`);
  }
  return parsed.value;
};

const buildSegmentExpression = (arbejdsdage: number, satsPrDag: number): string => {
  return `${arbejdsdage}*${satsPrDag}`;
};

/**
 * Komprimerer konsekutive identiske uge-led til `antal*(led)`.
 *
 * Fulde uger i et satssegment giver identiske led (samme afrundede ATP og OP),
 * mens delvise uger i enderne (eller uger med SH-dage) har egne beløb og bevares
 * for sig. Run-length-kodning over uge-rækkefølgen holder derfor det naturlige
 * tidsforløb og afrundingen pr. uge intakt:
 *   - led der optræder én gang skrives uændret (fx `21*2+35`),
 *   - led der gentages skrives som `antal*(led)` når det indeholder `+` (fx `26*(48*2+54)`),
 *     ellers som `antal*led` (fx `26*48*2`) da multiplikation er associativ.
 */
const compressUgeBidrag = (ugeLed: readonly string[]): string => {
  const grupper: string[] = [];
  let i = 0;
  while (i < ugeLed.length) {
    const led = ugeLed[i]!;
    let antal = 1;
    while (i + antal < ugeLed.length && ugeLed[i + antal] === led) {
      antal += 1;
    }
    if (antal === 1) {
      grupper.push(led);
    } else if (led.includes('+')) {
      grupper.push(`${antal}*(${led})`);
    } else {
      grupper.push(`${antal}*${led}`);
    }
    i += antal;
  }
  return grupper.join('+');
};

const buildTillaegExpression = (segment: SygedagpengeSegment): string => {
  const egetAtpPrKalenderuge = resolveEgetAtpBidragPrKalenderuge(segment.rate);
  const kommunaltFaktor = resolveKommunaltAtpBidragPrKalenderuge(segment.rate) / egetAtpPrKalenderuge;
  const opProcent = resolveObligatoriskPensionProcent(segment.rate);
  const ugeBidrag = buildSygedagpengeArbejdsdagePrKalenderuge(segment.fraDato, segment.tilDato).map((uge) => {
    const egetBidrag = roundByMethod((uge.arbejdsdage * egetAtpPrKalenderuge) / 5, 0, 'halfAwayFromZero');
    // Det kommunale ATP-bidrag er altid eget bidrag gange forholdet kommunalt/eget (= 2).
    const kommunaltAtpLed = `${egetBidrag}*${kommunaltFaktor}`;

    if (opProcent <= 0) {
      return kommunaltAtpLed;
    }

    // Obligatorisk pension (§ 67 stk. 2): procentsats på grundlag af sygedagpengene
    // efter fradrag for dagpengemodtagerens eget ATP-bidrag, afrundet til hele kroner pr. uge.
    const ugeSygedagpenge = uge.arbejdsdage * segment.rate.sygedagpengePrDagMax;
    const opGrundlag = ugeSygedagpenge - egetBidrag;
    const opBidrag = roundByMethod((opProcent / 100) * opGrundlag, 0, 'halfAwayFromZero');

    return `${kommunaltAtpLed}+${opBidrag}`;
  });

  if (ugeBidrag.length === 0) {
    throw new Error('CRITICAL: Sygedagpenge-segment med arbejdsdage gav intet tillæg pr. kalenderuge');
  }

  return compressUgeBidrag(ugeBidrag);
};

export const splitSygedagpengeRateSegments = (
  fraDato: ISODateString,
  tilDato: ISODateString
): readonly SygedagpengeSegment[] => {
  const segments: SygedagpengeSegment[] = [];

  for (const rate of sygedagpengeRates) {
    if (rate.tilDato < fraDato || rate.fraDato > tilDato) continue;

    const segmentFra = maxISO(fraDato, rate.fraDato);
    const segmentTil = minISO(tilDato, rate.tilDato);
    const arbejdsdage = countOffentligYdelsePeriodiseringsdage({
      fra: segmentFra,
      til: segmentTil,
      periodisering: 'arbejdsdage',
      ydelsestypeKey: 'sygedagpenge',
    });
    if (!arbejdsdage || arbejdsdage <= 0) continue;

    segments.push({
      fraDato: segmentFra,
      tilDato: segmentTil,
      rate,
      arbejdsdage,
    });
  }

  return segments;
};

/**
 * Fejl der signalerer at brugerens periode ikke er fuldt dækket af definerede satser.
 *
 * Adskilt fra almindelige `Error`, så UI kan vise den brugervendte besked direkte
 * (manglende satsdækning er en forventet brugerfejl, ikke en intern beregningsfejl).
 */
export class SygedagpengeCoverageError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'SygedagpengeCoverageError';
  }
}

/**
 * Bekræfter at HELE [fraDato, tilDato] er dækket af definerede satser, og kaster en
 * `SygedagpengeCoverageError` med klar brugerbesked hvis bare én dag mangler dækning.
 *
 * Dækningskravet er eksplicit todelt (jf. beslutning: kræv både sats OG OP):
 * - Sygedagpengesats + ATP: hele perioden skal ligge i [INSERT_MIN, INSERT_MAX].
 * - Obligatorisk pension: den del af perioden der ligger fra og med OP-ordningens
 *   ikrafttræden (6. januar 2020) skal ligge inden for OP-satsernes dækning.
 *   Perioden før da kræver ingen OP-dækning (ordningen fandtes ikke; OP = 0).
 *
 * Begge tabeller er pr. konstruktion kontinuerte (ingen interne huller), hvilket
 * `sygedagpengeInsertRows.test.ts` håndhæver, så dækning kan afgøres ud fra grænserne.
 */
export const assertSygedagpengeRangeFullyCovered = (
  fraDato: ISODateString,
  tilDato: ISODateString
): void => {
  if (fraDato < SYGEDAGPENGE_INSERT_MIN_DATE || tilDato > SYGEDAGPENGE_INSERT_MAX_DATE) {
    throw new SygedagpengeCoverageError(
      `Der er kun fastsat sygedagpengesatser for perioden ${formatISOToDanish(SYGEDAGPENGE_INSERT_MIN_DATE)} ` +
        `til ${formatISOToDanish(SYGEDAGPENGE_INSERT_MAX_DATE)}. ` +
        `Den valgte periode (${formatISOToDanish(fraDato)} til ${formatISOToDanish(tilDato)}) ` +
        'rækker uden for dette interval. Opdatér sygedagpengesatserne i koden, eller vælg en kortere periode.'
    );
  }

  // OP kræves kun for den del af perioden der ligger fra og med ordningens ikrafttræden.
  const opRelevantTil = tilDato;
  if (opRelevantTil >= SYGEDAGPENGE_OP_MIN_DATE) {
    const opRelevantFra = maxISO(fraDato, SYGEDAGPENGE_OP_MIN_DATE);
    if (opRelevantFra > SYGEDAGPENGE_OP_MAX_DATE || opRelevantTil > SYGEDAGPENGE_OP_MAX_DATE) {
      throw new SygedagpengeCoverageError(
        `Der er kun fastsat satser for obligatorisk pension til og med ${formatISOToDanish(SYGEDAGPENGE_OP_MAX_DATE)}. ` +
          `Den valgte periode rækker frem til ${formatISOToDanish(tilDato)}. ` +
          'Opdatér OP-satserne i koden, eller vælg en kortere periode.'
      );
    }
  }
};

export const buildSygedagpengeRowsForRange = (
  fraDato: ISODateString,
  tilDato: ISODateString
): readonly OffentligeYdelserRow[] => {
  assertSygedagpengeRangeFullyCovered(fraDato, tilDato);

  const segments = splitSygedagpengeRateSegments(fraDato, tilDato);

  return segments.map((segment) => {
    const tillaegExpression = buildTillaegExpression(segment);

    return {
      id: generateOffentligYdelseRowId(),
      fraDato: segment.fraDato,
      tilDato: segment.tilDato,
      ydelse: toExpressionAmount(buildSegmentExpression(segment.arbejdsdage, segment.rate.sygedagpengePrDagMax)),
      tillaeg: toExpressionAmount(tillaegExpression),
      ydelsestype: 'sygedagpenge',
    };
  });
};

/**
 * Sygedagpenge-rækker genereres som almindelige persisted brugerinputrækker:
 * - Hver overlapperiode splittes eksplicit i samme sats-intervaller som rate-tabellen.
 * - Beløbene gemmes som udtryk (`arbejdsdage*sats`) frem for præudregnede tal,
 *   så tabellen viser og persisterer dem på samme måde som manuel brugerindtastning.
 *
 * Vigtigt om dagtælling:
 * - Fra og med 2. juli 2012 medregnes SH-dage ikke længere for sygedagpenge.
 * - Til og med 1. juli 2012 medregnes SH-dage fortsat.
 * - Særreglen håndhæves centralt af `countOffentligYdelsePeriodiseringsdage(...)`
 *   og `buildSygedagpengeArbejdsdagePrKalenderuge`, så ydelse og ATP-tillæg altid
 *   anvender samme cutoff-regel på de samme datoer.
 *
 * Vigtigt om feriedage:
 * - Disse indsatte sygedagpenge-rækker følger samme regel som øvrige sygedagpenge-rækker i EO:
 *   de periodiseres på sygedagpenge-dage og fratrækker derfor ikke daterede feriedage.
 * - Det er bevidst og bryder den almindelige TAF-/løn-norm, hvor arbejdsdage typisk reduceres
 *   med daterede feriedage.
 *
 * Vigtigt om ATP:
 * - Tillægget indeholder det kommunale ATP-bidrag og (fra 6. januar 2020) obligatorisk pension.
 * - Rate-tabellen indeholder ugentlige ATP-satser; ATP beregnes ikke pr. dag.
 * - Beregningen grupperer derfor arbejdsdage pr. kalenderuge, afrunder først dagpengemodtagerens
 *   andel af den ugentlige sats til hele kroner, og ganger derefter med forholdet mellem
 *   kommunalt og eget bidrag for at få den kommunale andel i rækkens tillæg.
 * - `resolveKommunaltAtpBidragPrKalenderuge` håndhæver invarianten om at kommunalt bidrag altid
 *   er præcis dobbelt af eget bidrag i rate-tabellen.
 *
 * Vigtigt om obligatorisk pension (§ 67 / § 67 a):
 * - Fra og med 6. januar 2020 tillægges OP-bidraget oven i det kommunale ATP-bidrag i samme tillæg-felt.
 * - OP beregnes pr. kalenderuge med periodens procentsats på grundlag af ugens sygedagpenge
 *   efter fradrag for dagpengemodtagerens (allerede afrundede) eget ATP-bidrag, og afrundes
 *   til nærmeste hele kronebeløb pr. uge.
 * - Udtrykket gemmes derfor pr. uge som `egetBidrag*2+opBidrag`, hvor `opBidrag` er det
 *   forudberegnede, uge-afrundede OP-beløb.
 * - Procentsatserne resolves af `resolveObligatoriskPensionProcent` fra `sygedagpengeRates.ts`,
 *   hvor de står sammen med ATP-satserne.
 *
 * Vigtigt om udtryks-komprimering:
 * - Fulde uger i et satssegment giver identiske uge-led; for at undgå unødigt lange udtryk
 *   (fx `48*2+54+48*2+54+...` gentaget snesevis af gange) komprimeres konsekutive identiske
 *   led til `antal*(led)` af `compressUgeBidrag`, fx `26*(48*2+54)`.
 * - Delvise uger i enderne (eller uger med SH-dage) har egne beløb og bevares som selvstændige
 *   led, så uge-afrundingen er uændret. Komprimeringen er rent kosmetisk: den evaluerede sum
 *   er identisk med den ukomprimerede form.
 */
