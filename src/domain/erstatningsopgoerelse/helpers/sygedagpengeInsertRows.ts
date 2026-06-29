import {
  beregnEgetAtpBidragForTimer,
  beregnSygedagpengeForTimer,
  resolveObligatoriskPensionProcent,
  sygedagpengeRates,
  SYGEDAGPENGE_INSERT_MAX_DATE,
  SYGEDAGPENGE_INSERT_MIN_DATE,
  type DatedSygedagpengeRate,
} from '../../../data/sygedagpengeRates';
import type { OffentligeYdelserRow } from '../../../schemas/formSchemas';
import { roundByMethod } from '../../../utils/rounding';
import { parseAmountInput } from '../../../utils/expressionAmount';
import { formatISOToDanish } from '../../../utils/dateFormatting';
import { maxISO, minISO } from '../../../utils/isoDateHelpers';
import {
  buildSygedagpengeGrundlagPrKalenderuge,
  type KalenderugeSygedagpengeGrundlag,
} from '../engines/periodiseringsMotor';
import type { ISODateString } from '../../../types/branded';
import { generateOffentligYdelseRowId } from './eoRowInitialValues';

type SygedagpengeSegment = Readonly<{
  fraDato: ISODateString;
  tilDato: ISODateString;
  rate: DatedSygedagpengeRate;
  ugeGrundlag: readonly KalenderugeSygedagpengeGrundlag[];
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

const buildYdelseExpression = (segment: SygedagpengeSegment): string => {
  const ugeYdelser = segment.ugeGrundlag.map((uge) =>
    beregnSygedagpengeForTimer(segment.rate, uge.timer).toString()
  );

  if (ugeYdelser.length === 0) {
    throw new Error('CRITICAL: Sygedagpenge-segment med timer gav ingen ydelsesuger');
  }

  const compressed = compressUgeBidrag(ugeYdelser);
  return compressed.includes('+') || compressed.includes('*') ? compressed : `1*${compressed}`;
};

const buildTillaegExpression = (segment: SygedagpengeSegment): string => {
  const opProcent = resolveObligatoriskPensionProcent(segment.rate);
  const ugeBidrag = segment.ugeGrundlag.map((uge) => {
    const egetBidrag = beregnEgetAtpBidragForTimer(segment.rate, uge.timer);
    // Det kommunale ATP-bidrag er altid eget bidrag gange forholdet kommunalt/eget (= 2).
    const kommunaltAtpLed = `${egetBidrag}*2`;

    if (opProcent <= 0) {
      return kommunaltAtpLed;
    }

    // Obligatorisk pension (§ 67 stk. 2): procentsats på grundlag af sygedagpengene
    // efter fradrag for dagpengemodtagerens eget ATP-bidrag, afrundet til hele kroner pr. uge.
    const ugeSygedagpenge = beregnSygedagpengeForTimer(segment.rate, uge.timer);
    const opGrundlag = ugeSygedagpenge - egetBidrag;
    const opBidrag = roundByMethod((opProcent / 100) * opGrundlag, 0, 'halfAwayFromZero');

    return `${kommunaltAtpLed}+${opBidrag}`;
  });

  if (ugeBidrag.length === 0) {
    throw new Error('CRITICAL: Sygedagpenge-segment med timer gav intet tillæg pr. kalenderuge');
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
    const ugeGrundlag = buildSygedagpengeGrundlagPrKalenderuge(segmentFra, segmentTil);
    if (ugeGrundlag.length === 0) continue;

    segments.push({
      fraDato: segmentFra,
      tilDato: segmentTil,
      rate,
      ugeGrundlag,
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
 * Hver satsrække samler sygedagpenge-timesats, ATP-timebidrag og OP-procent for satsåret, så
 * satsdækning medfører altid ATP- og OP-dækning. Det er derfor tilstrækkeligt at
 * kontrollere, at hele perioden ligger i [INSERT_MIN, INSERT_MAX]. Tabellen er pr.
 * konstruktion kontinuert (ingen interne huller), hvilket `sygedagpengeRates.test.ts`
 * håndhæver, så dækning kan afgøres ud fra grænserne.
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
};

export const buildSygedagpengeRowsForRange = (
  fraDato: ISODateString,
  tilDato: ISODateString
): readonly OffentligeYdelserRow[] => {
  assertSygedagpengeRangeFullyCovered(fraDato, tilDato);

  const segments = splitSygedagpengeRateSegments(fraDato, tilDato);

  return segments.map((segment) => {
    const ydelseExpression = buildYdelseExpression(segment);
    const tillaegExpression = buildTillaegExpression(segment);

    return {
      id: generateOffentligYdelseRowId(),
      fraDato: segment.fraDato,
      tilDato: segment.tilDato,
      ydelse: toExpressionAmount(ydelseExpression),
      tillaeg: toExpressionAmount(tillaegExpression),
      ydelsestype: 'sygedagpenge',
    };
  });
};

/**
 * Sygedagpenge-rækker genereres som almindelige persisted brugerinputrækker:
 * - Hver overlapperiode splittes eksplicit i samme sats-intervaller som rate-tabellen.
 * - Beløbene gemmes som komprimerede uge-udtryk, så afrunding pr. kalenderuge bevares
 *   og persisteres som almindeligt brugerinput.
 *
 * Vigtigt om dagtælling:
 * - Fra og med 2. juli 2012 medregnes SH-dage ikke længere for sygedagpenge.
 * - Til og med 1. juli 2012 medregnes SH-dage fortsat.
 * - Særreglen håndhæves centralt af `buildSygedagpengeGrundlagPrKalenderuge`, så
 *   ydelse, ATP og OP altid anvender samme cutoff-regel på de samme datoer.
 *
 * Vigtigt om feriedage:
 * - Disse indsatte sygedagpenge-rækker følger samme regel som øvrige sygedagpenge-rækker i EO:
 *   de periodiseres på sygedagpenge-dage og fratrækker derfor ikke daterede feriedage.
 * - Det er bevidst og bryder den almindelige TAF-/løn-norm, hvor arbejdsdage typisk reduceres
 *   med daterede feriedage.
 *
 * Vigtigt om ATP:
 * - Tillægget indeholder det kommunale ATP-bidrag og (fra 6. januar 2020) obligatorisk pension.
 * - Rate-tabellen indeholder ATP-timebidrag; ATP beregnes pr. kalenderuge på samme timer
 *   som sygedagpengene og aldrig pr. dag eller samlet for hele indsættelsesperioden.
 * - Beregningen afrunder først dagpengemodtagerens 1/3-andel til hele kroner pr. uge,
 *   hvorefter kommunens 2/3-andel er dobbelt af det afrundede eget-bidrag.
 *
 * Vigtigt om obligatorisk pension (§ 67 / § 67 a):
 * - Fra og med 6. januar 2020 tillægges OP-bidraget oven i det kommunale ATP-bidrag i samme tillæg-felt.
 * - OP beregnes pr. kalenderuge med periodens procentsats på grundlag af ugens sygedagpenge
 *   efter fradrag for dagpengemodtagerens (allerede afrundede) eget ATP-bidrag, og afrundes
 *   til nærmeste hele kronebeløb pr. uge.
 * - Udtrykket gemmes derfor pr. uge som `egetBidrag*2+opBidrag`, hvor `opBidrag` er det
 *   forudberegnede, uge-afrundede OP-beløb.
 * - Procentsatserne resolves af `resolveObligatoriskPensionProcent` fra `sygedagpengeRates.ts`,
 *   hvor de står sammen med ATP-timebidragene.
 *
 * Vigtigt om udtryks-komprimering:
 * - Fulde uger i et satssegment giver identiske uge-led; for at undgå unødigt lange udtryk
 *   (fx `48*2+54+48*2+54+...` gentaget snesevis af gange) komprimeres konsekutive identiske
 *   led til `antal*(led)` af `compressUgeBidrag`, fx `26*(48*2+54)`.
 * - Delvise uger i enderne (eller uger med SH-dage) har egne beløb og bevares som selvstændige
 *   led, så uge-afrundingen er uændret. Komprimeringen er rent kosmetisk: den evaluerede sum
 *   er identisk med den ukomprimerede form.
 */
