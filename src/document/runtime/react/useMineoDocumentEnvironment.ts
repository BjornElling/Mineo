/**
 * Hovedappens dokumentmiljø som en hook.
 *
 * Miljøet er per definition app-globalt (samme kildeport, samme formatpolitik, samme failure-sink),
 * men det skal bindes til den `CriticalActionCoordinator`, der hører til den monterede
 * input-runtime. Hooken er derfor det ene sted, hvor sammenkoblingen sker, og den memoiseres på
 * koordinatoren, så et miljø ikke bliver en ny reference ved hver render – katalogposterne
 * afhænger af det, og hookens gate-memo afhænger af katalogposterne.
 *
 * Standalone MinProcesrente har sin egen tilsvarende hook i sit eget scope; de to må ikke deles,
 * fordi standalone hverken har eller må importere `AppSettings`.
 */
import React from 'react';
import { useDocumentInputAccess } from '../../../inputCore/react';
import { readPublishedSourceSettings } from '../../../inputCore/react/productionInputRuntime';
import type { DocumentBrevhovedType } from '../../layout/documentBrevhoved';
import type { DocumentExecutionEnvironment } from '../../definition/documentExecutionEnvironment';
import type { MineoDocumentGateSettings } from '../../definition/mineoDocumentDefinition';
import type { DocumentRenderSettings } from '../../../settings/sourceSettings';
import { createMineoDocumentEnvironment } from '../mineoDocumentEnvironment';

/**
 * Settings læses IKKE fra `useAppSettings` her.
 *
 * Hooken bandt tidligere miljøet til et `projectSourceSettings(settings)`-memo fra sin egen render. Det gjorde
 * settingshalvdelen af kildesnapshottet render-fanget, mens inputhalvdelen blev optaget friskt efter settle:
 * et click-preflight kunne dermed parre et NYT settingsrevision-token med det settingsobjekt, der gjaldt ved
 * sidste render. Miljøet binder sig nu til `readPublishedSourceSettings`, som returnerer den værdi, der
 * publiceres i samme layout-fase som settingsrevisionen hæves – altså den ENE kilde, tokenet faktisk beskriver.
 *
 * Fordelen er også referencestabilitet: miljøet afhænger nu kun af runtime-bindingen, så et settingsskift ikke
 * længere invaliderer hele gate-memoiseringen nedstrøms.
 */
export const useMineoDocumentEnvironment = (): DocumentExecutionEnvironment<
  MineoDocumentGateSettings,
  DocumentRenderSettings,
  DocumentBrevhovedType
> => {
  const runtime = useDocumentInputAccess();
  return React.useMemo(
    () => createMineoDocumentEnvironment(runtime, readPublishedSourceSettings),
    [runtime]
  );
};
