import {
  createManualRegulationBasisCommitOverride,
  resolveManualRegulationBasisRowId,
} from '../../../domain/erstatningsopgoerelse/manualRegulationBasisCommit';
import {
  eoAngivetLoenFields,
  eoAngivetLoenManual,
} from '../../../inputCore/catalog/erstatningsopgoerelseLoenDescriptors';
import type { CollectionRef } from '../../../inputCore/fieldAddress';

const location = {
  locationId: 'test:loenudviklingBeregningsgrundlag',
  route: '/erstatningsopgoerelse',
  tabKey: 'eo-oplysninger',
} as const;

const createCommit = (overrides?: Readonly<{
  hasManualBaseRow?: boolean;
  hasManualPercentBaseRow?: boolean;
}>) => createManualRegulationBasisCommitOverride({
  field: eoAngivetLoenFields.loenudviklingBeregningsgrundlag.bind(),
  location,
  manualCollection: eoAngivetLoenManual.manualCollection.template as CollectionRef,
  manualPercentCollection: eoAngivetLoenManual.manualPercentCollection.template as CollectionRef,
  hasManualBaseRow: overrides?.hasManualBaseRow ?? false,
  hasManualPercentBaseRow: overrides?.hasManualPercentBaseRow ?? false,
});

describe('createManualRegulationBasisCommitOverride', () => {
  it.each(['Manuelt angivet', 'Manuel procentsats'] as const)(
    'samler valget %s og dets basisrække i én strukturel transaktion',
    (value) => {
      const result = createCommit()(value);
      expect(result.command).toMatchObject({ kind: 'structuralTransaction', structural: true });
      expect(result.command.kind === 'structuralTransaction' ? result.command.steps : []).toHaveLength(2);
      expect(result.origin).toMatchObject({ kind: 'field', editorLocationId: location.locationId });
    }
  );

  it('opretter ikke en ekstra basisrække, når den valgte forms basis allerede findes', () => {
    expect(createCommit({ hasManualBaseRow: true })('Manuelt angivet').command.kind).toBe('setImmediateField');
    expect(createCommit({ hasManualPercentBaseRow: true })('Manuel procentsats').command.kind).toBe('setImmediateField');
  });

  it('ændrer øvrige valg uden strukturelle sideeffekter', () => {
    expect(createCommit()('Overenskomst').command.kind).toBe('setImmediateField');
  });

  it('låser første synlige række som basis ved ældre state uden canonical basisrække', () => {
    expect(resolveManualRegulationBasisRowId([], [{ rowId: 'placeholder-basis' }])).toBe('placeholder-basis');
    expect(resolveManualRegulationBasisRowId([{ id: 'canonical-basis' }], [{ rowId: 'canonical-basis' }]))
      .toBe('canonical-basis');
  });
});
