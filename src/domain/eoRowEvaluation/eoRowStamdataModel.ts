import type { PersistedSectionMap } from '../../config/persistenceRegistry';
import { isoToDanish } from '../../types/branded';
import { presentIssuesForRow, resolveEoRowDisplay } from './eoRowCommon';
import { isNonEmptyString } from '../erstatningsopgoerelse/validation/eoDateRangeMessages';
import type { EoRowModel, EoRowStatus } from './eoRowTypes';
import type { FieldIssueSet } from '../../inputCore/inputIssue';
import { topLevelFieldIssue } from '../erstatningsopgoerelse/eoInputIssues';
import { resolveSkadestypeDatoLabel } from '../policies/stamdataCalculations';
import type { AfsluttesMed } from '../../schemas/formSchemas';

type StamdataValues = PersistedSectionMap['stamdata'];
type StamdataFieldIssues = FieldIssueSet;

/**
 * Kræver den valgte afslutningsform skadelidtes navn?
 *
 * «Underskrift-linje» trykker navnet under selve underskriftslinjen. Uden det skrev dokumentet ordret
 * `*skadelidtes navn*` i et papir, der skulle sendes til underskrift, mens download var tilladt og den
 * eneste advarsel handlede om brevhovedet (BB-214). Navnet er uundværligt PRÆCIS i den tilstand: ved
 * «Bekræftet godkendt» og «Ingen» sættes det ikke, og en manglende værdi er da fortsat kun en advarsel.
 */
const kraeverSkadelidtesNavn = (afsluttesMed: AfsluttesMed | undefined): boolean =>
  afsluttesMed === 'Underskrift-linje';

export const buildEoStamdataRows = (
  values: StamdataValues,
  errors: StamdataFieldIssues,
  erstatningsopgoerelseAfsluttesMed: AfsluttesMed | undefined
): EoRowModel[] => {
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

  // Blokerer et tomt navn, skal beskeden sige HVORFOR. Den generiske «'Skadelidtes navn' er ikke angivet»
  // ville ikke forklare, at det netop er afslutningsformen, der gør navnet uundværligt – og brugeren ville
  // stå med en blokeret download uden at kunne se, at det andet valg fjerner kravet (BB-214).
  const skadelidteBlokerer =
    kraeverSkadelidtesNavn(erstatningsopgoerelseAfsluttesMed) && !isNonEmptyString(values.skadelidte);
  const skadelidteIssue = topLevelFieldIssue(errors, 'stamdata', 'skadelidte');
  const skadelidteDisplay = skadelidteBlokerer && presentIssuesForRow(skadelidteIssue).length === 0
    ? {
      displayValue: 'Fejl (Skadelidtes navn skal angives, når opgørelsen afsluttes med en underskrift-linje)',
      status: 'error' as EoRowStatus,
    }
    : resolveEoRowDisplay({ value: values.skadelidte, issue: skadelidteIssue, emptyState: 'warning' });

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
      ...skadelidteDisplay,
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
