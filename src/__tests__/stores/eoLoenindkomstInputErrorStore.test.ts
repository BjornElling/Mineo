import { __createTestEOLoenindkomstInputErrorStore } from '../../stores/eoLoenindkomstInputErrorStore';

describe('eoLoenindkomstInputErrorStore', () => {
  it('sets and clears a single error flag', () => {
    const store = __createTestEOLoenindkomstInputErrorStore();

    store.getState().setError('af-1', true);
    expect(store.getState().errors).toEqual({ 'af-1': true });

    store.getState().setError('af-1', false);
    expect(store.getState().errors).toEqual({});
  });

  it('clearAll removes all error flags', () => {
    const store = __createTestEOLoenindkomstInputErrorStore();
    store.getState().setError('af-1', true);
    store.getState().setError('af-2', true);

    store.getState().clearAll();
    expect(store.getState().errors).toEqual({});
  });

  it('replaceAll restores a full snapshot', () => {
    const store = __createTestEOLoenindkomstInputErrorStore();
    store.getState().setError('af-1', true);

    store.getState().replaceAll({ 'af-9': true });
    expect(store.getState().errors).toEqual({ 'af-9': true });
  });
});
