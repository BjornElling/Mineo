import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import Aarsloen from '../../../components/pages/Aarsloen';
import { AARSLOEN_INITIAL_VALUES } from '../../../domain/aarsloen/aarsloenInitialValues';
import type { StandardLoenTableValidationSummary } from '../../../types/table';
import type { StandardLoenTableHandle } from '../../../types/handles';
import { toISODateString } from '../../../types/branded';
import type { AarsloenValues } from '../../../schemas/formSchemas/sections/aarsloenSchemas';

const {
  stateRef,
  summaryRef,
  beregningRef,
  handleAarsloenPdfDownloadSpy,
} = vi.hoisted(() => ({
  stateRef: {
    values: null as unknown as AarsloenValues,
  },
  summaryRef: {
    current: {
      rowIssues: [],
      hasErrors: false,
      hasWarnings: false,
    } as StandardLoenTableValidationSummary,
  },
  beregningRef: {
    // Default: præcis ét år (erEtAar = true), gyldig beregning.
    metode: 'C' as string,
    erEtAar: true as boolean,
  },
  handleAarsloenPdfDownloadSpy: vi.fn(),
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
    periodeData: { start: new Date(Date.UTC(2024, 0, 1)), end: new Date(Date.UTC(2024, 11, 31)) },
    shDageAntal: 0,
    beregnetAarsloen: 100000,
    beregningsData: {
      metode: beregningRef.metode,
      erEtAar: beregningRef.erEtAar,
    },
    fejlmeddelelser: [],
    beregningsFejl: null,
    harFatalBeregningsFejl: false,
  }),
}));

vi.mock('../../../hooks/useAarsloenDocumentGates', () => ({
  useAarsloenDocumentGates: () => ({
    canDownloadDocument: true,
    canDownloadSHDageDocument: false,
    handleAarsloenDocumentDownload: handleAarsloenPdfDownloadSpy,
    handleSHDageDocumentDownload: vi.fn(),
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
    React.useImperativeHandle(ref, () => ({ shake: () => {} }), []);

    return (
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        aria-label="toggle"
        disabled={disabled}
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
      showMissingEntryError: vi.fn(),
      flashError: vi.fn(),
      showNeedsPeriodHint: vi.fn(),
    }), []);

    React.useEffect(() => {
      onValidationChange?.(summaryRef.current);
    });

    return <div data-testid="standard-loen-table" />;
  }),
}));

describe('Aarsloen omregning download ved præcis ét år (erEtAar)', () => {
  const ASYNC_TEST_TIMEOUT_MS = 15_000;

  beforeEach(() => {
    stateRef.values = {
      ...AARSLOEN_INITIAL_VALUES,
      loenperiode: 'dag',
      omregningTilFuldtAar: true,
      tableData: [{ id: 'row-1', col0_dag: toISODateString('2024-01-01'), col1_dag: toISODateString('2024-12-31') }],
    };
    summaryRef.current = {
      rowIssues: [],
      hasErrors: false,
      hasWarnings: false,
    };
    beregningRef.metode = 'C';
    beregningRef.erEtAar = true;
    handleAarsloenPdfDownloadSpy.mockReset();
  });

  // Helper: find download-ikonet inde i "Sammentælling"-rækken (eller null hvis fraværende).
  const sammentaellingDownloadIcon = () => {
    const row = screen
      .getByText('Sammentælling af løn fra tabellen:')
      .closest('.row--label-right-hover');
    return row?.querySelector('[data-testid="DownloadIcon"]') ?? null;
  };

  it('viser download-knap ved sammentællingen når omregning er aktiv og perioden er præcis ét år', async () => {
    render(<Aarsloen />);

    await waitFor(() => {
      const switches = screen.getAllByRole('switch');
      expect(switches[0]).toHaveAttribute('aria-checked', 'true');
      expect(sammentaellingDownloadIcon()).not.toBeNull();
    });
  }, ASYNC_TEST_TIMEOUT_MS);

  it('download-knappen ved sammentællingen udløser PDF-download', async () => {
    const user = userEvent.setup();
    render(<Aarsloen />);

    let icon: Element | null = null;
    await waitFor(() => {
      icon = sammentaellingDownloadIcon();
      expect(icon).not.toBeNull();
    });

    await user.click(icon as unknown as Element);

    expect(handleAarsloenPdfDownloadSpy).toHaveBeenCalledTimes(1);
  }, ASYNC_TEST_TIMEOUT_MS);

  it('viser IKKE download ved sammentællingen når omregning er aktiv og perioden ikke er ét år (knappen hører til mellemregningen)', async () => {
    beregningRef.erEtAar = false;

    render(<Aarsloen />);

    await waitFor(() => {
      const switches = screen.getAllByRole('switch');
      expect(switches[0]).toHaveAttribute('aria-checked', 'true');
    });

    expect(sammentaellingDownloadIcon()).toBeNull();
  }, ASYNC_TEST_TIMEOUT_MS);
});
