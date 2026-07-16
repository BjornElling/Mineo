/**
 * Bro mellem den greenfield Fase-2 input-kerne (`src/input/inputProjection.ts`) og det tværgående
 * dokument-gate-primitiv (`documentGateTypes.ts`). Søster til `domain/inputIntegrity/inputBlockerGate.ts`,
 * men bygget på den fælles `InputProjection`/`InputIssue`-model i stedet for den hånd-rullede
 * inputIntegrity-kontrakt. Domæner, der er migreret til input-kernen, bygger deres
 * `DocumentDownloadGateResult` herfra.
 *
 * Ethvert dokument-blokerende issue (severity `error`) på projektionen blokerer download — både
 * blocked-grenens blockers og en eventuel ready-grens error-issues (fx range/bounds med canonical
 * værdi), jf. draft-commit-greenfield-design.md §5.4/§6. Den første bærer den viste årsag (samme
 * "første grund"-semantik som de øvrige gates); `code` afledes af issue-årsagen.
 */
import {
  allowDocumentDownload,
  blockDocumentDownload,
  type DocumentDownloadGateResult,
} from './documentGateTypes';
import { isDocumentBlockingIssue } from '../../input/inputIssue';
import type { InputProjection } from '../../input/inputProjection';

/**
 * `codePrefix` navngiver domænet i den auditerbare `code` (fx `satser`, `renteberegning`), så det
 * matcher den eksisterende gate-konvention `${prefix}:${reason}-input`.
 */
export const documentGateFromInputProjection = (
  projection: InputProjection<unknown>,
  codePrefix: string
): DocumentDownloadGateResult => {
  const first = projection.issues.filter(isDocumentBlockingIssue)[0];
  if (first === undefined) return allowDocumentDownload();
  return blockDocumentDownload({
    code: `${codePrefix}:${first.reason}-input`,
    message: first.message,
  });
};
