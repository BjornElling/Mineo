import type { FieldDescriptor } from '../../inputCore/fieldDescriptor';
import {
  eoAngivetLoenFields,
  eoAngivetLoenManual,
  eoEmploymentFields,
  eoEmploymentManual,
  type ManualBindings,
} from '../../inputCore/catalog/erstatningsopgoerelseLoenDescriptors';
import type { LoenudviklingSource } from '../erstatningsopgoerelse/helpers/angivetLoenHelpers';
import {
  MANUEL_ANGIVET_SUPPLEMENT_FELTER,
  hasFinitePct,
  isManuelAngivetRowAktiv,
  isManuelAngivetRowDatoUdfyldt,
  isManuelProcentsatsRowAktiv,
  isManuelProcentsatsRowKomplet,
  type ManuelAngivetSupplementFelt,
} from '../erstatningsopgoerelse/helpers/manuelReguleringRowPredicates';
import type { EoIssueFocusTarget } from './eoRowTypes';

const MANUEL_REGULERING_MANGLE = 'Manuel regulering mangler';

export type ManualRegulationIssue = Readonly<{
  message: string;
  focusTarget: EoIssueFocusTarget;
}>;

type ManualOwner =
  | Readonly<{ kind: 'employment'; id: string }>
  | Readonly<{ kind: 'angivetLoen' }>;

const fieldTarget = <T>(descriptor: FieldDescriptor<T>, owner: ManualOwner, rowId?: string): EoIssueFocusTarget => ({
  kind: 'fieldAddress',
  address: owner.kind === 'employment'
    ? rowId === undefined ? descriptor.bind(owner.id).address : descriptor.bind(owner.id, rowId).address
    : rowId === undefined ? descriptor.bind().address : descriptor.bind(rowId).address,
});

const collectionFieldTarget = <T>(
  descriptor: FieldDescriptor<T>,
): EoIssueFocusTarget => ({
  kind: 'collectionField',
  template: descriptor.template,
});

const manualSupplementField = (
  bindings: ManualBindings,
  field: ManuelAngivetSupplementFelt,
): FieldDescriptor<number | undefined> => {
  switch (field) {
    case 'feriepenge': return bindings.manualFields.feriepenge;
    case 'shSoSats': return bindings.manualFields.shSoSats;
    case 'fritvalg': return bindings.manualFields.fritvalg;
    case 'agPension': return bindings.manualFields.agPension;
    default: {
      const _exhaustive: never = field;
      return _exhaustive;
    }
  }
};

const ownerSupplementField = (
  owner: ManualOwner,
  field: ManuelAngivetSupplementFelt,
): FieldDescriptor<number | undefined> | undefined => {
  if (owner.kind === 'angivetLoen') {
    return field === 'feriepenge' ? eoAngivetLoenFields.feriePct : undefined;
  }

  switch (field) {
    case 'feriepenge': return eoEmploymentFields.feriePct;
    case 'shSoSats': return eoEmploymentFields.shSoPct;
    case 'fritvalg': return eoEmploymentFields.fritvalgPct;
    case 'agPension': return eoEmploymentFields.pensionPct;
    default: {
      const _exhaustive: never = field;
      return _exhaustive;
    }
  }
};

const createIssue = (
  label: string,
  focusTarget: EoIssueFocusTarget,
): ManualRegulationIssue => ({
  message: `${MANUEL_REGULERING_MANGLE}: ${label}`,
  focusTarget,
});

const resolveManueltAngivetIssue = (
  source: LoenudviklingSource,
  owner: ManualOwner,
  bindings: ManualBindings,
): ManualRegulationIssue | undefined => {
  const rows = source.loenudviklingManuelTableData ?? [];
  const aktiveRows = rows.filter(isManuelAngivetRowAktiv);

  if (aktiveRows.length === 0) {
    return createIssue(
      bindings.manualFields.grundloen.label,
      collectionFieldTarget(bindings.manualFields.grundloen),
    );
  }

  const manglendeGrundloen = aktiveRows.find((row) => row.grundloen === undefined);
  if (manglendeGrundloen) {
    return createIssue(
      bindings.manualFields.grundloen.label,
      fieldTarget(bindings.manualFields.grundloen, owner, manglendeGrundloen.id),
    );
  }

  // Basisrækken har en programstyret dato. Datoen skal kun udfyldes på brugerens efterfølgende rækker.
  const manglendeDato = rows
    .slice(1)
    .find((row) => aktiveRows.includes(row) && !isManuelAngivetRowDatoUdfyldt(row));
  if (manglendeDato) {
    return createIssue(
      bindings.manualFields.dato.label,
      fieldTarget(bindings.manualFields.dato, owner, manglendeDato.id),
    );
  }

  const usedSupplements = MANUEL_ANGIVET_SUPPLEMENT_FELTER.filter((field) =>
    aktiveRows.some((row) => hasFinitePct(row[field]))
  );
  for (const field of usedSupplements) {
    const manglendeRow = aktiveRows.find((row) => !hasFinitePct(row[field]));
    if (!manglendeRow) continue;

    // Ved procenttillæg er basissats-cellerne låste og henter deres værdi fra felterne over tabellen.
    // Det er netop den kobling, der ellers kun blev synlig som et blink på hele ansættelseskortet.
    const topField = ownerSupplementField(owner, field);
    if (manglendeRow === rows[0] && source.tillaegAngivesSom !== 'beloeb' && topField) {
      return createIssue(topField.label, fieldTarget(topField, owner));
    }

    const tableField = manualSupplementField(bindings, field);
    return createIssue(tableField.label, fieldTarget(tableField, owner, manglendeRow.id));
  }

  return undefined;
};

const resolveManuelProcentsatsIssue = (
  source: LoenudviklingSource,
  owner: ManualOwner,
  bindings: ManualBindings,
): ManualRegulationIssue | undefined => {
  const rows = (source.loenudviklingManuelProcentsatsTableData ?? []).slice(1);
  const aktiveRows = rows.filter(isManuelProcentsatsRowAktiv);
  if (aktiveRows.length === 0) return undefined;

  const manglendeDato = aktiveRows.find((row) => row.dato === undefined);
  if (manglendeDato) {
    return createIssue(
      bindings.manualPercentFields.dato.label,
      fieldTarget(bindings.manualPercentFields.dato, owner, manglendeDato.id),
    );
  }

  const manglendeProcent = aktiveRows.find((row) => !isManuelProcentsatsRowKomplet(row));
  if (manglendeProcent) {
    return createIssue(
      bindings.manualPercentFields.procent.label,
      fieldTarget(bindings.manualPercentFields.procent, owner, manglendeProcent.id),
    );
  }

  return undefined;
};

/** Finder det første konkrete input, som den samlede manuel-regulering-række kan forklare. */
export const resolveManualRegulationIssue = (
  source: LoenudviklingSource,
  basis: 'Manuelt angivet' | 'Manuel procentsats',
  isEmployment: boolean,
): ManualRegulationIssue | undefined => {
  const owner: ManualOwner = isEmployment
    ? { kind: 'employment', id: source.id }
    : { kind: 'angivetLoen' };
  const bindings = isEmployment ? eoEmploymentManual : eoAngivetLoenManual;

  return basis === 'Manuelt angivet'
    ? resolveManueltAngivetIssue(source, owner, bindings)
    : resolveManuelProcentsatsIssue(source, owner, bindings);
};
