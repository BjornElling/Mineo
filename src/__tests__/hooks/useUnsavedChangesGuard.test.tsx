// @vitest-environment jsdom
import React from 'react';
import { act, render } from '@testing-library/react';
import { useUnsavedChangesGuard } from '../../hooks/useUnsavedChangesGuard';

describe('useUnsavedChangesGuard', () => {
  it('beregner hasUnsavedChanges ud fra committed revision og gemt baseline', () => {
    const captured: {
      hasUnsavedChanges: boolean | null;
      markSaved: ((revision: number) => void) | null;
    } = {
      hasUnsavedChanges: null,
      markSaved: null,
    };

    const Capture = ({ revision, epoch }: { revision: number; epoch: number }) => {
      const guard = useUnsavedChangesGuard({
        combinedSectionRevision: revision,
        authoritativeSnapshotEpoch: epoch,
      });
      captured.hasUnsavedChanges = guard.hasUnsavedChanges;
      captured.markSaved = guard.markSaved;
      return null;
    };

    const rendered = render(<Capture revision={1} epoch={1} />);
    expect(captured.hasUnsavedChanges).toBe(false);

    rendered.rerender(<Capture revision={2} epoch={1} />);
    expect(captured.hasUnsavedChanges).toBe(true);

    act(() => {
      captured.markSaved?.(2);
    });
    expect(captured.hasUnsavedChanges).toBe(false);

    rendered.rerender(<Capture revision={5} epoch={2} />);
    expect(captured.hasUnsavedChanges).toBe(false);
  });
});
