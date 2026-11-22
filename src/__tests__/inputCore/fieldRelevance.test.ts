import { createRelevanceTrackingView, memoizeRelevancePerView, resolveRelevanceStatus } from '../../inputCore/fieldRelevance';
import { eoKravPaaTabtArbejdsfortjenesteField, eoTafBeregningsperiodeTilField } from '../../inputCore/catalog/erstatningsopgoerelseDescriptors';
import { serializeFieldAddress } from '../../inputCore/fieldAddress';
import type { CanonicalView, FieldRef } from '../../inputCore/fieldDescriptor';
import type { RejectedInputs } from '../../inputCore/settledInput';

const krav = eoKravPaaTabtArbejdsfortjenesteField.bind();
const til = eoTafBeregningsperiodeTilField.bind();
const rejectedTil: RejectedInputs = { [serializeFieldAddress(til.address)]: { raw: '31-02-2018', reason: 'format' } };

const viewWith = (rejectedInputs: RejectedInputs): CanonicalView => createRelevanceTrackingView({
  readCanonical: <V,>(_field: FieldRef<V>): V => undefined as V,
  listEntityIds: () => [],
  rejectedInputs,
});

/** Et felt, hvis relevansregel læser slutdatoen og svarer «skjult». */
const fieldReadingTil = (): FieldRef<string | undefined> => ({
  ...krav,
  descriptor: { ...krav.descriptor, relevance: (_field: unknown, view: CanonicalView) => view.readCanonical(til) !== undefined },
}) as unknown as FieldRef<string | undefined>;

describe('fieldRelevance', () => {
  it('er ubestemt, når reglen læste et afvist felt, og irrelevant ellers', () => {
    expect(resolveRelevanceStatus(fieldReadingTil(), viewWith(rejectedTil))).toBe('ubestemt');
    expect(resolveRelevanceStatus(fieldReadingTil(), viewWith({}))).toBe('irrelevant');
  });

  it('melder en afvist læsning igen ved et cache-hit', () => {
    const rule = memoizeRelevancePerView((view) => view.readCanonical(til) !== undefined);
    const field = { ...krav, descriptor: { ...krav.descriptor, relevance: (_f: unknown, view: CanonicalView) => rule(view) } } as unknown as FieldRef<string | undefined>;
    const view = viewWith(rejectedTil);
    expect(resolveRelevanceStatus(field, view)).toBe('ubestemt');
    expect(resolveRelevanceStatus(field, view)).toBe('ubestemt');
  });

  it('serialiserer ingen adresse, når der ingen afvist råtekst findes', () => {
    // En adresse, som serialiseringens schema afviser: læses den uden kortslutning, kaster serialiseringen.
    const broken = { ...til, address: { ...til.address, section: 'ukendt' } } as unknown as FieldRef<string | undefined>;
    const field = { ...krav, descriptor: { ...krav.descriptor, relevance: (_f: unknown, view: CanonicalView) => view.readCanonical(broken) !== undefined } } as unknown as FieldRef<string | undefined>;
    expect(resolveRelevanceStatus(field, viewWith({}))).toBe('irrelevant');
    expect(() => resolveRelevanceStatus(field, viewWith(rejectedTil))).toThrow();
  });
});
