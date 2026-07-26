import type { PersistedSectionMap } from '../../config/persistenceRegistry';
import { isoToDanish } from '../../types/branded';
import { presentIssuesForRow, resolveEoRowDisplay } from './eoRowCommon';
import { isNonEmptyString } from '../erstatningsopgoerelse/validation/eoDateRangeMessages';
import type { EoRowModel, EoRowStatus } from './eoRowTypes';
import type { EoInputIssue } from '../erstatningsopgoerelse/eoInputIssues';

/**
 * Række-id skal være stabilt og semantisk knyttet til feltets identitet (ikke label-tekst eller array-rækkefølge).
 *
 * Dette beskytter React-key-stabilitet og gør kontrol-output auditerbart.
 */
export type EoRowId =
  | 'stamdata.journalnr'
  | 'stamdata.advokatSagsbehandler'
  | 'stamdata.skadelidte'
  | 'stamdata.skadestype'
  | 'stamdata.skadedato';

type StamdataValues = PersistedSectionMap['stamdata'];
type StamdataFieldName = Extract<keyof StamdataValues, string>;
type StamdataFieldIssues = Partial<Record<StamdataFieldName, EoInputIssue>>;

export const buildEoStamdataRows = (values: StamdataValues, errors: StamdataFieldIssues): EoRowModel[] => {
  const advokat = isNonEmptyString(values.advokat) ? values.advokat.trim() : undefined;
  const sagsbehandler = isNonEmptyString(values.sagsbehandler) ? values.sagsbehandler.trim() : undefined;
  const advokatSagsbehandler =
    advokat && sagsbehandler ? `${advokat} / ${sagsbehandler}` : (advokat ?? sagsbehandler);

  const advokatErrors = presentIssuesForRow(errors.advokat);
  const sagsbehandlerErrors = presentIssuesForRow(errors.sagsbehandler);
  const hasAdvokatSagsbehandlerErrors = advokatErrors.length > 0 || sagsbehandlerErrors.length > 0;

  const advokatSagsbehandlerDisplay = (() => {
    if (!hasAdvokatSagsbehandlerErrors) return undefined;
    const parts: string[] = [];
    for (const e of advokatErrors) {
      parts.push(`Advokat: ${e.message.trim()}`);
    }
    for (const e of sagsbehandlerErrors) {
      parts.push(`Sagsbehandler: ${e.message.trim()}`);
    }
    const hasError = advokatErrors.concat(sagsbehandlerErrors).some((e) => e.severity === 'error');
    return `${hasError ? 'Fejl' : 'Advarsel'} (${parts.join('; ')})`;
  })();

  const advokatSagsbehandlerStatus: EoRowStatus = hasAdvokatSagsbehandlerErrors
    ? advokatErrors.concat(sagsbehandlerErrors).some((e) => e.severity === 'error') ? 'error' : 'warning'
    : isNonEmptyString(advokatSagsbehandler) ? 'ok' : 'ok';

  const skadedatoLabel = values.skadestype === 'Erhvervssygdom' ? 'Anmeldelsesdato' : 'Skadedato';

  // Konverter skadedato til dansk format
  const danishSkadedato = isoToDanish(values.skadedato);

  return [
    {
      id: 'stamdata.journalnr',
      label: 'Journalnr.',
      ...resolveEoRowDisplay({ value: values.journalnr, issue: errors.journalnr, emptyState: 'ok' }),
    },
    {
      id: 'stamdata.advokatSagsbehandler',
      label: 'Advokat/Sagsbehandler',
      displayValue:
        advokatSagsbehandlerDisplay ?? (isNonEmptyString(advokatSagsbehandler) ? advokatSagsbehandler.trim() : '-'),
      status: advokatSagsbehandlerStatus,
    },
    {
      id: 'stamdata.skadelidte',
      label: 'Skadelidtes navn',
      ...resolveEoRowDisplay({ value: values.skadelidte, issue: errors.skadelidte, emptyState: 'warning' }),
    },
    {
      id: 'stamdata.skadestype',
      label: 'Skadestype',
      ...resolveEoRowDisplay({ value: values.skadestype, issue: errors.skadestype, emptyState: 'error' }),
    },
    {
      id: 'stamdata.skadedato',
      label: skadedatoLabel,
      ...resolveEoRowDisplay({ value: danishSkadedato, issue: errors.skadedato, emptyState: 'error' }),
    },
  ];
};
