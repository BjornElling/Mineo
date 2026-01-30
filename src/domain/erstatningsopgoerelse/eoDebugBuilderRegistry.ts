import type { DebugRowModel } from '../debug/eoDebugTypes';
import type { SectionId } from './eoDebugNavigationMap';
import type { EODebugExecutionContext } from './eoDebugExecutionContext';
import { buildEODebugStamdataRows } from './eoDebugStamdataModel';
import {
  buildEODebugErstatningsopgoerelseRows,
  buildEODebugForligRows,
  buildEODebugAesRows,
  buildEODebugSvieSmerteRows,
  buildEODebugTafBeregningsgrundlagRows,
  buildEODebugTaftRows,
  buildEODebugOevrigeKravRows,
  buildEODebugSaerligeKommentarerRows,
} from './eoDebugErstatningsopgoerelseModel';
import { buildSvieSmerteContext, buildTaftContext } from './eoDebugContextBuilders';

/**
 * Builder-entry type (meget simpelt)
 *
 * Ingen generics, ingen tagged union, ingen casting.
 * section bruges til grouping + navigation.
 */
export type EODebugBuilderEntry = {
  section: SectionId;
  run: (ctx: EODebugExecutionContext) => DebugRowModel[];
};

/**
 * Centraliseret registry af alle EODebug builders
 *
 * SINGLE SOURCE OF TRUTH - alle steder der bruger EODebug skal hente herfra.
 *
 * Rækkefølge: Samme som i original EODebug.tsx for konsistens i visning.
 *
 * VIGTIGT: Dette er det ENESTE sted der skal opdateres når du tilføjer ny builder.
 */
export const EO_DEBUG_BUILDERS: readonly EODebugBuilderEntry[] = [
  {
    section: 'stamdata',
    run: (ctx) =>
      buildEODebugStamdataRows(
        ctx.stamdataValues,
        ctx.stamdataErrors
      ),
  },

  {
    section: 'erstatningsopgoerelse',
    run: (ctx) =>
      buildEODebugErstatningsopgoerelseRows(
        ctx.eoValues,
        ctx.eoErrors
      ),
  },

  {
    section: 'forlig',
    run: (ctx) =>
      buildEODebugForligRows(
        ctx.eoValues,
        ctx.eoErrors
      ),
  },

  {
    section: 'aes',
    run: (ctx) =>
      buildEODebugAesRows(
        ctx.eoValues,
        ctx.eoErrors
      ),
  },

  {
    section: 'sviesmerte',
    run: (ctx) => {
      // Context beregnes lokalt i builder
      const context = buildSvieSmerteContext(
        ctx.stamdataValues,
        ctx.eoValues
      );
      return buildEODebugSvieSmerteRows(
        ctx.eoValues,
        ctx.eoErrors,
        context
      );
    },
  },

  {
    section: 'taf-beregningsgrundlag',
    run: (ctx) =>
      buildEODebugTafBeregningsgrundlagRows(
        ctx.eoValues,
        ctx.eoErrors
      ),
  },

  {
    section: 'taf',
    run: (ctx) => {
      // Context beregnes lokalt i builder
      const context = buildTaftContext(
        ctx.stamdataValues,
        ctx.eoValues
      );
      return buildEODebugTaftRows(
        ctx.eoValues,
        ctx.eoErrors,
        context
      );
    },
  },

  {
    section: 'oevrige-krav',
    run: (ctx) =>
      buildEODebugOevrigeKravRows(
        ctx.eoValues,
        ctx.eoErrors
      ),
  },

  {
    section: 'saerlige-kommentarer',
    run: (ctx) =>
      buildEODebugSaerligeKommentarerRows(
        ctx.eoValues,
        ctx.eoErrors
      ),
  },
] as const;

/**
 * Udfører alle builders fra registry og returnerer samlet liste
 *
 * MEGET simpelt - ingen switch, ingen casting, ingen exhaustiveness-illusion.
 *
 * @param ctx - Execution context med alle nødvendige værdier og fejl
 * @returns Array af alle DebugRowModel fra alle builders
 */
export const executeAllEODebugBuilders = (
  ctx: EODebugExecutionContext
): DebugRowModel[] => {
  return EO_DEBUG_BUILDERS.flatMap((entry) => entry.run(ctx));
};
