import { PERSISTED_SECTION_KEYS, persistenceSchemas, type PersistedSectionsSnapshot } from '../config/persistenceRegistry';
import { deserializeFieldAddress, type SerializedFieldAddress } from '../inputCore/fieldAddress';
import type { InputCatalog } from '../inputCore/fieldCatalog';
import { createValidationReader } from '../inputCore/inputReader';
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
 * Blokerende adresser i deterministisk rækkefølge med de SYNLIGE (relevante) først.
 *
 * Et `ubestemt` felt bærer afvist råtekst, men er skjult, fordi dets relevans byggede på afvist input i
 * et andet felt. Gem fokuserer den første adresse; sorteredes alene på adressen, kunne den ramme det skjulte felt,
 * sende brugeren til en anden fane og ikke fokusere noget. Årsagen er selv afvist og synlig, så der findes altid
 * en relevant adresse at sende brugeren til. Rækkefølgen sættes her, så alle forbrugere af projektionen får den.
 */
const orderVisibleFirst = (
  input: SettledInput,
  catalog: InputCatalog,
  addresses: readonly SerializedFieldAddress[]
): SerializedFieldAddress[] => {
  const reader = createValidationReader(input, catalog);
  const isVisible = (serialized: SerializedFieldAddress): boolean => {
    const address = deserializeFieldAddress(serialized);
    const descriptor = address === null ? undefined : catalog.resolveField(address);
    if (address === null || descriptor === undefined) return true;
    const entityIds = address.path.flatMap((segment) => segment.kind === 'entity' ? [segment.entityId] : []);
    return reader.isRelevant(descriptor.bind(...entityIds));
  };
  const sorted = [...addresses].sort();
  return [...sorted.filter(isVisible), ...sorted.filter((address) => !isVisible(address))];
};

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
      rejectedAddresses: Object.freeze(orderVisibleFirst(validated, catalog, rejectedAddresses)),
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
