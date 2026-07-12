// @vitest-environment jsdom
import * as React from 'react';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import StyledTextField from '../../components/inputs/StyledTextField';
import {
  CriticalActionProvider,
  useCriticalActionCoordinator,
} from '../../criticalActions/CriticalActionContext';
import type { CriticalActionCoordinator } from '../../criticalActions/criticalActionCoordinator';

describe('CriticalActionContext', () => {
  it('committer en åben form-draft præcis én gang før Gem godkendes', async () => {
    const onCommit = vi.fn();
    let coordinator: CriticalActionCoordinator | null = null;

    const Harness = () => {
      coordinator = useCriticalActionCoordinator();
      return <StyledTextField value="" label="Navn" autoFocus onCommit={onCommit} />;
    };

    render(
      <CriticalActionProvider>
        <Harness />
      </CriticalActionProvider>,
    );

    const input = await screen.findByLabelText('Navn');
    fireEvent.keyDown(input, { key: 'a', code: 'KeyA' });
    await waitFor(() => expect(input).not.toHaveAttribute('readonly'));

    let status = '';
    await act(async () => {
      status = (await coordinator!.prepare('save')).status;
    });

    expect(status).toBe('committed');
    expect(onCommit).toHaveBeenCalledTimes(1);
    expect(onCommit.mock.calls[0]?.[0]).toMatchObject({ target: { value: 'a' } });
  });

  it('blokerer load uden at committe en åben form-draft', async () => {
    const onCommit = vi.fn();
    let coordinator: CriticalActionCoordinator | null = null;

    const Harness = () => {
      coordinator = useCriticalActionCoordinator();
      return <StyledTextField value="" label="Navn" autoFocus onCommit={onCommit} />;
    };

    render(
      <CriticalActionProvider>
        <Harness />
      </CriticalActionProvider>,
    );

    const input = await screen.findByLabelText('Navn');
    fireEvent.keyDown(input, { key: 'a', code: 'KeyA' });
    await waitFor(() => expect(input).not.toHaveAttribute('readonly'));

    await expect(coordinator!.prepare('load')).resolves.toMatchObject({
      status: 'blocked',
      reason: 'editor-open',
    });
    expect(onCommit).not.toHaveBeenCalled();
    expect(input).toHaveValue('a');
  });
});
