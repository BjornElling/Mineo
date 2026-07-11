import {
  __createTestStore,
} from '../../stores/formPersistenceStore';
import {
  canDownloadSatser,
  hasSatserAny,
  resolveSatserAargangErrorMessage,
  resolveSatserEffectiveAargang,
} from '../../domain/policies';
import { PERSISTED_DATA_VERSION } from '../../config/persistenceVersion';
import { satserAngivAarYearBounds } from '../../data/lovbestemteRates';

const VALID_META = { hydrated: true, persistedDataVersion: PERSISTED_DATA_VERSION };
const SATSER_MIN_YEAR = satserAngivAarYearBounds.minYear;
const SATSER_MAX_YEAR = satserAngivAarYearBounds.maxYear;

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
    expect(resolveSatserEffectiveAargang(state.sections.satser, SATSER_MIN_YEAR, SATSER_MAX_YEAR)).toBeUndefined();
    expect(hasSatserAny(state.sections.satser)).toBe(false);
    expect(resolveSatserAargangErrorMessage(state.sections.satser, SATSER_MIN_YEAR, SATSER_MAX_YEAR)).toBe(`Årstallet skal være mellem ${SATSER_MIN_YEAR} og ${SATSER_MAX_YEAR}`);
    expect(canDownloadSatser(state.sections.satser, SATSER_MIN_YEAR, SATSER_MAX_YEAR)).toBe(false);
  });

  it('returns the selected year when present', () => {
    // arrange
    store.getState().commitSection('satser', { aargang: SATSER_MAX_YEAR });

    // act
    const state = store.getState();

    // assert
    expect(resolveSatserEffectiveAargang(state.sections.satser, SATSER_MIN_YEAR, SATSER_MAX_YEAR)).toBe(SATSER_MAX_YEAR);
    expect(hasSatserAny(state.sections.satser)).toBe(true);
    expect(resolveSatserAargangErrorMessage(state.sections.satser, SATSER_MIN_YEAR, SATSER_MAX_YEAR)).toBeUndefined();
    expect(canDownloadSatser(state.sections.satser, SATSER_MIN_YEAR, SATSER_MAX_YEAR)).toBe(true);
  });

  it('returns undefined for out-of-range year', () => {
    // arrange
    store.getState().commitSection('satser', { aargang: SATSER_MIN_YEAR - 1 });

    // act
    const state = store.getState();

    // assert
    expect(resolveSatserEffectiveAargang(state.sections.satser, SATSER_MIN_YEAR, SATSER_MAX_YEAR)).toBeUndefined();
    expect(hasSatserAny(state.sections.satser)).toBe(true);
    expect(resolveSatserAargangErrorMessage(state.sections.satser, SATSER_MIN_YEAR, SATSER_MAX_YEAR)).toBe(`Årstallet skal være mellem ${SATSER_MIN_YEAR} og ${SATSER_MAX_YEAR}`);
    expect(canDownloadSatser(state.sections.satser, SATSER_MIN_YEAR, SATSER_MAX_YEAR)).toBe(false);
  });
});
