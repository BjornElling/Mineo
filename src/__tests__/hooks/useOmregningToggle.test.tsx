// @vitest-environment jsdom
/// <reference types="vitest/globals" />
import React from 'react';
import { act, render } from '@testing-library/react';
import { useOmregningToggle } from '../../hooks/useOmregningToggle';
import type { ToggleCommitDecision } from '../../inputCore/react/fields/ToggleField';
import {
  EMPTY_STANDARD_LOEN_TABLE_VALIDATION_SUMMARY,
  type AarsloenOmregningGate,
} from '../../domain/aarsloen/aarsloenValidationPolicies';
import type {
  StandardLoenTableValidationSummary,
} from '../../types/table';
import type { StandardLoenTableHandle } from '../../types/handles';

let lastDecide: ((next: boolean) => ToggleCommitDecision) | null = null;
let lastDecision: ToggleCommitDecision | null = null;
let lastChecked = false;
let lastEffectiveEnabled = false;

type Props = {
  gate?: AarsloenOmregningGate;
  tableRefMock: StandardLoenTableHandle;
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
  tableRefMock,
}: Props) => {
  const tabelRef = React.useRef(tableRefMock);

  const { checked, effectiveEnabled, decideToggle } = useOmregningToggle({ gate, tabelRef });

  lastDecide = decideToggle;
  lastChecked = checked;
  lastEffectiveEnabled = effectiveEnabled;
  return null;
};

describe('useOmregningToggle', () => {
  afterEach(() => {
    lastDecide = null;
    lastDecision = null;
    lastChecked = false;
    lastEffectiveEnabled = false;
  });

  it('blocks enable and shows missing-entry error', async () => {
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
        tableRefMock={{
          showMissingEntryError,
          flashError,
          showNeedsPeriodHint: vi.fn(),
        }}
      />
    );

    await act(async () => {
      lastDecision = lastDecide?.(true) ?? null;
    });
    expect(showMissingEntryError).toHaveBeenCalled();
    expect(flashError).not.toHaveBeenCalled();
    expect(lastDecision).toBe('reject');
  });

  it('flashes cell on input error', async () => {
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
        tableRefMock={{
          showMissingEntryError: vi.fn(),
          flashError,
          showNeedsPeriodHint: vi.fn(),
        }}
      />
    );

    await act(async () => {
      lastDecision = lastDecide?.(true) ?? null;
    });

    expect(flashError).toHaveBeenCalledWith({
      kind: 'cell',
      issue: 'invalid',
      rowId: 'r2',
      colKey: 'col1_maaned',
    });
    expect(lastDecision).toBe('reject');
  });

  it('enables when tabelHarFejl=false og hasValidPeriod=true', async () => {

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
        tableRefMock={{
          showMissingEntryError: vi.fn(),
          flashError: vi.fn(),
          showNeedsPeriodHint: vi.fn(),
        }}
      />
    );

    await act(async () => {
      lastDecision = lastDecide?.(true) ?? null;
    });

    expect(lastDecision).toBe('commit');
  });

  it('kalder ikke showMissingEntryError/flashError ved gyldig enable', async () => {
    const showMissingEntryError = vi.fn();
    const flashError = vi.fn();

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
        tableRefMock={{
          showMissingEntryError,
          flashError,
          showNeedsPeriodHint: vi.fn(),
        }}
      />
    );

    await act(async () => {
      lastDecision = lastDecide?.(true) ?? null;
    });
    expect(showMissingEntryError).not.toHaveBeenCalled();
    expect(flashError).not.toHaveBeenCalled();
  });

  it('blokerer enable og peger på periodecellen når perioden er utilstrækkelig uden feltfejl', async () => {

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
        tableRefMock={{
          showMissingEntryError: vi.fn(),
          flashError: vi.fn(),
          showNeedsPeriodHint: vi.fn(),
        }}
      />
    );

    await act(async () => {
      lastDecision = lastDecide?.(true) ?? null;
    });
    expect(lastDecision).toBe('reject');
  });

  it('blokerer enable og peger på periodecelle når getValidationSummary ikke har firstErrorCell', async () => {
    const showMissingEntryError = vi.fn();
    const flashError = vi.fn();
    const showNeedsPeriodHint = vi.fn();

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
        tableRefMock={{
          showMissingEntryError,
          flashError,
          showNeedsPeriodHint,
        }}
      />
    );

    await act(async () => {
      lastDecision = lastDecide?.(true) ?? null;
    });

    // Ryster + peger på første periodecelle (ingen konkret fejlcelle); ingen direkte celle-fejl.
    expect(showNeedsPeriodHint).toHaveBeenCalled();
    expect(showMissingEntryError).not.toHaveBeenCalled();
    expect(flashError).not.toHaveBeenCalled();
    expect(lastDecision).toBe('reject');
  });

  it('disable-toggle kalder onEnabledChange(false)', async () => {

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
        tableRefMock={{
          showMissingEntryError: vi.fn(),
          flashError: vi.fn(),
          showNeedsPeriodHint: vi.fn(),
        }}
      />
    );

    await act(async () => {
      lastDecision = lastDecide?.(false) ?? null;
    });

    expect(lastDecision).toBe('commit');
  });

  it('viser checked=false og effectiveEnabled=false når gate blokerer pga. utilstrækkelig periode', async () => {

    const tableRefMock: StandardLoenTableHandle = {
      showMissingEntryError: vi.fn(),
      flashError: vi.fn(),
      showNeedsPeriodHint: vi.fn(),
    };

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
        tableRefMock={tableRefMock}
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
          tableRefMock={tableRefMock}
        />
      );
    });

    expect(lastChecked).toBe(false);
    expect(lastEffectiveEnabled).toBe(false);
    // Ingen toggle-interaktion i denne test: gaten skifter kun den VISTE tilstand.
    expect(lastDecision).toBeNull();
  });

  it('viser checked=false og effectiveEnabled=false når gate blokerer pga. tabel-fejl', async () => {

    const tableRefMock: StandardLoenTableHandle = {
      showMissingEntryError: vi.fn(),
      flashError: vi.fn(),
      showNeedsPeriodHint: vi.fn(),
    };

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
        tableRefMock={tableRefMock}
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
          tableRefMock={tableRefMock}
        />
      );
    });

    expect(lastChecked).toBe(false);
    expect(lastEffectiveEnabled).toBe(false);
    // Ingen toggle-interaktion i denne test: gaten skifter kun den VISTE tilstand.
    expect(lastDecision).toBeNull();
  });

  it('kan automatisk vende tilbage til checked=true når gate igen tillader omregning', async () => {

    const tableRefMock: StandardLoenTableHandle = {
      showMissingEntryError: vi.fn(),
      flashError: vi.fn(),
      showNeedsPeriodHint: vi.fn(),
    };

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
        tableRefMock={tableRefMock}
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
          tableRefMock={tableRefMock}
        />
      );
    });

    expect(lastChecked).toBe(true);
    expect(lastEffectiveEnabled).toBe(true);
    // Ingen toggle-interaktion i denne test: gaten skifter kun den VISTE tilstand.
    expect(lastDecision).toBeNull();
  });
});
