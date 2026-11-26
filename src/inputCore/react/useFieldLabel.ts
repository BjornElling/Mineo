import type { FieldRef } from '../fieldDescriptor';
import { useInputEvaluation } from './useInputEvaluation';

/**
 * Feltets SYNLIGE label – den ene måde en renderflade må komme til et feltnavn (§3.2a).
 *
 * **Hvorfor hooken findes.** Skrives den synlige label i hånden på rendersiden (`<Typography
 * className="row--text">Skadedato</Typography>`), mens `descriptor.label` navngiver feltet i beskeder, binder
 * intet de to sammen, og for et felt med et kontekstafhængigt navn driver de fra hinanden: `stamdata.skadedato`
 * viser «Anmeldelsesdato» ved Erhvervssygdom, mens den røde fejl beder brugeren rette «Skadedato».
 *
 * Hooken lukker driften ved at fjerne det ene af de to systemer: rendersiden HAR ikke sit eget
 * feltnavn, den spørger feltet. Beskeder og skærm læser derfor samme autoritet – descriptorens `label` plus
 * dens eventuelle `contextualLabel` – og kan ikke navngive samme felt forskelligt.
 *
 * Navnet kommer gennem `InputReader.labelOf`, ikke gennem en rå `CanonicalView`: en renderflade må navngive
 * et felt, men aldrig læse den canonical værdi bag en rød feltfejl (§1.5).
 */
export const useFieldLabel = <T>(field: FieldRef<T>): string =>
  useInputEvaluation().reader.labelOf(field);
