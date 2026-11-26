import { stamdataSkadestypeField } from '../../inputCore/catalog/stamdataDescriptors';
import type { InputReader } from '../../inputCore/inputReader';
import { resolveStamdataDatoReference, type StamdataDatoReference } from '../policies/stamdataCalculations';

const skadestypeRef = stamdataSkadestypeField.bind();

/**
 * Datoens navn for sagen, læst direkte gennem readeren.
 *
 * Læsningen blokerer intet: en tom eller fejlende skadestype giver standardnavnet. Den findes, fordi et
 * dokument ikke må hente skadestypen fra brevhovedets stamdata – de er tomme, når brevhovedet er fravalgt,
 * og dokumentet skiftede da tavst «Anmeldelsesdato» ud med «Skadedato».
 */
export const readStamdataDatoReference = (reader: InputReader): StamdataDatoReference => {
  const skadestype = reader.read(skadestypeRef);
  return resolveStamdataDatoReference(skadestype.status === 'usable' ? skadestype.value : undefined);
};
