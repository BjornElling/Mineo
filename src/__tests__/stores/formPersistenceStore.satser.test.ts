import {
  __createTestStore,
  selectSatserHasAnyInput,
  selectSatserAargangErrorMessage,
  selectSatserCanDownload,
  selectSatserEffectiveAargang,
} from '../../stores/formPersistenceStore';
import { PERSISTED_DATA_VERSION } from '../../config/persistenceVersion';

const VALID_META = { hydrated: true, schemaFingerprint: PERSISTED_DATA_VERSION };

describe('formPersistenceStore (satser selectors)', () => {
  let store: ReturnType<typeof __createTestStore>;

  beforeEach(() => {
    store = __createTestStore();
    store.getState().clearAll(VALID_META);
  });

  it('returns undefined when aargang is missing', () => {
    // arrange
    store.getState().commitSection('satser', { aargang: undefined });

    // act
    const state = store.getState();

    // assert
    expect(selectSatserEffectiveAargang(state.sections.satser, 2000, 2020)).toBeUndefined();
    expect(selectSatserHasAnyInput(state.sections.satser)).toBe(false);
    expect(selectSatserAargangErrorMessage(state.sections.satser, 2000, 2020)).toBe('Årstallet skal være mellem 2000 og 2020');
    expect(selectSatserCanDownload(state.sections.satser, 2000, 2020)).toBe(false);
  });

  it('returns the selected year when present', () => {
    // arrange
    store.getState().commitSection('satser', { aargang: 2025 });

    // act
    const state = store.getState();

    // assert
    expect(selectSatserEffectiveAargang(state.sections.satser, 2000, 2030)).toBe(2025);
    expect(selectSatserHasAnyInput(state.sections.satser)).toBe(true);
    expect(selectSatserAargangErrorMessage(state.sections.satser, 2000, 2030)).toBeUndefined();
    expect(selectSatserCanDownload(state.sections.satser, 2000, 2030)).toBe(true);
  });

  it('returns undefined for out-of-range year', () => {
    // arrange
    store.getState().commitSection('satser', { aargang: 2010 });

    // act
    const state = store.getState();

    // assert
    expect(selectSatserEffectiveAargang(state.sections.satser, 2011, 2020)).toBeUndefined();
    expect(selectSatserHasAnyInput(state.sections.satser)).toBe(true);
    expect(selectSatserAargangErrorMessage(state.sections.satser, 2011, 2020)).toBe('Årstallet skal være mellem 2011 og 2020');
    expect(selectSatserCanDownload(state.sections.satser, 2011, 2020)).toBe(false);
  });
});
