import {
  computeEetSnapshot,
  EMPTY_EET_FORLIG_INPUT,
  type EetSnapshotInput,
} from '../../domain/erhvervsevnetab/eetSnapshot';

type EetSnapshotTestInput = Omit<EetSnapshotInput, 'forlig'> & Readonly<{
  forlig?: EetSnapshotInput['forlig'];
}>;

/** Testfixture-default; produktionsporten kræver altid et eksplicit forligsinput. */
export const computeEetSnapshotForTest = (input: EetSnapshotTestInput) =>
  computeEetSnapshot({
    ...input,
    forlig: input.forlig ?? EMPTY_EET_FORLIG_INPUT,
  });
