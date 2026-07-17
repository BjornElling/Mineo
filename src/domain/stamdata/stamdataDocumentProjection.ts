import type { StamdataValues } from '../../schemas/formSchemas/sections/stamdataSchemas';
import {
  stamdataAdvokatField,
  stamdataJournalnrField,
  stamdataSagsbehandlerField,
  stamdataSkadedatoField,
  stamdataSkadelidteField,
  stamdataSkadelidteFodselsdatoField,
  stamdataSkadestypeField,
} from '../../inputCore/catalog/stamdataDescriptors';
import type { InputReader } from '../../inputCore/inputReader';
import { runProjection, type ProjectionReadResult, type ProjectionResult } from '../../inputCore/projection';

const refs = {
  journalnr: stamdataJournalnrField.bind(),
  advokat: stamdataAdvokatField.bind(),
  sagsbehandler: stamdataSagsbehandlerField.bind(),
  skadelidte: stamdataSkadelidteField.bind(),
  skadelidteFodselsdato: stamdataSkadelidteFodselsdatoField.bind(),
  skadestype: stamdataSkadestypeField.bind(),
  skadedato: stamdataSkadedatoField.bind(),
} as const;

const valueOf = <T>(result: ProjectionReadResult<T | undefined>): T | undefined =>
  result.status === 'usable' ? result.value : undefined;

/**
 * Dokumenternes typed brevhovedprojektion. Felterne er optionelle, men en aktiv feltfejl på et læst felt
 * blokerer dokumentet; rå stamdatasektioner må aldrig sendes uden om readeren til dokumentservicen.
 */
export const projectStamdataForDocument = (
  reader: InputReader,
  consumerId: string
): ProjectionResult<StamdataValues> =>
  runProjection(reader, consumerId, (collector): StamdataValues => ({
    journalnr: valueOf(collector.optional(refs.journalnr)),
    advokat: valueOf(collector.optional(refs.advokat)),
    sagsbehandler: valueOf(collector.optional(refs.sagsbehandler)),
    skadelidte: valueOf(collector.optional(refs.skadelidte)),
    skadelidteFodselsdato: valueOf(collector.optional(refs.skadelidteFodselsdato)),
    skadestype: valueOf(collector.optional(refs.skadestype)),
    skadedato: valueOf(collector.optional(refs.skadedato)),
  }));
