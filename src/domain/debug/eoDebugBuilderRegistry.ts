import type { DebugRowModel } from './eoDebugTypes';
import type { SectionId } from './eoDebugNavigationMap';
import type { EODebugExecutionContext } from './eoDebugExecutionContext';
import { buildEODebugStamdataRows } from './eoDebugStamdataModel';
import {
  buildEODebugErstatningsopgoerelseRows,
  buildEODebugForligRows,
  buildEODebugAesRows,
  buildEODebugIndkomstRows,
  buildEODebugOffentligeYdelserRows,
  buildEODebugSygeferiegodtgoerelseRows,
  buildEODebugSvieSmerteRows,
  buildEODebugTafBeregningsgrundlagRows,
  buildEODebugTaftRows,
  buildEODebugOevrigeKravRows,
  buildEODebugSaerligeKommentarerRows,
  buildEODebugBilagsnumreRows,
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
 * Builders er visningsprojektioner og skal foretrække canonical output frem for
 * at genkalde tunge motorer. Se docs/architecture/debug-builder-architecture.md.
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
    section: 'loenindkomst',
    run: (ctx) =>
      buildEODebugIndkomstRows(
        ctx.eoValues,
        ctx.stamdataValues.skadedato,
        ctx.loenindkomstManuelReguleringInputErrors,
        ctx.appSettings
      ),
  },

  {
    section: 'offentlige-ydelser',
    run: (ctx) =>
      buildEODebugOffentligeYdelserRows(
        ctx.eoValues
      ),
  },

  {
    section: 'sygeferiegodtgoerelse',
    run: (ctx) =>
      buildEODebugSygeferiegodtgoerelseRows(
        ctx.eoValues,
        ctx.stamdataValues,
        ctx.canonicalOutput,
        ctx.pdfModel
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
        context,
        ctx.canonicalOutput
      );
    },
  },

  {
    section: 'taf-beregningsgrundlag',
    run: (ctx) =>
      buildEODebugTafBeregningsgrundlagRows(
        ctx.eoValues,
        ctx.eoErrors,
        ctx.stamdataValues
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
        context,
        ctx.canonicalOutput
      );
    },
  },

  {
    section: 'oevrige-krav',
    run: (ctx) =>
      buildEODebugOevrigeKravRows(
        ctx.eoValues,
        ctx.eoErrors,
        ctx.canonicalOutput
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

  {
    section: 'bilagsnumre',
    run: ({ eoValues }) =>
      buildEODebugBilagsnumreRows(
        eoValues
      ),
  },
] as const;

const executeEODebugBuilderEntry = (
  entry: EODebugBuilderEntry,
  ctx: EODebugExecutionContext
): DebugRowModel[] => {
  try {
    return entry.run(ctx);
  } catch (error) {
    const message = error instanceof Error && error.message.trim() !== '' ? error.message : 'Ukendt fejl';
    return [
      {
        id: `debug.builder.${entry.section}.exception`,
        label: `Fejl i debug-builder (${entry.section})`,
        displayValue: `Fejl (Builder-fejl: ${message})`,
        status: 'error',
      },
    ];
  }
};

/**
 * Udfører et givent set af builders og isolerer fejl pr. builder
 *
 * @param entries - Builder entries (kan bruges i tests)
 * @param ctx - Execution context med alle nødvendige værdier og fejl
 * @returns Array af alle DebugRowModel fra alle builders
 */
export const executeEODebugBuilderEntries = (
  entries: ReadonlyArray<EODebugBuilderEntry>,
  ctx: EODebugExecutionContext
): DebugRowModel[] => {
  return entries.flatMap((entry) => executeEODebugBuilderEntry(entry, ctx));
};

/**
 * Udfører builders og returnerer rows grupperet pr. section
 *
 * Bruges af EO-debug siden, som har brug for sektioneret output
 * men stadig skal dele samme exception-isolation som resten af debug-laget.
 */
export const executeEODebugBuilderEntriesBySection = (
  entries: ReadonlyArray<EODebugBuilderEntry>,
  ctx: EODebugExecutionContext
): ReadonlyMap<SectionId, readonly DebugRowModel[]> => {
  const map = new Map<SectionId, readonly DebugRowModel[]>();
  entries.forEach((entry) => {
    map.set(entry.section, executeEODebugBuilderEntry(entry, ctx));
  });
  return map;
};

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
  return executeEODebugBuilderEntries(EO_DEBUG_BUILDERS, ctx);
};
