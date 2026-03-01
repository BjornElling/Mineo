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
  });

  it('sætter tidl. kap.dato max til dagen før afgørelsesdato', async () => {
    const user = userEvent.setup();

    render(
      <EetAslAfgoerelserTable
        tableData={[
          buildRow({
            afgoerelsesDato: '10-01-2024',
            afgoerelseType: 'Endelig',
          }),
        ]}
        skadesdatoMin={toISODateString('2020-01-01')}
        beregningsdato={toISODateString('2025-12-31')}
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
      />
    );

    expect(
      screen.getByText(
        'EET % skal være større end summen af kapitaliseringsprocenter fra tidligere afgørelser'
      )
    ).toBeInTheDocument();
  });
});

