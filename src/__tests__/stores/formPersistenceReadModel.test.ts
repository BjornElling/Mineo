import { PERSISTED_DATA_VERSION } from '../../config/persistenceVersion';
import {
  clearResolvedFieldErrorsCache,
  getResolvedFieldErrorsSnapshot,
} from '../../stores/formPersistenceReadModel';
import { formPersistenceStore } from '../../stores/formPersistenceStore';

describe('formPersistenceReadModel', () => {
  beforeEach(() => {
    clearResolvedFieldErrorsCache();
    formPersistenceStore.getState().clearAll({
      hydrated: true,
      schemaFingerprint: PERSISTED_DATA_VERSION,
      lastCommittedAt: Date.now(),
    });
    formPersistenceStore.getState().clearAllFieldErrors();
  });

  it('genberegner resolved field errors efter eksplicit cache-invalidering', () => {
    formPersistenceStore.getState().setFieldError('stamdata', 'skadedato', 'input', {
      message: 'Ugyldig dato',
      severity: 'error',
      blocksSave: true,
    });

    const firstSnapshot = getResolvedFieldErrorsSnapshot('stamdata');
    const cachedSnapshot = getResolvedFieldErrorsSnapshot('stamdata');

    expect(cachedSnapshot).toBe(firstSnapshot);

    clearResolvedFieldErrorsCache();
    const refreshedSnapshot = getResolvedFieldErrorsSnapshot('stamdata');

    expect(refreshedSnapshot).not.toBe(firstSnapshot);
    expect(refreshedSnapshot.skadedato).toMatchObject({
      message: 'Ugyldig dato',
      source: 'input',
      blocksSave: true,
    });
  });
});
