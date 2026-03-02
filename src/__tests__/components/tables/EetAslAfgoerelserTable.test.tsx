import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import EetAslAfgoerelserTable from '../../../components/tables/EetAslAfgoerelserTable';
import { createEmptyAslAfgoerelseRow } from '../../../domain/erhvervsevnetab/eetAslAfgoerelser';
import type { AslAfgoerelseRow } from '../../../schemas/formSchemas';
import { toISODateString } from '../../../types/branded';

const buildRow = (patch: Partial<AslAfgoerelseRow>): AslAfgoerelseRow => ({
  ...createEmptyAslAfgoerelseRow(),
  ...patch,
});

describe('EetAslAfgoerelserTable', () => {
  it('persisterer rækkeændringer på blur', async () => {
    const user = userEvent.setup();
    const onTableDataChange = vi.fn();

    render(
      <EetAslAfgoerelserTable
        tableData={[createEmptyAslAfgoerelseRow()]}
        skadesdatoMin={toISODateString('2020-01-01')}
        beregningsdato={toISODateString('2025-12-31')}
        fodselsdato={toISODateString('1990-01-01')}
        onTableDataChange={onTableDataChange}
      />
    );

    const rows = screen.getAllByRole('row');
    const firstDataRow = rows[1];
    const firstCell = within(firstDataRow).getAllByRole('cell')[0];
    const input = within(firstCell).getByRole('textbox');

    await user.dblClick(input);
    await user.type(input, '01-02-2024');
    fireEvent.blur(input);

    await waitFor(() => {
      expect(onTableDataChange).toHaveBeenCalledTimes(1);
    });

    const lastCallArg = onTableDataChange.mock.calls[0]?.[0] as Array<Record<string, unknown>>;
    expect(Array.isArray(lastCallArg)).toBe(true);
    expect(lastCallArg).toHaveLength(1);
    expect(lastCallArg[0]?.afgoerelsesDato).toBe('01-02-2024');
  });

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
        skadesdatoMin={toISODateString('2020-01-01')}
        beregningsdato={toISODateString('2025-12-31')}
        fodselsdato={toISODateString('1990-01-01')}
      />
    );

    expect(screen.getByText('EET % skal være deleligt med 5')).toBeInTheDocument();
    expect(screen.getByText('Kapitaliseringsprocent må ikke udfyldes ved midlertidig eller ikke-valgt afgørelsestype')).toBeInTheDocument();
    expect(screen.getByText('Kapitaliseringsdato må ikke udfyldes ved midlertidig eller ikke-valgt afgørelsestype')).toBeInTheDocument();
    expect(screen.getByText('Tidligere kapitaliseringsdato må ikke udfyldes ved midlertidig eller ikke-valgt afgørelsestype')).toBeInTheDocument();
  });

  it('deduplikerer identiske opdateringer så onTableDataChange ikke trigges igen', async () => {
    const user = userEvent.setup();
    const onTableDataChange = vi.fn();

    render(
      <EetAslAfgoerelserTable
        tableData={[createEmptyAslAfgoerelseRow()]}
        skadesdatoMin={toISODateString('2020-01-01')}
        beregningsdato={toISODateString('2025-12-31')}
        fodselsdato={toISODateString('1990-01-01')}
        onTableDataChange={onTableDataChange}
      />
    );

    const rows = screen.getAllByRole('row');
    const firstDataRow = rows[1];
    const firstCell = within(firstDataRow).getAllByRole('cell')[0];
    const input = within(firstCell).getByRole('textbox');

    await user.dblClick(input);
    await user.type(input, '01-02-2024');
    fireEvent.blur(input);

    await waitFor(() => expect(onTableDataChange).toHaveBeenCalledTimes(1));

    await user.dblClick(input);
    await user.clear(input);
    await user.type(input, '01-02-2024');
    fireEvent.blur(input);

    await waitFor(() => expect(onTableDataChange).toHaveBeenCalledTimes(1));
  }, 15000);

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
        skadesdatoMin={toISODateString('2020-01-01')}
        beregningsdato={toISODateString('2025-12-31')}
        fodselsdato={toISODateString('1990-01-01')}
      />
    );

    const rows = screen.getAllByRole('row');
    const firstDataRow = rows[1];
    const tidlKapDatoCell = within(firstDataRow).getAllByRole('cell')[6];
    const tidlKapDatoInput = within(tidlKapDatoCell).getByRole('textbox');

    await user.dblClick(tidlKapDatoInput);
    await user.type(tidlKapDatoInput, '10-01-2024');
    fireEvent.blur(tidlKapDatoInput);

    await waitFor(() => {
      expect(
        screen.getAllByText(/Dato skal være mellem 01-01-2020 og 09-01-2024/).length
      ).toBeGreaterThan(0);
    });
  });

  it('medregner tidligere kapitaliseringsprocenter på tværs af rækker i EET-validering', () => {
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
            eetPct: '20',
            afgoerelseType: 'Endelig',
          }),
        ]}
        skadesdatoMin={toISODateString('2020-01-01')}
        beregningsdato={toISODateString('2025-12-31')}
        fodselsdato={toISODateString('1990-01-01')}
      />
    );

    expect(
      screen.getByText(
        'EET % skal være større end summen af kapitaliseringsprocenter fra tidligere afgørelser'
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
        skadesdatoMin={toISODateString('2020-01-01')}
        beregningsdato={toISODateString('2025-12-31')}
        fodselsdato={toISODateString('1990-01-01')}
      />
    );

    expect(screen.queryByText(/Ingen gyldige datoer/)).not.toBeInTheDocument();
  });

  it('viser ikke no-valid-range fejl for tidl. kap.dato når skadesdato er efter afgørelsesdato', () => {
    render(
      <EetAslAfgoerelserTable
        tableData={[
          buildRow({
            afgoerelseType: 'Endelig',
            afgoerelsesDato: '30-06-2023',
            kapDato: '30-06-2023',
          }),
        ]}
        skadesdatoMin={toISODateString('2024-08-01')}
        beregningsdato={toISODateString('2025-12-31')}
        fodselsdato={toISODateString('1990-01-01')}
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
        skadesdatoMin={toISODateString('2020-01-01')}
        beregningsdato={toISODateString('2025-12-31')}
        fodselsdato={toISODateString('1990-01-01')}
      />
    );

    expect(screen.getByText('Kun relevant ved tidligere kapitalisering')).toBeInTheDocument();
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
        skadesdatoMin={toISODateString('2020-01-01')}
        beregningsdato={toISODateString('2025-12-31')}
        fodselsdato={toISODateString('1990-01-01')}
      />
    );

    expect(
      screen.getByText('Fra 1. juli 2024 sker kapitalisering fra afgørelsesdagen ved genoptagelse')
    ).toBeInTheDocument();
  });

  it('viser fejl i kap. % ved endelig afgørelse under to år til folkepension når samlet kap % ikke matcher EET %', () => {
    render(
      <EetAslAfgoerelserTable
        tableData={[
          buildRow({
            id: 'r1',
            afgoerelseType: 'Delvist endelig',
            afgoerelsesDato: '01-01-2028',
            eetPct: '80',
            kapPct: '20',
          }),
          buildRow({
            id: 'r2',
            afgoerelseType: 'Endelig',
            afgoerelsesDato: '01-06-2029',
            eetPct: '80',
            kapPct: '40',
          }),
        ]}
        skadesdatoMin={toISODateString('2020-01-01')}
        beregningsdato={toISODateString('2030-12-31')}
        fodselsdato={toISODateString('1963-01-01')}
      />
    );

    expect(screen.getByText('Ved < 2 år til folkepension kapitaliseres hele EET')).toBeInTheDocument();
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
        skadesdatoMin={toISODateString('2020-01-01')}
        beregningsdato={toISODateString('2026-12-31')}
        fodselsdato={toISODateString('1990-01-01')}
      />
    );

    expect(screen.getAllByText('Der er angivet to identiske afgørelser').length).toBeGreaterThanOrEqual(3);
  });
});

