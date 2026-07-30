import { PERSISTED_SECTION_KEYS, persistenceSchemas, type PersistedSectionsSnapshot } from '../config/persistenceRegistry';
import type { SerializedFieldAddress } from '../inputCore/fieldAddress';
import type { InputCatalog } from '../inputCore/fieldCatalog';
import type { SettledInput } from '../inputCore/settledInput';
import { cloneAndDeepFreeze } from '../utils/deepFreeze';
import { omitDerivedLoenindkomstSatser } from '../domain/erstatningsopgoerelse/loenindkomstSatsProjection';

export type EoSaveProjection =
  | Readonly<{
      status: 'ready';
      snapshot: PersistedSectionsSnapshot;
    }>
  | Readonly<{
      status: 'blocked';
      rejectedAddresses: readonly SerializedFieldAddress[];
    }>;

/**
 * Den ene strukturelle `.eo`-save-projektion. Den validerer hele inputaggregaten som defense-in-depth,
 * blokerer præcis på rejected input og returnerer ellers et schema-parset canonical sektionssnapshot.
 * Afledte feltissues indgår bevidst ikke: bounds/rule på canonical input må gemmes uændret.
 */
export const projectEoSave = (
  input: SettledInput,
  catalog: InputCatalog
): EoSaveProjection => {
  const validated = catalog.validateSettledInput(input);
  const rejectedAddresses = Object.keys(validated.rejectedInputs) as SerializedFieldAddress[];
  if (rejectedAddresses.length > 0) {
    return Object.freeze({
      status: 'blocked',
      rejectedAddresses: Object.freeze([...rejectedAddresses].sort()),
    });
  }

  const sections = validated.sections.erstatningsopgoerelse === null
    ? validated.sections
    : {
      ...validated.sections,
      erstatningsopgoerelse: omitDerivedLoenindkomstSatser(
        validated.sections.erstatningsopgoerelse,
        { skadedato: validated.sections.stamdata?.skadedato }
      ),
    };
  const snapshot = cloneAndDeepFreeze(Object.fromEntries(PERSISTED_SECTION_KEYS.map((section) => {
    const value = sections[section];
    return [section, value === null ? undefined : persistenceSchemas[section].parse(value)];
  }))) as PersistedSectionsSnapshot;

  return Object.freeze({ status: 'ready', snapshot });
};
