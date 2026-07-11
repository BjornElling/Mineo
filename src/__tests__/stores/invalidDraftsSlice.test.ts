import { __createTestStore } from '../../stores/formPersistenceStore';
import { PERSISTED_DATA_VERSION } from '../../config/persistenceVersion';
import type { PersistedSectionMap } from '../../config/persistenceRegistry';
import { STAMDATA_INITIAL_VALUES } from '../../domain/stamdata/stamdataInitialValues';
import { createErstatningsopgoerelseInitialValues } from '../../domain/erstatningsopgoerelse/helpers/erstatningsopgoerelseInitialValues';
import { createRenteberegningInitialValues } from '../../domain/renteberegning/renteberegningInitialValues';
import { ERHVERVSEVNETAB_INITIAL_VALUES } from '../../domain/erhvervsevnetab/erhvervsevnetabInitialValues';
import { LOENPERIODE, LOEN_PAA_HELLIGDAGE } from '../../types/loen';

const VALID_META = { hydrated: true, persistedDataVersion: PERSISTED_DATA_VERSION };

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
    tillaegAngivesSom: 'procent',
    tableData: [],
    omregningTilFuldtAar: false,
    fuldLoenUnderFerie: true,
    retTilSjetteFerieuge: true,
    antalFeriedage: undefined,
    loenPaaHelligdage: LOEN_PAA_HELLIGDAGE.ALMINDELIG,
  },
  faellesAarsloen: { aslAarsloen: undefined, ealAarsloen: undefined },
  renteberegning: createRenteberegningInitialValues(),
  varigemen: { mengrad: undefined, beregningsdato: undefined },
  forsoergertab: { beregningsdato: undefined, virkningsdato: undefined, tilkendtForPeriodeAar: undefined },
  erstatningsopgoerelse: createErstatningsopgoerelseInitialValues(),
  erhvervsevnetab: ERHVERVSEVNETAB_INITIAL_VALUES,
});

describe('formPersistenceStore invalidDrafts-slice', () => {
  it('initial state har tom invalidDrafts-cache med alle sektions-nøgler', () => {
    const store = __createTestStore();
    const cache = store.getState().invalidDrafts;
    expect(Object.keys(cache).sort()).toEqual(Object.keys(store.getState().sections).sort());
    expect(cache.stamdata).toEqual({});
  });

  it('setInvalidDraft skriver et entry og bumper revision; uændret værdi er no-op', () => {
    const store = __createTestStore();
    const rev0 = store.getState().invalidDraftRevisions.stamdata;
    store.getState().setInvalidDraft('stamdata', 'skadedato', '12.x.20');
    expect(store.getState().invalidDrafts.stamdata).toEqual({ skadedato: '12.x.20' });
    const rev1 = store.getState().invalidDraftRevisions.stamdata;
    expect(rev1).toBe(rev0 + 1);

    // Samme værdi igen: no-op (ingen revision-bump)
    store.getState().setInvalidDraft('stamdata', 'skadedato', '12.x.20');
    expect(store.getState().invalidDraftRevisions.stamdata).toBe(rev1);
  });

  it('setInvalidDraft med null/tom streng rydder entry', () => {
    const store = __createTestStore();
    store.getState().setInvalidDraft('stamdata', 'skadedato', '12.x.20');
    store.getState().setInvalidDraft('stamdata', 'skadedato', null);
    expect(store.getState().invalidDrafts.stamdata).toEqual({});

    store.getState().setInvalidDraft('stamdata', 'skadedato', 'abc');
    store.getState().setInvalidDraft('stamdata', 'skadedato', '');
    expect(store.getState().invalidDrafts.stamdata).toEqual({});
  });

  it('to felter i samme sektion holdes adskilt', () => {
    const store = __createTestStore();
    store.getState().setInvalidDraft('stamdata', 'skadedato', 'a');
    store.getState().setInvalidDraft('stamdata', 'anmeldtdato', 'b');
    expect(store.getState().invalidDrafts.stamdata).toEqual({ skadedato: 'a', anmeldtdato: 'b' });
  });

  it('clearInvalidDraftsForSection rydder kun den sektion', () => {
    const store = __createTestStore();
    store.getState().setInvalidDraft('stamdata', 'skadedato', 'a');
    store.getState().setInvalidDraft('satser', 'aargang', 'b');
    store.getState().clearInvalidDraftsForSection('stamdata');
    expect(store.getState().invalidDrafts.stamdata).toEqual({});
    expect(store.getState().invalidDrafts.satser).toEqual({ aargang: 'b' });
  });

  it('clearAllInvalidDrafts rydder alt', () => {
    const store = __createTestStore();
    store.getState().setInvalidDraft('stamdata', 'skadedato', 'a');
    store.getState().setInvalidDraft('satser', 'aargang', 'b');
    store.getState().clearAllInvalidDrafts();
    expect(store.getState().invalidDrafts.stamdata).toEqual({});
    expect(store.getState().invalidDrafts.satser).toEqual({});
  });

  it('replaceSectionsAndClearFieldErrors rydder invalidDrafts (load = ingen ugyldige drafts)', () => {
    const store = __createTestStore();
    store.getState().setInvalidDraft('stamdata', 'skadedato', 'a');
    store.getState().replaceSectionsAndClearFieldErrors(createValidSections(), VALID_META);
    expect(store.getState().invalidDrafts.stamdata).toEqual({});
  });

  it('clearAll rydder invalidDrafts', () => {
    const store = __createTestStore();
    store.getState().setInvalidDraft('stamdata', 'skadedato', 'a');
    store.getState().clearAll(VALID_META);
    expect(store.getState().invalidDrafts.stamdata).toEqual({});
  });

  it('hydrate installerer den hydrerede invalidDrafts-cache', () => {
    const store = __createTestStore();
    const sections = createValidSections();
    const hydratedDrafts = { ...store.getState().invalidDrafts, stamdata: { skadedato: '12.x.20' } };
    store.getState().hydrate(sections, VALID_META, hydratedDrafts);
    expect(store.getState().invalidDrafts.stamdata).toEqual({ skadedato: '12.x.20' });
  });

  it('restoreInvalidDrafts gendanner en hel cache (undo/redo + rollback)', () => {
    const store = __createTestStore();
    store.getState().setInvalidDraft('stamdata', 'skadedato', 'a');
    const snapshot = store.getState().invalidDrafts;
    const snapshotRevisions = store.getState().invalidDraftRevisions;
    store.getState().clearAllInvalidDrafts();
    expect(store.getState().invalidDrafts.stamdata).toEqual({});
    store.getState().restoreInvalidDrafts(snapshot, snapshotRevisions);
    expect(store.getState().invalidDrafts.stamdata).toEqual({ skadedato: 'a' });
  });
});
