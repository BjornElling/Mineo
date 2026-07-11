import {
  __createTestStore,
} from '../../stores/formPersistenceStore';
import { hasStamdataAny, resolveStamdataDatoLabel } from '../../domain/policies';
import { toISODateString } from '../../types/branded';
import { PERSISTED_DATA_VERSION } from '../../config/persistenceVersion';

const VALID_META = { hydrated: true, persistedDataVersion: PERSISTED_DATA_VERSION };

describe('formPersistenceStore (stamdata selectors)', () => {
  let store: ReturnType<typeof __createTestStore>;

  beforeEach(() => {
    store = __createTestStore();
    store.getState().clearAll(VALID_META);
  });

  it('returns Anmeldelsesdato for erhvervssygdom and reports data present', () => {
    // arrange
    store.getState().commitSection('stamdata', {
      journalnr: 'A-1',
      advokat: 'AB',
      sagsbehandler: 'CD',
      skadelidte: 'Navn',
      skadestype: 'Erhvervssygdom',
      skadedato: toISODateString('2024-01-01'),
    });

    // act
    const state = store.getState();

    // assert
    expect(resolveStamdataDatoLabel(state.sections.stamdata)).toBe('Anmeldelsesdato');
    expect(hasStamdataAny(state.sections.stamdata)).toBe(true);
  });

  it('defaults to Skadedato when skadestype is unset', () => {
    // arrange
    store.getState().commitSection('stamdata', {
      skadestype: undefined,
    });

    // act
    const state = store.getState();

    // assert
    expect(resolveStamdataDatoLabel(state.sections.stamdata)).toBe('Skadedato');
  });

  it('treats empty stamdata as no data', () => {
    // arrange
    store.getState().clearSection('stamdata');

    // act
    const state = store.getState();

    // assert
    expect(hasStamdataAny(state.sections.stamdata)).toBe(false);
    expect(resolveStamdataDatoLabel(state.sections.stamdata)).toBe('Skadedato');
  });
});
