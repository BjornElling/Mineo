import * as React from 'react';

import { APP_ROUTES } from '../../../config/pageNavigation';
import {
  stamdataAdvokatField,
  stamdataJournalnrField,
  stamdataSagsbehandlerField,
  stamdataSkadedatoField,
  stamdataSkadelidteField,
  stamdataSkadelidteFodselsdatoField,
  stamdataSkadestypeField,
} from '../../../inputCore/catalog/stamdataDescriptors';
import { useFieldLabel } from '../../../inputCore/react';
import type { EditorLocation } from '../../../inputCore/editor/fieldEditorState';

/**
 * Stamdata-sidens ene kanoniske viewmodel (`page-component-contract.md` §4.4).
 *
 * Siden har lidt afledt state – ét dynamisk feltlabel – så modellen er tynd. Den er **bevidst bevaret for
 * ensartning** (§4.4's anti-refactor-back): svaret på "hvor bor afledt state og feltbindinger for en §2.1-side"
 * skal være det samme for alle otte sider, uanset hvor lidt den enkelte side rummer i dag. Inlin den ikke.
 *
 * Modellen ejer ingen skrivekanal: felterne skriver selv gennem deres `field` + `location`, og labelen læses
 * gennem den offentlige `InputReader`, så et fejlende felt ikke kan omgå issue-grænsen med et rå canonical read.
 * Modellen UDLEDER heller ikke labelen – den spørger feltet (§3.2a), som ejer sit eget navn.
 */

// Bundne field-refs (stabile – alle Stamdata-felter er top-level skalarer uden entity-id).
const journalnrRef = stamdataJournalnrField.bind();
const advokatRef = stamdataAdvokatField.bind();
const sagsbehandlerRef = stamdataSagsbehandlerField.bind();
const skadelidteRef = stamdataSkadelidteField.bind();
const skadelidteFodselsdatoRef = stamdataSkadelidteFodselsdatoField.bind();
const skadestypeRef = stamdataSkadestypeField.bind();
const skadedatoRef = stamdataSkadedatoField.bind();

/**
 * Stabil editorlokation pr. felt (§3.2): `locationId` er editor-metadata, ikke datafeltets identitet. `route` er
 * eksplicit navigation-metadata (§3.7), så undo/redo kan navigere hertil uden at parse `locationId`. `tabKey` er
 * `null`: Stamdata deltager IKKE i den persisterede aktiv-fane-mekanisme (`usePersistedActiveTab`) – dens fanevalg
 * er lokal `useState`, og `setActiveTabForPage` ville derfor ikke kunne skifte den. Alle editorfelter bor på
 * hovedfanen, som vises ved navigation; test-fanen er DEV-only og har ingen editorlokationer at restore til.
 */
const loc = (field: string): EditorLocation =>
  ({ locationId: `stamdata:${field}`, route: APP_ROUTES.stamdata, tabKey: null });

/** Lokationerne er konstante pr. felt, så de bygges én gang frem for pr. render. */
const LOCATIONS = Object.freeze({
  journalnr: loc('journalnr'),
  advokat: loc('advokat'),
  sagsbehandler: loc('sagsbehandler'),
  skadelidte: loc('skadelidte'),
  skadelidteFodselsdato: loc('skadelidteFodselsdato'),
  skadestype: loc('skadestype'),
  skadedato: loc('skadedato'),
});

const FIELDS = Object.freeze({
  journalnr: journalnrRef,
  advokat: advokatRef,
  sagsbehandler: sagsbehandlerRef,
  skadelidte: skadelidteRef,
  skadelidteFodselsdato: skadelidteFodselsdatoRef,
  skadestype: skadestypeRef,
  skadedato: skadedatoRef,
});

export function useStamdataViewModel() {
  // Skadedato-feltets navn er KONTEKSTUELT (§3.2a) og kommer fra feltet selv – ikke fra en label, siden
  // udleder på egen hånd. Det er netop den binding, der gør, at beskeden om feltet og den label brugeren ser
  // ikke kan navngive feltet forskelligt.
  const datoLabel = useFieldLabel(skadedatoRef);

  return React.useMemo(
    () => ({ fields: FIELDS, locations: LOCATIONS, datoLabel }),
    [datoLabel]
  );
}
