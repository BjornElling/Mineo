import type { PersistedSectionMap } from '../../config/persistenceRegistry';
import { isoToDanish } from '../../types/branded';
import { presentIssuesForRow, resolveEoRowDisplay } from './eoRowCommon';
import { isNonEmptyString } from '../erstatningsopgoerelse/validation/eoDateRangeMessages';
import type { EoRowModel, EoRowStatus } from './eoRowTypes';
import type { FieldIssueSet } from '../../inputCore/inputIssue';
import { topLevelFieldIssue } from '../erstatningsopgoerelse/eoInputIssues';
import { resolveSkadestypeDatoLabel } from '../policies/stamdataCalculations';

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
type StamdataFieldIssues = FieldIssueSet;

export const buildEoStamdataRows = (values: StamdataValues, errors: StamdataFieldIssues): EoRowModel[] => {
  const advokat = isNonEmptyString(values.advokat) ? values.advokat.trim() : undefined;
  const sagsbehandler = isNonEmptyString(values.sagsbehandler) ? values.sagsbehandler.trim() : undefined;
  const advokatSagsbehandler =
    advokat && sagsbehandler ? `${advokat} / ${sagsbehandler}` : (advokat ?? sagsbehandler);

  const advokatErrors = presentIssuesForRow(topLevelFieldIssue(errors, 'stamdata', 'advokat'));
  const sagsbehandlerErrors = presentIssuesForRow(topLevelFieldIssue(errors, 'stamdata', 'sagsbehandler'));
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

  // Rækkens label er samme feltnavn, brugeren ser på Stamdata: læses fra feltets ene navneregel (§3.2a).
  const skadedatoLabel = resolveSkadestypeDatoLabel(values.skadestype);

  // Konverter skadedato til dansk format
  const danishSkadedato = isoToDanish(values.skadedato);

  return [
    {
      id: 'stamdata.journalnr',
      label: 'Journalnr.',
      ...resolveEoRowDisplay({ value: values.journalnr, issue: topLevelFieldIssue(errors, 'stamdata', 'journalnr'), emptyState: 'ok' }),
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
      ...resolveEoRowDisplay({ value: values.skadelidte, issue: topLevelFieldIssue(errors, 'stamdata', 'skadelidte'), emptyState: 'warning' }),
    },
    {
      id: 'stamdata.skadestype',
      label: 'Skadestype',
      ...resolveEoRowDisplay({ value: values.skadestype, issue: topLevelFieldIssue(errors, 'stamdata', 'skadestype'), emptyState: 'error' }),
    },
    {
      id: 'stamdata.skadedato',
      label: skadedatoLabel,
      ...resolveEoRowDisplay({ value: danishSkadedato, issue: topLevelFieldIssue(errors, 'stamdata', 'skadedato'), emptyState: 'error' }),
    },
  ];
};
