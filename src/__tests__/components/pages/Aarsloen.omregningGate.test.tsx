import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import Aarsloen from '../../../components/pages/Aarsloen';
import { AARSLOEN_INITIAL_VALUES } from '../../../domain/aarsloen/aarsloenInitialValues';
import type { StandardLoenTableValidationSummary, TableError } from '../../../types/table';
import type { StandardLoenTableHandle } from '../../../types/handles';

const {
  stateRef,
  summaryRef,
  tableHandleSpies,
} = vi.hoisted(() => ({
  stateRef: {
    values: null as unknown as typeof AARSLOEN_INITIAL_VALUES,
  },
  summaryRef: {
    current: {
      rowIssues: [],
      hasErrors: false,
      hasWarnings: false,
    } as StandardLoenTableValidationSummary,
  },
  tableHandleSpies: {
    showMissingEntryError: vi.fn(),
    flashError: vi.fn(),
  },
}));

vi.mock('../../../hooks/usePersistedForm', () => ({
  usePersistedForm: () => {
    const [values, setValues] = React.useState(stateRef.values);

    React.useEffect(() => {
      stateRef.values = values;
    }, [values]);

    return { values, setValues };
  },
}));

vi.mock('../../../hooks/useFormPersistenceSelectors', () => ({
  usePersistedSectionSelector: () => ({}),
}));

vi.mock('../../../contexts/useAppSettings', () => ({
  useAppSettings: () => ({ settings: {} }),
}));

vi.mock('../../../hooks/useAarsloenBeregning', () => ({
  useAarsloenBeregning: () => ({
    periodeData: { start: new Date(Date.UTC(2024, 0, 1)), end: new Date(Date.UTC(2024, 0, 31)) },
    shDageAntal: 0,
    beregnetAarsloen: 100000,
    beregningsData: {
      metode: 'ingen',
      erEtAar: false,
    },
    fejlmeddelelser: [],
    beregningsFejl: null,
    harFatalBeregningsFejl: false,
  }),
}));

vi.mock('../../../hooks/useAarsloenPdfGates', () => ({
  useAarsloenPdfGates: () => ({
    canDownloadPdf: false,
    canDownloadSHDagePdf: false,
    handleAarsloenPdfDownload: vi.fn(),
    handleSHDagePdfDownload: vi.fn(),
    downloadShake: false,
  }),
}));

