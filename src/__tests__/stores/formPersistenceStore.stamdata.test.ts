import {
  __createTestStore,
  selectStamdataDefaultDatoLabel,
  selectStamdataHasAnyInput,
} from '../../stores/formPersistenceStore';
import { toISODateString } from '../../types/branded';
import { PERSISTED_DATA_VERSION } from '../../config/persistenceVersion';

const VALID_META = { hydrated: true, schemaFingerprint: PERSISTED_DATA_VERSION };

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
      skadesdato: toISODateString('2024-01-01'),
    });

    // act
    const state = store.getState();

    // assert
    expect(selectStamdataDefaultDatoLabel(state.sections.stamdata)).toBe('Anmeldelsesdato');
    expect(selectStamdataHasAnyInput(state.sections.stamdata)).toBe(true);
  });

  it('defaults to Skadesdato when skadestype is unset', () => {
    // arrange
    store.getState().commitSection('stamdata', {
      skadestype: undefined,
    });

    // act
    const state = store.getState();

    // assert
    expect(selectStamdataDefaultDatoLabel(state.sections.stamdata)).toBe('Skadesdato');
  });

  it('treats empty stamdata as no data', () => {
    // arrange
    store.getState().clearSection('stamdata');

    // act
    const state = store.getState();

    // assert
    expect(selectStamdataHasAnyInput(state.sections.stamdata)).toBe(false);
    expect(selectStamdataDefaultDatoLabel(state.sections.stamdata)).toBe('Skadesdato');
  });
});
