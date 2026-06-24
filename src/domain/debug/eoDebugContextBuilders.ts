/**
 * Context-afledningen for periode-blokering bor nu i domænets validerings-lag, så den deles
 * med det autoritative `eoBlockingValidation` (jf. B9). Re-eksporteres her, så eksisterende
 * debug-importer er uændrede.
 */
export {
  buildSvieSmerteContext,
  buildTaftContext,
  type SvieSmerteContext,
  type TaftContext,
} from '../erstatningsopgoerelse/validation/eoPeriodeBlockingContext';
