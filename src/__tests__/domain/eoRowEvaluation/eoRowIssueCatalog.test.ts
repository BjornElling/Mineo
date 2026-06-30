import { CELL_TABLE_IDS, buildCellInvalidDraftFieldPath } from '../../../config/cellInvalidDraftScopes';
import {
  resolveEoIssueFocusTarget,
  resolveEoIssueSummaryText,
} from '../../../domain/eoRowEvaluation/eoRowIssueCatalog';
import type { EoRowModel } from '../../../domain/eoRowEvaluation/eoRowTypes';

const makeErrorRow = (patch: Partial<EoRowModel>): EoRowModel => ({
  id: 'row.id',
  label: 'Felt',
  displayValue: 'Fejl (Indtastning mangler)',
  status: 'error',
  ...patch,
});

describe('eoRowIssueCatalog', () => {
  it('danner kort fallbacktekst med feltets label når rå besked mangler', () => {
    const row = makeErrorRow({
      id: 'stamdata.skadedato',
      label: 'Skadedato',
      displayValue: '-',
    });

    expect(resolveEoIssueSummaryText(row)).toBe('Skadedato mangler');
  });

  it('danner målrettet TAF-periodebesked for datointervalfejl', () => {
    const row = makeErrorRow({
      id: 'taf.periode.taf-1',
      label: 'Periode',
      displayValue: 'Fejl (Dato skal være mellem 01-01-2024 og 31-12-2024)',
    });

    expect(resolveEoIssueSummaryText(row)).toBe(
      'TAF-perioden skal være mellem 01-01-2024 og 31-12-2024'
    );
  });

  it('peger TAF-periodefejl på den konkrete tabelcelle', () => {
    const row = makeErrorRow({
      id: 'taf.periode.taf-1',
      displayValue: 'Fejl (Dato skal være mellem 01-01-2024 og 31-12-2024)',
    });

    expect(resolveEoIssueFocusTarget(row)).toEqual({
      kind: 'fieldPath',
      fieldPath: buildCellInvalidDraftFieldPath(CELL_TABLE_IDS.eoTafPeriode, '', 'taf-1:0'),
    });
  });

  it('peger svie/smerte-tilstandsfejl på tilstandscellen', () => {
    const row = makeErrorRow({
      id: 'sviesmerte.periode.ss-1',
      displayValue: 'Fejl (Tilstand mangler)',
    });

    expect(resolveEoIssueFocusTarget(row)).toEqual({
      kind: 'fieldPath',
      fieldPath: buildCellInvalidDraftFieldPath(CELL_TABLE_IDS.eoSvieSmerte, '', 'ss-1:3'),
    });
  });
});
