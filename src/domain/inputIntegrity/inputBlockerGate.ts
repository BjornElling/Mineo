/**
 * Bro mellem den generiske input-integritets-kontrakt (`inputBlocker.ts`) og det tværgående
 * dokument-gate-primitiv (`documentGateTypes.ts`). Hvert domæne bygger sin
 * `DocumentDownloadGateResult` ved at samle sine blockers og filtrere på det scope, det
 * pågældende output afhænger af — så et per-række-dokument kun blokeres af SIN egen rækkes
 * blockers, mens et aggregat blokeres af enhver relevant blocker (jf. document-output-contract.md
 * §A2.1 og draft-commit-greenfield-design.md §5.2).
 */
import {
  allowDocumentDownload,
  blockDocumentDownload,
  type DocumentDownloadGateResult,
} from '../../document/layout/documentGateTypes';
import { formatInputBlockerMessage, type InputBlocker } from './inputBlocker';

/**
 * Returnerer de blockers, der er relevante for et output afgrænset til `rowId`.
 * - Er `rowId` udeladt (aggregat/sektions-output): alle blockers er relevante.
 * - Er `rowId` angivet (per-række-output): kun `global`/`section`-blockers samt `row`-blockers
 *   for netop den række — de øvrige rækkers `row`-blockers ignoreres, så de ikke over-blokerer.
 */
export const blockersForScope = (
  blockers: readonly InputBlocker[],
  rowId?: string
): readonly InputBlocker[] => {
  if (rowId === undefined) return blockers;
  return blockers.filter((b) => b.scope.kind !== 'row' || b.scope.rowId === rowId);
};

/**
 * Bygger et `DocumentDownloadGateResult` af blockers. Er der ingen relevante blockers, tillades
 * download. Den første relevante blocker bærer den viste årsag (samme "første grund"-semantik som
 * de øvrige gates); `code` afledes af blocker-årsagen.
 *
 * `codePrefix` navngiver domænet i den auditerbare `code` (fx `satser`, `renteberegning`).
 */
export const documentGateFromBlockers = (
  blockers: readonly InputBlocker[],
  codePrefix: string,
  rowId?: string
): DocumentDownloadGateResult => {
  const relevant = blockersForScope(blockers, rowId);
  if (relevant.length === 0) return allowDocumentDownload();
  const first = relevant[0]!;
  return blockDocumentDownload({
    code: `${codePrefix}:${first.reason}-input`,
    message: formatInputBlockerMessage(first),
  });
};