vi.mock('../../../components/layout/ContentBox', () => ({
  __esModule: true,
  default: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));

vi.mock('../../../components/inputs/StyledPercentField', () => ({
  __esModule: true,
  default: () => <div data-testid="percent-field" />,
}));

vi.mock('../../../components/inputs/StyledRadioButton', () => ({
  __esModule: true,
  default: () => <div data-testid="radio-button" />,
}));

vi.mock('../../../components/inputs/StyledIntegerField', () => ({
  __esModule: true,
  default: ({ disabled }: { disabled?: boolean }) => (
    <input data-testid="integer-field" disabled={disabled} readOnly value="" />
  ),
}));

vi.mock('../../../components/inputs/StyledDropdown', () => ({
  __esModule: true,
  default: ({ disabled }: { disabled?: boolean }) => (
    <div data-testid="dropdown-field" data-disabled={disabled ? 'true' : 'false'} />
  ),
}));

vi.mock('../../../components/inputs/StyledToggleSwitch', () => ({
  __esModule: true,
  default: React.forwardRef(function MockStyledToggleSwitch(
    {
      checked,
      disabled,
      onCommit,
    }: {
      checked: boolean;
      disabled?: boolean;
      onCommit: (event: { target: { value: boolean } }) => void;
    },
    ref: React.ForwardedRef<{ shake: () => void }>
  ) {
    const [shakeCount, setShakeCount] = React.useState(0);

    React.useImperativeHandle(ref, () => ({
      shake: () => {
        setShakeCount((count) => count + 1);
      },
    }), []);

    return (
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        aria-label="toggle"
        disabled={disabled}
        data-shakes={shakeCount}
        onClick={() => onCommit({ target: { value: !checked } })}
      />
    );
  }),
}));

vi.mock('../../../components/tables/StandardLoenTable', () => ({
  __esModule: true,
  default: React.forwardRef(function MockStandardLoenTable(
    {
      onValidationChange,
    }: {
      onValidationChange?: (summary: StandardLoenTableValidationSummary) => void;
    },
    ref: React.ForwardedRef<StandardLoenTableHandle>
  ) {
    React.useImperativeHandle(ref, () => ({
      getErrors: () => [],
      getValidationSummary: () => summaryRef.current,
      showMissingEntryError: tableHandleSpies.showMissingEntryError,
      flashError: tableHandleSpies.flashError,
    }), []);

    React.useEffect(() => {
      onValidationChange?.(summaryRef.current);
    });

    return <div data-testid="standard-loen-table" />;
  }),
}));

describe('Aarsloen omregning gate UI', () => {
  const ASYNC_TEST_TIMEOUT_MS = 15_000;

  beforeEach(() => {
    stateRef.values = {
      ...AARSLOEN_INITIAL_VALUES,
      loenperiode: 'dag',
      omregningTilFuldtAar: true,
      tableData: [{ id: 'row-1', col0_dag: '01-01-2024', col1_dag: '31-01-2024' }],
    };
    summaryRef.current = {
      rowIssues: [],
      hasErrors: false,
      hasWarnings: false,
    };
    tableHandleSpies.showMissingEntryError.mockReset();
    tableHandleSpies.flashError.mockReset();
  });

  it('holder toggle-visning og indhold under toggle synkroniseret med samme gate', async () => {
    const firstRender = render(<Aarsloen />);

    await waitFor(() => {
      const switches = screen.getAllByRole('switch');
      expect(switches[0]).toHaveAttribute('aria-checked', 'true');
      expect(screen.getByText('Fuld løn under ferie:')).toBeVisible();
      expect(switches[1]).not.toBeDisabled();
    });

    firstRender.unmount();

    summaryRef.current = {
      rowIssues: [{ rowId: 'row-1', level: 'error' }],
      hasErrors: true,
      hasWarnings: false,
      firstErrorCell: { rowId: 'row-1', colKey: 'col0_dag', reason: 'input' },
    };
    const secondRender = render(<Aarsloen />);

    await waitFor(() => {
      const switches = screen.getAllByRole('switch');
      expect(switches[0]).toHaveAttribute('aria-checked', 'false');
      expect(screen.getByText('Fuld løn under ferie:')).not.toBeVisible();
    });

    secondRender.unmount();

    summaryRef.current = {
      rowIssues: [],
      hasErrors: false,
      hasWarnings: false,
    };
    render(<Aarsloen />);

    await waitFor(() => {
      const switches = screen.getAllByRole('switch');
      expect(switches[0]).toHaveAttribute('aria-checked', 'true');
      expect(screen.getByText('Fuld løn under ferie:')).toBeVisible();
      expect(switches[1]).not.toBeDisabled();
    });
  }, ASYNC_TEST_TIMEOUT_MS);

  it('ryster toggle og markerer første fejlbehæftede felt ved ugyldigt enable-forsøg', async () => {
    const user = userEvent.setup();
    stateRef.values = {
      ...AARSLOEN_INITIAL_VALUES,
      loenperiode: 'dag',
      omregningTilFuldtAar: false,
      tableData: [{ id: 'row-1', col0_dag: '10-01-2024', col1_dag: '09-01-2024' }],
    };
    summaryRef.current = {
      rowIssues: [{ rowId: 'row-1', level: 'error' }],
      hasErrors: true,
      hasWarnings: false,
      firstErrorCell: { rowId: 'row-1', colKey: 'col0_dag', reason: 'input' },
    };

    render(<Aarsloen />);

    const omregningSwitch = await screen.findAllByRole('switch').then((switches) => switches[0]);
    expect(omregningSwitch).toHaveAttribute('aria-checked', 'false');

    await user.click(omregningSwitch);

    await waitFor(() => {
      expect(omregningSwitch).toHaveAttribute('data-shakes', '1');
      expect(tableHandleSpies.flashError).toHaveBeenCalledWith({
        kind: 'cell',
        issue: 'invalid',
        rowId: 'row-1',
        colKey: 'col0_dag',
      } satisfies Extract<TableError, { kind: 'cell' }>);
    });

    expect(tableHandleSpies.showMissingEntryError).not.toHaveBeenCalled();
    expect(omregningSwitch).toHaveAttribute('aria-checked', 'false');
  }, ASYNC_TEST_TIMEOUT_MS);

  it('renderer beregningsrækker som hover-rækker', async () => {
    render(<Aarsloen />);

    await waitFor(() => {
      expect(screen.getByText('Antal kalenderdage i den indtastede periode:').closest('.row--label-right-hover')).not.toBeNull();
      expect(screen.getByText('Sammentælling af løn fra tabellen:').closest('.row--label-right-hover')).not.toBeNull();
    });
  }, ASYNC_TEST_TIMEOUT_MS);
});
