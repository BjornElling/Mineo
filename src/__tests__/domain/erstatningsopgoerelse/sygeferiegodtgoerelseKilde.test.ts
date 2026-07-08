import type {
  LoenindkomstAnsaettelsesforhold,
  SygeferiegodtgoerelseAnsaettelsesforholdRow,
} from '../../../schemas/formSchemas';
import { createDefaultLoenindkomstAnsaettelsesforhold } from '../../../domain/erstatningsopgoerelse/helpers/erstatningsopgoerelseInitialValues';
import {
  SFGG_KILDE_REGISTRY,
  getSfggKildeSpec,
  hasSfggSelectedOverenskomst,
  resolveSfggSource,
  sfggKildeUsesReferenceperiode,
  type SfggSourceKind,
} from '../../../domain/erstatningsopgoerelse/engines/sygeferiegodtgoerelseKilde';

const ALL_KINDS: readonly SfggSourceKind[] = [
  'ingen',
  'manuel',
  'ferielov',
  'overenskomst_direkte',
  'overenskomst_ferielov',
];

const makeEmployment = (
  patch: Partial<LoenindkomstAnsaettelsesforhold> = {}
): LoenindkomstAnsaettelsesforhold => ({
  ...createDefaultLoenindkomstAnsaettelsesforhold(),
  id: 'af-1',
  ...patch,
});

const makeRow = (
  kilde: SygeferiegodtgoerelseAnsaettelsesforholdRow['sfggBeregningskilde']
): SygeferiegodtgoerelseAnsaettelsesforholdRow => ({
  ansaettelsesforholdId: 'af-1',
  sfggBeregningskilde: kilde,
  sfggManuelDagssats: undefined,
  sfggManuelBeloebIHenholdTil: undefined,
  sfggManuelFoerstEfterSygeloen: 'Nej',
  sfggReferenceperiodeFra: undefined,
  sfggReferenceperiodeTil: undefined,
  sfggReferenceperiodeFravaersdageUdenLoen: 0,
  sfggSatsvalg: undefined,
  sfggAlleredeBetaltBeloeb: undefined,
});

describe('sygeferiegodtgoerelseKilde-registeret', () => {
  it('dækker hver SfggSourceKind, og hver post matcher sin nøgle', () => {
    for (const kind of ALL_KINDS) {
      const spec = SFGG_KILDE_REGISTRY[kind];
      expect(spec).toBeDefined();
      expect(spec.kind).toBe(kind);
    }
    // Ingen ekstra/ukendte nøgler i registeret.
    expect(Object.keys(SFGG_KILDE_REGISTRY).sort()).toEqual([...ALL_KINDS].sort());
  });

  it('markerer præcis ferielov og overenskomst_ferielov som referenceperiode-spor', () => {
    const referenceperiodeKilder = ALL_KINDS.filter((kind) => sfggKildeUsesReferenceperiode(kind));
    expect(referenceperiodeKilder.sort()).toEqual(['ferielov', 'overenskomst_ferielov']);
  });

  it('afleder rateModel og afterSickPayModel konsistent med referenceperiode-partitionen', () => {
    for (const kind of ALL_KINDS) {
      const spec = getSfggKildeSpec(kind);
      expect(sfggKildeUsesReferenceperiode(kind)).toBe(spec.rateModel === 'referenceperiode');
    }
    expect(getSfggKildeSpec('overenskomst_direkte').rateModel).toBe('per_periode_overenskomst');
    expect(getSfggKildeSpec('manuel').rateModel).toBe('manuel');
    expect(getSfggKildeSpec('manuel').afterSickPayModel).toBe('manuel');
    expect(getSfggKildeSpec('ferielov').afterSickPayModel).toBe('ingen');
    expect(getSfggKildeSpec('overenskomst_direkte').afterSickPayModel).toBe('overenskomst');
    expect(getSfggKildeSpec('overenskomst_ferielov').afterSickPayModel).toBe('overenskomst');
  });
});

describe('resolveSfggSource', () => {
  it('normaliserer de simple kilder', () => {
    expect(resolveSfggSource(undefined, makeEmployment()).kind).toBe('ingen');
    expect(resolveSfggSource(makeRow('Ingen'), makeEmployment()).kind).toBe('ingen');
    expect(resolveSfggSource(makeRow('Manuelt angivet'), makeEmployment()).kind).toBe('manuel');
    expect(resolveSfggSource(makeRow('Ferieloven'), makeEmployment()).kind).toBe('ferielov');
  });

  it('splitter Overenskomst i direkte vs. ferielov ud fra policy-model', () => {
    const direkte = resolveSfggSource(
      makeRow('Overenskomst'),
      makeEmployment({ harOverenskomst: true, overenskomstId: 'bygge-anlaeg' })
    );
    expect(direkte.kind).toBe('overenskomst_direkte');

    const ferielovModel = resolveSfggSource(
      makeRow('Overenskomst'),
      makeEmployment({ harOverenskomst: true, overenskomstId: 'kl-overenskomst' })
    );
    expect(ferielovModel.kind).toBe('overenskomst_ferielov');
  });

  it('behandler Overenskomst som ferielov-spor når harOverenskomst er slået fra, selv med hængende direkte-sats-ID', () => {
    // Motorens grænse: uden aktiv overenskomst slås policyen ikke op — et hængende privat
    // direkte-sats-ID må ikke ændre sporet til overenskomst_direkte.
    const source = resolveSfggSource(
      makeRow('Overenskomst'),
      makeEmployment({ harOverenskomst: false, overenskomstId: 'bygge-anlaeg' })
    );
    expect(source.kind).toBe('overenskomst_ferielov');
  });
});

describe('hasSfggSelectedOverenskomst', () => {
  it('kræver kilde=Overenskomst, harOverenskomst og et overenskomst-ID', () => {
    expect(hasSfggSelectedOverenskomst(makeRow('Overenskomst'), makeEmployment({ harOverenskomst: true, overenskomstId: 'bygge-anlaeg' }))).toBe(true);
    expect(hasSfggSelectedOverenskomst(makeRow('Overenskomst'), makeEmployment({ harOverenskomst: false, overenskomstId: 'bygge-anlaeg' }))).toBe(false);
    expect(hasSfggSelectedOverenskomst(makeRow('Overenskomst'), makeEmployment({ harOverenskomst: true, overenskomstId: undefined }))).toBe(false);
    expect(hasSfggSelectedOverenskomst(makeRow('Ferieloven'), makeEmployment({ harOverenskomst: true, overenskomstId: 'bygge-anlaeg' }))).toBe(false);
  });
});
