import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import EetAslAfgoerelserTable from '../../../components/tables/EetAslAfgoerelserTable';
import { createEmptyAslAfgoerelseRow } from '../../../domain/erhvervsevnetab/eetAslAfgoerelser';
import type { AslAfgoerelseRow } from '../../../schemas/formSchemas';
import { toISODateString } from '../../../types/branded';

const buildRow = (patch: Partial<AslAfgoerelseRow>): AslAfgoerelseRow => ({
  ...createEmptyAslAfgoerelseRow(),
  ...patch,
});

const openInputEditing = async (user: ReturnType<typeof userEvent.setup>, input: HTMLElement) => {
  await user.click(input);
  if (input.hasAttribute('readonly')) {
    await user.keyboard('1');
  }
  await waitFor(() => {
    expect(input).not.toHaveAttribute('readonly');
  });
};

describe('EetAslAfgoerelserTable', () => {
  const ASYNC_TEST_TIMEOUT_MS = 60_000;

  it('persisterer rækkeændringer på blur', async () => {
    const user = userEvent.setup();
    const onTableDataChange = vi.fn();

    render(
      <EetAslAfgoerelserTable
        tableData={[createEmptyAslAfgoerelseRow()]}
        skadedato={toISODateString('2020-01-01')}
        skadedatoMin={toISODateString('2020-01-01')}
        beregningsdato={toISODateString('2025-12-31')}
        skadelidteFodselsdato={toISODateString('1990-01-01')}
        onTableDataChange={onTableDataChange}
      />
    );

    const rows = screen.getAllByRole('row');
    const firstDataRow = rows[1];
    const firstCell = within(firstDataRow).getAllByRole('cell')[0];
    const input = within(firstCell).getByRole('textbox');

    await openInputEditing(user, input);
    await user.clear(input);
    await user.type(input, '01-02-2024');
    await user.tab();

    await waitFor(() => {
      expect(onTableDataChange).toHaveBeenCalledTimes(1);
    });

    const lastCallArg = onTableDataChange.mock.calls[0]?.[0] as Array<Record<string, unknown>>;
    expect(Array.isArray(lastCallArg)).toBe(true);
    expect(lastCallArg).toHaveLength(1);
    expect(lastCallArg[0]?.afgoerelsesDato).toBe('01-02-2024');
  }, ASYNC_TEST_TIMEOUT_MS);

  it('viser valideringsfeedback for procent- og datofelter', () => {
    render(
      <EetAslAfgoerelserTable
        tableData={[
          buildRow({
            afgoerelseType: 'Midlertidig',
            eetPct: '7',
            kapPct: '5',
            kapDato: '01-01-2024',
            tidlKapDato: '01-01-2024',
          }),
        ]}
        skadedato={toISODateString('2020-01-01')}
        skadedatoMin={toISODateString('2020-01-01')}
        beregningsdato={toISODateString('2025-12-31')}
        skadelidteFodselsdato={toISODateString('1990-01-01')}
      />
    );

    expect(screen.getByText('EET % skal være deleligt med 5.')).toBeInTheDocument();
    expect(screen.getByText('Kapitaliseringsprocent må ikke udfyldes ved midlertidig eller ikke-valgt afgørelsestype.')).toBeInTheDocument();
    expect(screen.getByText('Kapitaliseringsdato må kun udfyldes ved endelig eller delvist endelig afgørelsestype.')).toBeInTheDocument();
    expect(screen.getByText('Tidligere kapitaliseringsdato må ikke udfyldes ved midlertidig eller ikke-valgt afgørelsestype.')).toBeInTheDocument();
  });

  it('deduplikerer identiske opdateringer så onTableDataChange ikke trigges igen', async () => {
    const user = userEvent.setup();
    const onTableDataChange = vi.fn();

    render(
      <EetAslAfgoerelserTable
        tableData={[createEmptyAslAfgoerelseRow()]}
        skadedato={toISODateString('2020-01-01')}
        skadedatoMin={toISODateString('2020-01-01')}
        beregningsdato={toISODateString('2025-12-31')}
        skadelidteFodselsdato={toISODateString('1990-01-01')}
        onTableDataChange={onTableDataChange}
      />
    );

    const rows = screen.getAllByRole('row');
    const firstDataRow = rows[1];
    const firstCell = within(firstDataRow).getAllByRole('cell')[0];
    const input = within(firstCell).getByRole('textbox');

    await openInputEditing(user, input);
    await user.clear(input);
    await user.type(input, '01-02-2024');
    await user.tab();

    await waitFor(() => expect(onTableDataChange).toHaveBeenCalledTimes(1));

    await openInputEditing(user, input);
    await user.clear(input);
    await user.type(input, '01-02-2024');
    await user.tab();

    await waitFor(() => expect(onTableDataChange).toHaveBeenCalledTimes(1));
  }, ASYNC_TEST_TIMEOUT_MS);

  it('bevarer FS tilbageholdt EET når det vælges før øvrige afgørelsesfelter', async () => {
    const user = userEvent.setup();
    const onTableDataChange = vi.fn();

    render(
      <EetAslAfgoerelserTable
        tableData={[createEmptyAslAfgoerelseRow()]}
        skadedato={toISODateString('2020-01-01')}
        skadedatoMin={toISODateString('2020-01-01')}
        beregningsdato={toISODateString('2025-12-31')}
        skadelidteFodselsdato={toISODateString('1990-01-01')}
        onTableDataChange={onTableDataChange}
      />
    );

    const rows = screen.getAllByRole('row');
    const firstDataRow = rows[1];
    const fsCell = within(firstDataRow).getAllByRole('cell')[7];
    const fsDropdown = within(fsCell).getByRole('combobox');

    await user.click(fsDropdown);
    await user.click(await screen.findByRole('option', { name: 'Ja' }));

    await waitFor(() => {
      expect(within(fsCell).getByRole('combobox')).toHaveValue('Ja');
      expect(onTableDataChange).toHaveBeenCalledTimes(1);
    });

    const persistedRows = onTableDataChange.mock.calls[0]?.[0] as AslAfgoerelseRow[];
    expect(persistedRows).toHaveLength(1);
    expect(persistedRows[0]?.fsTilbageholdtEet).toBe('Ja');
  }, ASYNC_TEST_TIMEOUT_MS);

  it('sætter tidl. kap.dato max til dagen før afgørelsesdato', async () => {
    const user = userEvent.setup();

    render(
      <EetAslAfgoerelserTable
        tableData={[
          buildRow({
            afgoerelsesDato: '10-01-2024',
            afgoerelseType: 'Endelig',
            kapDato: '10-01-2024',
          }),
        ]}
        skadedato={toISODateString('2020-01-01')}
        skadedatoMin={toISODateString('2020-01-01')}
        beregningsdato={toISODateString('2025-12-31')}
        skadelidteFodselsdato={toISODateString('1990-01-01')}
      />
    );

    const rows = screen.getAllByRole('row');
    const firstDataRow = rows[1];
    const tidlKapDatoCell = within(firstDataRow).getAllByRole('cell')[6];
    const tidlKapDatoInput = within(tidlKapDatoCell).getByRole('textbox');

    await openInputEditing(user, tidlKapDatoInput);
    await user.clear(tidlKapDatoInput);
    await user.type(tidlKapDatoInput, '10-01-2024');
    await user.tab();

    await waitFor(() => {
      expect(
        screen.getAllByText(/Datoen for den tidligere afgørelse skal være før afgørelsesdatoen|Tidl. kap.dato skal være før afgørelsesdatoen/).length
      ).toBeGreaterThan(0);
    });
  }, ASYNC_TEST_TIMEOUT_MS);

  it('bevarer den indtastede kap.dato når den ligger før afgørelsesdato', async () => {
    const user = userEvent.setup();

    render(
      <EetAslAfgoerelserTable
        tableData={[
          buildRow({
            afgoerelseType: 'Endelig',
            afgoerelsesDato: '10-01-2024',
          }),
        ]}
        skadedato={toISODateString('2020-01-01')}
        skadedatoMin={toISODateString('2020-01-01')}
        beregningsdato={toISODateString('2025-12-31')}
        skadelidteFodselsdato={toISODateString('1990-01-01')}
      />
    );

    const rows = screen.getAllByRole('row');
    const firstDataRow = rows[1];
    const kapDatoCell = within(firstDataRow).getAllByRole('cell')[4];
    const kapDatoInput = within(kapDatoCell).getByRole('textbox');

    await openInputEditing(user, kapDatoInput);
    await user.clear(kapDatoInput);
    await user.type(kapDatoInput, '09-01-2024');
    await user.tab();

    await waitFor(() => {
      expect(kapDatoInput).toHaveValue('09-01-2024');
    });
  }, ASYNC_TEST_TIMEOUT_MS);

  it('viser fejl når EET % er lavere end akkumuleret tidligere kapitaliseret procent', () => {
    render(
      <EetAslAfgoerelserTable
        tableData={[
          buildRow({
            id: 'r1',
            afgoerelsesDato: '01-01-2024',
            kapPct: '20',
            afgoerelseType: 'Endelig',
          }),
          buildRow({
            id: 'r2',
            afgoerelsesDato: '01-02-2024',
            eetPct: '15',
            afgoerelseType: 'Endelig',
          }),
        ]}
        skadedato={toISODateString('2020-01-01')}
        skadedatoMin={toISODateString('2020-01-01')}
        beregningsdato={toISODateString('2025-12-31')}
        skadelidteFodselsdato={toISODateString('1990-01-01')}
      />
    );

    expect(
      screen.getByText(
        'EET % kan ikke være lavere end den akkumulerede kapitaliseringsprocent fra tidligere afgørelser.'
      )
    ).toBeInTheDocument();
  });

  it('viser ikke no-valid-range fejl for kap.dato når afgørelsesdato er efter max-dato', () => {
    render(
      <EetAslAfgoerelserTable
        tableData={[
          buildRow({
            afgoerelseType: 'Endelig',
            afgoerelsesDato: '30-06-2027',
          }),
        ]}
        skadedato={toISODateString('2020-01-01')}
        skadedatoMin={toISODateString('2020-01-01')}
        beregningsdato={toISODateString('2025-12-31')}
        skadelidteFodselsdato={toISODateString('1990-01-01')}
      />
    );

    expect(screen.queryByText(/Ingen gyldige datoer/)).not.toBeInTheDocument();
  });

  it('viser ikke no-valid-range fejl for tidl. kap.dato når skadedato er efter afgørelsesdato', () => {
    render(
      <EetAslAfgoerelserTable
        tableData={[
          buildRow({
            afgoerelseType: 'Endelig',
            afgoerelsesDato: '30-06-2023',
            kapDato: '30-06-2023',
          }),
        ]}
        skadedato={toISODateString('2024-08-01')}
        skadedatoMin={toISODateString('2024-08-01')}
        beregningsdato={toISODateString('2025-12-31')}
        skadelidteFodselsdato={toISODateString('1990-01-01')}
      />
    );

    expect(screen.queryByText(/Ingen gyldige datoer/)).not.toBeInTheDocument();
  });

  it('viser fejl når tidl. kap.dato er udfyldt uden kap.dato', () => {
    render(
      <EetAslAfgoerelserTable
        tableData={[
          buildRow({
            afgoerelseType: 'Endelig',
            afgoerelsesDato: '01-07-2024',
            tidlKapDato: '01-01-2024',
          }),
        ]}
        skadedato={toISODateString('2020-01-01')}
        skadedatoMin={toISODateString('2020-01-01')}
        beregningsdato={toISODateString('2025-12-31')}
        skadelidteFodselsdato={toISODateString('1990-01-01')}
      />
    );

    expect(screen.getByText('Kun relevant ved tidligere kapitalisering.')).toBeInTheDocument();
  });

  it('viser fejl når kap.dato ved genoptagelse fra 1. juli 2024 ikke matcher afgørelsesdato', () => {
    render(
      <EetAslAfgoerelserTable
        tableData={[
          buildRow({
            afgoerelseType: 'Endelig',
            afgoerelsesDato: '01-07-2024',
            kapDato: '02-07-2024',
            tidlKapDato: '01-01-2024',
          }),
        ]}
        skadedato={toISODateString('2020-01-01')}
        skadedatoMin={toISODateString('2020-01-01')}
        beregningsdato={toISODateString('2025-12-31')}
        skadelidteFodselsdato={toISODateString('1990-01-01')}
      />
    );

    expect(
      screen.getByText('Fra 1. juli 2024 sker kapitalisering fra afgørelsesdagen ved genoptagelse.')
    ).toBeInTheDocument();
  });

  it('viser fejl i kap. % ved endelig afgørelse under to år til folkepension når samlet kap % ikke matcher EET %', () => {
    render(
      <EetAslAfgoerelserTable
        tableData={[
          buildRow({
            id: 'r1',
            afgoerelseType: 'Delvist endelig',
            afgoerelsesDato: '01-01-2024',
            eetPct: '80',
            kapPct: '20',
          }),
          buildRow({
            id: 'r2',
            afgoerelseType: 'Endelig',
            afgoerelsesDato: '01-07-2025',
            eetPct: '80',
            kapPct: '40',
          }),
        ]}
        skadedato={toISODateString('2025-01-01')}
        skadedatoMin={toISODateString('2020-01-01')}
        beregningsdato={toISODateString('2025-12-31')}
        skadelidteFodselsdato={toISODateString('1959-01-01')}
      />
    );

    expect(screen.getByText('Ved ≤ 2 år til folkepension kapitaliseres hele EET.')).toBeInTheDocument();
  });

  it('genberegner kap.dato- og kap.%-fejl når fodselsdato ændres', async () => {
    const initialRows = [
      buildRow({
        id: 'r1',
        afgoerelseType: 'Endelig',
        afgoerelsesDato: '01-07-2025',
        virkningsDato: '01-07-2025',
        eetPct: '80',
        kapDato: '01-10-2025',
        kapPct: '40',
      }),
    ];

    const { rerender } = render(
      <EetAslAfgoerelserTable
        tableData={initialRows}
        skadedato={toISODateString('2025-01-01')}
        skadedatoMin={toISODateString('2020-01-01')}
        beregningsdato={toISODateString('2025-12-31')}
        skadelidteFodselsdato={toISODateString('1990-01-01')}
      />
    );

    expect(screen.queryByText('Ved ≤ 2 år til folkepension sker kapitalisering fra afgørelsesdagen.')).not.toBeInTheDocument();
    expect(screen.queryByText('Ved ≤ 2 år til folkepension kapitaliseres hele EET.')).not.toBeInTheDocument();

    rerender(
      <EetAslAfgoerelserTable
        tableData={initialRows}
        skadedato={toISODateString('2025-01-01')}
        skadedatoMin={toISODateString('2020-01-01')}
        beregningsdato={toISODateString('2025-12-31')}
        skadelidteFodselsdato={toISODateString('1959-01-01')}
      />
    );

    expect(screen.getByText('Ved ≤ 2 år til folkepension sker kapitalisering fra afgørelsesdagen.')).toBeInTheDocument();
    expect(screen.getByText('Ved ≤ 2 år til folkepension kapitaliseres hele EET.')).toBeInTheDocument();

    rerender(
      <EetAslAfgoerelserTable
        tableData={initialRows}
        skadedato={toISODateString('2025-01-01')}
        skadedatoMin={toISODateString('2020-01-01')}
        beregningsdato={toISODateString('2025-12-31')}
        skadelidteFodselsdato={toISODateString('1990-01-01')}
      />
    );

    expect(screen.queryByText('Ved ≤ 2 år til folkepension sker kapitalisering fra afgørelsesdagen.')).not.toBeInTheDocument();
    expect(screen.queryByText('Ved ≤ 2 år til folkepension kapitaliseres hele EET.')).not.toBeInTheDocument();
  });

  it('viser duplicate-fejl på nederste række når afgørelsesdato, virkningsdato og afgørelsestype er identiske', () => {
    render(
      <EetAslAfgoerelserTable
        tableData={[
          buildRow({
            id: 'r1',
            afgoerelsesDato: '01-11-2025',
            virkningsDato: '01-10-2025',
            afgoerelseType: 'Endelig',
          }),
          buildRow({
            id: 'r2',
            afgoerelsesDato: '01-11-2025',
            virkningsDato: '01-10-2025',
            afgoerelseType: 'Endelig',
          }),
        ]}
        skadedato={toISODateString('2020-01-01')}
        skadedatoMin={toISODateString('2020-01-01')}
        beregningsdato={toISODateString('2026-12-31')}
        skadelidteFodselsdato={toISODateString('1990-01-01')}
      />
    );

    expect(screen.getAllByText('Der er angivet to identiske afgørelser med samme afgørelsesdato og virkningsdato.').length).toBeGreaterThanOrEqual(2);
  });
});
