/** Kontrolvisningens reguleringstabeller læser motorens autoritative resultat. */


import type { RowCellValue } from '../eoRowEvaluation/eoRowTypes';
import { formatIsoValue } from './eoInspektionFormat';
import type { RegulationIndexTimeline } from './eoInspektionRegulationTypes';
import type { EoCanonicalOutput } from '../erstatningsopgoerelse/snapshot/eoCanonicalOutput';
import type { LoenudviklingModel } from '../erstatningsopgoerelse/shared/eoTypes';
import { resolveForloebForAnsaettelse } from '../erstatningsopgoerelse/engines/reguleringForloeb';
import type { ErstatningsopgoerelseValues, StamdataValues } from '../../schemas/formSchemas';
import { resolveLoenudviklingKilde } from '../erstatningsopgoerelse/helpers/angivetLoenHelpers';
import { resolveAnvendtReguleringsdato } from '../erstatningsopgoerelse/helpers/eoSharedUtils';
import { resolveAnvendtReguleringsdatoReferenceText } from '../erstatningsopgoerelse/helpers/eoDateReferenceText';
import { getAngivetLoenOpreguleresFraDato } from '../erstatningsopgoerelse/helpers/angivetLoenHelpers';
import { computeTafBeregningsenhed } from '../erstatningsopgoerelse/helpers/tafBeregningsenhed';
import { capitalizeFirstCharDa } from '../../utils/formatUtils';
import {
  buildReguleringIndexRows,
  buildReguleringsvaerdierTableData,
  resolveLoenudviklingSegmentBounds,
  resolveLoenudviklingSegmenterForKilde,
} from '../erstatningsopgoerelse/engines/reguleringsPresentation';

export type RegulationInspektionSection = {
  readonly id: string;
  readonly header: string;
  readonly rows: readonly RegulationInspektionRow[];
  readonly tables?: readonly RegulationInspektionTable[];
};

export type RegulationInspektionRow = {
  readonly id: string;
  readonly label: string;
  readonly value: RowCellValue | string;
};

export type RegulationInspektionTable = {
  readonly id: string;
  readonly columns: readonly string[];
  readonly rows: readonly RegulationInspektionTableRow[];
};

export type RegulationInspektionTableRow = {
  readonly id: string;
  readonly cells: readonly (RowCellValue | string)[];
};

/**
 * Bygger reguleringstabeller pr. ansættelsesforhold fra det autoritative resultat.
 */
