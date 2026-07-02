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

    expect(resolveEoIssueSummaryText(row)).toBe('Skadedato er ikke angivet');
  });

  it('sætter apostroffer om et flerords-label i den generiske fallbacktekst', () => {
    const row = makeErrorRow({
      id: 'ukatalogiseret.felt',
      label: 'Vedrører perioden',
      displayValue: '-',
    });

    expect(resolveEoIssueSummaryText(row)).toBe("'Vedrører perioden' er ikke angivet");
  });

  it('lader et enkeltords-label være uændret i den generiske fallbacktekst', () => {
    const row = makeErrorRow({
      id: 'ukatalogiseret.felt',
      label: 'Skadestype',
      displayValue: '-',
    });

    expect(resolveEoIssueSummaryText(row)).toBe('Skadestype er ikke angivet');
  });

  it('sætter apostroffer om et flerords-label når en fortsættelses-frase limes på', () => {
    const row = makeErrorRow({
      id: 'ukatalogiseret.felt',
      label: 'Angivet månedsløn',
      displayValue: 'Fejl (er ikke angivet for perioden)',
    });

    expect(resolveEoIssueSummaryText(row)).toBe("'Angivet månedsløn' er ikke angivet for perioden");
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
