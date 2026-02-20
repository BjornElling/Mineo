/// <reference types="vitest/globals" />
import React from 'react';
import { act, render } from '@testing-library/react';
import { useOmregningToggle } from '../../hooks/useOmregningToggle';
import type { CommitEvent } from '../../components/inputs/fieldEvents';
import type {
  AarsloenTableValidationSummary,
} from '../../types/table';
import type { AarsloenTableHandle, StyledToggleSwitchHandle } from '../../types/handles';

let lastHandleToggle: ((e: CommitEvent<boolean>) => void) | null = null;

type Props = {
  initialEnabled?: boolean;
  tabelHarFejl: boolean;
  hasValidPeriod: boolean;
  onEnabledChange: (enabled: boolean) => void;
  tableRefMock: AarsloenTableHandle;
  toggleRefMock: StyledToggleSwitchHandle;
};

const Harness = ({
  initialEnabled = false,
  tabelHarFejl,
  hasValidPeriod,
  onEnabledChange,
  tableRefMock,
  toggleRefMock,
}: Props) => {
  const tabelRef = React.useRef(tableRefMock);
  const toggleRef = React.useRef(toggleRefMock);

  const { handleToggle } = useOmregningToggle({
    initialEnabled,
    tabelHarFejl,
    hasValidPeriod,
    tabelRef,
    toggleRef,
    onEnabledChange,
  });

  lastHandleToggle = handleToggle;
  return null;
};

describe('useOmregningToggle', () => {
  afterEach(() => {
    lastHandleToggle = null;
  });

  it('blocks enable and shows missing-entry error', async () => {
    const onEnabledChange = vi.fn();
    const shake = vi.fn();
    const showMissingEntryError = vi.fn();
    const flashError = vi.fn();

    const summary: AarsloenTableValidationSummary = {
      rowIssues: [],
      hasErrors: true,
      hasWarnings: false,
      firstErrorCell: { rowId: 'r1', colKey: 'col0_maaned', reason: 'missing' },
    };

    render(
      <Harness
        tabelHarFejl
        hasValidPeriod
        onEnabledChange={onEnabledChange}
        tableRefMock={{
          getErrors: vi.fn(),
          getValidationSummary: vi.fn(() => summary),
          showMissingEntryError,
          flashError,
        }}
        toggleRefMock={{ shake }}
      />
    );

    await act(async () => {
      lastHandleToggle?.({ target: { value: true } } as CommitEvent<boolean>);
    });

    expect(shake).toHaveBeenCalled();
    expect(showMissingEntryError).toHaveBeenCalled();
    expect(flashError).not.toHaveBeenCalled();
    expect(onEnabledChange).not.toHaveBeenCalled();
  });

  it('flashes cell on input error', async () => {
    const onEnabledChange = vi.fn();
    const shake = vi.fn();
    const flashError = vi.fn();

    const summary: AarsloenTableValidationSummary = {
      rowIssues: [],
      hasErrors: true,
      hasWarnings: false,
      firstErrorCell: { rowId: 'r2', colKey: 'col1_maaned', reason: 'input' },
    };

    render(
      <Harness
        tabelHarFejl
        hasValidPeriod
        onEnabledChange={onEnabledChange}
        tableRefMock={{
          getErrors: vi.fn(),
          getValidationSummary: vi.fn(() => summary),
          showMissingEntryError: vi.fn(),
          flashError,
        }}
        toggleRefMock={{ shake }}
      />
    );

    await act(async () => {
      lastHandleToggle?.({ target: { value: true } } as CommitEvent<boolean>);
    });

    expect(flashError).toHaveBeenCalledWith({
      kind: 'cell',
      issue: 'invalid',
      rowId: 'r2',
      colKey: 'col1_maaned',
    });
    expect(onEnabledChange).not.toHaveBeenCalled();
  });

  it('auto-disables when period becomes invalid', async () => {
    const onEnabledChange = vi.fn();

    const tableRefMock: AarsloenTableHandle = {
      getErrors: vi.fn(),
      getValidationSummary: vi.fn(),
      showMissingEntryError: vi.fn(),
      flashError: vi.fn(),
    };

    const toggleRefMock: StyledToggleSwitchHandle = { shake: vi.fn() };

    const { rerender } = render(
      <Harness
        initialEnabled={true}
        tabelHarFejl={false}
        hasValidPeriod={true}
        onEnabledChange={onEnabledChange}
        tableRefMock={tableRefMock}
        toggleRefMock={toggleRefMock}
      />
    );

    await act(async () => {
      rerender(
        <Harness
          initialEnabled={true}
          tabelHarFejl={false}
          hasValidPeriod={false}
          onEnabledChange={onEnabledChange}
          tableRefMock={tableRefMock}
          toggleRefMock={toggleRefMock}
        />
      );
    });

    expect(onEnabledChange).toHaveBeenCalledWith(false);
  });
});
