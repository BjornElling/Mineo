// @vitest-environment jsdom
import React from 'react';
import { render, act } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { useForligAnsvarsgradValidation } from '../../hooks/useForligAnsvarsgradValidation';
import { FormPersistenceProvider, initializePersistenceRuntime } from '../../contexts/FormPersistenceContext';
import { clearResolvedFieldErrorsCache } from '../../hooks/useFormPersistenceSelectors';
import { formPersistenceStore } from '../../stores/formPersistenceStore';
import { getResolvedFieldErrorsSnapshot } from '../../stores/formPersistenceReadModel';
import { undoRedoStore } from '../../stores/undoRedoStore';
import { PERSISTED_DATA_VERSION } from '../../config/persistenceVersion';
import {
  FORLIG_BEGGE_UDFYLDT_FEJL,
  FORLIG_DATO_KRAEVER_ANSVARSGRAD_FEJL,
  type ForligAnsvarsgradFields,
} from '../../domain/erstatningsopgoerelse/validation/forligAnsvarsgradRules';
import type { ISODateString } from '../../types/branded';

const iso = (value: string): ISODateString => value as ISODateString;

const Harness = ({ values }: { values: ForligAnsvarsgradFields }) => {
  useForligAnsvarsgradValidation(values);
  return null;
};

const renderHook = (values: ForligAnsvarsgradFields) =>
  render(
    <MemoryRouter>
      <FormPersistenceProvider runtime={initializePersistenceRuntime()}>
        <Harness values={values} />
      </FormPersistenceProvider>
    </MemoryRouter>
  );

const ruleError = (field: 'forligAnsvarsgradProcent' | 'forligAnsvarsgradBroek' | 'forligDato') => {
  clearResolvedFieldErrorsCache();
  return getResolvedFieldErrorsSnapshot('erstatningsopgoerelse')[field];
};

describe('useForligAnsvarsgradValidation', () => {
  beforeEach(() => {
    sessionStorage.clear();
    clearResolvedFieldErrorsCache();
    formPersistenceStore.getState().clearAll({
      hydrated: true,
      persistedDataVersion: PERSISTED_DATA_VERSION,
      lastCommittedAt: Date.now(),
    });
    formPersistenceStore.getState().clearAllFieldErrors();
    undoRedoStore.getState().clear();
  });

  it('rapporterer ingen blokerende fejl når intet er udfyldt', () => {
    renderHook({ forligAnsvarsgradProcent: undefined, forligAnsvarsgradBroek: undefined, forligDato: undefined });

    expect(ruleError('forligAnsvarsgradProcent')).toBeUndefined();
    expect(ruleError('forligAnsvarsgradBroek')).toBeUndefined();
    expect(ruleError('forligDato')).toBeUndefined();
  });

  it('rapporterer blokerende "begge udfyldt"-regel til procent og brøk', () => {
    renderHook({ forligAnsvarsgradProcent: 50, forligAnsvarsgradBroek: '1/3', forligDato: undefined });

    const procent = ruleError('forligAnsvarsgradProcent');
    const broek = ruleError('forligAnsvarsgradBroek');
    expect(procent).toMatchObject({ message: FORLIG_BEGGE_UDFYLDT_FEJL, severity: 'error', source: 'rule', blocksSave: true });
    expect(broek).toMatchObject({ message: FORLIG_BEGGE_UDFYLDT_FEJL, severity: 'error', source: 'rule', blocksSave: true });
  });

  it('rapporterer blokerende dato-regel når forligDato er sat uden ansvarsgrad', () => {
    renderHook({ forligAnsvarsgradProcent: undefined, forligAnsvarsgradBroek: undefined, forligDato: iso('2024-05-17') });

    expect(ruleError('forligDato')).toMatchObject({
      message: FORLIG_DATO_KRAEVER_ANSVARSGRAD_FEJL,
      severity: 'error',
      source: 'rule',
      blocksSave: true,
    });
  });

  it('rydder reglen igen, når en gyldig ansvarsgrad angives sammen med datoen', () => {
    const { rerender } = renderHook({
      forligAnsvarsgradProcent: undefined,
      forligAnsvarsgradBroek: undefined,
      forligDato: iso('2024-05-17'),
    });
    expect(ruleError('forligDato')).toMatchObject({ message: FORLIG_DATO_KRAEVER_ANSVARSGRAD_FEJL });

    act(() => {
      rerender(
        <MemoryRouter>
          <FormPersistenceProvider runtime={initializePersistenceRuntime()}>
            <Harness values={{ forligAnsvarsgradProcent: 50, forligAnsvarsgradBroek: undefined, forligDato: iso('2024-05-17') }} />
          </FormPersistenceProvider>
        </MemoryRouter>
      );
    });

    expect(ruleError('forligDato')).toBeUndefined();
  });
});
