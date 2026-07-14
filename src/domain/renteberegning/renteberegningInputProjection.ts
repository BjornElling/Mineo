import type { RateEntry } from '../../data/interestRates';
import type { RentekravRow } from '../../schemas/formSchemas';
import type { ISODateString } from '../../types/branded';
import {
  blockedInputProjection,
  readyInputProjection,
  type InputBlocker,
  type InputProjection,
} from '../inputIntegrity/inputBlocker';
import { blockersForScope } from '../inputIntegrity/inputBlockerGate';
import { computeRentekravRow, type RentekravRowResult } from './renteberegningEngine';
import { buildRenteInputBlockers } from './renteInputIntegrity';
import { isRentekravRowEmpty } from './rowEmpty';

export type RenteAggregateProjectionData = Readonly<{
  pdfContexts: ReadonlyMap<string, NonNullable<RentekravRowResult['pdfContext']>>;
  anyRowHasError: boolean;
}>;

export type RenteberegningInputProjection = Readonly<{
  revision: number;
  blockers: readonly InputBlocker[];
  rowProjections: ReadonlyMap<string, InputProjection<RentekravRowResult>>;
  aggregateProjection: InputProjection<RenteAggregateProjectionData>;
}>;

/**
 * Én kanonisk projektion til både tabelvisning og alle dokumentgates. En blokeret række beregnes
 * bevidst ikke, så en tidligere canonical værdi bag en ugyldig maske aldrig når motoren.
 */
export const buildRenteberegningInputProjection = (args: Readonly<{
  beregningsdato: ISODateString | undefined;
  committedRentekravById: ReadonlyMap<string, RentekravRow>;
  invalidDrafts: Readonly<Record<string, string>>;
  referenceRates: ReadonlyArray<RateEntry>;
  surchargeRates: ReadonlyArray<RateEntry>;
  revision: number;
}>): RenteberegningInputProjection => {
  const {
    beregningsdato,
    committedRentekravById,
    invalidDrafts,
    referenceRates,
    surchargeRates,
    revision,
  } = args;
  const blockers = buildRenteInputBlockers(invalidDrafts);
  const rowProjections = new Map<string, InputProjection<RentekravRowResult>>();
  const pdfContexts = new Map<string, NonNullable<RentekravRowResult['pdfContext']>>();
  let anyRowHasError = false;

  for (const [rowId, committedRow] of committedRentekravById) {
    const rowBlockers = blockersForScope(blockers, rowId);
    if (rowBlockers.length > 0) {
      rowProjections.set(rowId, blockedInputProjection(rowBlockers, revision));
      continue;
    }

    const result = computeRentekravRow(
      committedRow,
      beregningsdato,
      referenceRates,
      surchargeRates
    );
    rowProjections.set(rowId, readyInputProjection(result, revision));
    if (isRentekravRowEmpty(committedRow)) continue;
    if (result.pdfContext === null) {
      anyRowHasError = true;
    } else {
      pdfContexts.set(rowId, result.pdfContext);
    }
  }

  const aggregateProjection = blockers.length > 0
    ? blockedInputProjection<RenteAggregateProjectionData>(blockers, revision)
    : readyInputProjection({ pdfContexts, anyRowHasError }, revision);

  return { revision, blockers, rowProjections, aggregateProjection };
};
