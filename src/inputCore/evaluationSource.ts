import { z } from 'zod';

// Inputkernen (§3.4): issue-snapshots, consumerprojektioner og PreparedDocument bindes til ét
// EvaluationSourceToken. Tokenet omfatter BÅDE inputrevision OG settingsrevision, så en ændring i
// AppSettings gør et resultat stale på samme måde som en ændring i input.

const monotonicRevisionSchema = z.number().int().nonnegative()
  .refine(Number.isSafeInteger, 'Revision skal være et sikkert heltal');

export const inputRevisionSchema = monotonicRevisionSchema.brand<'InputRevision'>();
export type InputRevision = z.infer<typeof inputRevisionSchema>;

export const settingsRevisionSchema = monotonicRevisionSchema.brand<'SettingsRevision'>();
export type SettingsRevision = z.infer<typeof settingsRevisionSchema>;

export const createInputRevision = (value: number): InputRevision => inputRevisionSchema.parse(value);
export const createSettingsRevision = (value: number): SettingsRevision => settingsRevisionSchema.parse(value);

export type EvaluationSourceToken = Readonly<{
  inputRevision: InputRevision;
  settingsRevision: SettingsRevision;
}>;

export const createEvaluationSourceToken = (
  inputRevision: InputRevision,
  settingsRevision: SettingsRevision
): EvaluationSourceToken => Object.freeze({ inputRevision, settingsRevision });

export const sourceTokensEqual = (left: EvaluationSourceToken, right: EvaluationSourceToken): boolean =>
  left.inputRevision === right.inputRevision && left.settingsRevision === right.settingsRevision;

const STABLE_SOURCE_RETRY_COUNT = 3;

/**
 * Stabil dobbeltlæsning (§3.4): læs token, læs data, læs token igen. Kun hvis før/efter-tokenet er
 * identisk må data og token bruges sammen. Ved samtidig ændring forsøges igen; kan et stabilt snapshot
 * ikke opnås inden for retrygrænsen, stoppes operationen fail-closed som en transient systemfejl.
 *
 * Ren og framework-fri: kalderen leverer `readToken`/`readData`. Runtime-bindingen (inputkernen) leverer de
 * konkrete store-læsninger.
 */
export const captureStableSource = <T>(
  readToken: () => EvaluationSourceToken,
  readData: () => T
): Readonly<{ token: EvaluationSourceToken; data: T }> => {
  for (let attempt = 0; attempt <= STABLE_SOURCE_RETRY_COUNT; attempt += 1) {
    const before = readToken();
    const data = readData();
    const after = readToken();
    if (sourceTokensEqual(before, after)) return Object.freeze({ token: before, data });
  }
  throw new Error('EvaluationSource: kunne ikke optage et stabilt kildesnapshot (transient systemfejl)');
};
