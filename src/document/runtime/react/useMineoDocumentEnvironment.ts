/**
 * Hovedappens dokumentmiljø som en hook (Fase 5, pass 7).
 *
 * Miljøet er per definition app-globalt (samme kildeport, samme formatpolitik, samme failure-sink),
 * men det skal bindes til den `CriticalActionCoordinator`, der hører til den monterede
 * input-runtime. Hooken er derfor det ene sted, hvor sammenkoblingen sker, og den memoiseres på
 * koordinatoren, så et miljø ikke bliver en ny reference ved hver render — katalogposterne
 * afhænger af det, og hookens gate-memo afhænger af katalogposterne.
 *
 * Standalone MinProcesrente har sin egen tilsvarende hook i sit eget scope; de to må ikke deles,
 * fordi standalone hverken har eller må importere `AppSettings`.
 */
import React from 'react';
import { useCriticalInputActions } from '../../../inputCore/react';
import type { DocumentBrevhovedType } from '../../layout/documentBrevhoved';
import type { DocumentExecutionEnvironment } from '../../definition/documentExecutionEnvironment';
import type { DocumentSourceSettings } from '../../definition/documentSourceSettings';
import { createMineoDocumentEnvironment } from '../mineoDocumentEnvironment';

export const useMineoDocumentEnvironment = (): DocumentExecutionEnvironment<DocumentSourceSettings, DocumentBrevhovedType> => {
  const criticalActions = useCriticalInputActions();
  return React.useMemo(() => createMineoDocumentEnvironment(criticalActions), [criticalActions]);
};
