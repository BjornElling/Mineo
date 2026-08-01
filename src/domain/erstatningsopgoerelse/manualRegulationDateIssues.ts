import { toAnyFieldRef } from '../../inputCore/fieldDescriptor';
import type { FieldIssue } from '../../inputCore/inputIssue';
import type {
  ErstatningsopgoerelseValues,
  LoenudviklingManuelProcentsatsRow,
  LoenudviklingManuelRow,
  StamdataValues,
} from '../../schemas/formSchemas';
import { isoToDanish, type ISODateString } from '../../types/branded';
import {
  eoAngivetLoenManual,
  eoEmploymentManual,
  type ManualBindings,
} from '../../inputCore/catalog/erstatningsopgoerelseLoenDescriptors';
import { getAngivetLoenOpreguleresFraDato } from './helpers/angivetLoenHelpers';
import { resolveAnvendtReguleringsdato } from './helpers/eoSharedUtils';
import { isManualRegulationDateOnOrBeforeBasis } from './helpers/manuelReguleringRowPredicates';

type ManualDateRow = LoenudviklingManuelRow | LoenudviklingManuelProcentsatsRow;

const collectTableDateIssues = (args: Readonly<{
  rows: readonly ManualDateRow[];
  anvendtReguleringsdato: ISODateString | undefined;
  dateField: ManualBindings['manualFields']['dato'] | ManualBindings['manualPercentFields']['dato'];
  bindIds: (rowId: string) => readonly string[];
}>): readonly FieldIssue[] => {
  const anvendtReguleringsdato = args.anvendtReguleringsdato;
  if (anvendtReguleringsdato === undefined) return [];
  const datoDisplay = isoToDanish(anvendtReguleringsdato) ?? anvendtReguleringsdato;
  const message = `Datoen skal være senere end datoen i den låste første række (${datoDisplay})`;

  // Første række er programmets låste basisrække. Kun brugerens efterfølgende rækker er omfattet af
  // den strenge kronologi; en lig dato ville ellers oprette to forskellige reguleringer på samme anker.
  return args.rows.slice(1).flatMap((row) => {
    if (!isManualRegulationDateOnOrBeforeBasis(row.dato, anvendtReguleringsdato)) return [];
    const field = args.dateField.bind(...args.bindIds(row.id));
    return [Object.freeze({
      kind: 'field' as const,
      code: `${field.descriptor.id}.dato.afterAnvendtRegulering`,
      severity: 'error' as const,
      field: toAnyFieldRef(field),
      reason: 'rule' as const,
      message,
      detail: Object.freeze({ anvendtReguleringsdato }),
    })];
  });
};

/**
 * Udleder datofejlene for den aktive manuelle reguleringsform. Inaktive tabellers bevarede input må ikke
 * blokere sagen, men begge former følger samme regel, når de er valgt.
 */
export const collectManualRegulationDateIssues = (
  values: ErstatningsopgoerelseValues,
  stamdata: Pick<StamdataValues, 'skadedato'>
): readonly FieldIssue[] => {
  const issues: FieldIssue[] = [];
  const angivetLoenOpreguleresFraDato = getAngivetLoenOpreguleresFraDato(values);

  for (const employment of values.loenindkomstAnsaettelsesforhold) {
    const basis = employment.loenudviklingBeregningsgrundlag;
    if (basis !== 'Manuelt angivet' && basis !== 'Manuel procentsats') continue;
    const anvendtReguleringsdato = resolveAnvendtReguleringsdato({
      beregnesUdFra: values.beregnesUdFra,
      angivetLoenMetodeOpreguleresFraDato: angivetLoenOpreguleresFraDato,
      saerligFraDatoRegulering: employment.saerligFraDatoRegulering,
      beregningsperiodeTil: values.tafBeregningsperiodeTil,
      skadedato: stamdata.skadedato,
    });
    const isPercent = basis === 'Manuel procentsats';
    issues.push(...collectTableDateIssues({
      rows: isPercent
        ? employment.loenudviklingManuelProcentsatsTableData
        : employment.loenudviklingManuelTableData,
      anvendtReguleringsdato,
      dateField: isPercent
        ? eoEmploymentManual.manualPercentFields.dato
        : eoEmploymentManual.manualFields.dato,
      bindIds: (rowId) => [employment.id, rowId],
    }));
  }

  const eoLoen = values.eoAngivetLoenLoenudvikling;
  const eoBasis = eoLoen.loenudviklingBeregningsgrundlag;
  if (
    (values.beregnesUdFra === 'Angivet månedsløn' || values.beregnesUdFra === 'Angivet dagsløn')
    && (eoBasis === 'Manuelt angivet' || eoBasis === 'Manuel procentsats')
  ) {
    const anvendtReguleringsdato = resolveAnvendtReguleringsdato({
      beregnesUdFra: values.beregnesUdFra,
      angivetLoenMetodeOpreguleresFraDato: angivetLoenOpreguleresFraDato,
      saerligFraDatoRegulering: undefined,
      beregningsperiodeTil: values.tafBeregningsperiodeTil,
      skadedato: stamdata.skadedato,
    });
    const isPercent = eoBasis === 'Manuel procentsats';
    issues.push(...collectTableDateIssues({
      rows: isPercent
        ? eoLoen.loenudviklingManuelProcentsatsTableData
        : eoLoen.loenudviklingManuelTableData,
      anvendtReguleringsdato,
      dateField: isPercent
        ? eoAngivetLoenManual.manualPercentFields.dato
        : eoAngivetLoenManual.manualFields.dato,
      bindIds: (rowId) => [rowId],
    }));
  }

  return Object.freeze(issues);
};
