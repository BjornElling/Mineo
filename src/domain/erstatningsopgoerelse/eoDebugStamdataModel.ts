import type { PersistedSectionMap } from '../../config/persistenceRegistry';
import type { FieldErrorBySource } from '../../types/fieldErrors';
import { isoToDanish } from '../../types/branded';
import { collectPresentFieldErrors, isNonEmptyString, resolveDebugDisplay } from './eoDebugCommon';
import type { DebugRowModel, DebugStatus } from '../debug/eoDebugTypes';

/**
 * Debug row id must be stable and semantically tied to field identity (not label text or array order).
 *
 * This protects React key stability and makes debug output auditable.
 */
export type DebugRowId =
  | 'stamdata.journalnr'
  | 'stamdata.advokatSagsbehandler'
  | 'stamdata.skadelidte'
  | 'stamdata.skadestype'
  | 'stamdata.skadesdato';

type StamdataValues = PersistedSectionMap['stamdata'];
type StamdataFieldName = Extract<keyof StamdataValues, string>;
type StamdataFieldErrorsBySource = Partial<Record<StamdataFieldName, FieldErrorBySource>>;

export const buildEODebugStamdataRows = (values: StamdataValues, errors: StamdataFieldErrorsBySource): DebugRowModel[] => {
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

  const advokatSagsbehandlerStatus: DebugStatus = hasAdvokatSagsbehandlerErrors
    ? advokatErrors.concat(sagsbehandlerErrors).some((e) => e.severity === 'error') ? 'error' : 'warning'
    : isNonEmptyString(advokatSagsbehandler) ? 'ok' : 'ok';

  const skadesdatoLabel = values.skadestype === 'Erhvervssygdom' ? 'Anmeldelsesdato' : 'Skadesdato';

  // Konverter skadesdato til dansk format
  const danishSkadesdato = isoToDanish(values.skadesdato);

  return [
    {
      id: 'stamdata.journalnr',
      label: 'Journalnr.',
      ...resolveDebugDisplay({ value: values.journalnr, errors: errors.journalnr, emptyState: 'ok' }),
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
      ...resolveDebugDisplay({ value: values.skadelidte, errors: errors.skadelidte, emptyState: 'warning' }),
    },
    {
      id: 'stamdata.skadestype',
      label: 'Skadestype',
      ...resolveDebugDisplay({ value: values.skadestype, errors: errors.skadestype, emptyState: 'error' }),
    },
    {
      id: 'stamdata.skadesdato',
      label: skadesdatoLabel,
      ...resolveDebugDisplay({ value: danishSkadesdato, errors: errors.skadesdato, emptyState: 'error' }),
    },
  ];
};
