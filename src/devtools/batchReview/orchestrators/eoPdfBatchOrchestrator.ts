/**
 * Orkestrator for EO PDF-batch-review.
 *
 * Orkestrerer den fulde PDF-track:
 * 1. Udvælger scenarier for den valgte profil
 * 2. Opretter én enkelt PdfWriter
 * 3. For hvert scenarie: beregner snapshot og renderer SFGG-data ind i writer
 * 4. Kalder writer.save() KUN én gang til sidst
 *
 * Bruger runBatchChunked for at undgå at blokere UI-tråden.
 */

import { createStandardPdfWriter } from '../../../utils/pdf/pdfWriter';
import { computeEoScenario } from '../adapters/eoAdapter';
import { getSfggPdfScenarios } from '../scenarios/eo/sfgg/pdf/sfggPdfScenarios';
import { renderEoSfggBatchPage } from '../renderers/eoPdfBatchRenderer';
import { renderScenarioHeader } from '../renderers/scenarioHeaderRenderer';
import { runBatchChunked } from '../batchRunner';
import type { BatchProfile } from '../types';
import type { EoScenarioInput } from '../adapters/eoAdapter';
import type { BatchScenario, BatchScenarioResult } from '../types';

export type EoPdfBatchOrchestratorCallbacks = {
  readonly onProgress: (completed: number, total: number, currentId: string) => void;
  readonly onDone: () => void;
  readonly onError: (error: string) => void;
};

const BATCH_FILENAME = 'Mineo-batch-review-eo-sfgg.pdf';

type NoOutput = Record<string, never>;

/**
 * Starter et asynkront EO PDF batch-review.
 *
 * @returns Abort-funktion — kald den for at stoppe batch-kørslen.
 */
export const runEoPdfBatchReview = (
  profile: BatchProfile,
  callbacks: EoPdfBatchOrchestratorCallbacks
): (() => void) => {
  const scenarios = getSfggPdfScenarios(profile);

  if (scenarios.length === 0) {
    callbacks.onError('Ingen scenarier fundet for den valgte profil.');
    return () => {};
  }

  const writer = createStandardPdfWriter({
    visUdkastStempel: true,
    onLayoutFallback: () => {},
  });

  // Render første side som forside (den side der oprettes automatisk ved createStandardPdfWriter)
  writer.writeTitle(`Batch-review: EO SFGG — profil "${profile}"`);
  writer.writeWrappedText(`Antal scenarier: ${scenarios.length}`);

  const processScenario = (
    scenario: BatchScenario<EoScenarioInput>
  ): BatchScenarioResult<NoOutput> => {
    const result = computeEoScenario(scenario.input);

    if (result.kind === 'error') {
      renderScenarioHeader(writer, scenario, 'error');
      writer.writeSectionHeader('Beregningsfejl', 6);
      writer.writeWrappedText(result.message);
      return { kind: 'error', scenarioId: scenario.id, error: result.message };
    }

    if (result.kind === 'blocked') {
      renderScenarioHeader(writer, scenario, 'blocked');
      writer.writeSectionHeader('Blokeret', 6);
      writer.writeWrappedText(result.message);
      return { kind: 'blocked', scenarioId: scenario.id, message: result.message };
    }

    renderEoSfggBatchPage(writer, scenario, result.pdfModel);
    return { kind: 'ok', scenarioId: scenario.id, output: {} };
  };

  let abortFn: (() => void) | null = null;

  const abort = () => {
    if (abortFn) abortFn();
  };

  abortFn = runBatchChunked<EoScenarioInput, NoOutput>(
    scenarios,
    processScenario,
    {
      onProgress: (progress) => {
        callbacks.onProgress(
          progress.completed,
          progress.total,
          progress.currentId ?? ''
        );
      },
      onScenarioResult: () => {
        // Resultater er allerede renderet ind i writer under processScenario
      },
      onDone: (result) => {
        if (!result.aborted) {
          try {
            writer.save(BATCH_FILENAME);
            callbacks.onDone();
          } catch (err) {
            callbacks.onError(
              err instanceof Error ? err.message : 'Fejl ved PDF-gemning'
            );
          }
        } else {
          callbacks.onDone();
        }
      },
    }
  );

  return abort;
};
