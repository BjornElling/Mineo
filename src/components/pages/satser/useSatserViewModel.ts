import * as React from 'react';

import { satserAargangField } from '../../../inputCore/catalog/satserDescriptors';
import { useInputEvaluation } from '../../../inputCore/react/useInputEvaluation';
import { APP_ROUTES } from '../../../config/pageNavigation';
import { projectSatser } from '../../../domain/satser/satserProjection';
import { satserDocumentDefinition } from '../../../domain/satser/satserDocumentDefinition';
import { useMineoDocumentOutput } from '../../../document/runtime/react/useMineoDocumentOutput';
import type { EditorLocation } from '../../../inputCore/editor/fieldEditorState';

/**
 * Satser-sidens ene kanoniske viewmodel (`page-component-contract.md` §4.4).
 *
 * Vist = beregnet (§3.9): sidevisningen udledes af SAMME reader-projektion, som definitionens gate bruger. Et
 * out-of-bounds eller tomt år giver `blocked` → satser skjules OG download blokeres; der findes ikke en
 * separat visningsvej, der kunne vise satser for et fallback-år.
 *
 * Download-livscyklussen – barriere, frisk capture, token-lighed, gate, lazy-load, friskheds-recheck og
 * fejlrouting – ejes af definitionen (§A2). Modellen konfigurerer den ikke; den aktiverer den.
 */

// Stabil felt-ref + editorlokation (§3.2): locationId er editor-metadata, ikke datafeltets identitet.
const aargangRef = satserAargangField.bind();
// route er eksplicit navigation-metadata (§3.7); Satser er en side uden faner (tabKey: null).
const aargangLocation: EditorLocation = {
  locationId: 'satser:aargang',
  route: APP_ROUTES.satser,
  tabKey: null,
};

export function useSatserViewModel() {
  const evaluation = useInputEvaluation();

  const projection = React.useMemo(() => projectSatser(evaluation.reader), [evaluation]);
  const effectiveYear = projection.status === 'ready' ? projection.value.year : undefined;
  const satser = projection.status === 'ready' ? projection.value.satser : null;

  const download = useMineoDocumentOutput(satserDocumentDefinition, undefined);

  return {
    aargangField: aargangRef,
    aargangLocation,
    effectiveYear,
    satser,
    download,
    /** Sidetitlen bærer årstallet, men KUN for et gyldigt valgt år. */
    pageTitle: effectiveYear !== undefined ? `Arbejdsskadesatser ${effectiveYear}` : 'Arbejdsskadesatser',
  };
}
