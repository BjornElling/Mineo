import { buildFieldWarningMap, type FieldWarning } from '../../inputCore/fieldWarning';
import type { SerializedFieldAddress } from '../../inputCore/fieldAddress';
import type { ErstatningsopgoerelseValues, StamdataValues } from '../../schemas/formSchemas';
import { resolveAnciennitetstillaegEfterTafAdvarsler } from './anciennitetstillaegRules';
import { resolveForhoejetGrundloenAdvarsler } from './forhoejetGrundloenRules';
import { resolveTafBoundaryDatesInSkadetPeriode } from './helpers/indtaegtPerioder';
import { resolveManualRegulationWarnings } from './manualRegulationIssues';
import { toAnyFieldRef } from '../../inputCore/fieldDescriptor';
import { eoSfggReferenceperiodeTilField } from '../../inputCore/catalog/erstatningsopgoerelseDescriptors';
import {
  buildSfggGammelReferenceperiodeBesked,
  resolveSfggGamleReferenceperiodeAdvarsler,
} from './engines/sfggWarnings';

/**
 * Lønudviklingens gule ringe på begge flader: de manuelle tabellers celler (BB-302, BB-313), en anciennitetsdato
 * efter erstatningsperioden (BB-305), en forhøjet grundløn over løntrinnets løn (BB-313) og en referenceperiode for
 * sygeferiegodtgørelsen, der slutter mere end 12 måneder før reguleringsdatoen ved de manuelle former (BB-324). Samme domæneregler giver linjerne i «Fejl og advarsler»; adresserne er
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
    ...resolveSfggGamleReferenceperiodeAdvarsler({ values, stamdata }).map((advarsel) => ({
      cells: [toAnyFieldRef(eoSfggReferenceperiodeTilField.bind(advarsel.employmentId))],
      cellMessage: buildSfggGammelReferenceperiodeBesked(advarsel.reguleringsdato),
    })),
  ]);
};
