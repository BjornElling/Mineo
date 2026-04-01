/**
 * Orkestrator for EO Issues-batch-review (fejl og advarsler).
 *
 * Orkestrerer issues-trackens PDF:
 * 1. Udvælger scenarier for den valgte profil
 * 2. Opretter én enkelt PdfWriter
 * 3. For hvert scenarie: beregner snapshot, indsamler debug-rows, renderer fejl/advarsler
 * 4. Kalder writer.save() KUN én gang til sidst
 *
 * Bruger runBatchChunked for at undgå at blokere UI-tråden.
 */

import { createStandardPdfWriter } from '../../../pdf/infrastructure/pdfWriter';
import { computeEoScenario } from '../adapters/eoAdapter';
import { collectAllDebugRows } from '../../../domain/debug/eoDebugRowAggregator';
import { getSfggIssuesScenarios } from '../scenarios/eo/sfgg/issues/sfggIssuesScenarios';
import { renderEoIssuesBatchPage } from '../renderers/eoIssuesBatchRenderer';
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

const BATCH_FILENAME = 'Mineo-batch-review-eo-issues.pdf';

type NoOutput = Record<string, never>;

const EMPTY_ERRORS = {};

/**
 * Starter et asynkront EO Issues batch-review.
 *
 * @returns Abort-funktion — kald den for at stoppe batch-kørslen.
 */
export const runEoIssuesBatchReview = (
  profile: BatchProfile,
  callbacks: EoPdfBatchOrchestratorCallbacks
): (() => void) => {
  const scenarios = getSfggIssuesScenarios(profile);

  if (scenarios.length === 0) {
    callbacks.onError('Ingen scenarier fundet for den valgte profil.');
    return () => {};
  }

  const writer = createStandardPdfWriter({
    visUdkastStempel: true,
    onLayoutFallback: () => {},
  });

  // Render første side som forside
  writer.writeTitle(`Batch-review: EO Fejl og advarsler — profil "${profile}"`);
  writer.writeWrappedText(`Antal scenarier: ${scenarios.length}`);

  const processScenario = (
    scenario: BatchScenario<EoScenarioInput>
  ): BatchScenarioResult<NoOutput> => {
    const eoResult = computeEoScenario(scenario.input);

    if (eoResult.kind === 'error') {
      renderScenarioHeader(writer, scenario, 'error');
      writer.writeSectionHeader('Beregningsfejl', 6);
      writer.writeWrappedText(eoResult.message);
      return { kind: 'error', scenarioId: scenario.id, error: eoResult.message };
    }

    // For issues-track bruger vi collectAllDebugRows — selv ved 'blocked' snapshots
    // har vi muligvis et debugSnapshot og validerede input.
    const { stamdataValues, eoValues } = scenario.input;

    let summary;
    try {
      summary = collectAllDebugRows(
        stamdataValues,
        EMPTY_ERRORS,
        eoValues,
        EMPTY_ERRORS
      );
    } catch (err) {
      renderScenarioHeader(writer, scenario, 'error');
      writer.writeSectionHeader('Debug-fejl', 6);
      const msg = err instanceof Error ? err.message : String(err);
      writer.writeWrappedText(msg);
      return { kind: 'error', scenarioId: scenario.id, error: msg };
    }

    renderEoIssuesBatchPage(writer, scenario, summary);
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
