import { __createTestStore } from '../../stores/formPersistenceStore';
import { PERSISTED_DATA_VERSION } from '../../config/persistenceVersion';
import type { PersistedSectionMap } from '../../config/persistenceRegistry';
import { STAMDATA_INITIAL_VALUES } from '../../domain/stamdata/stamdataInitialValues';
import { createErstatningsopgoerelseInitialValues } from '../../domain/erstatningsopgoerelse/erstatningsopgoerelseInitialValues';
import { LOENPERIODE, LOEN_PAA_HELLIGDAGE } from '../../types/common';

const VALID_META = { hydrated: true, schemaFingerprint: PERSISTED_DATA_VERSION };

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

  it('hydrate sets schema fingerprint and hydrated flag', () => {
    const store = __createTestStore();
    const sections = createValidSections();
    store.getState().hydrate(sections, { hydrated: false, schemaFingerprint: PERSISTED_DATA_VERSION });
    expect(store.getState().meta.hydrated).toBe(true);
    expect(store.getState().meta.schemaFingerprint).toBe(PERSISTED_DATA_VERSION);
  });
});