export function buildRegulationInspektionSections(
  params: Readonly<{
    timeline: RegulationIndexTimeline;
    canonicalOutput?: EoCanonicalOutput;
    loenudvikling?: LoenudviklingModel | null;
    eoValues: ErstatningsopgoerelseValues;
    stamdataValues: StamdataValues;
  }>
): readonly RegulationInspektionSection[] {
  const { timeline, canonicalOutput, eoValues, stamdataValues, loenudvikling } = params;
  if (timeline.ansaettelser.length === 0) return [];

  const loenudviklingsKilderById = new Map(
    resolveLoenudviklingKilde(eoValues).map((ansaettelsesforhold) => [ansaettelsesforhold.id, ansaettelsesforhold] as const)
  );
  const sections: RegulationInspektionSection[] = [];

  timeline.ansaettelser.forEach((af, idx) => {
    const header = af.navn && af.navn.trim() !== ''
      ? `Regulering (${af.navn.trim()})`
      : `Regulering (Ansættelsesforhold ${idx + 1})`;

    const sectionId = `regulation.${af.ansaettelsesforholdId}`;
    const ansaettelsesforhold = loenudviklingsKilderById.get(af.ansaettelsesforholdId);
    const forloeb = resolveForloebForAnsaettelse(
      loenudvikling?.perAnsaettelse ?? [],
      loenudvikling?.forloeb,
      af.ansaettelsesforholdId
    );
    const anvendtReguleringsdato = ansaettelsesforhold
      ? resolveAnvendtReguleringsdato({
          beregnesUdFra: eoValues.beregnesUdFra,
          angivetLoenMetodeOpreguleresFraDato: getAngivetLoenOpreguleresFraDato(eoValues),
          saerligFraDatoRegulering: ansaettelsesforhold.saerligFraDatoRegulering,
          beregningsperiodeTil: eoValues.tafBeregningsperiodeTil,
          skadedato: stamdataValues.skadedato,
        })
      : undefined;
    const referenceLabel = ansaettelsesforhold
      ? capitalizeFirstCharDa(resolveAnvendtReguleringsdatoReferenceText({
          anvendtReguleringsdato,
          skadedato: stamdataValues.skadedato,
          skadestype: stamdataValues.skadestype,
          beregnesUdFra: eoValues.beregnesUdFra,
          beregningsperiodeTil: eoValues.tafBeregningsperiodeTil,
          saerligFraDatoRegulering: ansaettelsesforhold.saerligFraDatoRegulering,
          angivetLoenMetodeOpreguleresFraDato: getAngivetLoenOpreguleresFraDato(eoValues),
        }))
      : capitalizeFirstCharDa(`reguleringsdatoen (${formatIsoValue(af.referenceIso)})`);
    const rows: RegulationInspektionRow[] = [
      {
        id: `${sectionId}:kilde`,
        label: af.kildeLabel,
        value: af.kildeVaerdi,
      },
      {
        id: `${sectionId}:skadedato`,
        label: referenceLabel,
        value: { rawValue: af.referenceIso, displayValue: formatIsoValue(af.referenceIso) },
      },
    ];

    const canonicalSegments = resolveLoenudviklingSegmenterForKilde({
      perAnsaettelse: (canonicalOutput?.regulering.perAnsaettelse ?? []).map((entry) => ({
        ansaettelsesforholdId: entry.ansaettelsesforholdId,
        beregnedeSegmenter: entry.loenudviklingSegmenter,
      })),
      globaleSegmenter: canonicalOutput?.regulering.loenudviklingSegmenter ?? [],
      ansaettelsesforholdId: af.ansaettelsesforholdId,
    });
    // Kontrolgrundlaget må aldrig blive et alternativt beregningsresultat. Uden canonical
    // segmenter er der ingen beregnet regulering at vise, heller ikke en syntetisk nul-faktor.
    const segmentsForInspektion = canonicalSegments;
    const coverageBounds = resolveLoenudviklingSegmentBounds(segmentsForInspektion);
    const reguleringsvaerdierTableData =
      ansaettelsesforhold && coverageBounds
        ? buildReguleringsvaerdierTableData({
            segments: segmentsForInspektion,
            ansaettelsesforhold,
            anvendtReguleringsdato,
            tafFra: coverageBounds.foerste,
            tafTil: coverageBounds.sidste,
            tafBeregningsenhed: computeTafBeregningsenhed(eoValues),
            forloeb,
          })
        : null;
    const tables: RegulationInspektionTable[] = [];
    if (reguleringsvaerdierTableData) {
      tables.push({
        id: `${sectionId}:vaerdier`,
        columns: reguleringsvaerdierTableData.columns,
        rows: reguleringsvaerdierTableData.rows.map((row, rowIndex) => ({
          id: `${sectionId}:vaerdier:${rowIndex}`,
          cells: row,
        })),
      });
    }

    if (ansaettelsesforhold && segmentsForInspektion.length > 0) {
      const indeksRows = buildReguleringIndexRows({
        segments: segmentsForInspektion,
        ansaettelsesforhold,
        anvendtReguleringsdato,
        tafBeregningsenhed: computeTafBeregningsenhed(eoValues),
        forloeb,
      });
      if (indeksRows.length > 0) {
        // KL-lønaftaler: trinvis kæde-opregulering vises uden indeksberegning; i stedet
        // ses lønudviklingen og den resulterende, afrundede måneds-/dagsløn.
        // Se docs/domain/taf/kl-loenaftaler-regulering.md.
        const isKlLoenaftalerTable = indeksRows.some((row) => row.reguleretLoen !== undefined);
        const reguleretLoenHeader =
          computeTafBeregningsenhed(eoValues) === 'Måneder' ? 'Reguleret månedsløn' : 'Reguleret dagsløn';
        tables.push(isKlLoenaftalerTable
          ? {
              id: `${sectionId}:beregnet`,
              columns: ['Fra-dato', 'Til-dato', 'Lønudvikling', reguleretLoenHeader],
              rows: indeksRows.map((row, rowIndex) => ({
                id: `${sectionId}:beregnet:${rowIndex}`,
                cells: [row.fraDato, row.tilDato, row.loenudvikling, row.reguleretLoen ?? ''],
              })),
            }
          : {
              id: `${sectionId}:beregnet`,
              columns: ['Fra-dato', 'Til-dato', 'Indeksberegning', 'Indeks', 'Lønudvikling'],
              rows: indeksRows.map((row, rowIndex) => ({
                id: `${sectionId}:beregnet:${rowIndex}`,
                cells: [row.fraDato, row.tilDato, row.indeksberegning, row.indeks, row.loenudvikling],
              })),
            });
      }
    }

    sections.push({
      id: sectionId,
      header,
      rows,
      tables,
    });
  });

  return sections;
}
