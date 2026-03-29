/**
 * Renderer til scenarie-headers.
 *
 * Skriver scenariets id, titel, tags og parameteropsummering til en PdfWriter.
 * Bruges som indledende afsnit for hvert scenarie i batch-review PDF'en.
 */

import type { PdfWriter } from '../../../utils/pdf/pdfWriter';
import type { BatchScenario } from '../types';

const STATUS_LABELS: Record<'ok' | 'blocked' | 'error', string> = {
  ok: 'OK',
  blocked: 'BLOKERET',
  error: 'FEJL',
};

/**
 * Skriver scenario-header til writer.
 *
 * Starter altid på en ny side for at sikre klart afsnits-skift mellem scenarier.
 */
export const renderScenarioHeader = (
  writer: PdfWriter,
  scenario: BatchScenario<unknown>,
  resultStatus: 'ok' | 'blocked' | 'error'
): void => {
  writer.addPage();

  // Titel: scenarie-id + titel
  writer.writeTitle(`${scenario.id}: ${scenario.title}`);

  // Status-linje
  const statusLabel = STATUS_LABELS[resultStatus];
  writer.writeLeftRightText('Status', statusLabel, {
    rightFontStyle: 'bold',
  });

  // Tags
  if (scenario.tags.length > 0) {
    writer.writeLeftRightText('Tags', scenario.tags.join(' · '), {
      rightFontStyle: 'normal',
    });
  }

  // Beskrivelse
  if (scenario.description) {
    writer.writeWrappedText(scenario.description);
  }

  // Parameteropsummering
  if (scenario.parameterSummary.length > 0) {
    writer.writeSectionHeader('Parametre', 6);
    for (const param of scenario.parameterSummary) {
      writer.writeLeftRightText(param.label, param.value, {
        rightFontStyle: 'normal',
      });
    }
  }
};
