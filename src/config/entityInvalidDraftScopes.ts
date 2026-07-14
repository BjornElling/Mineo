/**
 * Parse-kompetente ansættelsesforholdsfelter med `${afId}:${field}`-adresse.
 * Listen er fælles autoritet for orphan-oprydning og save-fokusrouting.
 */
const EO_AF_INVALID_DRAFT_FIELD_NAME_LIST = [
  'anciennitetstillaegDato',
  'anciennitetstillaegSats',
  'feriePct',
  'fritvalgPct',
  'offentligLoenEkstraGrundloen',
  'offentligLoenGruppe',
  'offentligLoenTrin',
  'pensionPct',
  'saerligFraDatoRegulering',
  'sfggAlleredeBetaltBeloeb',
  'sfggManuelDagssats',
  'sfggReferenceperiodeFra',
  'sfggReferenceperiodeFravaersdageUdenLoen',
  'sfggReferenceperiodeTil',
  'shSoPct',
  'sidsteArbejdsdag',
] as const;

export type EoAfInvalidDraftFieldName = typeof EO_AF_INVALID_DRAFT_FIELD_NAME_LIST[number];
export const EO_AF_INVALID_DRAFT_FIELD_NAMES: ReadonlySet<string> = new Set(EO_AF_INVALID_DRAFT_FIELD_NAME_LIST);

export const createEoAfInvalidDraftClears = (
  ansaettelsesforholdId: string,
  fieldNames: readonly EoAfInvalidDraftFieldName[]
) => fieldNames.map((fieldName) => ({
  pageKey: 'erstatningsopgoerelse' as const,
  fieldPath: `${ansaettelsesforholdId}:${fieldName}`,
}));

/**
 * Er en dynamisk entity-feltadresse (`${entityId}:${fieldName}`) forældreløs?
 * `fieldNames` er en eksplicit whitelist, så andre fremtidige colon-adresser aldrig ryddes ved et gæt.
 */
export const isEntityInvalidDraftScopeOrphan = (
  fieldPath: string,
  fieldNames: ReadonlySet<string>,
  liveEntityIds: ReadonlySet<string>
): boolean => {
  const separator = fieldPath.indexOf(':');
  if (separator <= 0) return false;
  const entityId = fieldPath.slice(0, separator);
  const fieldName = fieldPath.slice(separator + 1);
  return fieldNames.has(fieldName) && !liveEntityIds.has(entityId);
};

export const isEoAfInvalidDraftFieldPath = (fieldPath: string): boolean => {
  const separator = fieldPath.indexOf(':');
  return separator > 0 && EO_AF_INVALID_DRAFT_FIELD_NAMES.has(fieldPath.slice(separator + 1));
};
