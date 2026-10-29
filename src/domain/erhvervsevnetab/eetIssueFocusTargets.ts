import type { FieldAddress } from '../../inputCore/fieldAddress';
import {
  type FieldAddressTemplate,
} from '../../inputCore/fieldDescriptor';
import {
  aslAfgoerelseAfgoerelsesDatoField,
  aslAfgoerelseAfgoerelseTypeField as aslTypeField,
  aslAfgoerelseEetPctField,
  aslAfgoerelseKapDatoField,
  aslAfgoerelseKapPctField,
  aslAfgoerelseVirkningsDatoField,
  erhvervsevnetabBeregningsdatoField,
  erhvervsevnetabEalEetPctField,
  erhvervsevnetabKoenField,
} from '../../inputCore/catalog/erhvervsevnetabDescriptors';
import {
  faellesAarsloenAslAarsloenField,
  faellesAarsloenEalAarsloenField,
} from '../../inputCore/catalog/faellesAarsloenDescriptors';
import {
  stamdataSkadedatoField,
  stamdataSkadelidteFodselsdatoField,
} from '../../inputCore/catalog/stamdataDescriptors';
import { forligInputFields } from '../erstatningsopgoerelse/forligInputPort';
import type { AslAfgoerelseRow } from '../../schemas/formSchemas';
import type { ISODateString } from '../../types/branded';
import { coerceToISODateString } from '../../types/branded';
import type { AttentionTarget } from '../../utils/attentionTarget';
import { EET_DATO_EFTER_BEREGNINGSDATO_WARNING_ID } from './eetIssueCatalog';
import {
  ASL_IDENTICAL_AFGOERELSER_ID,
  collectIncompleteRowIssues,
  hasTextValue,
  isAslAfgoerelseRowEmpty,
  isKnownAfgoerelseType,
  parseCommittedPercent,
  validateDuplicateAfgoerelse,
  type AslIssueField,
  resolveAslVirkningsdato,
} from './eetAslAfgoerelser';
import { harEetTitrinAfvigelse, resolveEetUnder15Warning } from './eetFieldWarnings';

export type EetIssueFocusContext = Readonly<{
  aslAfgoerelser?: readonly AslAfgoerelseRow[];
  skadedato?: ISODateString;
  skadelidteFodselsdato?: ISODateString;
}>;

const STAMDATA_FIELD_BY_ISSUE_ID: Readonly<Record<string, FieldAddress>> = {
  'skadedato-missing': stamdataSkadedatoField.bind().address,
  'field-skadedato': stamdataSkadedatoField.bind().address,
  'stamdata-date-order:skadedato': stamdataSkadedatoField.bind().address,
  'skadelidte-fodselsdato-missing': stamdataSkadelidteFodselsdatoField.bind().address,
  'field-skadelidte-fodselsdato': stamdataSkadelidteFodselsdatoField.bind().address,
  'stamdata-date-order:skadelidteFodselsdato': stamdataSkadelidteFodselsdatoField.bind().address,
};

const GRUNDLAEGGENDE_FIELD_BY_ISSUE_ID: Readonly<Record<string, FieldAddress>> = {
  'beregningsdato-missing': erhvervsevnetabBeregningsdatoField.bind().address,
  'beregningsdato-invalid': erhvervsevnetabBeregningsdatoField.bind().address,
  'warn-beregningsdato-foer-skadedato': erhvervsevnetabBeregningsdatoField.bind().address,
  'field-beregningsdato': erhvervsevnetabBeregningsdatoField.bind().address,
  [EET_DATO_EFTER_BEREGNINGSDATO_WARNING_ID]: erhvervsevnetabBeregningsdatoField.bind().address,
  'missing-koen': erhvervsevnetabKoenField.bind().address,
};

