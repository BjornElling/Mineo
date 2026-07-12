// @vitest-environment jsdom
/// <reference types="vitest/globals" />
import React from 'react';
import { act, render } from '@testing-library/react';
import { useOmregningToggle } from '../../hooks/useOmregningToggle';
import type { CommitEvent } from '../../types/fieldEvents';
import {
  EMPTY_STANDARD_LOEN_TABLE_VALIDATION_SUMMARY,
  type AarsloenOmregningGate,
} from '../../domain/aarsloen/aarsloenValidationPolicies';
import type {
  StandardLoenTableValidationSummary,
} from '../../types/table';
import type { StandardLoenTableHandle, StyledToggleSwitchHandle } from '../../types/handles';

let lastHandleToggle: ((e: CommitEvent<boolean>) => boolean) | null = null;
let lastChecked = false;
let lastEffectiveEnabled = false;

type Props = {
  gate?: AarsloenOmregningGate;
  onEnabledChange: (enabled: boolean) => boolean;
  tableRefMock: StandardLoenTableHandle;
  toggleRefMock: StyledToggleSwitchHandle;
};

const Harness = ({
  gate = {
    checked: false,
    effectiveEnabled: false,
    canEnable: true,
    hasValidPeriod: true,
    hasBlockingTableIssue: false,
    validationSummary: EMPTY_STANDARD_LOEN_TABLE_VALIDATION_SUMMARY,
  },
  onEnabledChange,
  tableRefMock,
  toggleRefMock,
}: Props) => {
  const tabelRef = React.useRef(tableRefMock);
  const toggleRef = React.useRef(toggleRefMock);

  const { checked, effectiveEnabled, handleToggle } = useOmregningToggle({ gate, tabelRef, toggleRef, onEnabledChange });

  lastHandleToggle = handleToggle;
  lastChecked = checked;
  lastEffectiveEnabled = effectiveEnabled;
  return null;
};

