import { sygedagpengeRates, type DatedSygedagpengeRate } from '../../../config/regulatoryRates';
import type { OffentligeYdelserRow } from '../../../schemas/formSchemas';
import { parseAmountInput } from '../../../utils/expressionAmount';
import { beregnPeriodiseringsDage } from '../../../utils/periodeBeregning';
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

const resolveKommunaltAtpBidragPrDag = (rate: DatedSygedagpengeRate): number => {
  const expectedKommunaltBidragPrDag = rate.egetAtpPrDag * 2;
  if (rate.kommunaltAtpPrDag !== expectedKommunaltBidragPrDag) {
    throw new Error('CRITICAL: Sygedagpenge-rater forventer at kommunalt ATP-bidrag altid er dobbelt af eget ATP-bidrag.');
  }
  return expectedKommunaltBidragPrDag;
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
    const kommunaltAtpBidragPrDag = resolveKommunaltAtpBidragPrDag(segment.rate);
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
      tillaeg: toExpressionAmount(buildSegmentExpression(segment.arbejdsdage, kommunaltAtpBidragPrDag)),
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
 * - Den særregel håndhæves centralt af `beregnPeriodiseringsDage(..., 'sygedagpenge')`.
 *
 * Vigtigt om feriedage:
 * - Disse indsatte sygedagpenge-rækker følger samme regel som øvrige sygedagpenge-rækker i EO:
 *   de periodiseres på sygedagpenge-dage og fratrækker derfor ikke daterede feriedage.
 * - Det er bevidst og bryder den almindelige TAF-/løn-norm, hvor arbejdsdage typisk reduceres
 *   med daterede feriedage.
 *
 * Vigtigt om ATP:
 * - Tillægget indeholder kun det kommunale ATP-bidrag.
 * - Det kommunale bidrag forventes i rate-tabellen altid at være præcis dobbelt af eget bidrag.
 * - Invarianten håndhæves eksplicit, så en fremtidig rate-ændring ikke stiltiende ændrer beregningen.
 */
