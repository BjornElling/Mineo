import { createManualPercentBasisCommitOverride } from '../../../domain/erstatningsopgoerelse/manualPercentBasisCommit';
import { eoAngivetLoenFields, eoAngivetLoenManual } from '../../../inputCore/catalog/erstatningsopgoerelseLoenDescriptors';
import type { CollectionRef } from '../../../inputCore/fieldAddress';

const location = {
  locationId: 'test:loenudviklingBeregningsgrundlag',
  route: '/erstatningsopgoerelse',
  tabKey: 'eo-oplysninger',
} as const;

describe('createManualPercentBasisCommitOverride', () => {
  it('samler valg og oprettelse af basisrække i én strukturel transaktion', () => {
    const commit = createManualPercentBasisCommitOverride({
      field: eoAngivetLoenFields.loenudviklingBeregningsgrundlag.bind(),
      location,
      collection: eoAngivetLoenManual.manualPercentCollection.template as CollectionRef,
      hasBaseRow: false,
    });

    const result = commit('Manuel procentsats');
    expect(result.command).toMatchObject({ kind: 'structuralTransaction', structural: true });
    expect(result.command.kind === 'structuralTransaction' ? result.command.steps : []).toHaveLength(2);
    expect(result.origin).toMatchObject({ kind: 'field', editorLocationId: location.locationId });
  });

  it('bruger almindeligt immediate commit når basisrækken allerede findes', () => {
    const commit = createManualPercentBasisCommitOverride({
      field: eoAngivetLoenFields.loenudviklingBeregningsgrundlag.bind(),
      location,
      collection: eoAngivetLoenManual.manualPercentCollection.template as CollectionRef,
      hasBaseRow: true,
    });

    expect(commit('Manuel procentsats').command.kind).toBe('setImmediateField');
  });
});
