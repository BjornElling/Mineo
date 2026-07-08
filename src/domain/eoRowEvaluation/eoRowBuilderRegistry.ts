import type { EoRowModel } from './eoRowTypes';
import type { SectionId } from './eoRowNavigationMap';
import type { EoRowEvaluationContext } from './eoRowExecutionContext';
import { buildEoStamdataRows } from './eoRowStamdataModel';
import {
  buildEoErstatningsopgoerelseRows,
  buildEoForligRows,
  buildEoAesRows,
  buildEoIndkomstRows,
  buildEoOffentligeYdelserRows,
  buildEoSygeferiegodtgoerelseRows,
  buildEoSvieSmerteRows,
  buildEoTafBeregningsgrundlagRows,
  buildEoTaftRows,
  buildEoOevrigeKravRows,
  buildEoSaerligeKommentarerRows,
  buildEoBilagsnumreRows,
} from './eoRowErstatningsopgoerelseModel';
import { buildSvieSmerteContext, buildTaftContext } from './eoRowContextBuilders';

/**
 * Builder-entry type (meget simpelt)
 *
 * Ingen generics, ingen tagged union, ingen casting.
 * section bruges til grouping + navigation.
 */
export type EoRowBuilderEntry = {
  section: SectionId;
  run: (ctx: EoRowEvaluationContext) => EoRowModel[];
};

/**
 * Centraliseret registry af alle EO row-buildere
 *
 * SINGLE SOURCE OF TRUTH - både download-gaten og EOInspektion skal hente herfra.
 * Builders er rækkeprojektioner og skal foretrække canonical output frem for
 * at genkalde tunge motorer. Se docs/architecture/eo-row-evaluation-architecture.md.
 *
 * Rækkefølge: Samme som i original EOInspektion.tsx for konsistens i visning.
 *
 * VIGTIGT: Nye builders skal registreres her og gennemgå den fulde række-evaluerings-
 * tjekliste i docs/architecture/eo-row-evaluation-architecture.md §14.
 */
export const EO_ROW_BUILDERS: readonly EoRowBuilderEntry[] = [
  {
    section: 'stamdata',
    run: (ctx) =>
      buildEoStamdataRows(
        ctx.stamdataValues,
        ctx.stamdataErrors
      ),
  },

  {
    section: 'erstatningsopgoerelse',
    run: (ctx) =>
      buildEoErstatningsopgoerelseRows(
        ctx.eoValues,
        ctx.eoErrors
      ),
  },

  {
    section: 'forlig',
    run: (ctx) =>
      buildEoForligRows(
        ctx.eoValues,
        ctx.eoErrors
      ),
  },

  {
    section: 'aes',
    run: (ctx) =>
      buildEoAesRows(
        ctx.eoValues,
        ctx.eoErrors
      ),
  },

  {
    section: 'loenindkomst',
    run: (ctx) =>
      buildEoIndkomstRows(
        ctx.eoValues,
        ctx.stamdataValues.skadedato,
        ctx.loenindkomstManuelReguleringInputErrors,
        ctx.appSettings,
        ctx.stamdataValues.skadestype
      ),
  },

  {
    section: 'offentlige-ydelser',
    run: (ctx) =>
      buildEoOffentligeYdelserRows(
        ctx.eoValues,
        ctx.stamdataValues.skadedato
      ),
  },

  {
    section: 'sygeferiegodtgoerelse',
    run: (ctx) =>
      buildEoSygeferiegodtgoerelseRows(
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
      return buildEoSvieSmerteRows(
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
      buildEoTafBeregningsgrundlagRows(
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
      return buildEoTaftRows(
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
      buildEoOevrigeKravRows(
        ctx.eoValues,
        ctx.eoErrors,
        ctx.canonicalOutput
      ),
  },

  {
    section: 'saerlige-kommentarer',
    run: (ctx) =>
      buildEoSaerligeKommentarerRows(
        ctx.eoValues,
        ctx.eoErrors
      ),
  },

  {
    section: 'bilagsnumre',
    run: ({ eoValues }) =>
      buildEoBilagsnumreRows(
        eoValues
      ),
  },
] as const;

const executeEoRowBuilderEntry = (
  entry: EoRowBuilderEntry,
  ctx: EoRowEvaluationContext
): EoRowModel[] => {
  try {
    return entry.run(ctx);
  } catch (error) {
    const message = error instanceof Error && error.message.trim() !== '' ? error.message : 'Ukendt fejl';
    return [
      {
        id: `eo.rowBuilder.${entry.section}.exception`,
        label: `Fejl i række-builder (${entry.section})`,
        displayValue: `Fejl (Række-builder-fejl: ${message})`,
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
 * @returns Array af alle EoRowModel fra alle builders
 */
export const executeEoRowBuilderEntries = (
  entries: ReadonlyArray<EoRowBuilderEntry>,
  ctx: EoRowEvaluationContext
): EoRowModel[] => {
  return entries.flatMap((entry) => executeEoRowBuilderEntry(entry, ctx));
};

/**
 * Udfører builders og returnerer rows grupperet pr. section
 *
 * Bruges af EO-kontrol-siden, som har brug for sektioneret output
 * men stadig skal dele samme exception-isolation som download-gaten.
 */
export const executeEoRowBuilderEntriesBySection = (
  entries: ReadonlyArray<EoRowBuilderEntry>,
  ctx: EoRowEvaluationContext
): ReadonlyMap<SectionId, readonly EoRowModel[]> => {
  const map = new Map<SectionId, readonly EoRowModel[]>();
  entries.forEach((entry) => {
    map.set(entry.section, executeEoRowBuilderEntry(entry, ctx));
  });
  return map;
};

/**
 * Udfører alle builders fra registry og returnerer samlet liste
 *
 * MEGET simpelt - ingen switch, ingen casting, ingen exhaustiveness-illusion.
 *
 * @param ctx - Execution context med alle nødvendige værdier og fejl
 * @returns Array af alle EoRowModel fra alle builders
 */
export const executeAllEoRowBuilders = (
  ctx: EoRowEvaluationContext
): EoRowModel[] => {
  return executeEoRowBuilderEntries(EO_ROW_BUILDERS, ctx);
};
