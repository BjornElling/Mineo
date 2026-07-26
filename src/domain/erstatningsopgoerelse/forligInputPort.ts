import {
  eoForligAnsvarsgradBroekField,
  eoForligAnsvarsgradProcentField,
  eoForligDatoField,
} from '../../inputCore/catalog/erstatningsopgoerelseDescriptors';
import type { InputReader, ReadFieldResult } from '../../inputCore/inputReader';

/**
 * Den eneste cross-domain-port til de tre delte forligsfelter.
 *
 * EET må hverken importere EO's brede descriptorkatalog eller kende andre EO-felter. Samme refs bruges til
 * redigering på differencekrav-fanen og til den tokenbundne read-projektion.
 */
export const forligInputFields = Object.freeze({
  procent: eoForligAnsvarsgradProcentField,
  broek: eoForligAnsvarsgradBroekField,
  dato: eoForligDatoField,
});

export type ForligInputProjection = Readonly<{
  procent: ReadFieldResult<number | undefined>;
  broek: ReadFieldResult<string | undefined>;
  dato: ReadFieldResult<string | undefined>;
}>;

export const projectForligInput = (reader: InputReader): ForligInputProjection => Object.freeze({
  procent: reader.read(forligInputFields.procent.bind()),
  broek: reader.read(forligInputFields.broek.bind()),
  dato: reader.read(forligInputFields.dato.bind()),
});