describe('useOmregningToggle', () => {
  afterEach(() => {
    lastHandleToggle = null;
    lastChecked = false;
    lastEffectiveEnabled = false;
  });

  it('blocks enable and shows missing-entry error', async () => {
    const onEnabledChange = vi.fn();
    const shake = vi.fn();
    const showMissingEntryError = vi.fn();
    const flashError = vi.fn();

    const summary: StandardLoenTableValidationSummary = {
      rowIssues: [],
      hasErrors: true,
      hasWarnings: false,
      firstErrorCell: { rowId: 'r1', colKey: 'col0_maaned', reason: 'missing' },
    };

    render(
        <Harness
        gate={{
          checked: false,
          effectiveEnabled: false,
          canEnable: false,
          hasValidPeriod: true,
          hasBlockingTableIssue: true,
          validationSummary: summary,
        }}
        onEnabledChange={onEnabledChange}
        tableRefMock={{
          getErrors: vi.fn(),
          getValidationSummary: vi.fn(() => summary),
          showMissingEntryError,
          flashError,
          showNeedsPeriodHint: vi.fn(),
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

    const summary: StandardLoenTableValidationSummary = {
      rowIssues: [],
      hasErrors: true,
      hasWarnings: false,
      firstErrorCell: { rowId: 'r2', colKey: 'col1_maaned', reason: 'input' },
    };

    render(
        <Harness
        gate={{
          checked: false,
          effectiveEnabled: false,
          canEnable: false,
          hasValidPeriod: true,
          hasBlockingTableIssue: true,
          validationSummary: summary,
        }}
        onEnabledChange={onEnabledChange}
        tableRefMock={{
          getErrors: vi.fn(),
          getValidationSummary: vi.fn(() => summary),
          showMissingEntryError: vi.fn(),
          flashError,
          showNeedsPeriodHint: vi.fn(),
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

  it('enables when tabelHarFejl=false og hasValidPeriod=true', async () => {
    const onEnabledChange = vi.fn();

    render(
        <Harness
        gate={{
          checked: false,
          effectiveEnabled: false,
          canEnable: true,
          hasValidPeriod: true,
          hasBlockingTableIssue: false,
          validationSummary: EMPTY_STANDARD_LOEN_TABLE_VALIDATION_SUMMARY,
        }}
        onEnabledChange={onEnabledChange}
        tableRefMock={{
          getErrors: vi.fn(),
          getValidationSummary: vi.fn(() => ({ rowIssues: [], hasErrors: false, hasWarnings: false })),
          showMissingEntryError: vi.fn(),
          flashError: vi.fn(),
          showNeedsPeriodHint: vi.fn(),
        }}
        toggleRefMock={{ shake: vi.fn() }}
      />
    );

    await act(async () => {
      lastHandleToggle?.({ target: { value: true } } as CommitEvent<boolean>);
    });

    expect(onEnabledChange).toHaveBeenCalledWith(true);
  });

  it('kalder ikke shake/showMissingEntryError/flashError ved gyldig enable', async () => {
    const shake = vi.fn();
    const showMissingEntryError = vi.fn();
    const flashError = vi.fn();
    const onEnabledChange = vi.fn();

    render(
        <Harness
        gate={{
          checked: false,
          effectiveEnabled: false,
          canEnable: true,
          hasValidPeriod: true,
          hasBlockingTableIssue: false,
          validationSummary: EMPTY_STANDARD_LOEN_TABLE_VALIDATION_SUMMARY,
        }}
        onEnabledChange={onEnabledChange}
        tableRefMock={{
          getErrors: vi.fn(),
          getValidationSummary: vi.fn(() => ({ rowIssues: [], hasErrors: false, hasWarnings: false })),
          showMissingEntryError,
          flashError,
          showNeedsPeriodHint: vi.fn(),
        }}
        toggleRefMock={{ shake }}
      />
    );

    await act(async () => {
      lastHandleToggle?.({ target: { value: true } } as CommitEvent<boolean>);
    });

    expect(shake).not.toHaveBeenCalled();
    expect(showMissingEntryError).not.toHaveBeenCalled();
    expect(flashError).not.toHaveBeenCalled();
  });

  it('blokerer enable og ryster når perioden er utilstrækkelig uden feltfejl', async () => {
    const shake = vi.fn();
    const onEnabledChange = vi.fn();

    render(
        <Harness
        gate={{
          checked: false,
          effectiveEnabled: false,
          canEnable: false,
          hasValidPeriod: false,
          hasBlockingTableIssue: true,
          validationSummary: EMPTY_STANDARD_LOEN_TABLE_VALIDATION_SUMMARY,
        }}
        onEnabledChange={onEnabledChange}
        tableRefMock={{
          getErrors: vi.fn(),
          getValidationSummary: vi.fn(() => ({ rowIssues: [], hasErrors: false, hasWarnings: false })),
          showMissingEntryError: vi.fn(),
          flashError: vi.fn(),
          showNeedsPeriodHint: vi.fn(),
        }}
        toggleRefMock={{ shake }}
      />
    );

    await act(async () => {
      lastHandleToggle?.({ target: { value: true } } as CommitEvent<boolean>);
    });

    expect(shake).toHaveBeenCalled();
    expect(onEnabledChange).not.toHaveBeenCalled();
  });

  it('blokerer enable og peger på periodecelle når getValidationSummary ikke har firstErrorCell', async () => {
    const shake = vi.fn();
    const showMissingEntryError = vi.fn();
    const flashError = vi.fn();
    const showNeedsPeriodHint = vi.fn();
    const onEnabledChange = vi.fn();

    render(
        <Harness
        gate={{
          checked: false,
          effectiveEnabled: false,
          canEnable: false,
          hasValidPeriod: true,
          hasBlockingTableIssue: true,
          validationSummary: EMPTY_STANDARD_LOEN_TABLE_VALIDATION_SUMMARY,
        }}
        onEnabledChange={onEnabledChange}
        tableRefMock={{
          getErrors: vi.fn(),
          getValidationSummary: vi.fn(() => ({ rowIssues: [], hasErrors: false, hasWarnings: false })),
          showMissingEntryError,
          flashError,
          showNeedsPeriodHint,
        }}
        toggleRefMock={{ shake }}
      />
    );

    await act(async () => {
      lastHandleToggle?.({ target: { value: true } } as CommitEvent<boolean>);
    });

    // Ryster + peger på første periodecelle (ingen konkret fejlcelle); ingen direkte celle-fejl.
    expect(shake).toHaveBeenCalled();
    expect(showNeedsPeriodHint).toHaveBeenCalled();
    expect(showMissingEntryError).not.toHaveBeenCalled();
    expect(flashError).not.toHaveBeenCalled();
    expect(onEnabledChange).not.toHaveBeenCalled();
  });

  it('disable-toggle kalder onEnabledChange(false)', async () => {
    const onEnabledChange = vi.fn();

    render(
        <Harness
        gate={{
          checked: true,
          effectiveEnabled: true,
          canEnable: true,
          hasValidPeriod: true,
          hasBlockingTableIssue: false,
          validationSummary: EMPTY_STANDARD_LOEN_TABLE_VALIDATION_SUMMARY,
        }}
        onEnabledChange={onEnabledChange}
        tableRefMock={{
          getErrors: vi.fn(),
          getValidationSummary: vi.fn(() => ({ rowIssues: [], hasErrors: false, hasWarnings: false })),
          showMissingEntryError: vi.fn(),
          flashError: vi.fn(),
          showNeedsPeriodHint: vi.fn(),
        }}
        toggleRefMock={{ shake: vi.fn() }}
      />
    );

    await act(async () => {
      lastHandleToggle?.({ target: { value: false } } as CommitEvent<boolean>);
    });

    expect(onEnabledChange).toHaveBeenCalledWith(false);
  });

  it('viser checked=false og effectiveEnabled=false når gate blokerer pga. utilstrækkelig periode', async () => {
    const onEnabledChange = vi.fn();

    const tableRefMock: StandardLoenTableHandle = {
      getErrors: vi.fn(),
      getValidationSummary: vi.fn(),
      showMissingEntryError: vi.fn(),
      flashError: vi.fn(),
      showNeedsPeriodHint: vi.fn(),
    };

    const toggleRefMock: StyledToggleSwitchHandle = { shake: vi.fn() };

    const { rerender } = render(
      <Harness
        gate={{
          checked: true,
          effectiveEnabled: true,
          canEnable: true,
          hasValidPeriod: true,
          hasBlockingTableIssue: false,
          validationSummary: EMPTY_STANDARD_LOEN_TABLE_VALIDATION_SUMMARY,
        }}
        onEnabledChange={onEnabledChange}
        tableRefMock={tableRefMock}
        toggleRefMock={toggleRefMock}
      />
    );

    await act(async () => {
      rerender(
        <Harness
          gate={{
            checked: false,
            effectiveEnabled: false,
            canEnable: false,
            hasValidPeriod: false,
            hasBlockingTableIssue: true,
            validationSummary: EMPTY_STANDARD_LOEN_TABLE_VALIDATION_SUMMARY,
          }}
          onEnabledChange={onEnabledChange}
          tableRefMock={tableRefMock}
          toggleRefMock={toggleRefMock}
        />
      );
    });

    expect(lastChecked).toBe(false);
    expect(lastEffectiveEnabled).toBe(false);
    expect(onEnabledChange).not.toHaveBeenCalled();
  });

  it('viser checked=false og effectiveEnabled=false når gate blokerer pga. tabel-fejl', async () => {
    const onEnabledChange = vi.fn();

    const tableRefMock: StandardLoenTableHandle = {
      getErrors: vi.fn(),
      getValidationSummary: vi.fn(),
      showMissingEntryError: vi.fn(),
      flashError: vi.fn(),
      showNeedsPeriodHint: vi.fn(),
    };

    const toggleRefMock: StyledToggleSwitchHandle = { shake: vi.fn() };

    const { rerender } = render(
      <Harness
        gate={{
          checked: true,
          effectiveEnabled: true,
          canEnable: true,
          hasValidPeriod: true,
          hasBlockingTableIssue: false,
          validationSummary: EMPTY_STANDARD_LOEN_TABLE_VALIDATION_SUMMARY,
        }}
        onEnabledChange={onEnabledChange}
        tableRefMock={tableRefMock}
        toggleRefMock={toggleRefMock}
      />
    );

    await act(async () => {
      rerender(
        <Harness
          gate={{
            checked: false,
            effectiveEnabled: false,
            canEnable: false,
            hasValidPeriod: true,
            hasBlockingTableIssue: true,
            validationSummary: {
              rowIssues: [],
              hasErrors: true,
              hasWarnings: false,
            },
          }}
          onEnabledChange={onEnabledChange}
          tableRefMock={tableRefMock}
          toggleRefMock={toggleRefMock}
        />
      );
    });

    expect(lastChecked).toBe(false);
    expect(lastEffectiveEnabled).toBe(false);
    expect(onEnabledChange).not.toHaveBeenCalled();
  });

  it('kan automatisk vende tilbage til checked=true når gate igen tillader omregning', async () => {
    const onEnabledChange = vi.fn();

    const tableRefMock: StandardLoenTableHandle = {
      getErrors: vi.fn(),
      getValidationSummary: vi.fn(),
      showMissingEntryError: vi.fn(),
      flashError: vi.fn(),
      showNeedsPeriodHint: vi.fn(),
    };

    const toggleRefMock: StyledToggleSwitchHandle = { shake: vi.fn() };

    const { rerender } = render(
      <Harness
        gate={{
          checked: false,
          effectiveEnabled: false,
          canEnable: false,
          hasValidPeriod: true,
          hasBlockingTableIssue: true,
          validationSummary: {
            rowIssues: [],
            hasErrors: true,
            hasWarnings: false,
          },
        }}
        onEnabledChange={onEnabledChange}
        tableRefMock={tableRefMock}
        toggleRefMock={toggleRefMock}
      />
    );

    expect(lastChecked).toBe(false);
    expect(lastEffectiveEnabled).toBe(false);

    await act(async () => {
      rerender(
        <Harness
          gate={{
            checked: true,
            effectiveEnabled: true,
            canEnable: true,
            hasValidPeriod: true,
            hasBlockingTableIssue: false,
            validationSummary: EMPTY_STANDARD_LOEN_TABLE_VALIDATION_SUMMARY,
          }}
          onEnabledChange={onEnabledChange}
          tableRefMock={tableRefMock}
          toggleRefMock={toggleRefMock}
        />
      );
    });

    expect(lastChecked).toBe(true);
    expect(lastEffectiveEnabled).toBe(true);
    expect(onEnabledChange).not.toHaveBeenCalled();
  });
});
