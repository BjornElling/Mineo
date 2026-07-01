// @vitest-environment jsdom
import { render } from '@testing-library/react';
import type { LoenudviklingManuelRow } from '../../../schemas/formSchemas';
import LoenudviklingManuelTable from '../../../components/tables/LoenudviklingManuelTable';

const makeRow = (id: string, overrides: Partial<LoenudviklingManuelRow> = {}): LoenudviklingManuelRow => ({
  id,
  dato: undefined,
  grundloen: undefined,
  feriepenge: undefined,
  shSoSats: undefined,
  fritvalg: undefined,
  agPension: undefined,
  ...overrides,
});

const lockedInputCount = (container: HTMLElement): number =>
  container.querySelectorAll('[data-mineo-grid-locked="true"]').length;

/**
 * readOnlyBaseRowPercentFields er den ene knap, der adskiller Procent- og Beløb-tilstand i
 * manuel-tabellen:
 *  - Procent (true): basisrækkens dato OG de fire tillægsprocenter er låste (spejler felterne ovenfor).
 *  - Beløb (false): kun basisrækkens dato er låst; de fire tillægsprocenter låses op til indtastning.
 */
describe('LoenudviklingManuelTable — basisrække-låsning pr. tilstand', () => {
  const tableData = [makeRow('base-row'), makeRow('tail-row')];

  it('Procent-tilstand: basisrækkens dato + 4 tillægsprocenter er låst (5 låste celler)', () => {
    const { container } = render(
      <LoenudviklingManuelTable
        tableData={tableData}
        baseDateDisplay="01-01-2024"
        baseDateISO="2024-01-01"
        readOnlyBaseRowPercentFields={true}
      />
    );
    expect(lockedInputCount(container)).toBe(5);
  });

  it('Beløb-tilstand: kun basisrækkens dato er låst; tillægsprocenterne kan redigeres (1 låst celle)', () => {
    const { container } = render(
      <LoenudviklingManuelTable
        tableData={tableData}
        baseDateDisplay="01-01-2024"
        baseDateISO="2024-01-01"
        readOnlyBaseRowPercentFields={false}
      />
    );
    // Datocellen forbliver låst (beregningsperiodens slutdato), men de fire tillægsprocenter er nu
    // redigerbare felter — brugeren angiver start-tillæggene direkte i rækken.
    expect(lockedInputCount(container)).toBe(1);
  });
});
