import { __createTestStore } from '../../stores/formPersistenceStore';
import { PERSISTED_DATA_VERSION } from '../../config/persistenceVersion';
import type { PersistedSectionMap } from '../../config/persistenceRegistry';
import { STAMDATA_INITIAL_VALUES } from '../../domain/stamdata/stamdataInitialValues';
import { createErstatningsopgoerelseInitialValues } from '../../domain/erstatningsopgoerelse/helpers/erstatningsopgoerelseInitialValues';
import { createRenteberegningInitialValues } from '../../domain/renteberegning/renteberegningInitialValues';
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
  faellesAarsloen: {
    aslAarsloen: undefined,
    ealAarsloen: undefined,
  },
  renteberegning: createRenteberegningInitialValues(),
  varigemen: {
    mengrad: undefined,
    beregningsdato: undefined,
  },
  forsoergertab: {
    beregningsdato: undefined,
    virkningsdato: undefined,
    tilkendtForPeriodeAar: undefined,
  },
  erstatningsopgoerelse: createErstatningsopgoerelseInitialValues(),
  erhvervsevnetab: {
    beregningsdato: undefined,
    aslAfgoerelser: [],
    ealEetPct: undefined,
    eetDifferencekravBilagSelection: {
      loebendeYdelser: true,
      kapitalisering: true,
      eetEfterEal: true,
      proformaKapitalisering: true,
      visUdvidetSpecifikation: false,
      visUdvidetSpecifikationLoebendeYdelserBilag: false,
    },
  },
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

  it('commitSection records the caller-provided lastCommittedAt deterministically', () => {
    const store = __createTestStore();
    store.getState().clearAll(VALID_META);
    // lastCommittedAt er nu deterministisk: den kommer fra kalderens metaPatch, ikke fra
    // et ikke-deterministisk Date.now() inde i store-updater'en.
    store.getState().commitSection('satser', { aargang: 2025 }, { lastCommittedAt: 1234 });
    expect(store.getState().meta.lastCommittedAt).toBe(1234);

    store.getState().commitSection('satser', { aargang: 2026 }, { lastCommittedAt: 5678 });
    expect(store.getState().meta.lastCommittedAt).toBe(5678);
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
    expect(after.sectionRevisions.faellesAarsloen).toBe(before.sectionRevisions.faellesAarsloen + 1);
    expect(after.sectionRevisions.renteberegning).toBe(before.sectionRevisions.renteberegning + 1);
    expect(after.sectionRevisions.varigemen).toBe(before.sectionRevisions.varigemen + 1);
    expect(after.sectionRevisions.forsoergertab).toBe(before.sectionRevisions.forsoergertab + 1);
    expect(after.sectionRevisions.erstatningsopgoerelse).toBe(before.sectionRevisions.erstatningsopgoerelse + 1);
    expect(after.sectionRevisions.erhvervsevnetab).toBe(before.sectionRevisions.erhvervsevnetab + 1);
  });

  it('replaceSectionsAndClearFieldErrors is atomic for sections and field-errors', () => {
    const store = __createTestStore();
    store.getState().setFieldError('stamdata', 'skadelidte', 'input', { message: 'Fejl', severity: 'error' });
    const before = store.getState();
    const nextSections = createValidSections();

    store.getState().replaceSectionsAndClearFieldErrors(nextSections, VALID_META);
    const after = store.getState();

    expect(after.sections).toEqual(nextSections);
    expect(after.authoritativeSnapshotEpoch).toBe(before.authoritativeSnapshotEpoch + 1);
    expect(after.fieldErrors.stamdata).toEqual({});
    expect(after.fieldErrorRevisions.stamdata).toBe(before.fieldErrorRevisions.stamdata + 1);
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
      snapshot.committedChangeCounter,
      snapshot.authoritativeSnapshotEpoch,
      snapshot.meta
    );
    const restored = store.getState();

    expect(restored.sections).toEqual(snapshot.sections);
    expect(restored.sectionRevisions).toEqual(snapshot.sectionRevisions);
    expect(restored.committedChangeCounter).toBe(snapshot.committedChangeCounter);
    expect(restored.authoritativeSnapshotEpoch).toBe(snapshot.authoritativeSnapshotEpoch);
    expect(restored.meta).toEqual(snapshot.meta);
  });

  it('rollbackSections preserves existing field-errors', () => {
    const store = __createTestStore();
    store.getState().setFieldError('stamdata', 'skadelidte', 'input', { message: 'Bevar mig', severity: 'error' });
    const beforeFieldErrors = store.getState().fieldErrors;
    const beforeFieldErrorRevisions = store.getState().fieldErrorRevisions;

    store.getState().replaceSections(createValidSections(), VALID_META);
    const snapshot = store.getState();
    store.getState().replaceSections({ ...createValidSections(), satser: { aargang: 2024 } }, VALID_META);

    store.getState().rollbackSections(
      snapshot.sections,
      snapshot.sectionRevisions,
      snapshot.committedChangeCounter,
      snapshot.authoritativeSnapshotEpoch,
      snapshot.meta
    );

    expect(store.getState().fieldErrors).toEqual(beforeFieldErrors);
    expect(store.getState().fieldErrorRevisions).toEqual(beforeFieldErrorRevisions);
  });

  it('setFieldError increments revision only when value actually changes', () => {
    const store = __createTestStore();
    const beforeRevision = store.getState().fieldErrorRevisions.stamdata;

    store.getState().setFieldError('stamdata', 'skadelidte', 'input', { message: 'Fejl', severity: 'error' });
    const afterSet = store.getState().fieldErrorRevisions.stamdata;
    expect(afterSet).toBe(beforeRevision + 1);

    store.getState().setFieldError('stamdata', 'skadelidte', 'input', { message: 'Fejl', severity: 'error' });
    const afterNoop = store.getState().fieldErrorRevisions.stamdata;
    expect(afterNoop).toBe(afterSet);
  });

  it('setFieldError increments revision when blocksSave changes', () => {
    const store = __createTestStore();

    store.getState().setFieldError('stamdata', 'skadelidte', 'input', {
      message: 'Fejl',
      severity: 'error',
      blocksSave: true,
    });
    const afterBlocking = store.getState().fieldErrorRevisions.stamdata;

    store.getState().setFieldError('stamdata', 'skadelidte', 'input', {
      message: 'Fejl',
      severity: 'error',
      blocksSave: false,
    });
    const afterNonBlocking = store.getState().fieldErrorRevisions.stamdata;

    expect(afterNonBlocking).toBe(afterBlocking + 1);
    expect(store.getState().fieldErrors.stamdata.skadelidte?.input?.blocksSave).toBe(false);
  });

  it('clearFieldErrorsForSection does not bump revision when section has no errors', () => {
    const store = __createTestStore();
    const before = store.getState().fieldErrorRevisions;

    store.getState().clearFieldErrorsForSection('satser');
    const after = store.getState().fieldErrorRevisions;

    expect(after.satser).toBe(before.satser);
    expect(after.stamdata).toBe(before.stamdata);
  });

  it('clearAllFieldErrors bumps all field-error revisions', () => {
    const store = __createTestStore();
    const before = store.getState().fieldErrorRevisions;

    store.getState().clearAllFieldErrors();
    const after = store.getState().fieldErrorRevisions;

    expect(after.stamdata).toBe(before.stamdata + 1);
    expect(after.satser).toBe(before.satser + 1);
    expect(after.aarsloen).toBe(before.aarsloen + 1);
    expect(after.faellesAarsloen).toBe(before.faellesAarsloen + 1);
    expect(after.renteberegning).toBe(before.renteberegning + 1);
    expect(after.varigemen).toBe(before.varigemen + 1);
    expect(after.forsoergertab).toBe(before.forsoergertab + 1);
    expect(after.erstatningsopgoerelse).toBe(before.erstatningsopgoerelse + 1);
    expect(after.erhvervsevnetab).toBe(before.erhvervsevnetab + 1);
  });

  it('restoreFieldErrors restores fieldErrors and revisions exactly', () => {
    const store = __createTestStore();

    store.getState().setFieldError('stamdata', 'skadelidte', 'input', { message: 'A', severity: 'error' });
    const snapshotErrors = store.getState().fieldErrors;
    const snapshotRevisions = store.getState().fieldErrorRevisions;

    store.getState().clearAllFieldErrors();
    store.getState().restoreFieldErrors(snapshotErrors, snapshotRevisions);

    expect(store.getState().fieldErrors).toEqual(snapshotErrors);
    expect(store.getState().fieldErrorRevisions).toEqual(snapshotRevisions);
  });

  it('restoreHistoryFrame restores sections and field-errors in one store notification', () => {
    const store = __createTestStore();
    store.getState().replaceSections(createValidSections(), VALID_META);
    store.getState().setFieldError('stamdata', 'skadelidte', 'input', { message: 'Historisk fejl', severity: 'error' });
    const snapshot = store.getState();
    const observed: Array<{
      satser: PersistedSectionMap['satser'] | null;
      stamdataErrors: unknown;
    }> = [];
    const unsubscribe = store.subscribe((state) => {
      observed.push({
        satser: state.sections.satser,
        stamdataErrors: state.fieldErrors.stamdata,
      });
    });

    store.getState().clearAllFieldErrors();
    observed.length = 0;
    store.getState().restoreHistoryFrame(
      snapshot.sections,
      snapshot.sectionRevisions,
      snapshot.fieldErrors,
      snapshot.fieldErrorRevisions,
      snapshot.meta,
      snapshot.meta.lastCommittedAt ?? 0
    );
    unsubscribe();

    expect(observed).toHaveLength(1);
    expect(observed[0]?.satser).toEqual(snapshot.sections.satser);
    expect(observed[0]?.stamdataErrors).toEqual(snapshot.fieldErrors.stamdata);
  });

  it('hydrate sets schema fingerprint and hydrated flag', () => {
    const store = __createTestStore();
    const sections = createValidSections();
    const beforeEpoch = store.getState().authoritativeSnapshotEpoch;
    store.getState().hydrate(sections, { hydrated: false, schemaFingerprint: PERSISTED_DATA_VERSION });
    expect(store.getState().meta.hydrated).toBe(true);
    expect(store.getState().meta.schemaFingerprint).toBe(PERSISTED_DATA_VERSION);
    expect(store.getState().authoritativeSnapshotEpoch).toBe(beforeEpoch + 1);
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
