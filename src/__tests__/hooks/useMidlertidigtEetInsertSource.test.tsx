// @vitest-environment jsdom
import React from 'react';
import { act, render } from '@testing-library/react';
import { PERSISTED_DATA_VERSION } from '../../config/persistenceVersion';
import { formPersistenceStore } from '../../stores/formPersistenceStore';
import {
  resetMidlertidigtEetInsertSourceCacheForTesting,
  useMidlertidigtEetInsertSource,
} from '../../hooks/useMidlertidigtEetInsertSource';
import { ERHVERVSEVNETAB_INITIAL_VALUES } from '../../domain/erhvervsevnetab/erhvervsevnetabInitialValues';

describe('useMidlertidigtEetInsertSource', () => {
  beforeEach(() => {
    sessionStorage.clear();
    resetMidlertidigtEetInsertSourceCacheForTesting();
    formPersistenceStore.getState().clearAll({
      hydrated: true,
      schemaFingerprint: PERSISTED_DATA_VERSION,
      lastCommittedAt: Date.now(),
    });
  });

  it('emitter schema-invalid issue fra hook-laget når fælles årsløn-sektionen er ugyldig', () => {
    const captured: {
      issueIds: readonly string[] | null;
      messages: readonly string[] | null;
    } = {
      issueIds: null,
      messages: null,
    };

    const Capture = () => {
      const source = useMidlertidigtEetInsertSource();
      captured.issueIds = source.issues?.map((issue) => issue.id) ?? [];
      captured.messages = source.issues?.map((issue) => issue.message) ?? [];
      return null;
    };

    render(<Capture />);

    act(() => {
      formPersistenceStore.getState().__setSectionUnsafe('faellesAarsloen', {
        aslAarsloen: { kind: 'number', value: -1 },
      });
    });

    expect(captured.issueIds).toContain('midlertidigt-eet-faelles-aarsloen-schema-invalid');
    expect(captured.messages).toContain('Årslønnen er ikke gyldig.');
  });

  it('emitter konkrete mangler-beskeder når EET-kildesektioner ikke er udfyldt', () => {
    const captured: {
      messages: readonly string[] | null;
    } = {
      messages: null,
    };

    const Capture = () => {
      const source = useMidlertidigtEetInsertSource();
      captured.messages = source.issues?.map((issue) => issue.message) ?? [];
      return null;
    };

    render(<Capture />);

    expect(captured.messages).toContain('Der mangler en afgørelse med EET-procent.');
    expect(captured.messages).toContain('Årsløn er ikke indtastet.');
  });

  it('emitter målrettet schema-invalid issue når EET-procenten er ugyldig', () => {
    const captured: {
      issueIds: readonly string[] | null;
      messages: readonly string[] | null;
    } = {
      issueIds: null,
      messages: null,
    };

    const Capture = () => {
      const source = useMidlertidigtEetInsertSource();
      captured.issueIds = source.issues?.map((issue) => issue.id) ?? [];
      captured.messages = source.issues?.map((issue) => issue.message) ?? [];
      return null;
    };

    render(<Capture />);

    act(() => {
      formPersistenceStore.getState().__setSectionUnsafe('erhvervsevnetab', {
        ...ERHVERVSEVNETAB_INITIAL_VALUES,
        aslAfgoerelser: [{
          id: 'afg-1',
          afgoerelsesDato: undefined,
          virkningsDato: undefined,
          eetPct: 7,
          kapDato: undefined,
          kapPct: undefined,
          afgoerelseType: undefined,
          tidlKapDato: undefined,
          fsTilbageholdtEet: 'Nej',
        }],
      });
    });

    expect(captured.issueIds).toContain('midlertidigt-eet-source-schema-invalid');
    expect(captured.messages).toContain('EET-procenten er ikke gyldig.');
  });
});
