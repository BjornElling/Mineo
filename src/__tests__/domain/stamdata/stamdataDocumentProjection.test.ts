// @vitest-environment jsdom
import { __createSlimInputTestStore } from '../../../inputCore/runtime/slimInputStore';
import { buildProductionInputCatalog } from '../../../inputCore/catalog/productionCatalog';
import { stamdataSkadedatoField } from '../../../inputCore/catalog/stamdataDescriptors';
import { createInputEvaluation } from '../../../inputCore/inputReader';
import { createEvaluationSourceToken } from '../../../inputCore/evaluationSource';
import { projectStamdataForDocument } from '../../../domain/stamdata/stamdataDocumentProjection';
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
      settings: {},
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
      settings: {},
    });

    const result = projectStamdataForDocument(evaluation.reader, 'document.test');

    expect(result.status).toBe('blocked');
  });
});
