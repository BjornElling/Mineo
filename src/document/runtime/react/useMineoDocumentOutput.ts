/**
 * Hovedappens ene vej fra en side til et dokumentoutput.
 *
 * En side kalder `useMineoDocumentOutput(definition, request)` og får både den reaktive knap-gate og
 * click-preflighten tilbage. Tidligere skrev hver side selv den sekvens: settle → frisk capture →
 * token-lighed → projektion → gate → servicekald, og ni sider havde hver sin kopi. Fem af kopierne
 * manglede mindst ét trin.
 *
 * Hooken samler tre ting, der ellers skulle gentages på hver side:
 *
 *   1. **Miljøet** (`useMineoDocumentEnvironment`) — appens runtimepolitik, bundet til den monterede
 *      input-runtimes commit-barriere.
 *   2. **Katalogposten** (`closeDocumentDefinition`) — definitionen lukket om miljøet. Memoiseret,
 *      så gate-memoen nedenfor ikke invalideres ved hver render.
 *   3. **Kildekonteksten** (`useDocumentSourceContext`) — render-tidens evaluation + settings, ÉN pr.
 *      revision. Flere outputs på samme side deler den gennem `useMineoDocumentSourceContext`, så en
 *      dyr fælles domæneprojektion kun køres én gang; et enkeltstående output kan bruge hooken uden
 *      at tænke over det.
 *
 * Kataloget komponeres altså pr. side frem for som én global `Map`. Det er ikke en stilistisk
 * detalje: Mineos ruter er lazy (`App.tsx`), og et globalt katalog ville have trukket samtlige
 * domæners projektionslag ind i den første dokumentførende route.
 */
import React from 'react';
import { useAppSettings } from '../../../contexts/useAppSettings';
import { useInputEvaluation } from '../../../inputCore/react';
import { closeDocumentAction, closeDocumentDefinition, type DocumentOutput } from '../../definition/documentCatalog';
import type { DocumentAction } from '../../definition/documentAction';
import type { DocumentSourceContext } from '../../definition/documentSourceContext';
import {
  projectDocumentRenderSettings,
  projectEoRowPolicy,
  projectSourceSettings,
  type DocumentRenderSettings,
} from '../../../settings/sourceSettings';
import type { MineoDocumentDefinition, MineoDocumentGateSettings } from '../../definition/mineoDocumentDefinition';
import type { DocumentBrevhovedType } from '../../layout/documentBrevhoved';
import {
  useDocumentDownload,
  useDocumentSourceContext,
  type DocumentDownloadHandle,
} from '../../definition/react/useDocumentDownload';
import { useMineoDocumentEnvironment } from './useMineoDocumentEnvironment';

/**
 * Render-tidens delte kildekontekst for hovedappen. Kald den ÉN gang pr. side (eller pr. sektion med
 * flere outputs) og videregiv resultatet til `useMineoDocumentOutput`, når flere outputs deler en dyr
 * projektion — fx EO's fire dokumenter eller EET's fire faner.
 */
export const useMineoDocumentSourceContext = (): DocumentSourceContext<MineoDocumentGateSettings> => {
  const evaluation = useInputEvaluation();
  const { settings } = useAppSettings();
  // Samme indsnævring som miljøets `captureSource`, så render-tidens gate og click-preflighten ser
  // PRÆCIS samme settings-form — her GATE-halvdelen alene. Memoiseret, fordi projektionen
  // ellers ville give en ny reference ved hver render og dermed slå kildekontekstens delte
  // projektions-memo ihjel.
  const gateSettings = React.useMemo(
    () => projectEoRowPolicy(projectSourceSettings(settings)),
    [settings]
  );
  return useDocumentSourceContext(evaluation, gateSettings);
};

/**
 * Render-tidens format-/brevhoved-settings, som udfaldsbeskeden navngiver formatet med.
 *
 * Bevidst en SELVSTÆNDIG hook og ikke et felt på kildekonteksten: konteksten er det, en
 * definitions `project` ser, og formatet må ikke kunne nå en gate. Værdien bruges derfor kun på
 * beskedsiden.
 */
const useMineoDocumentRenderSettings = (): DocumentRenderSettings => {
  const { settings } = useAppSettings();
  return React.useMemo(
    () => projectDocumentRenderSettings(projectSourceSettings(settings)),
    [settings]
  );
};

/** Binder én definition til hovedappens miljø. Memoiseret på definition + miljø. */
export const useMineoDocumentCatalogEntry = <TInput, TRequest>(
  definition: MineoDocumentDefinition<TInput, TRequest>
): DocumentOutput<TRequest, MineoDocumentGateSettings, DocumentRenderSettings> => {
  const environment = useMineoDocumentEnvironment();
  return React.useMemo(() => closeDocumentDefinition(definition, environment), [definition, environment]);
};

/**
 * Ét dokumentoutput, klar til en knap.
 *
 * `gateRequest` er den request, den reaktive gate vurderes for — for rækkebaserede outputs den række,
 * knappen tegnes for; for outputs uden aktiveringsidentitet `undefined as void`. `download(request)`
 * tager sin egen request, så en liste kan dele ét handle, hvis den vil.
 *
 * `context` kan udelades, når siden kun har ét output; så bygger hooken sin egen. Deler flere outputs
 * en dyr projektion, SKAL den samme kontekst sendes ind til dem alle — ellers får hver sit memo-slot.
 */
export const useMineoDocumentOutputWithContext = <TInput, TRequest>(
  definition: MineoDocumentDefinition<TInput, TRequest>,
  // `NoInfer` er ikke kosmetik: uden den ville et kald med `undefined` inferere `TRequest = undefined`
  // frem for at bruge definitionens `void`, og handlen ville da ikke kunne tildeles en
  // `DocumentDownloadHandle<void>`-prop. Requesten er definitionens type — ikke argumentets.
  gateRequest: NoInfer<TRequest>,
  context: DocumentSourceContext<MineoDocumentGateSettings>
): DocumentDownloadHandle<TRequest> => {
  const output = useMineoDocumentCatalogEntry(definition);
  const renderSettings = useMineoDocumentRenderSettings();
  return useDocumentDownload(output, context, gateRequest, renderSettings);
};

/** Ét selvstændigt dokumentoutput uden en side-delt kildekontekst. */
export const useMineoDocumentOutput = <TInput, TRequest>(
  definition: MineoDocumentDefinition<TInput, TRequest>,
  gateRequest: NoInfer<TRequest>
): DocumentDownloadHandle<TRequest> => {
  const context = useMineoDocumentSourceContext();
  return useMineoDocumentOutputWithContext(definition, gateRequest, context);
};

/** Binder en dynamisk handling til samme miljø og kontekst som statiske outputs. */
export const useMineoDocumentActionOutput = <TRequest>(
  action: DocumentAction<TRequest, MineoDocumentGateSettings, DocumentBrevhovedType>,
  gateRequest: NoInfer<TRequest>,
  context: DocumentSourceContext<MineoDocumentGateSettings>
): DocumentDownloadHandle<TRequest> => {
  const environment = useMineoDocumentEnvironment();
  const output = React.useMemo(() => closeDocumentAction(action, environment), [action, environment]);
  const renderSettings = useMineoDocumentRenderSettings();
  return useDocumentDownload(output, context, gateRequest, renderSettings);
};
