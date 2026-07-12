import { PERSISTED_DATA_VERSION } from '../../config/persistenceVersion';
import {
  clearResolvedFieldErrorsCache,
  getFieldErrorsBySourceSnapshot,
  getResolvedFieldErrorsSnapshot,
} from '../../stores/formPersistenceReadModel';
import { formPersistenceStore } from '../../stores/formPersistenceStore';

describe('formPersistenceReadModel', () => {
  beforeEach(() => {
    clearResolvedFieldErrorsCache();
    formPersistenceStore.getState().clearAll({
      hydrated: true,
      persistedDataVersion: PERSISTED_DATA_VERSION,
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

  it('genberegner resolved field errors automatisk efter feltfejl ændres', () => {
    formPersistenceStore.getState().setFieldError('stamdata', 'skadedato', 'input', {
      message: 'Ugyldig dato',
      severity: 'error',
      blocksSave: true,
    });

    const firstSnapshot = getResolvedFieldErrorsSnapshot('stamdata');
    expect(firstSnapshot.skadedato?.message).toBe('Ugyldig dato');

    formPersistenceStore.getState().setFieldError('stamdata', 'skadedato', 'input', {
      message: 'Dato ligger uden for intervallet',
      severity: 'error',
      blocksSave: true,
    });

    const refreshedSnapshot = getResolvedFieldErrorsSnapshot('stamdata');

    expect(refreshedSnapshot).not.toBe(firstSnapshot);
    expect(refreshedSnapshot.skadedato).toMatchObject({
      message: 'Dato ligger uden for intervallet',
      source: 'input',
      blocksSave: true,
    });
  });

  describe('invalidDrafts eksponeres som blokerende feltfejl', () => {
    it('en ikke-committbar rå draft bliver en blokerende invalid-draft-feltfejl', () => {
      formPersistenceStore.getState().setInvalidDraft('varigemen', 'mengrad', '0');
      clearResolvedFieldErrorsCache();

      const resolved = getResolvedFieldErrorsSnapshot('varigemen');
      expect(resolved.mengrad).toMatchObject({
        source: 'invalid-draft',
        severity: 'error',
        blocksSave: true,
      });
      expect(resolved.mengrad?.message).toContain('0');
    });

    it('invalid-draft flettes ind i by-source-modellen (læses af collectAllEoRows m.fl.)', () => {
      formPersistenceStore.getState().setInvalidDraft('erstatningsopgoerelse', 'forligAnsvarsgradProcent', '0');
      clearResolvedFieldErrorsCache();

      const bySource = getFieldErrorsBySourceSnapshot('erstatningsopgoerelse');
      expect(bySource.forligAnsvarsgradProcent?.['invalid-draft']).toMatchObject({
        severity: 'error',
        blocksSave: true,
      });
    });

    it('invalid-draft har forrang over en committet fejl for samme felt', () => {
      formPersistenceStore.getState().setFieldError('erstatningsopgoerelse', 'forligAnsvarsgradProcent', 'rule', {
        message: 'Regel-fejl',
        severity: 'error',
        blocksSave: true,
      });
      formPersistenceStore.getState().setInvalidDraft('erstatningsopgoerelse', 'forligAnsvarsgradProcent', '0');
      clearResolvedFieldErrorsCache();

      const resolved = getResolvedFieldErrorsSnapshot('erstatningsopgoerelse');
      expect(resolved.forligAnsvarsgradProcent?.source).toBe('invalid-draft');
    });

    it('uden invalidDrafts returneres den rå by-source-reference uændret (reference-stabil)', () => {
      const first = getFieldErrorsBySourceSnapshot('varigemen');
      const second = getFieldErrorsBySourceSnapshot('varigemen');
      expect(second).toBe(first);
    });

    it('feltfejlen forsvinder når den rå draft ryddes', () => {
      formPersistenceStore.getState().setInvalidDraft('varigemen', 'mengrad', '0');
      clearResolvedFieldErrorsCache();
      expect(getResolvedFieldErrorsSnapshot('varigemen').mengrad).toBeDefined();

      formPersistenceStore.getState().setInvalidDraft('varigemen', 'mengrad', null);
      clearResolvedFieldErrorsCache();
      expect(getResolvedFieldErrorsSnapshot('varigemen').mengrad).toBeUndefined();
    });
  });
});
