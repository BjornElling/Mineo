import { prefixFieldLabel, type FieldIssue } from '../../inputCore/inputIssue';
import { serializeFieldAddress, type FieldAddress } from '../../inputCore/fieldAddress';
import type { AslAfgoerelseRow } from '../../schemas/formSchemas';
import { coerceToISODateString, isoToDanish } from '../../types/branded';
import type { EetIssue } from './eetTypes';

/** Det fælles issue-id for en rød celle i ASL-afgørelsestabellen – uanset hvilken fane eller side der viser den. */
export const ASL_AFGOERELSER_FIELD_ISSUE_ID = 'field-asl-afgoerelser';

/** Rækkens id i en feltadresse i afgørelsestabellen; `undefined` for felter uden for tabellen. */
export const aslRowIdOfAddress = (address: FieldAddress): string | undefined => {
  const segment = [...address.path].reverse().find((candidate) => candidate.kind === 'entity');
  return segment?.kind === 'entity' ? segment.entityId : undefined;
};

const entityIdOf = (issue: FieldIssue): string | undefined => aslRowIdOfAddress(issue.field.address);

/**
 * Rækkens navn i en fejloversigt: afgørelsesdatoen, når den er gyldig og entydig, ellers rækkens plads i tabellen.
 * Pladsen er collectionens rækkefølge, som også er tabellens (sortering flytter rækkerne i collectionen).
 */
export const describeAslAfgoerelseRow = (
  rowId: string | undefined,
  rows: readonly AslAfgoerelseRow[]
): string | undefined => {
  if (rowId === undefined) return undefined;
  const index = rows.findIndex((row) => row.id === rowId);
  if (index < 0) return undefined;
  const dato = coerceToISODateString(rows[index]?.afgoerelsesDato);
  const entydig = dato !== undefined
    && rows.filter((row) => coerceToISODateString(row.afgoerelsesDato) === dato).length === 1;
  return entydig ? `Afgørelsen af ${isoToDanish(dato) ?? dato}` : `Afgørelse ${String(index + 1)}`;
};

/**
 * ALLE røde celler i ASL-afgørelsestabellen som linjer i en fejloversigt – hver med række, kolonne og sin egen celle
 * som mål.
 *
 * Både EET-fanerne og EO's import af midlertidigt EET fører ALLE fejl videre. Ført kun den første videre, skulle
 * brugeren rette, vende tilbage og først da blive bedt om den næste. Tabellen viser i forvejen alle fejlene på deres
 * celler; oversigten skal sige det samme.
 *
 * `fieldIssues` er readerens feltfejl efterfulgt af tabellens kryds-række-regler. Højst én linje pr. celle: den
 * første vinder, og en feltfejl går derfor forud for en regel på samme celle – som tooltippet ved cellen.
 */
export const buildAslAfgoerelserSummaryIssues = (
  fieldIssues: readonly FieldIssue[],
  rows: readonly AslAfgoerelseRow[]
): readonly EetIssue[] => {
  const seen = new Set<string>();
  const summary: EetIssue[] = [];
  for (const issue of fieldIssues) {
    const key = serializeFieldAddress(issue.field.address);
    if (seen.has(key)) continue;
    seen.add(key);
    const feltbesked = prefixFieldLabel(issue.field.descriptor.label, issue.message.trim());
    const raekke = describeAslAfgoerelseRow(entityIdOf(issue), rows);
    summary.push({
      id: ASL_AFGOERELSER_FIELD_ISSUE_ID,
      severity: 'error',
      message: raekke === undefined ? feltbesked : `${raekke}, ${feltbesked}`,
      focusTarget: { kind: 'fieldAddress', address: issue.field.address },
    });
  }
  return Object.freeze(summary);
};

/**
 * Én feltfejl uden for tabellen som oversigtslinje med feltets navn og konkrete besked. Bruges, hvor en side før
 * kun skrev, AT et felt var ugyldigt («… er ikke gyldigt udfyldt»), mens readeren kendte årsagen.
 */
export const buildFieldSummaryIssue = (id: string, issue: FieldIssue): EetIssue => ({
  id,
  severity: 'error',
  message: prefixFieldLabel(issue.field.descriptor.label, issue.message.trim()),
  focusTarget: { kind: 'fieldAddress', address: issue.field.address },
});
