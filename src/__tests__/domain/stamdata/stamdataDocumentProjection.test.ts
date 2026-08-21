// @vitest-environment jsdom
import { __createSlimInputTestStore } from '../../../inputCore/runtime/slimInputStore';
import { buildProductionInputCatalog } from '../../../inputCore/catalog/productionCatalog';
import { stamdataSkadedatoField } from '../../../inputCore/catalog/stamdataDescriptors';
import { createInputEvaluation } from '../../../inputCore/inputReader';
import { createEvaluationSourceToken } from '../../../inputCore/evaluationSource';
import {
  projectStamdataForDocument,
  projectStamdataForDocumentIfEnabled,
} from '../../../domain/stamdata/stamdataDocumentProjection';
import { dispatchInput, initializeInputRuntime } from '../../../inputCore/runtime';
import { settleField } from '../../../inputCore/inputReducer';

describe('projectStamdataForDocument', () => {
  it('returnerer typed tom stamdata, når alle optionelle felter er tomme', () => {
    sessionStorage.clear();
    const catalog = buildProductionInputCatalog();
    const store = __createSlimInputTestStore();
    initializeInputRuntime(store, catalog);
    const state = store.getState();
    const evaluation = createInputEvaluation({
      input: state.input,
      catalog,
      sourceToken: createEvaluationSourceToken(state.revision, state.settingsRevision),
    });

    const result = projectStamdataForDocument(evaluation.reader, 'document.test');

    expect(result.status).toBe('ready');
  });

  it('blokerer ved en rød fejl i et brevhovedfelt', () => {
    sessionStorage.clear();
    const catalog = buildProductionInputCatalog();
    const store = __createSlimInputTestStore();
    initializeInputRuntime(store, catalog);
    dispatchInput(store, catalog, settleField(stamdataSkadedatoField.bind(), 'ikke-en-dato'));
    const state = store.getState();
    const evaluation = createInputEvaluation({
      input: state.input,
      catalog,
      sourceToken: createEvaluationSourceToken(state.revision, state.settingsRevision),
    });

    const result = projectStamdataForDocument(evaluation.reader, 'document.test');

    expect(result.status).toBe('blocked');
  });

  it('læser ikke stamdata som dependency, når brevhovedet er slået fra', () => {
    sessionStorage.clear();
    const catalog = buildProductionInputCatalog();
    const store = __createSlimInputTestStore();
    initializeInputRuntime(store, catalog);
    dispatchInput(store, catalog, settleField(stamdataSkadedatoField.bind(), 'ikke-en-dato'));
    const state = store.getState();
    const evaluation = createInputEvaluation({
      input: state.input,
      catalog,
      sourceToken: createEvaluationSourceToken(state.revision, state.settingsRevision),
    });

    const result = projectStamdataForDocumentIfEnabled(evaluation.reader, 'document.test', false);

    expect(result.status).toBe('ready');
    if (result.status !== 'ready') throw new Error('Forventede ready');
    expect(result.value).toEqual({
      journalnr: undefined,
      advokat: undefined,
      sagsbehandler: undefined,
      skadelidte: undefined,
      skadelidteFodselsdato: undefined,
      skadestype: undefined,
      skadedato: undefined,
    });
    expect(result.issues).toEqual([]);
  });
});
