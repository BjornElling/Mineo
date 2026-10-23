import { buildFieldWarningMap, type FieldWarning } from '../../inputCore/fieldWarning';
import type { SerializedFieldAddress } from '../../inputCore/fieldAddress';
import type { ErstatningsopgoerelseValues, StamdataValues } from '../../schemas/formSchemas';
import { resolveAnciennitetstillaegEfterTafAdvarsler } from './anciennitetstillaegRules';
import { resolveForhoejetGrundloenAdvarsler } from './forhoejetGrundloenRules';
import { resolveTafBoundaryDatesInSkadetPeriode } from './helpers/indtaegtPerioder';
import { resolveManualRegulationWarnings } from './manualRegulationIssues';

/**
 * Lønudviklingens gule ringe på begge flader: de manuelle tabellers celler (BB-302, BB-313), en anciennitetsdato
 * efter erstatningsperioden (BB-305) og en forhøjet grundløn over løntrinnets løn (BB-313). Samme domæneregler giver linjerne i «Fejl og advarsler»; adresserne er
 * fuldt bundne, så ét opslag dækker alle kort og den angivne løn.
 *
 * @param udloebToleranceMaaneder Indstillingernes «regnes for dækkende indtil N måneder efter udløb».
 */
export const resolveLoenudviklingFieldWarnings = (
  values: ErstatningsopgoerelseValues,
  stamdata: Pick<StamdataValues, 'skadedato'>,
  udloebToleranceMaaneder: number,
): ReadonlyMap<SerializedFieldAddress, FieldWarning> => {
  const tafSlut = resolveTafBoundaryDatesInSkadetPeriode(values).last;
  return buildFieldWarningMap([
    ...resolveManualRegulationWarnings(values, stamdata, tafSlut, udloebToleranceMaaneder),
    ...resolveAnciennitetstillaegEfterTafAdvarsler(values, tafSlut),
    ...resolveForhoejetGrundloenAdvarsler(values, stamdata),
  ]);
};
