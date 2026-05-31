import type { ErstatningsopgoerelseValues, StamdataValues } from '../../schemas/formSchemas';
import type { FieldErrorsForSection } from '../../types/fieldErrors';
import type { IsoRange } from '../erstatningsopgoerelse/validation/tafPeriodConstraints';
import type { SvieSmerteEngineOutput } from '../erstatningsopgoerelse/engines/svieSmerteEngine';
import type { SygeferiegodtgoerelseResult } from '../erstatningsopgoerelse/engines/sygeferiegodtgoerelse';
import type { EoCanonicalOutput } from '../erstatningsopgoerelse/snapshot/eoCanonicalOutput';
import { buildEODebugModel } from './eoDebugModel';
import type { DebugDay } from './eoDebugTypes';
import {
  buildEODebugSammentaellingModel,
  buildSammentaellingDisplayTables,
  flattenSammentaellingDisplayTables,
  buildSvieSmerteContext,
  buildTaftContext,
  type SammentaellingDisplayRow,
  type SammentaellingDisplayTables,
  type SammentaellingModel,
} from './eoDebugSammentaelling';
import type { EODebugModel } from './eoDebugModel';

/**
 * EODebugSnapshot er et konsistens-kritisk, entry-bundet snapshot.
 *
 * Invarianter:
 * - bygges kun ved tab-entry
 * - revision er monotont voksende og skal ændre sig ved mutation af EO-input/-fejl
 */
export type EODebugSnapshot = Readonly<{
  revision: string;
  createdAt: string;
  model: EODebugModel;
  debugDays: readonly DebugDay[];
  sammentaelling: SammentaellingModel;
  sammentaellingTables: SammentaellingDisplayTables;
  sammentaellingRows: readonly SammentaellingDisplayRow[];
  stamdataValues: StamdataValues;
  eoValues: ErstatningsopgoerelseValues;
  fieldErrors: Readonly<{
    stamdata: FieldErrorsForSection<'stamdata'>;
    erstatningsopgoerelse: FieldErrorsForSection<'erstatningsopgoerelse'>;
  }>;
}>;

const buildDebugDaysFromModel = (model: EODebugModel): readonly DebugDay[] => {
  const { tableData } = model;
  return tableData.dates.map((iso, rowIndex) => ({
    iso,
    weekday: tableData.weekdayIndexByRow[rowIndex] ?? 1,
    isWeekend: [0, 6].includes(tableData.weekdayIndexByRow[rowIndex] ?? 1),
    isSognehelligdag: tableData.isSognehelligdagByIndex[rowIndex] ?? false,
    isArbejdsdag: tableData.isWorkdayByIndex[rowIndex] ?? false,
    tafFlags: tableData.tafFlagsByIndex[rowIndex] ?? new Set<string>(),
    svieSmerte: tableData.svieSmerteByIndex[rowIndex] ?? 'Ingen',
  }));
};

export const buildEODebugSnapshot = (args: {
  revision: string;
  stamdataValues: StamdataValues;
  eoValues: ErstatningsopgoerelseValues;
  stamdataErrors: FieldErrorsForSection<'stamdata'>;
  eoErrors: FieldErrorsForSection<'erstatningsopgoerelse'>;
  /** Clampede TAF-ranges fra engines. Når disse er leveret afspejler debug-tabellen
   *  præcis de perioder der indgik i beregningen — ikke de rå committede datoer. */
  tafRanges?: readonly IsoRange[];
  /** Autoritativt svie/smerte-engine-output fra EO-snapshot-pipelinen. */
  svieSmerteEngine?: SvieSmerteEngineOutput;
  canonicalOutput?: EoCanonicalOutput;
  sfggResult?: SygeferiegodtgoerelseResult;
}): EODebugSnapshot => {
  const { revision, stamdataValues, eoValues, stamdataErrors, eoErrors, tafRanges } = args;
  const svieSmerteContext = buildSvieSmerteContext(stamdataValues, eoValues);
  const taftContext = buildTaftContext(stamdataValues, eoValues);
  const model = buildEODebugModel(eoValues, {
    tafRanges,
    skadedatoISO: stamdataValues.skadedato,
    svieSmerteConstrainedPeriods: args.svieSmerteEngine?.constrainedPeriods,
  });
  const debugDays = buildDebugDaysFromModel(model);
  const sammentaelling = buildEODebugSammentaellingModel({
    values: eoValues,
    errors: eoErrors,
    model,
    svieSmerteContext,
    taftContext,
    tafRanges,
    canonicalOutput: args.canonicalOutput,
    sfggResult: args.sfggResult,
    svieSmerteEngine: args.svieSmerteEngine,
  });
  const sammentaellingTables = buildSammentaellingDisplayTables(sammentaelling);
  const sammentaellingRows = flattenSammentaellingDisplayTables(sammentaellingTables);

  return {
    revision,
    createdAt: new Date().toISOString(),
    model,
    debugDays,
    sammentaelling,
    sammentaellingTables,
    sammentaellingRows,
    stamdataValues,
    eoValues,
    fieldErrors: {
      stamdata: stamdataErrors,
      erstatningsopgoerelse: eoErrors,
    },
  };
};
