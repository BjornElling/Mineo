import {
  resolveEgetAtpBidragPrKalenderuge,
  resolveKommunaltAtpBidragPrKalenderuge,
  sygedagpengeRates,
  type DatedSygedagpengeRate,
} from '../../../data/sygedagpengeRates';
import type { OffentligeYdelserRow } from '../../../schemas/formSchemas';
import { roundByMethod } from '../../../utils/rounding';
import { parseAmountInput } from '../../../utils/expressionAmount';
import {
  beregnPeriodiseringsDage,
  beregnSygedagpengeArbejdsdagePrKalenderuge,
} from '../../../utils/periodeBeregning';
import { isoToDanish, maxIso, minIso, type ISODateString } from '../../../types/branded';
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

const buildKommunaltAtpExpression = (segment: SygedagpengeSegment): string => {
  const egetAtpPrKalenderuge = resolveEgetAtpBidragPrKalenderuge(segment.rate);
  const kommunaltFaktor = resolveKommunaltAtpBidragPrKalenderuge(segment.rate) / egetAtpPrKalenderuge;
  const ugeBidrag = beregnSygedagpengeArbejdsdagePrKalenderuge(segment.fraDato, segment.tilDato).map((uge) => {
    const egetBidrag = roundByMethod((uge.arbejdsdage * egetAtpPrKalenderuge) / 5, 0, 'halfAwayFromZero');
    return `${egetBidrag}*${kommunaltFaktor}`;
  });

  if (ugeBidrag.length === 0) {
    throw new Error('CRITICAL: Sygedagpenge-segment med arbejdsdage gav intet ATP-bidrag pr. kalenderuge');
  }

  return ugeBidrag.join('+');
};

export const splitSygedagpengeRateSegments = (
  fraDato: ISODateString,
  tilDato: ISODateString
): readonly SygedagpengeSegment[] => {
  const segments: SygedagpengeSegment[] = [];

  for (const rate of sygedagpengeRates) {
    if (rate.tilDato < fraDato || rate.fraDato > tilDato) continue;

    const segmentFra = maxIso(fraDato, rate.fraDato);
    const segmentTil = minIso(tilDato, rate.tilDato);
    const segmentFraDa = isoToDanish(segmentFra);
    const segmentTilDa = isoToDanish(segmentTil);
    if (!segmentFraDa || !segmentTilDa) {
      throw new Error('CRITICAL: Kunne ikke konvertere sygedagpenge-segment til dansk datoformat');
    }

    const arbejdsdage = beregnPeriodiseringsDage(segmentFraDa, segmentTilDa, 'arbejdsdage', 'sygedagpenge');
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

export const buildSygedagpengeRowsForRange = (
  fraDato: ISODateString,
  tilDato: ISODateString
): readonly OffentligeYdelserRow[] => {
  const segments = splitSygedagpengeRateSegments(fraDato, tilDato);

  return segments.map((segment) => {
    const kommunaltAtpExpression = buildKommunaltAtpExpression(segment);
    const fraDatoDa = isoToDanish(segment.fraDato);
    const tilDatoDa = isoToDanish(segment.tilDato);
    if (!fraDatoDa || !tilDatoDa) {
      throw new Error('CRITICAL: Kunne ikke konvertere indsatte sygedagpengedatoer til dansk tabel-format');
    }

    return {
      id: generateOffentligYdelseRowId(),
      fraDato: fraDatoDa,
      tilDato: tilDatoDa,
      ydelse: toExpressionAmount(buildSegmentExpression(segment.arbejdsdage, segment.rate.sygedagpengePrDagMax)),
      tillaeg: toExpressionAmount(kommunaltAtpExpression),
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
 * - Særreglen håndhæves centralt af `beregnPeriodiseringsDage(..., 'sygedagpenge')`
 *   og `beregnSygedagpengeArbejdsdagePrKalenderuge`, så ydelse og ATP-tillæg altid
 *   anvender samme cutoff-regel på de samme datoer.
 *
 * Vigtigt om feriedage:
 * - Disse indsatte sygedagpenge-rækker følger samme regel som øvrige sygedagpenge-rækker i EO:
 *   de periodiseres på sygedagpenge-dage og fratrækker derfor ikke daterede feriedage.
 * - Det er bevidst og bryder den almindelige TAF-/løn-norm, hvor arbejdsdage typisk reduceres
 *   med daterede feriedage.
 *
 * Vigtigt om ATP:
 * - Tillægget indeholder kun det kommunale ATP-bidrag.
 * - Rate-tabellen indeholder ugentlige ATP-satser; ATP beregnes ikke pr. dag.
 * - Beregningen grupperer derfor arbejdsdage pr. kalenderuge, afrunder først dagpengemodtagerens
 *   andel af den ugentlige sats til hele kroner, og ganger derefter med forholdet mellem
 *   kommunalt og eget bidrag for at få den kommunale andel i rækkens tillæg.
 * - `resolveKommunaltAtpBidragPrKalenderuge` håndhæver invarianten om at kommunalt bidrag altid
 *   er præcis dobbelt af eget bidrag i rate-tabellen.
 */
