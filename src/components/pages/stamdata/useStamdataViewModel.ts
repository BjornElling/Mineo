import * as React from 'react';

import { resolveStamdataDatoLabel } from '../../../domain/policies';
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
import { useInputEvaluation } from '../../../inputCore/react';
import type { EditorLocation } from '../../../inputCore/editor/fieldEditorState';

/**
 * Stamdata-sidens ene kanoniske viewmodel (`page-component-contract.md` §4.4).
 *
 * Siden har lidt afledt state — ét dynamisk feltlabel — så modellen er tynd. Den er **bevidst bevaret for
 * ensartning** (§4.4's anti-refactor-back): svaret på "hvor bor afledt state og feltbindinger for en §2.1-side"
 * skal være det samme for alle otte sider, uanset hvor lidt den enkelte side rummer i dag. Inlin den ikke.
 *
 * Modellen ejer ingen skrivekanal: felterne skriver selv gennem deres `field` + `location`, og labelen læses
 * gennem den offentlige `InputReader`, så et fejlende felt ikke kan omgå issue-grænsen med et rå canonical read.
 */

// Bundne field-refs (stabile — alle Stamdata-felter er top-level skalarer uden entity-id).
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
 * `null`: Stamdata deltager IKKE i den persisterede aktiv-fane-mekanisme (`usePersistedActiveTab`) — dens fanevalg
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
  // Den dynamiske datolabel afhænger af den AFSLUTTEDE skadestype-værdi (§1.2) og læses gennem samme offentlige
  // reader som øvrige consumers.
  const evaluation = useInputEvaluation();
  const skadestypeRead = evaluation.reader.read(skadestypeRef);
  const skadestype = skadestypeRead.status === 'usable' ? skadestypeRead.value : undefined;

  const datoLabel = React.useMemo(
    () => resolveStamdataDatoLabel(skadestype === undefined ? null : { skadestype }),
    [skadestype]
  );

  return React.useMemo(
    () => ({ fields: FIELDS, locations: LOCATIONS, datoLabel }),
    [datoLabel]
  );
}
