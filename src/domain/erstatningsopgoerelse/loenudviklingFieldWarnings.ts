import { buildFieldWarningMap, type FieldWarning } from '../../inputCore/fieldWarning';
import type { SerializedFieldAddress } from '../../inputCore/fieldAddress';
import type { ErstatningsopgoerelseValues, StamdataValues } from '../../schemas/formSchemas';
import {
  resolveAnciennitetstillaegEfterTafAdvarsler,
  resolveAnciennitetstillaegOverTrinloenAdvarsler,
} from './anciennitetstillaegRules';
import { resolveForhoejetGrundloenAdvarsler } from './forhoejetGrundloenRules';
import { resolveTafBoundaryDatesInSkadetPeriode } from './helpers/indtaegtPerioder';
import { resolveManualRegulationWarnings } from './manualRegulationIssues';
import { toAnyFieldRef } from '../../inputCore/fieldDescriptor';
import { eoSfggManuelDagssatsField, eoSfggReferenceperiodeTilField } from '../../inputCore/catalog/erstatningsopgoerelseDescriptors';
import {
  buildSfggGammelReferenceperiodeBesked,
  buildSfggManuelDagssatsBesked,
  resolveSfggGamleReferenceperiodeAdvarsler,
  resolveSfggManuelDagssatsAdvarsler,
} from './engines/sfggWarnings';

/**
 * Lønudviklingens gule ringe på begge flader: de manuelle tabellers celler, en anciennitetsdato
 * efter erstatningsperioden, en forhøjet grundløn eller et anciennitetstillæg over løntrinnets løn,
 * en manuel dagssats for sygeferiegodtgørelse over en dags løn og en referenceperiode for
 * sygeferiegodtgørelsen, der slutter mere end 12 måneder før reguleringsdatoen ved de manuelle former.
 * Samme domæneregler giver linjerne i «Fejl og advarsler»; adresserne er fuldt bundne, så ét opslag dækker alle kort
 * og den angivne løn.
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
    ...resolveAnciennitetstillaegOverTrinloenAdvarsler(values, stamdata),
    ...resolveSfggGamleReferenceperiodeAdvarsler({ values, stamdata }).map((advarsel) => ({
      cells: [toAnyFieldRef(eoSfggReferenceperiodeTilField.bind(advarsel.employmentId))],
      cellMessage: buildSfggGammelReferenceperiodeBesked(advarsel.reguleringsdato),
    })),
    ...resolveSfggManuelDagssatsAdvarsler(values).map((advarsel) => ({
      cells: [toAnyFieldRef(eoSfggManuelDagssatsField.bind(advarsel.employmentId))],
      cellMessage: buildSfggManuelDagssatsBesked(advarsel),
    })),
  ]);
};
