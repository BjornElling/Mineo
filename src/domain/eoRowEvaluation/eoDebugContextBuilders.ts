/**
 * Context-afledningen for periode-blokering bor i domænets validerings-lag (`eoPeriodeBlockingContext`),
 * så den er React-/visnings-fri og udgør ÉN sandhedskilde (jf. B9). Re-eksporteres her, så den
 * autoritative række-evaluerings-motors periode-buildere kan importere den uændret.
 */
export {
  buildSvieSmerteContext,
  buildTaftContext,
  type SvieSmerteContext,
  type TaftContext,
} from '../erstatningsopgoerelse/validation/eoPeriodeBlockingContext';
