// @vitest-environment jsdom
import React from 'react';
import { act, render } from '@testing-library/react';
import { PERSISTED_DATA_VERSION } from '../../config/persistenceVersion';
import { formPersistenceStore } from '../../stores/formPersistenceStore';
import {
  resetMidlertidigtEetInsertSourceCacheForTesting,
  useMidlertidigtEetInsertSource,
} from '../../hooks/useMidlertidigtEetInsertSource';

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
    } = {
      issueIds: null,
    };

    const Capture = () => {
      const source = useMidlertidigtEetInsertSource();
      captured.issueIds = source.issues?.map((issue) => issue.id) ?? [];
      return null;
    };

    render(<Capture />);

    act(() => {
      formPersistenceStore.getState().__setSectionUnsafe('faellesAarsloen', {
        aslAarsloen: { kind: 'number', value: -1 },
      });
    });

    expect(captured.issueIds).toContain('midlertidigt-eet-faelles-aarsloen-schema-invalid');
  });
});
