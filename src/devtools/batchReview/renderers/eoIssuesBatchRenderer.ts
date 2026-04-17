/**
 * Renderer for EO fejl og advarsler fra BeregningErrorSummary til en eksisterende PdfWriter.
 *
 * Opretter IKKE sin egen writer og kalder IKKE writer.save().
 *
 * Renderingsrækkefølge per scenarie:
 * 1. Scenarie-header (via scenarioHeaderRenderer)
 * 2. Fejl-sektion (errors)
 * 3. Advarsels-sektion (warnings)
 * 4. "Ingen fejl eller advarsler" hvis begge sektioner er tomme
 */

import type { PdfWriter } from '../../../pdf/infrastructure/pdfWriter';
import type { BeregningErrorSummary } from '../../../domain/debug/eoDebugRowAggregator';
import type { BatchScenario } from '../types';
import { renderScenarioHeader } from './scenarioHeaderRenderer';

const hasIssues = (summary: BeregningErrorSummary): boolean =>
  summary.errors.length > 0 || summary.warnings.length > 0;

const resultStatusFromSummary = (summary: BeregningErrorSummary): 'ok' | 'blocked' | 'error' => {
  if (summary.errors.length > 0) return 'error';
  if (summary.warnings.length > 0) return 'ok'; // advarsler er ikke blokerende
  return 'ok';
};

/**
 * Renderer EO fejl og advarsler fra BeregningErrorSummary ind i en eksisterende PdfWriter.
 *
 * Kalder renderScenarioHeader og renderer derefter fejl- og advarsels-sektionerne.
 */
export const renderEoIssuesBatchPage = (
  writer: PdfWriter,
  scenario: BatchScenario<unknown>,
  summary: BeregningErrorSummary
): void => {
  const resultStatus = resultStatusFromSummary(summary);
  renderScenarioHeader(writer, scenario, resultStatus);

  if (!hasIssues(summary)) {
    writer.writeSectionHeader('Resultat', 6);
    writer.writeWrappedText('Ingen fejl eller advarsler fundet for dette scenarie.');
    return;
  }

  // Fejl
  if (summary.errors.length > 0) {
    writer.writeSectionHeader(`Fejl (${summary.errors.length})`, 6);
    for (const row of summary.errors) {
      writer.writeBoldSubheader(`FEJL: ${row.label}`, 6, { addTopSpacing: true });
      const bodyText = row.message ?? row.displayValue;
      if (bodyText) {
        writer.writeWrappedText(bodyText);
      }
      writer.writeLeftRightText('Felt-ID', row.id, { rightFontStyle: 'normal' });
    }
  }

  // Advarsler
  if (summary.warnings.length > 0) {
    writer.writeSectionHeader(`Advarsler (${summary.warnings.length})`, 6);
    for (const row of summary.warnings) {
      writer.writeBoldSubheader(`ADVARSEL: ${row.label}`, 6, { addTopSpacing: true });
      const bodyText = row.message ?? row.displayValue;
      if (bodyText) {
        writer.writeWrappedText(bodyText);
      }
      writer.writeLeftRightText('Felt-ID', row.id, { rightFontStyle: 'normal' });
    }
  }
};
