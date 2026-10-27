import type { FieldAddress } from '../../inputCore/fieldAddress';
import type { ConsumerIssue, FieldIssue } from '../../inputCore/inputIssue';
import { quoteFieldLabel } from '../../inputCore/inputIssue';
import { STANDARD_LOEN_COLUMN_LABELS, type TableError } from '../../types/table';

/**
 * Årslønnens «Fejl og advarsler» (BB-350, udviklerafgørelse 2026-10-27): ALLE blokerende fejl og mangler samles i
 * én boks magen til de øvrige siders – ingen af dem står som tekst ved de enkelte felter (dér er der kun rød ring
 * og tooltip). Advarslerne står efter fejlene.
 *
 * Rækkerne bygges her som rene data, så boksen kun renderer. Et mål peger på feltet eller lønrækkens celle.
 */
export type AarsloenIssueTarget =
  | Readonly<{ kind: 'field'; address: FieldAddress; sectionName: string }>
  | Readonly<{ kind: 'cell'; error: Extract<TableError, { kind: 'cell' }>; sectionName: string }>;

export type AarsloenIssueRow = Readonly<{
  id: string;
  severity: 'error' | 'warning';
  message: string;
  target?: AarsloenIssueTarget;
}>;

const LOENFORHOLD = 'Lønforhold';
const SATSER = 'Satser';
const BEREGNINGSPRINCIPPER = 'Beregningsprincipper';
const INDTAEGTSOPLYSNINGER = 'Indtægtsoplysninger';

const SECTION_BY_FIELD: Readonly<Record<string, string>> = {
  'aarsloen.tillaegAngivesSom': LOENFORHOLD,
  'aarsloen.overenskomstId': LOENFORHOLD,
  'aarsloen.overenskomstLoenmodtager': LOENFORHOLD,
  'aarsloen.overenskomstArbejdsgiver': LOENFORHOLD,
  'aarsloen.reguleringsdato': LOENFORHOLD,
  'aarsloen.fuldLoenUnderFerie': LOENFORHOLD,
  'aarsloen.loenPaaHelligdage': LOENFORHOLD,
  'aarsloen.beregnStoreBededagstillaeg': LOENFORHOLD,
  'aarsloen.feriePct': SATSER,
  'aarsloen.fritvalgPct': SATSER,
  'aarsloen.shSoPct': SATSER,
  'aarsloen.storeBededagPct': SATSER,
  'aarsloen.pensionPct': SATSER,
  'aarsloen.antalFeriedage': BEREGNINGSPRINCIPPER,
  'aarsloen.retTilSjetteFerieuge': BEREGNINGSPRINCIPPER,
};

/** Feltets navn står foran beskeden, fordi boksen læses uden feltet foran sig – som på EO's beregningsfane. */
const formatFieldIssueMessage = (issue: FieldIssue | ConsumerIssue): string => {
  if (issue.kind === 'consumer' || issue.field === undefined) return issue.message;
  const label = issue.field.descriptor.label;
  return issue.message.includes(quoteFieldLabel(label)) || issue.message.startsWith(label)
    ? issue.message
    : `${label}: ${issue.message}`;
};

const CELL_ISSUE_TEXT: Readonly<Record<Extract<TableError, { kind: 'cell' }>['issue'], string>> = {
  invalid: 'ugyldig værdi',
  partial_period: 'perioden er ikke udfyldt',
  missing_amount: 'beløbet mangler',
};

export const buildAarsloenIssueRows = (input: Readonly<{
  beregningsFejl: string | null;
  fieldIssues: readonly (FieldIssue | ConsumerIssue)[];
  feriedageIssues: readonly FieldIssue[];
  tableErrors: readonly TableError[];
  tableRowIds: readonly string[];
  downloadError: string | null;
  warnings: readonly string[];
}>): readonly AarsloenIssueRow[] => {
  const rows: AarsloenIssueRow[] = [];
  const seen = new Set<string>();
  const push = (row: AarsloenIssueRow): void => {
    if (seen.has(row.id)) return;
    seen.add(row.id);
    rows.push(row);
  };

  for (const issue of [...input.fieldIssues, ...input.feriedageIssues]) {
    const field = issue.field;
    push({
      id: `field:${issue.code}`,
      severity: 'error',
      message: formatFieldIssueMessage(issue),
      ...(field === undefined ? {} : {
        target: { kind: 'field', address: field.address, sectionName: SECTION_BY_FIELD[field.descriptor.id] ?? LOENFORHOLD },
      }),
    });
  }

  // Rækkenummeret er rækkens plads i tabellen; flere celler i samme række med samme problem er én linje.
  for (const error of input.tableErrors) {
    if (error.kind !== 'cell') continue;
    const index = input.tableRowIds.indexOf(error.rowId);
    const raekke = index < 0 ? 'Lønrække' : `Lønrække ${index + 1}`;
    const kolonne = error.issue === 'partial_period' ? '' : `, ${STANDARD_LOEN_COLUMN_LABELS[error.colKey]}`;
    push({
      id: `cell:${error.rowId}:${error.issue}${error.issue === 'partial_period' ? '' : `:${error.colKey}`}`,
      severity: 'error',
      message: `${raekke}${kolonne}: ${CELL_ISSUE_TEXT[error.issue]}`,
      target: { kind: 'cell', error, sectionName: INDTAEGTSOPLYSNINGER },
    });
  }

  if (input.beregningsFejl !== null && input.beregningsFejl.trim() !== '') {
    push({ id: 'beregning', severity: 'error', message: input.beregningsFejl });
  }
  if (input.downloadError !== null && input.downloadError.trim() !== '') {
    push({ id: 'download', severity: 'error', message: input.downloadError });
  }
  input.warnings.forEach((message, index) => push({ id: `warning:${index}:${message}`, severity: 'warning', message }));
  return rows;
};
