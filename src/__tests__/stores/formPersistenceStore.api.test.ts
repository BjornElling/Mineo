import { __createTestStore } from '../../stores/formPersistenceStore';
import { PERSISTED_DATA_VERSION } from '../../config/persistenceVersion';
import type { PersistedSectionMap } from '../../config/persistenceRegistry';
import { STAMDATA_INITIAL_VALUES } from '../../domain/stamdata/stamdataInitialValues';
import { createErstatningsopgoerelseInitialValues } from '../../domain/erstatningsopgoerelse/erstatningsopgoerelseInitialValues';
import { LOENPERIODE, LOEN_PAA_HELLIGDAGE } from '../../types/loen';

const VALID_META = { hydrated: true, schemaFingerprint: PERSISTED_DATA_VERSION };

const withNodeEnv = (nodeEnv: string, run: () => void): void => {
  const originalNodeEnv = process.env.NODE_ENV;
  process.env.NODE_ENV = nodeEnv;
  try {
    run();
  } finally {
    process.env.NODE_ENV = originalNodeEnv;
  }
};

const createValidSections = (): PersistedSectionMap => ({
  stamdata: STAMDATA_INITIAL_VALUES,
  satser: { aargang: 2025 },
  aarsloen: {
    feriePct: undefined,
    fritvalgPct: undefined,
    shSoPct: undefined,
    storeBededagPct: undefined,
    pensionPct: undefined,
    loenperiode: LOENPERIODE.MAANED,
    tableData: [],
    omregningTilFuldtAar: false,
    fuldLoenUnderFerie: true,
    retTilSjetteFerieuge: true,
    antalFeriedage: undefined,
    loenPaaHelligdage: LOEN_PAA_HELLIGDAGE.ALMINDELIG,
  },
  renteberegning: {
    beregningsdato: undefined,
    rentekravRows: [],
  },
  varigemen: {
    fodselsdato: undefined,
    mengrad: undefined,
    beregningsdato: undefined,
  },
  erstatningsopgoerelse: createErstatningsopgoerelseInitialValues(),
});

describe('formPersistenceStore public API', () => {
  it('throws on missing keys for replaceSections', () => {
    const store = __createTestStore();
    const sections = createValidSections();
    // @ts-expect-error: intentional missing key for coverage check
    delete sections.varigemen;
    expect(() => store.getState().replaceSections(sections, VALID_META)).toThrow();
  });

  it('throws on extra keys for replaceSections', () => {
    const store = __createTestStore();
    const sections = createValidSections() as Record<string, unknown>;
    sections.extra = null;
    expect(() => store.getState().replaceSections(sections as PersistedSectionMap, VALID_META)).toThrow();
  });

  it('replaceSections is atomic on validation failure', () => {
    const store = __createTestStore();
    const sections = createValidSections();
    store.getState().replaceSections(sections, VALID_META);
    const before = store.getState().sections;

    const bad = { ...sections, satser: { aargang: 999999 } };
    expect(() => store.getState().replaceSections(bad, VALID_META)).toThrow();
    expect(store.getState().sections).toEqual(before);
  });

  it('commitSection updates meta deterministically', () => {
    const store = __createTestStore();
    store.getState().clearAll(VALID_META);
    const before = store.getState().meta.lastCommittedAt;
    store.getState().commitSection('satser', { aargang: 2025 }, { schemaFingerprint: PERSISTED_DATA_VERSION });
    const after = store.getState().meta.lastCommittedAt;
    expect(after).not.toBeUndefined();
    if (before !== undefined) {
      expect(after).not.toBe(before);
    }
  });

  it('commitSection increments only the targeted section revision', () => {
    const store = __createTestStore();
    store.getState().clearAll(VALID_META);
    const before = store.getState();

    store.getState().commitSection('satser', { aargang: 2025 }, { schemaFingerprint: PERSISTED_DATA_VERSION });
    const after = store.getState();

    expect(after.sectionRevisions.satser).toBe(before.sectionRevisions.satser + 1);
    expect(after.sectionRevisions.stamdata).toBe(before.sectionRevisions.stamdata);
    expect(after.authoritativeSnapshotEpoch).toBe(before.authoritativeSnapshotEpoch);
  });

  it('replaceSections increments all section revisions and authoritative epoch', () => {
    const store = __createTestStore();
    const before = store.getState();

    store.getState().replaceSections(createValidSections(), VALID_META);
    const after = store.getState();

    expect(after.authoritativeSnapshotEpoch).toBe(before.authoritativeSnapshotEpoch + 1);
    expect(after.sectionRevisions.stamdata).toBe(before.sectionRevisions.stamdata + 1);
    expect(after.sectionRevisions.satser).toBe(before.sectionRevisions.satser + 1);
    expect(after.sectionRevisions.aarsloen).toBe(before.sectionRevisions.aarsloen + 1);
    expect(after.sectionRevisions.renteberegning).toBe(before.sectionRevisions.renteberegning + 1);
    expect(after.sectionRevisions.varigemen).toBe(before.sectionRevisions.varigemen + 1);
    expect(after.sectionRevisions.erstatningsopgoerelse).toBe(before.sectionRevisions.erstatningsopgoerelse + 1);
  });

  it('rollbackSections restores sections, revisions and epoch exactly', () => {
    const store = __createTestStore();
    store.getState().replaceSections(createValidSections(), VALID_META);
    const snapshot = store.getState();

    store.getState().replaceSections(
      {
        ...createValidSections(),
        satser: { aargang: 2024 },
      },
      VALID_META
    );

    store.getState().rollbackSections(
      snapshot.sections,
      snapshot.sectionRevisions,
      snapshot.authoritativeSnapshotEpoch,
      snapshot.meta
    );
    const restored = store.getState();

    expect(restored.sections).toEqual(snapshot.sections);
    expect(restored.sectionRevisions).toEqual(snapshot.sectionRevisions);
    expect(restored.authoritativeSnapshotEpoch).toBe(snapshot.authoritativeSnapshotEpoch);
    expect(restored.meta).toEqual(snapshot.meta);
  });

  it('hydrate sets schema fingerprint and hydrated flag', () => {
    const store = __createTestStore();
    const sections = createValidSections();
    store.getState().hydrate(sections, { hydrated: false, schemaFingerprint: PERSISTED_DATA_VERSION });
    expect(store.getState().meta.hydrated).toBe(true);
    expect(store.getState().meta.schemaFingerprint).toBe(PERSISTED_DATA_VERSION);
  });

  it('__setSectionUnsafe allows mutation in test environment', () => {
    const store = __createTestStore();
    const satser = { aargang: 2025 };

    store.getState().__setSectionUnsafe('satser', satser);

    expect(store.getState().sections.satser).toEqual(satser);
  });

  it('__setMetaUnsafe fails closed outside test environment', () => {
    const store = __createTestStore();
    withNodeEnv('production', () => {
      expect(() => store.getState().__setMetaUnsafe({ hydrated: true })).toThrow(
        'formPersistenceStore: unsafe test mutation is only allowed in test environment'
      );
    });
  });

  it('__setSectionUnsafe fails closed outside test environment', () => {
    const store = __createTestStore();
    withNodeEnv('production', () => {
      expect(() => store.getState().__setSectionUnsafe('satser', { aargang: 2025 })).toThrow(
        'formPersistenceStore: unsafe test mutation is only allowed in test environment'
      );
    });
  });
});
