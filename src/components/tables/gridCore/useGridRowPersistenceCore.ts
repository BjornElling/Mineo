import * as React from 'react';

import { reconcileGridRowIdentityForRestore } from './gridModel';
import { useCriticalActionParticipant } from '../../../criticalActions/CriticalActionContext';

/**
 * Fælles persist-/resync-kerne for de tabel-lokale grid-tabeller (Standard løn, Offentlige ydelser,
 * EET ASL-afgørelser, Lønudvikling manuel). Disse tabeller ejer selv deres committed rækkeliste
 * (hvert `Table*Input` ejer sin draft indtil blur), og delte tidligere den samme — men subtilt
 * divergerende — pipeline til at gemme og resynkronisere. Divergenserne var utilsigtet drift:
 *
 * - Standard løn manglede row-id-reconcile ved resync → undo/redo kunne miste celle-fokus
 *   (fokus-målet `rowId:colIndex` pegede på et id der var regenereret). De øvrige reconcilede.
 * - Tre tabeller persisterede den syntetiske efterfølgende tomme række; EET strippede den. Kun
 *   bruger-indtastede rækker bør gemmes (jf. save/load-kontrakten "Persistér kun brugerindtastet data").
 * - Tre forskellige flush-guard-strategier.
 *
 * Denne kerne samler de tre ting ét sted, så adfærden er ufravigeligt ens på tværs af tabellerne:
 * 1) **Strip tomme rækker ved persist** — kun non-empty rækker sendes til `onTableDataChange`.
 * 2) **Reconcile ved resync** — ikke-tomme indgående rækker beholder deres committed id, mens
 *    tomme syntetiske rækker kan arve et tidligere id, og ikke-tomme id-skift får undo-fokus-alias.
 * 3) **Fingerprint-bevogtet flush** — det køede payload persisteres kun, hvis dets fingerprint
 *    stadig matcher den aktuelle (strippede) state; ellers droppes det (stale).
 *
 * Alle fingerprints beregnes over den **strippede** (non-empty) rækkeliste, så persist-siden og
 * resync-sammenligningen bruger samme grundlag og ikke kan drifte fra hinanden.
 *
 * Komponenten beholder selv: normalisering (`normalizeRows`), commit-handler (med evt. fokus-plan),
 * sortering, validering og rendering. Kernen rører ikke fokus-planer — de bygges i komponentens
 * commit-handler ud fra den `lastPersistedFingerprintRef`/`getStrippedFingerprint` kernen eksponerer.
 */
export type GridRowPersistencePending<TRow> = Readonly<{
  rows: TRow[];
  fingerprint: string;
  fieldPath?: string;
  completion: Readonly<{
    promise: Promise<void>;
    resolve: () => void;
    reject: (reason: unknown) => void;
  }>;
}>;

export type UseGridRowPersistenceCoreConfig<TRow> = Readonly<{
  tableData: readonly TRow[];
  onTableDataChange?: (rows: TRow[], origin?: Readonly<{ fieldPath?: string }>) => void;
  /** Normaliser en rækkeliste (min-rows + én efterfølgende tom række; evt. låst basisrække). */
  normalizeRows: (rows: readonly TRow[]) => TRow[];
  isRowEmpty: (row: TRow) => boolean;
  getRowId: (row: TRow) => string;
  withRowId: (row: TRow, id: string) => TRow;
  /** Fingerprint af de angivne rækker; kernen anvender det altid på den strippede (non-empty) liste. */
  fingerprint: (rows: readonly TRow[]) => string;
  /**
   * Antal ledende rækker der ALDRIG strippes, uanset om de er tomme (strukturelle anker-rækker,
   * ikke bruger-data-rækker). Default 0. Lønudvikling manuel sætter 1 for sin låste basisrække:
   * den ligger altid på indeks 0 (jf. `normalizeRows`), og hvis en tom basisrække blev strippet,
   * ville `rows[0]` på næste load være en tail-række → basisrækken ville blive fejltolket.
   */
  keepLeadingRows?: number;
}>;

