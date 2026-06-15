import * as React from 'react';

import type { SetValuesUpdater } from '../hooks/usePersistedForm';
import type { RowId, WithId } from './types';
import { useRowDrafts, type UseRowDraftsConfig, type UseRowDraftsResult } from './useRowDrafts';

/**
 * Fælles wiring for de per-tabel row-hooks (TAF, rentekrav, ferie, fravær, øvrige krav,
 * svie/smerte): de er alle `useRowDrafts(...)` bundet til én slice af et større persisteret
 * values-objekt, plus en `committedRowsEnsured`/`committedById`-projektion.
 *
 * Tidligere reimplementerede hver hook den samme `getCommitted`/`setCommitted`-updater og de
 * to memo'er inline. Denne factory ejer mønstret ét sted; de konkrete hooks leverer kun
 * slice-vælgeren og row-modellen (jf. 7.4-konsolideringen, krydsref. 13.4/14.2).
 *
 * Adfærds-neutral: `getCommitted` læser slicen fra `values` (samme closure som før), og
 * `setCommitted`-updateren læser altid slicen fra det `prev`-snapshot caller leverer (ikke en
 * stale closure), præcis som de håndskrevne hooks gjorde.
 */
export type UseSliceRowDraftsConfig<
  TValues extends object,
  TDraft extends WithId,
  TCommitted extends WithId,
  TField extends keyof TDraft & string,
> = Readonly<{
  values: TValues;
  setValues: SetValuesUpdater<TValues>;
  resyncToken: unknown;

  /** Læs den persisterede række-slice ud af values. */
  getSlice: (values: TValues) => TCommitted[] | undefined;
  /** Skriv en ny række-slice tilbage i values (immutabelt). */
  setSlice: (values: TValues, rows: TCommitted[]) => TValues;
}> &
  Pick<
    UseRowDraftsConfig<TDraft, TCommitted, TField>,
    | 'toDraft'
    | 'toCommittedRow'
    | 'isRowEmpty'
    | 'ensureRows'
    | 'createId'
    | 'createEmptyCommittedRow'
    | 'fieldColIndex'
  >;

export type UseSliceRowDraftsResult<
  TDraft extends WithId,
  TCommitted extends WithId,
  TField extends keyof TDraft & string,
> = UseRowDraftsResult<TDraft, TField> &
  Readonly<{
    committedRowsEnsured: readonly TCommitted[];
    committedById: ReadonlyMap<string, TCommitted>;
  }>;

export const useSliceRowDrafts = <
  TValues extends object,
  TDraft extends WithId,
  TCommitted extends WithId,
  TField extends keyof TDraft & string,
>(
  config: UseSliceRowDraftsConfig<TValues, TDraft, TCommitted, TField>
): UseSliceRowDraftsResult<TDraft, TCommitted, TField> => {
  const {
    values,
    setValues,
    resyncToken,
    getSlice,
    setSlice,
    toDraft,
    toCommittedRow,
    isRowEmpty,
    ensureRows,
    createId,
    createEmptyCommittedRow,
    fieldColIndex,
  } = config;

  const rowDrafts = useRowDrafts<TDraft, TCommitted, TField>({
    getCommitted: () => getSlice(values),
    setCommitted: (updater, origin) => {
      setValues((prev) => {
        const nextRows = updater(getSlice(prev));
        if (!nextRows) return prev;
        return setSlice(prev, nextRows);
      }, origin);
    },
    toDraft,
    toCommittedRow,
    isRowEmpty,
    ensureRows,
    createId,
    createEmptyCommittedRow,
    fieldColIndex,
    resyncToken,
  });

  // Afhæng kun af den relevante slice (ikke hele values-objektet), så ensureRows ikke kører
  // igen ved enhver committed ændring andetsteds i formen.
  const slice = getSlice(values);
  const committedRowsEnsured = React.useMemo(() => ensureRows(slice), [ensureRows, slice]);
  const committedById = React.useMemo(
    () => new Map(committedRowsEnsured.map((row): readonly [RowId, TCommitted] => [row.id, row])),
    [committedRowsEnsured]
  );

  return { ...rowDrafts, committedRowsEnsured, committedById };
};
