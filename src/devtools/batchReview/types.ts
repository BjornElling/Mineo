/**
 * Fælles typer for batch-review systemet.
 *
 * Disse typer er generiske og domæne-agnostiske — konkrete domæneadaptere
 * specialiserer dem via TInput og TRenderOutput.
 */

export type BatchScenario<TInput> = {
  readonly id: string;
  readonly title: string;
  readonly description?: string;
  readonly tags: readonly string[];
  readonly input: TInput;
  readonly parameterSummary: readonly { readonly label: string; readonly value: string }[];
};

export type BatchProfile = 'basis' | 'udvidet' | 'alle';

export type BatchRunConfig = {
  readonly profile: BatchProfile;
  readonly maxScenarier?: number;
};

export type BatchScenarioResult<TRenderOutput> =
  | { readonly kind: 'ok'; readonly scenarioId: string; readonly output: TRenderOutput }
  | { readonly kind: 'blocked'; readonly scenarioId: string; readonly message: string }
  | { readonly kind: 'error'; readonly scenarioId: string; readonly error: string };