export type UseGridRowPersistenceCoreApi<TRow> = Readonly<{
  internalTableData: TRow[];
  setInternalTableData: React.Dispatch<React.SetStateAction<TRow[]>>;
  /** `lastPersistedFingerprintRef` (strippet grundlag) — til komponentens `evaluateRowCommit`. */
  lastPersistedFingerprintRef: React.MutableRefObject<string | null>;
  /** Fingerprint af rækkerne efter stripning af tomme — det grundlag persist/flush/resync bruger. */
  getStrippedFingerprint: (rows: readonly TRow[]) => string;
  /** Kø et normaliseret commit-resultat til persistering (strippes ved flush). Udelad fieldPath ved reorder. */
  queuePersist: (normalizedRows: readonly TRow[], fieldPath?: string) => void;
  /** Fokus-aliaser for en celle efter undo/redo-resync. Må kun bruges til restore-attributter. */
  getUndoFieldPathAliases: (rowId: string, colIndex: number) => readonly string[];
}>;

const stripPersistableRows = <TRow>(
  rows: readonly TRow[],
  isRowEmpty: (row: TRow) => boolean,
  keepLeadingRows: number
): TRow[] => {
  if (keepLeadingRows <= 0) return rows.filter((row) => !isRowEmpty(row));
  // De ledende anker-rækker beholdes altid (uanset tomhed); resten strippes for tomme.
  return [...rows.slice(0, keepLeadingRows), ...rows.slice(keepLeadingRows).filter((row) => !isRowEmpty(row))];
};

