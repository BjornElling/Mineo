/**
 * EO-adapter til batch-review.
 *
 * Oversætter et EO-scenarie (StamdataValues + ErstatningsopgoerelseValues)
 * til en beregnet EoSnapshot med tilhørende EoModel.
 *
 * Bruger udelukkende de autoritative entry points — ingen reimplementering af logik.
 */

import { computeEoSnapshot } from '../../../domain/erstatningsopgoerelse/snapshot/eoSnapshot';
import { eoSnapshotToEoPdfDocument } from '../../../domain/erstatningsopgoerelse/snapshot/eoSnapshotToEoPdfDocument';
import type { EoSnapshot } from '../../../domain/erstatningsopgoerelse/snapshot/eoSnapshot';
import type { EoModel } from '../../../domain/erstatningsopgoerelse/shared/eoTypes';
import type { StamdataValues } from '../../../schemas/formSchemas/sections/stamdataSchemas';
import type { ErstatningsopgoerelseValues } from '../../../schemas/formSchemas/sections/erstatningsopgoerelseSchemas';

export type EoScenarioInput = {
  readonly stamdataValues: StamdataValues;
  readonly eoValues: ErstatningsopgoerelseValues;
};

export type EoAdapterResult =
  | { readonly kind: 'ok'; readonly snapshot: EoSnapshot; readonly pdfModel: EoModel }
  | { readonly kind: 'blocked'; readonly snapshot: EoSnapshot; readonly message: string }
  | { readonly kind: 'error'; readonly message: string };

/**
 * Beregner EoSnapshot og bygger EoModel for et EO-scenarie.
 *
 * Returnerer 'blocked' hvis snapshottet ikke kan producere et PDF-dokument
 * (fx pga. valideringsfejl der forhindrer autoritativ beregning).
 */
export const computeEoScenario = (
  input: EoScenarioInput,
  revision: string = 'batch-review'
): EoAdapterResult => {
  let snapshot: EoSnapshot;
  try {
    snapshot = computeEoSnapshot({
      revision,
      stamdataValues: input.stamdataValues,
      eoValues: input.eoValues,
    });
  } catch (err) {
    return {
      kind: 'error',
      message: err instanceof Error ? err.message : String(err),
    };
  }

  const pdfProjection = eoSnapshotToEoPdfDocument(snapshot);

  if (pdfProjection.kind === 'blocked') {
    return {
      kind: 'blocked',
      snapshot,
      message: pdfProjection.message,
    };
  }

  return {
    kind: 'ok',
    snapshot,
    pdfModel: pdfProjection.document,
  };
};
