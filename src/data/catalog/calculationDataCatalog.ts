import type { ISODateString } from '../../types/branded';

/**
 * Fælles metadata-grænse for statiske programdata, der kan påvirke beregninger.
 * Payloadens form forbliver kilde-specifik; kataloget standardiserer kun identitet,
 * provenance, dækning og den fail-closed validering, der skal køres ved modul-load.
 */
export type CalculationDataProvenance = Readonly<{
  readonly sources: readonly [string, ...string[]];
  readonly maintenance:
    | Readonly<{ readonly method: 'generated'; readonly command: string }>
    | Readonly<{ readonly method: 'machine_extracted'; readonly sourceDirectory: string }>
    | Readonly<{ readonly method: 'manually_transcribed' }>;
}>;

export type CalculationDataCoverage =
  | Readonly<{ readonly kind: 'year'; readonly from: number; readonly through: number }>
  | Readonly<{ readonly kind: 'date'; readonly from: ISODateString; readonly through: ISODateString | null }>
  | Readonly<{ readonly kind: 'source_defined'; readonly description: string }>;

export type CalculationDataCatalogEntry<Id extends string = string, Payload = unknown> = Readonly<{
  readonly id: Id;
  readonly provenance: CalculationDataProvenance;
  readonly coverage: CalculationDataCoverage;
  readonly payload: Payload;
  readonly assertIntegrity: () => void;
}>;

type CalculationDataDefinition<Id extends string, Payload> = Omit<CalculationDataCatalogEntry<Id, Payload>, 'assertIntegrity'> &
  Readonly<{ readonly validate: (payload: Payload) => void }>;

const assertMetadata = <Payload>(definition: CalculationDataDefinition<string, Payload>): void => {
  if (definition.id.trim() === '') {
    throw new Error('Beregningsdatakatalog: id må ikke være tomt');
  }
  if (definition.provenance.sources.some((source) => source.trim() === '')) {
    throw new Error(`Beregningsdatakatalog "${definition.id}": kilden må ikke være tom`);
  }
  if (definition.coverage.kind === 'year' && definition.coverage.from > definition.coverage.through) {
    throw new Error(`Beregningsdatakatalog "${definition.id}": ugyldig årsdækning`);
  }
  if (
    definition.coverage.kind === 'date'
    && definition.coverage.through !== null
    && definition.coverage.from > definition.coverage.through
  ) {
    throw new Error(`Beregningsdatakatalog "${definition.id}": ugyldig datodækning`);
  }
};

export const defineCalculationData = <const Id extends string, Payload>(
  definition: CalculationDataDefinition<Id, Payload>
): CalculationDataCatalogEntry<Id, Payload> => {
  assertMetadata(definition);
  definition.validate(definition.payload);
  return Object.freeze({
    id: definition.id,
    provenance: definition.provenance,
    coverage: definition.coverage,
    payload: definition.payload,
    assertIntegrity: () => definition.validate(definition.payload),
  });
};

export const defineCalculationDataCatalog = <
  const Entries extends readonly CalculationDataCatalogEntry[],
>(entries: Entries): Entries => {
  const ids = new Set<string>();
  for (const entry of entries) {
    if (ids.has(entry.id)) {
      throw new Error(`Beregningsdatakatalog: duplikeret id "${entry.id}"`);
    }
    ids.add(entry.id);
  }
  return Object.freeze(entries) as Entries;
};