const EAL_FIELD_BY_ISSUE_ID: Readonly<Record<string, FieldAddress>> = {
  'forlig-ansvarsgrad-invalid': forligInputFields.procent.bind().address,
  'field-forlig-dato': forligInputFields.dato.bind().address,
  'eal-aarsloen-missing': faellesAarsloenEalAarsloenField.bind().address,
  'eal-aarsloen-zero': faellesAarsloenEalAarsloenField.bind().address,
  'field-aarsloen-eal': faellesAarsloenEalAarsloenField.bind().address,
  'warn-eal-aarsloen-is-max': faellesAarsloenEalAarsloenField.bind().address,
  'warn-eal-aarsloen-empty-for-2024-07-01': faellesAarsloenEalAarsloenField.bind().address,
  'eal-eet-pct-invalid': erhvervsevnetabEalEetPctField.bind().address,
  'eet-pct-missing': erhvervsevnetabEalEetPctField.bind().address,
  'field-eal-eet-pct': erhvervsevnetabEalEetPctField.bind().address,
  'warn-eal-eet-under-15': erhvervsevnetabEalEetPctField.bind().address,
};

const ASL_FIELD_BY_ISSUE_ID: Readonly<Record<string, FieldAddress>> = {
  'aarsloen-missing': faellesAarsloenAslAarsloenField.bind().address,
  'asl-aarsloen-missing': faellesAarsloenAslAarsloenField.bind().address,
  'aarsloen-zero': faellesAarsloenAslAarsloenField.bind().address,
  'field-aarsloen-asl': faellesAarsloenAslAarsloenField.bind().address,
  'aarsloen-over-max': faellesAarsloenAslAarsloenField.bind().address,
  'warn-asl-aarsloen-is-max': faellesAarsloenAslAarsloenField.bind().address,
};

const ASL_FIRST_ROW_FIELD_BY_ISSUE_ID: Readonly<Record<string, FieldAddressTemplate>> = {
  'asl-afgoerelser-empty': aslAfgoerelseAfgoerelsesDatoField.template,
  'no-asl-afgoerelser-known-at-beregningsdato': aslAfgoerelseAfgoerelsesDatoField.template,
  'no-endelig-afgoerelser': aslTypeField.template,
  'missing-afgoerelsesdato': aslAfgoerelseAfgoerelsesDatoField.template,
  'missing-eet-pct': aslAfgoerelseEetPctField.template,
  'missing-afgoerelseType': aslTypeField.template,
  'missing-kap-dato': aslAfgoerelseKapDatoField.template,
  'missing-kap-pct': aslAfgoerelseKapPctField.template,
  'endelig-under-50-missing-kapitalisering': aslAfgoerelseKapDatoField.template,
  'delvist-endelig-missing-kapitalisering': aslAfgoerelseKapDatoField.template,
};

const ASL_FIELD_BY_ISSUE_FIELD: Readonly<Record<AslIssueField, { bind: (rowId: string) => { address: FieldAddress } }>> = {
  afgoerelsesDato: aslAfgoerelseAfgoerelsesDatoField,
  virkningsDato: aslAfgoerelseVirkningsDatoField,
  eetPct: aslAfgoerelseEetPctField,
  afgoerelseType: aslTypeField,
  kapDato: aslAfgoerelseKapDatoField,
  kapPct: aslAfgoerelseKapPctField,
};

const asFieldTarget = (address: FieldAddress): AttentionTarget => ({ kind: 'fieldAddress', address });
const asTemplateTarget = (template: FieldAddressTemplate): AttentionTarget => ({ kind: 'collectionField', template });
const asRowTarget = (rowId: string): AttentionTarget => ({ kind: 'rowId', rowId });

const findResolvedRows = (rows: readonly AslAfgoerelseRow[]) => rows.flatMap((row) => {
  const eetPct = parseCommittedPercent(row.eetPct);
  const afgoerelsesdato = coerceToISODateString(row.afgoerelsesDato);
  const virkningsdato = resolveAslVirkningsdato(row);
  if (eetPct === undefined || eetPct === 0 || !afgoerelsesdato || !virkningsdato || !isKnownAfgoerelseType(row.afgoerelseType)) {
    return [];
  }
  return [{ row, eetPct, afgoerelsesdato, virkningsdato, afgoerelseType: row.afgoerelseType }];
});