export const useGridRowPersistenceCore = <TRow>(
  config: UseGridRowPersistenceCoreConfig<TRow>
): UseGridRowPersistenceCoreApi<TRow> => {
  const criticalActionParticipantId = React.useId();
  const { tableData, onTableDataChange, normalizeRows, isRowEmpty, getRowId, withRowId, fingerprint, keepLeadingRows = 0 } = config;

  const getStrippedFingerprint = React.useCallback(
    (rows: readonly TRow[]): string => fingerprint(stripPersistableRows(rows, isRowEmpty, keepLeadingRows)),
    [fingerprint, isRowEmpty, keepLeadingRows]
  );

  // Konfig læses via ref i effekter/callbacks, så identitets-skift på funktions-props ikke
  // gentriggerer effekter utilsigtet (kun de bevidste deps styrer kørsel).
  const stableRef = React.useRef({ onTableDataChange, isRowEmpty, getStrippedFingerprint, getRowId, withRowId, keepLeadingRows });
  React.useLayoutEffect(() => {
    stableRef.current = { onTableDataChange, isRowEmpty, getStrippedFingerprint, getRowId, withRowId, keepLeadingRows };
  });

  const incomingNormalized = React.useMemo(() => normalizeRows(tableData), [normalizeRows, tableData]);

  const [internalTableData, setInternalTableData] = React.useState<TRow[]>(() => incomingNormalized);
  const [undoAliasRowIdsByRowId, setUndoAliasRowIdsByRowId] = React.useState<ReadonlyMap<string, readonly string[]>>(
    () => new Map()
  );
  const internalTableDataRef = React.useRef<TRow[]>(incomingNormalized);
  const lastPersistedFingerprintRef = React.useRef<string | null>(getStrippedFingerprint(incomingNormalized));
  const pendingPersistRef = React.useRef<GridRowPersistencePending<TRow> | null>(null);

  React.useLayoutEffect(() => {
    internalTableDataRef.current = internalTableData;
  }, [internalTableData]);

  const setInternalTableDataPublic = React.useCallback<React.Dispatch<React.SetStateAction<TRow[]>>>((action) => {
    setUndoAliasRowIdsByRowId((current) => (current.size === 0 ? current : new Map()));
    setInternalTableData(action);
  }, []);

  const queuePersist = React.useCallback((normalizedRows: readonly TRow[], fieldPath?: string) => {
    const { isRowEmpty: empty, getStrippedFingerprint: fp, keepLeadingRows: keep } = stableRef.current;
    // Last-write-wins: en nyere payload erstatter den tidligere før effekt-flush. Den tidligere
    // kvittering kan afsluttes, fordi kun den nye payload nu er autoritativt ventepunkt.
    pendingPersistRef.current?.completion.resolve();
    let resolveCompletion: () => void = () => undefined;
    let rejectCompletion: (reason: unknown) => void = () => undefined;
    const promise = new Promise<void>((resolve, reject) => {
      resolveCompletion = resolve;
      rejectCompletion = reject;
    });
    // Forhindr en global unhandled-rejection, hvis React unmount'er tabellen uden at en
    // kritisk handling aktuelt afventer kvitteringen.
    void promise.catch(() => undefined);
    pendingPersistRef.current = {
      rows: stripPersistableRows(normalizedRows, empty, keep),
      fingerprint: fp(normalizedRows),
      fieldPath,
      completion: {
        promise,
        resolve: resolveCompletion,
        reject: rejectCompletion,
      },
    };
  }, []);

  const awaitPendingCommits = React.useCallback(async (): Promise<void> => {
    while (true) {
      const pending = pendingPersistRef.current;
      if (!pending) return;
      await pending.completion.promise;
      // En nyere last-write-wins-payload kan være blevet køet, mens den tidligere
      // blev persisteret. Fortsæt indtil pipeline-ref'en faktisk er tom.
    }
  }, []);

  useCriticalActionParticipant({
    id: `commit-pipeline:${criticalActionParticipantId}`,
    kind: 'commit-pipeline',
    awaitPendingCommit: awaitPendingCommits,
  });

  const getUndoFieldPathAliases = React.useCallback(
    (rowId: string, colIndex: number): readonly string[] => {
      const aliasRowIds = undoAliasRowIdsByRowId.get(rowId);
      if (!aliasRowIds || aliasRowIds.length === 0) return [];
      return aliasRowIds.map((aliasRowId) => `${aliasRowId}:${colIndex}`);
    },
    [undoAliasRowIdsByRowId]
  );

  // Flush: persistér kun det køede payload, hvis det stadig matcher den aktuelle strippede state.
  React.useEffect(() => {
    const pending = pendingPersistRef.current;
    if (!pending) return;
    const { onTableDataChange: onChange, getStrippedFingerprint: fp } = stableRef.current;
    if (pending.fingerprint !== fp(internalTableData)) {
      pendingPersistRef.current = null;
      pending.completion.resolve();
      return;
    }
    pendingPersistRef.current = null;
    if (!onChange) {
      pending.completion.resolve();
      return;
    }
    // pending.rows er allerede strippet; pending.fingerprint er fingerprintet af præcis dem.
    lastPersistedFingerprintRef.current = pending.fingerprint;
    try {
      onChange(pending.rows, pending.fieldPath ? { fieldPath: pending.fieldPath } : undefined);
      pending.completion.resolve();
    } catch (error) {
      pending.completion.reject(error);
      throw error;
    }
  }, [internalTableData]);

  React.useEffect(() => () => {
    const pending = pendingPersistRef.current;
    pendingPersistRef.current = null;
    pending?.completion.reject(new Error('Grid-rækkens persistence-deltager blev afmonteret før commit var afsluttet.'));
  }, []);

  // Resync fra prop (load, undo/redo, ekstern ændring): reconcile bevarer rækkernes id positionelt,
  // så en celles undo-fokus-mål overlever. Springes over når intet materielt ændrede sig.
  React.useEffect(() => {
    const { getStrippedFingerprint: fp, getRowId: rowId, withRowId: setRowId } = stableRef.current;
    const fingerprintValue = fp(incomingNormalized);
    if (fingerprintValue === lastPersistedFingerprintRef.current) return;
    lastPersistedFingerprintRef.current = fingerprintValue;
    pendingPersistRef.current?.completion.resolve();
    pendingPersistRef.current = null;
    const reconciled = reconcileGridRowIdentityForRestore({
      incoming: incomingNormalized,
      current: internalTableDataRef.current,
      getRowId: rowId,
      isRowEmpty: stableRef.current.isRowEmpty,
      withRowId: setRowId,
    });
    setUndoAliasRowIdsByRowId(reconciled.undoAliasRowIdsByRowId);
    setInternalTableData(reconciled.rows);
  }, [incomingNormalized]);

  return {
    internalTableData,
    setInternalTableData: setInternalTableDataPublic,
    lastPersistedFingerprintRef,
    getStrippedFingerprint,
    queuePersist,
    getUndoFieldPathAliases,
  };
};
