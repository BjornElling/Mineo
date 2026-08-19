import type { ErstatningsopgoerelseValues, StamdataValues } from '../../schemas/formSchemas';
import type { IsoRange } from '../erstatningsopgoerelse/validation/tafPeriodConstraints';
import type { SvieSmerteEngineOutput } from '../erstatningsopgoerelse/engines/svieSmerteEngine';
import type { SygeferiegodtgoerelseResult } from '../erstatningsopgoerelse/engines/sfggResult';
import type { EoCanonicalOutput } from '../erstatningsopgoerelse/snapshot/eoCanonicalOutput';
import { buildEOInspektionModel } from './eoInspektionKontrolModel';
import type { RowDay } from '../eoRowEvaluation/eoRowTypes';
import {
  buildEOInspektionSammentaellingModel,
  buildSammentaellingDisplayTables,
  flattenSammentaellingDisplayTables,
  buildSvieSmerteContext,
  buildTaftContext,
  type SammentaellingDisplayTables,
  type SammentaellingModel,
} from './eoInspektionSammentaelling';
import type { SammentaellingDisplayRow } from '../erstatningsopgoerelse/control/eoControlMismatch';
import type { EOInspektionModel } from './eoInspektionKontrolModel';
import type { FieldIssueSet } from '../../inputCore/inputIssue';

/**
 * EOInspektionSnapshot er et konsistens-kritisk, entry-bundet snapshot.
 *
 * Invarianter:
 * - bygges kun ved tab-entry
 * - revision er monotont voksende og skal ændre sig ved mutation af EO-input/-fejl
 */
export type EOInspektionSnapshot = Readonly<{
  revision: string;
  model: EOInspektionModel;
  inspektionDays: readonly RowDay[];
  sammentaelling: SammentaellingModel;
  sammentaellingTables: SammentaellingDisplayTables;
  sammentaellingRows: readonly SammentaellingDisplayRow[];
  stamdataValues: StamdataValues;
  eoValues: ErstatningsopgoerelseValues;
  fieldErrors: Readonly<{
    stamdata: FieldIssueSet;
    erstatningsopgoerelse: FieldIssueSet;
  }>;
}>;

const buildInspektionDaysFromModel = (model: EOInspektionModel): readonly RowDay[] => {
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

export const buildEOInspektionSnapshot = (args: {
  revision: string;
  stamdataValues: StamdataValues;
  eoValues: ErstatningsopgoerelseValues;
  stamdataErrors: FieldIssueSet;
  eoErrors: FieldIssueSet;
  /** Clampede TAF-ranges fra engines. Når disse er leveret afspejler kontroltabellen
   *  præcis de perioder der indgik i beregningen – ikke de rå committede datoer. */
  tafRanges?: readonly IsoRange[];
  /** Autoritativt svie/smerte-engine-output fra EO-snapshot-pipelinen. */
  svieSmerteEngine?: SvieSmerteEngineOutput;
  canonicalOutput?: EoCanonicalOutput;
  sfggResult?: SygeferiegodtgoerelseResult;
}): EOInspektionSnapshot => {
  const { revision, stamdataValues, eoValues, stamdataErrors, eoErrors, tafRanges } = args;
  const svieSmerteContext = buildSvieSmerteContext(stamdataValues, eoValues);
  const taftContext = buildTaftContext(stamdataValues, eoValues);
  const model = buildEOInspektionModel(eoValues, {
    tafRanges,
    skadedatoISO: stamdataValues.skadedato,
    svieSmerteConstrainedPeriods: args.svieSmerteEngine?.constrainedPeriods,
  });
  const inspektionDays = buildInspektionDaysFromModel(model);
  const sammentaelling = buildEOInspektionSammentaellingModel({
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
    model,
    inspektionDays,
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
