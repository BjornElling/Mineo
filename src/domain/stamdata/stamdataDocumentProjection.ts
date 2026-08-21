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

const EMPTY_STAMDATA: StamdataValues = Object.freeze({
  journalnr: undefined,
  advokat: undefined,
  sagsbehandler: undefined,
  skadelidte: undefined,
  skadelidteFodselsdato: undefined,
  skadestype: undefined,
  skadedato: undefined,
});

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

/**
 * Projekter kun brevhovedets stamdata, når det konkrete output faktisk skal tegne et brevhoved.
 * Et output uden brevhoved må ikke blokeres af en ugyldig værdi i stamdata, som det hverken viser
 * eller bruger. Den naive løsning – altid at læse stamdata – gjorde en anden fane til en usynlig
 * forudsætning for dokumentet.
 */
export const projectStamdataForDocumentIfEnabled = (
  reader: InputReader,
  consumerId: string,
  enabled: boolean
): ProjectionResult<StamdataValues> => enabled
  ? projectStamdataForDocument(reader, consumerId)
  : Object.freeze({ status: 'ready', value: EMPTY_STAMDATA, issues: Object.freeze([]), sourceToken: reader.sourceToken });