const findNonEndeligAfterEndeligRow = (rows: readonly AslAfgoerelseRow[]): AslAfgoerelseRow | undefined => {
  const resolved = findResolvedRows(rows);
  return resolved.find((candidate) =>
    (candidate.afgoerelseType === 'Midlertidig' || candidate.afgoerelseType === 'Delvist endelig')
    && resolved.some((endelig) =>
      endelig.afgoerelseType === 'Endelig'
      && (
        candidate.afgoerelsesdato > endelig.afgoerelsesdato
        || (candidate.afgoerelsesdato === endelig.afgoerelsesdato && candidate.virkningsdato > endelig.virkningsdato)
      )
    )
  )?.row;
};

const resolveRowIssueFocusTarget = (
  issueId: string,
  context: EetIssueFocusContext
): AttentionTarget | undefined => {
  const rows = context.aslAfgoerelser;
  if (!rows) return undefined;

  const incomplete = collectIncompleteRowIssues(rows, context.skadedato, context.skadelidteFodselsdato)
    .find((issue) => issue.id === issueId);
  if (incomplete) {
    return incomplete.target.field === undefined
      ? asRowTarget(incomplete.target.rowId)
      : asFieldTarget(ASL_FIELD_BY_ISSUE_FIELD[incomplete.target.field].bind(incomplete.target.rowId).address);
  }

  const startedRows = rows.filter((row) => !isAslAfgoerelseRowEmpty(row));
  if (issueId === 'delvist-endelig-missing-kapitalisering') {
    const row = startedRows.find((candidate) =>
      candidate.afgoerelseType === 'Delvist endelig'
      && !hasTextValue(candidate.kapDato)
      && !hasTextValue(candidate.kapPct)
    );
    return row ? asRowTarget(row.id) : undefined;
  }

  if (issueId === ASL_IDENTICAL_AFGOERELSER_ID) {
    const row = rows.find((candidate) => validateDuplicateAfgoerelse(candidate, rows) !== undefined);
    return row ? asRowTarget(row.id) : undefined;
  }

  if (issueId === 'invalid-afgoerelse-type') {
    const row = startedRows.find((candidate) =>
      candidate.afgoerelseType !== undefined && !isKnownAfgoerelseType(candidate.afgoerelseType)
    );
    return row ? asFieldTarget(aslTypeField.bind(row.id).address) : undefined;
  }

  if (issueId === 'warn-asl-eet-under-15') {
    const row = findResolvedRows(rows).find((candidate) => resolveEetUnder15Warning(candidate.eetPct) !== undefined)?.row;
    return row ? asFieldTarget(aslAfgoerelseEetPctField.bind(row.id).address) : undefined;
  }

  if (issueId === 'warn-invalid-eet-pct-after-2024-07-01') {
    const row = findResolvedRows(rows).find((candidate) =>
      harEetTitrinAfvigelse(candidate.eetPct, context.skadedato)
    )?.row;
    return row ? asFieldTarget(aslAfgoerelseEetPctField.bind(row.id).address) : undefined;
  }

  if (issueId === 'warn-non-endelig-after-endelig') {
    const row = findNonEndeligAfterEndeligRow(rows);
    return row ? asRowTarget(row.id) : undefined;
  }

  return undefined;
};

/** Ét fælles opslag til EET-fejlens konkrete felt eller række. */
export const resolveEetIssueFocusTarget = (
  issueId: string,
  context: EetIssueFocusContext = {}
): AttentionTarget | undefined => {
  const rowTarget = resolveRowIssueFocusTarget(issueId, context);
  if (rowTarget !== undefined) return rowTarget;

  const address = STAMDATA_FIELD_BY_ISSUE_ID[issueId]
    ?? GRUNDLAEGGENDE_FIELD_BY_ISSUE_ID[issueId]
    ?? EAL_FIELD_BY_ISSUE_ID[issueId]
    ?? ASL_FIELD_BY_ISSUE_ID[issueId];
  if (address !== undefined) return asFieldTarget(address);

  const template = ASL_FIRST_ROW_FIELD_BY_ISSUE_ID[issueId];
  return template === undefined ? undefined : asTemplateTarget(template);
};
