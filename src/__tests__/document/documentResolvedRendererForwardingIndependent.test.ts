import type { DocumentArtifact } from '../../document/downloadArtifact';
import type { DocumentGenerationSession } from '../../document/documentGenerationSession';
import {
  defineDocumentOutput,
  type DocumentDefinition,
  type DocumentRenderer,
} from '../../document/definition/documentDefinition';
import { resolveDocumentDefinition } from '../../document/definition/documentAction';
import { createDocumentSourceContext } from '../../document/definition/documentSourceContext';
import {
  createEvaluationSourceToken,
  createInputEvaluation,
  createInputRevision,
  createSettingsRevision,
} from '../../inputCore';
import { createEmptySettledInput } from '../../inputCore/settledInput';
import { getProductionInputCatalog } from '../../inputCore/catalog/productionCatalog';

type TestRequest = Readonly<{ rowId: string }>;
type TestInput = Readonly<{ marker: string; amount: number }>;

const sourceToken = createEvaluationSourceToken(
  createInputRevision(7),
  createSettingsRevision(11),
);

const sourceContext = createDocumentSourceContext(
  createInputEvaluation({
    input: createEmptySettledInput(),
    catalog: getProductionInputCatalog(),
    sourceToken,
  }),
  undefined,
);

const fakeSession = (): DocumentGenerationSession => ({
  format: 'pdf',
  render: async () => new Blob(),
});

describe('DOC-001/DOC-003 – resolved renderer-forwarding', () => {
  it('videresender den typed projektion og brevhovedbeslutningen samt returnerer artifactet uændret', async () => {
    const request: TestRequest = { rowId: 'række-7' };
    const projectedInput: TestInput = Object.freeze({ marker: 'frisk-projektion', amount: 731 });
    const artifact: DocumentArtifact = Object.freeze({
      blob: new Blob(['typed-forwarding']),
      filename: 'typed-forwarding.pdf',
    });
    const renderer: DocumentRenderer<TestInput> = vi.fn(
      async (session, input, context) => {
        expect(session).toBeInstanceOf(Object);
        expect(input).toBe(projectedInput);
        expect(context).toEqual({ visBrevhoved: true });
        return artifact;
      },
    );
    let projectedRequest: TestRequest | undefined;

    const definition: DocumentDefinition<TestRequest, TestInput, undefined, never> = defineDocumentOutput({
      id: 'satser',
      brevhoved: { kind: 'none' },
      labels: { documentName: 'typed forwarding' },
      project: (_context, receivedRequest) => {
        projectedRequest = receivedRequest;
        return { status: 'ready', input: projectedInput };
      },
      loadRenderer: async () => renderer,
    });

    const resolved = resolveDocumentDefinition(definition, sourceContext, request);
    if (resolved.status !== 'ready') throw new Error('Testdefinitionen blev uventet blokeret');

    const resolvedRenderer = await resolved.document.loadRenderer();
    const result = await resolvedRenderer(fakeSession(), true);

    expect(projectedRequest).toBe(request);
    expect(renderer).toHaveBeenCalledTimes(1);
    expect(result).toBe(artifact);
    expect(result.filename).toBe('typed-forwarding.pdf');
  });
});
