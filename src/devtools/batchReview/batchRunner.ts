/**
 * Asynkron chunk-baseret runner til batch-review scenarier.
 *
 * Behandler scenarier i bidder (chunks) for at undgå at blokere UI-tråden.
 * Giver kontrol tilbage til browseren mellem hvert chunk via setTimeout(0).
 */

import type { BatchScenario, BatchScenarioResult } from './types';

export type BatchRunProgress = {
  readonly total: number;
  readonly completed: number;
  readonly currentId?: string;
};

export type BatchRunResult = {
  readonly completed: number;
  readonly aborted: boolean;
};

export type BatchRunCallbacks<TInput, TRenderOutput> = {
  readonly onProgress: (progress: BatchRunProgress) => void;
  readonly onScenarioResult: (result: BatchScenarioResult<TRenderOutput>) => void;
  readonly onDone: (result: BatchRunResult) => void;
};

const DEFAULT_CHUNK_SIZE = 5;

/**
 * Kører scenarier asynkront i chunks.
 *
 * @returns Abort-funktion — kald den for at afbryde kørselens midlertidigt.
 */
export const runBatchChunked = <TInput, TRenderOutput>(
  scenarios: readonly BatchScenario<TInput>[],
  processScenario: (scenario: BatchScenario<TInput>) => BatchScenarioResult<TRenderOutput>,
  callbacks: BatchRunCallbacks<TInput, TRenderOutput>,
  chunkSize: number = DEFAULT_CHUNK_SIZE
): (() => void) => {
  let aborted = false;
  let completed = 0;
  let chunkStart = 0;

  const abort = () => {
    aborted = true;
  };

  const processNextChunk = () => {
    if (aborted) {
      callbacks.onDone({ completed, aborted: true });
      return;
    }

    const chunkEnd = Math.min(chunkStart + chunkSize, scenarios.length);

    for (let i = chunkStart; i < chunkEnd; i += 1) {
      if (aborted) {
        callbacks.onDone({ completed, aborted: true });
        return;
      }

      const scenario = scenarios[i];

      callbacks.onProgress({
        total: scenarios.length,
        completed,
        currentId: scenario.id,
      });

      let result: BatchScenarioResult<TRenderOutput>;
      try {
        result = processScenario(scenario);
      } catch (err) {
        result = {
          kind: 'error',
          scenarioId: scenario.id,
          error: err instanceof Error ? err.message : String(err),
        };
      }

      callbacks.onScenarioResult(result);
      completed += 1;
    }

    chunkStart = chunkEnd;

    if (chunkStart >= scenarios.length) {
      callbacks.onProgress({ total: scenarios.length, completed });
      callbacks.onDone({ completed, aborted: false });
      return;
    }

    // Giv kontrollen tilbage til browseren inden næste chunk
    setTimeout(processNextChunk, 0);
  };

  // Start første chunk
  setTimeout(processNextChunk, 0);

  return abort;
};
