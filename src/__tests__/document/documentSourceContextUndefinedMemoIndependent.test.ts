import { createInputEvaluation } from '../../inputCore/inputReader';
import { createEvaluationSourceToken, createInputRevision, createSettingsRevision } from '../../inputCore/evaluationSource';
import { createEmptySettledInput } from '../../inputCore';
import { getProductionInputCatalog } from '../../inputCore/catalog/productionCatalog';
import { createDocumentSourceContext, type SharedProjectionBuilder } from '../../document/definition/documentSourceContext';

type FixtureGateSettings = Readonly<{ source: 'typed-fixture' }>;

const sourceContext = createDocumentSourceContext<FixtureGateSettings>(
  createInputEvaluation({
    input: createEmptySettledInput(),
    catalog: getProductionInputCatalog(),
    sourceToken: createEvaluationSourceToken(createInputRevision(1), createSettingsRevision(1)),
  }),
  { source: 'typed-fixture' },
);

describe('document source context – undefined memo-facit', () => {
  it('kører en shared-projektion med undefined-resultat præcis én gang pr. kontekst', () => {
    const buildUndefined = vi.fn<SharedProjectionBuilder<FixtureGateSettings, undefined>>(() => undefined);

    expect(sourceContext.shared(buildUndefined)).toBeUndefined();
    expect(sourceContext.shared(buildUndefined)).toBeUndefined();
    expect(buildUndefined).toHaveBeenCalledOnce();
  });
});
