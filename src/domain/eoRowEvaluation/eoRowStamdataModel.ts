import type { PersistedSectionMap } from '../../config/persistenceRegistry';
import type { FieldErrorBySource } from '../../types/fieldErrors';
import { isoToDanish } from '../../types/branded';
import { collectPresentFieldErrors, isNonEmptyString, resolveEoRowDisplay } from './eoRowCommon';
import type { EoRowModel, EoRowStatus } from './eoRowTypes';

/**
 * Debug-row-id skal være stabilt og semantisk knyttet til feltets identitet (ikke label-tekst eller array-rækkefølge).
 *
 * Dette beskytter React-key-stabilitet og gør debug-output auditerbart.
 */
export type EoRowId =
  | 'stamdata.journalnr'
  | 'stamdata.advokatSagsbehandler'
  | 'stamdata.skadelidte'
  | 'stamdata.skadestype'
  | 'stamdata.skadedato';

type StamdataValues = PersistedSectionMap['stamdata'];
type StamdataFieldName = Extract<keyof StamdataValues, string>;
type StamdataFieldErrorsBySource = Partial<Record<StamdataFieldName, FieldErrorBySource>>;

export const buildEoStamdataRows = (values: StamdataValues, errors: StamdataFieldErrorsBySource): EoRowModel[] => {
  const advokat = isNonEmptyString(values.advokat) ? values.advokat.trim() : undefined;
  const sagsbehandler = isNonEmptyString(values.sagsbehandler) ? values.sagsbehandler.trim() : undefined;
  const advokatSagsbehandler =
    advokat && sagsbehandler ? `${advokat} / ${sagsbehandler}` : (advokat ?? sagsbehandler);

  const advokatErrors = collectPresentFieldErrors(errors.advokat);
  const sagsbehandlerErrors = collectPresentFieldErrors(errors.sagsbehandler);
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
      ...resolveEoRowDisplay({ value: values.journalnr, errors: errors.journalnr, emptyState: 'ok' }),
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
      ...resolveEoRowDisplay({ value: values.skadelidte, errors: errors.skadelidte, emptyState: 'warning' }),
    },
    {
      id: 'stamdata.skadestype',
      label: 'Skadestype',
      ...resolveEoRowDisplay({ value: values.skadestype, errors: errors.skadestype, emptyState: 'error' }),
    },
    {
      id: 'stamdata.skadedato',
      label: skadedatoLabel,
      ...resolveEoRowDisplay({ value: danishSkadedato, errors: errors.skadedato, emptyState: 'error' }),
    },
  ];
};
