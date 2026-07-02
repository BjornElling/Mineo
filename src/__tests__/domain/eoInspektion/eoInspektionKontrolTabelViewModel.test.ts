/**
 * Tests for eoInspektionKontrolTabelViewModel
 */

import type { InspektionModelInput } from '../../../domain/eoInspektion/eoInspektionCoreModel';
import type { RowDay } from '../../../domain/eoRowEvaluation/eoRowTypes';
import { buildInspektionCoreModel } from '../../../domain/eoInspektion/eoInspektionCoreModel';
import { buildKontrolTabelViewModel } from '../../../domain/eoInspektion/eoInspektionKontrolTabelViewModel';
import type { ISODateString } from '../../../types/branded';
import { toISODateString } from '../../../types/branded';

// Test helper: Cast string literal til ISODateString (kun til tests)
const iso = (date: string): ISODateString => date as ISODateString;

describe('eoInspektionKontrolTabelViewModel', () => {
  describe('buildKontrolTabelViewModel - Basis funktionalitet', () => {
    it('returnerer tom model ved tom input', () => {
      const inspektionDays: RowDay[] = [];
      const viewModel = buildKontrolTabelViewModel(inspektionDays);

      expect(viewModel.rowCount).toBe(0);
      expect(viewModel.columns.length).toBeGreaterThan(0); // Basis-kolonner altid vist
    });

    it('genererer korrekt antal rækker', () => {
      const input: InspektionModelInput = {
        stamdataValues: {
          journalnr: '',
          advokat: '',
          sagsbehandler: '',
          skadelidte: '',
          skadestype: undefined,
          skadedato: iso(''),
        },
        erstatningsopgoerelseValues: {
          vedroererPeriodeFra: toISODateString('2024-01-01'),
          vedroererPeriodeTil: toISODateString('2024-01-05'), // 5 dage
          tafPerioder: [],
          svieSmertePerioder: [],
        } as any,
      };

      const inspektionDays = buildInspektionCoreModel(input);
      const viewModel = buildKontrolTabelViewModel(inspektionDays);

      expect(viewModel.rowCount).toBe(5);
    });

    it('getRowKey returnerer ISO-dato', () => {
      const input: InspektionModelInput = {
        stamdataValues: {
          journalnr: '',
          advokat: '',
          sagsbehandler: '',
          skadelidte: '',
          skadestype: undefined,
          skadedato: iso(''),
        },
        erstatningsopgoerelseValues: {
          vedroererPeriodeFra: toISODateString('2024-01-01'),
          vedroererPeriodeTil: toISODateString('2024-01-03'),
          tafPerioder: [],
          svieSmertePerioder: [],
        } as any,
      };

      const inspektionDays = buildInspektionCoreModel(input);
      const viewModel = buildKontrolTabelViewModel(inspektionDays);

      expect(viewModel.getRowKey(0)).toBe(toISODateString('2024-01-01'));
      expect(viewModel.getRowKey(1)).toBe(toISODateString('2024-01-02'));
      expect(viewModel.getRowKey(2)).toBe(toISODateString('2024-01-03'));
    });

    it('getRowIso returnerer ISO-dato', () => {
      const input: InspektionModelInput = {
        stamdataValues: {
          journalnr: '',
          advokat: '',
          sagsbehandler: '',
          skadelidte: '',
          skadestype: undefined,
          skadedato: iso(''),
        },
        erstatningsopgoerelseValues: {
          vedroererPeriodeFra: toISODateString('2024-01-01'),
          vedroererPeriodeTil: toISODateString('2024-01-02'),
          tafPerioder: [],
          svieSmertePerioder: [],
        } as any,
      };

      const inspektionDays = buildInspektionCoreModel(input);
      const viewModel = buildKontrolTabelViewModel(inspektionDays);

      expect(viewModel.getRowIso(0)).toBe(toISODateString('2024-01-01'));
      expect(viewModel.getRowIso(1)).toBe(toISODateString('2024-01-02'));
    });
  });

  describe('buildKontrolTabelViewModel - Kolonner', () => {
    it('inkluderer basis-kolonner', () => {
      const input: InspektionModelInput = {
        stamdataValues: {
          journalnr: '',
          advokat: '',
          sagsbehandler: '',
          skadelidte: '',
          skadestype: undefined,
          skadedato: iso(''),
        },
        erstatningsopgoerelseValues: {
          vedroererPeriodeFra: toISODateString('2024-01-01'),
          vedroererPeriodeTil: toISODateString('2024-01-01'),
          tafPerioder: [],
          svieSmertePerioder: [],
        } as any,
      };

      const inspektionDays = buildInspektionCoreModel(input);
      const viewModel = buildKontrolTabelViewModel(inspektionDays);

      const columnIds = viewModel.columns.map((c) => c.id);

      expect(columnIds).toContain('base:weekday');
      expect(columnIds).toContain('base:date');
      expect(columnIds).toContain('base:weekend');
      expect(columnIds).toContain('base:sh_day');
      expect(columnIds).toContain('base:arbejdsdag');
      expect(columnIds).toContain('base:ss_day');
    });

    it('tilføjer TAF-kolonner når TAF-perioder findes', () => {
      const input: InspektionModelInput = {
        stamdataValues: {
          journalnr: '',
          advokat: '',
          sagsbehandler: '',
          skadelidte: '',
          skadestype: undefined,
          skadedato: iso(''),
        },
        erstatningsopgoerelseValues: {
          vedroererPeriodeFra: toISODateString('2024-01-01'),
          vedroererPeriodeTil: toISODateString('2024-01-05'),
          tafPerioder: [
            {
              id: 'taf-1',
              fra: toISODateString('2024-01-02'),
              til: toISODateString('2024-01-04'),
              loseFeriedage: '',
            },
          ],
          svieSmertePerioder: [],
        } as any,
      };

      const inspektionDays = buildInspektionCoreModel(input);
      const viewModel = buildKontrolTabelViewModel(inspektionDays);

      const columnIds = viewModel.columns.map((c) => c.id);

      expect(columnIds).toContain('taf:taf-1');
    });

    it('tilføjer flere TAF-kolonner i sorteret rækkefølge', () => {
      const input: InspektionModelInput = {
        stamdataValues: {
          journalnr: '',
          advokat: '',
          sagsbehandler: '',
          skadelidte: '',
          skadestype: undefined,
          skadedato: iso(''),
        },
        erstatningsopgoerelseValues: {
          vedroererPeriodeFra: toISODateString('2024-01-01'),
          vedroererPeriodeTil: toISODateString('2024-01-10'),
          tafPerioder: [
            {
              id: 'taf-3',
              fra: toISODateString('2024-01-01'),
              til: toISODateString('2024-01-02'),
              loseFeriedage: '',
            },
            {
              id: 'taf-1',
              fra: toISODateString('2024-01-03'),
              til: toISODateString('2024-01-04'),
              loseFeriedage: '',
            },
            {
              id: 'taf-2',
              fra: toISODateString('2024-01-05'),
              til: toISODateString('2024-01-06'),
              loseFeriedage: '',
            },
          ],
          svieSmertePerioder: [],
        } as any,
      };

      const inspektionDays = buildInspektionCoreModel(input);
      const viewModel = buildKontrolTabelViewModel(inspektionDays);

      const tafColumns = viewModel.columns.filter((c) =>
        c.id.startsWith('taf:')
      );

      expect(tafColumns.map((c) => c.id)).toEqual([
        'taf:taf-1',
        'taf:taf-2',
        'taf:taf-3',
      ]);
    });

    it('kan skjule TAF-kolonner via options', () => {
      const input: InspektionModelInput = {
        stamdataValues: {
          journalnr: '',
          advokat: '',
          sagsbehandler: '',
          skadelidte: '',
          skadestype: undefined,
          skadedato: iso(''),
        },
        erstatningsopgoerelseValues: {
          vedroererPeriodeFra: toISODateString('2024-01-01'),
          vedroererPeriodeTil: toISODateString('2024-01-05'),
          tafPerioder: [
            {
              id: 'taf-1',
              fra: toISODateString('2024-01-02'),
              til: toISODateString('2024-01-04'),
              loseFeriedage: '',
            },
          ],
          svieSmertePerioder: [],
        } as any,
      };

      const inspektionDays = buildInspektionCoreModel(input);
      const viewModel = buildKontrolTabelViewModel(inspektionDays, {
        showTafColumns: false,
      });

      const columnIds = viewModel.columns.map((c) => c.id);

      expect(columnIds).not.toContain('taf:taf-1');
    });
  });

  describe('buildKontrolTabelViewModel - getCell', () => {
    it('returnerer weekday navn', () => {
      const input: InspektionModelInput = {
        stamdataValues: {
          journalnr: '',
          advokat: '',
          sagsbehandler: '',
          skadelidte: '',
          skadestype: undefined,
          skadedato: iso(''),
        },
        erstatningsopgoerelseValues: {
          vedroererPeriodeFra: toISODateString('2024-01-01'), // Mandag
          vedroererPeriodeTil: toISODateString('2024-01-02'), // Tirsdag
          tafPerioder: [],
          svieSmertePerioder: [],
        } as any,
      };

      const inspektionDays = buildInspektionCoreModel(input);
      const viewModel = buildKontrolTabelViewModel(inspektionDays);

      expect(viewModel.getCell(0, 'base:weekday')).toBe('Mandag');
      expect(viewModel.getCell(1, 'base:weekday')).toBe('Tirsdag');
    });

    it('returnerer dato med rawValue og displayValue', () => {
      const input: InspektionModelInput = {
        stamdataValues: {
          journalnr: '',
          advokat: '',
          sagsbehandler: '',
          skadelidte: '',
          skadestype: undefined,
          skadedato: iso(''),
        },
        erstatningsopgoerelseValues: {
          vedroererPeriodeFra: toISODateString('2024-01-01'),
          vedroererPeriodeTil: toISODateString('2024-01-01'),
          tafPerioder: [],
          svieSmertePerioder: [],
        } as any,
      };

      const inspektionDays = buildInspektionCoreModel(input);
      const viewModel = buildKontrolTabelViewModel(inspektionDays);

      const cell = viewModel.getCell(0, 'base:date');

      expect(typeof cell).toBe('object');
      if (typeof cell === 'object') {
        expect(cell.rawValue).toBe(toISODateString('2024-01-01'));
        expect(cell.displayValue).toBe('01-01-2024'); // Dansk format til visning
      }
    });

    it('returnerer weekend med rawValue og displayValue', () => {
      const input: InspektionModelInput = {
        stamdataValues: {
          journalnr: '',
          advokat: '',
          sagsbehandler: '',
          skadelidte: '',
          skadestype: undefined,
          skadedato: iso(''),
        },
        erstatningsopgoerelseValues: {
          vedroererPeriodeFra: toISODateString('2024-01-06'), // Lørdag
          vedroererPeriodeTil: toISODateString('2024-01-08'), // Mandag
          tafPerioder: [],
          svieSmertePerioder: [],
        } as any,
      };

      const inspektionDays = buildInspektionCoreModel(input);
      const viewModel = buildKontrolTabelViewModel(inspektionDays);

      const weekendCell = viewModel.getCell(0, 'base:weekend');
      const hverdagCell = viewModel.getCell(2, 'base:weekend');

      expect(typeof weekendCell).toBe('object');
      if (typeof weekendCell === 'object') {
        expect(weekendCell.rawValue).toBe(true);
        expect(weekendCell.displayValue).toBe('Ja');
      }

      expect(typeof hverdagCell).toBe('object');
      if (typeof hverdagCell === 'object') {
        expect(hverdagCell.rawValue).toBe(false);
        expect(hverdagCell.displayValue).toBe('-');
      }
    });

    it('returnerer søgnehelligdag korrekt', () => {
      const input: InspektionModelInput = {
        stamdataValues: {
          journalnr: '',
          advokat: '',
          sagsbehandler: '',
          skadelidte: '',
          skadestype: undefined,
          skadedato: iso(''),
        },
        erstatningsopgoerelseValues: {
          vedroererPeriodeFra: toISODateString('2024-01-01'), // Nytårsdag (mandag)
          vedroererPeriodeTil: toISODateString('2024-01-02'),
          tafPerioder: [],
          svieSmertePerioder: [],
        } as any,
      };

      const inspektionDays = buildInspektionCoreModel(input);
      const viewModel = buildKontrolTabelViewModel(inspektionDays);

      const shCell = viewModel.getCell(0, 'base:sh_day');

      expect(typeof shCell).toBe('object');
      if (typeof shCell === 'object') {
        expect(shCell.rawValue).toBe(true);
        expect(shCell.displayValue).toBe('Ja');
      }
    });

    it('returnerer arbejdsdag korrekt', () => {
      const input: InspektionModelInput = {
        stamdataValues: {
          journalnr: '',
          advokat: '',
          sagsbehandler: '',
          skadelidte: '',
          skadestype: undefined,
          skadedato: iso(''),
        },
        erstatningsopgoerelseValues: {
          vedroererPeriodeFra: toISODateString('2024-01-01'), // Nytårsdag (helligdag)
          vedroererPeriodeTil: toISODateString('2024-01-02'), // Tirsdag (arbejdsdag)
          tafPerioder: [],
          svieSmertePerioder: [],
        } as any,
      };

      const inspektionDays = buildInspektionCoreModel(input);
      const viewModel = buildKontrolTabelViewModel(inspektionDays);

      const helligdagCell = viewModel.getCell(0, 'base:arbejdsdag');
      const arbejdsdagCell = viewModel.getCell(1, 'base:arbejdsdag');

      expect(typeof helligdagCell).toBe('object');
      if (typeof helligdagCell === 'object') {
        expect(helligdagCell.rawValue).toBe(false);
      }

      expect(typeof arbejdsdagCell).toBe('object');
      if (typeof arbejdsdagCell === 'object') {
        expect(arbejdsdagCell.rawValue).toBe(true);
      }
    });

    it('returnerer svie/smerte niveau', () => {
      const input: InspektionModelInput = {
        stamdataValues: {
          journalnr: '',
          advokat: '',
          sagsbehandler: '',
          skadelidte: '',
          skadestype: undefined,
          skadedato: iso(''),
        },
        erstatningsopgoerelseValues: {
          vedroererPeriodeFra: toISODateString('2024-01-01'),
          vedroererPeriodeTil: toISODateString('2024-01-05'),
          tafPerioder: [],
          svieSmertePerioder: [
            {
              id: 'ss-1',
              fra: toISODateString('2024-01-02'),
              til: toISODateString('2024-01-03'),
              tilstand: 'sygemeldt',
            },
          ],
        } as any,
      };

      const inspektionDays = buildInspektionCoreModel(input);
      const viewModel = buildKontrolTabelViewModel(inspektionDays);

      const ingenCell = viewModel.getCell(0, 'base:ss_day');
      const fuldCell = viewModel.getCell(1, 'base:ss_day');

      expect(typeof ingenCell).toBe('object');
      if (typeof ingenCell === 'object') {
        expect(ingenCell.rawValue).toBe('Ingen');
        expect(ingenCell.displayValue).toBe('Ingen');
      }

      expect(typeof fuldCell).toBe('object');
      if (typeof fuldCell === 'object') {
        expect(fuldCell.rawValue).toBe('Fuld');
        expect(fuldCell.displayValue).toBe('Fuld');
      }
    });

    it('returnerer TAF-status for TAF-kolonner', () => {
      const input: InspektionModelInput = {
        stamdataValues: {
          journalnr: '',
          advokat: '',
          sagsbehandler: '',
          skadelidte: '',
          skadestype: undefined,
          skadedato: iso(''),
        },
        erstatningsopgoerelseValues: {
          vedroererPeriodeFra: toISODateString('2024-01-01'),
          vedroererPeriodeTil: toISODateString('2024-01-05'),
          tafPerioder: [
            {
              id: 'taf-1',
              fra: toISODateString('2024-01-02'),
              til: toISODateString('2024-01-04'),
              loseFeriedage: '',
            },
          ],
          svieSmertePerioder: [],
        } as any,
      };

      const inspektionDays = buildInspektionCoreModel(input);
      const viewModel = buildKontrolTabelViewModel(inspektionDays);

      const inactivCell = viewModel.getCell(0, 'taf:taf-1');
      const activCell = viewModel.getCell(1, 'taf:taf-1');

      expect(typeof inactivCell).toBe('object');
      if (typeof inactivCell === 'object') {
        expect(inactivCell.rawValue).toBe(false);
        expect(inactivCell.displayValue).toBe('-');
      }

      expect(typeof activCell).toBe('object');
      if (typeof activCell === 'object') {
        expect(activCell.rawValue).toBe(true);
        expect(activCell.displayValue).toBe('Ja');
      }
    });
  });

  describe('buildKontrolTabelViewModel - Options', () => {
    it('filtrerer weekends når includeWeekends=false', () => {
      const input: InspektionModelInput = {
        stamdataValues: {
          journalnr: '',
          advokat: '',
          sagsbehandler: '',
          skadelidte: '',
          skadestype: undefined,
          skadedato: iso(''),
        },
        erstatningsopgoerelseValues: {
          vedroererPeriodeFra: toISODateString('2024-01-05'), // Fredag
          vedroererPeriodeTil: toISODateString('2024-01-08'), // Mandag
          tafPerioder: [],
          svieSmertePerioder: [],
        } as any,
      };

      const inspektionDays = buildInspektionCoreModel(input);

      // Med weekends (default)
      const viewModelWithWeekends = buildKontrolTabelViewModel(inspektionDays);
      expect(viewModelWithWeekends.rowCount).toBe(4); // Fre, Lør, Søn, Man

      // Uden weekends
      const viewModelWithoutWeekends = buildKontrolTabelViewModel(inspektionDays, {
        includeWeekends: false,
      });
      expect(viewModelWithoutWeekends.rowCount).toBe(2); // Kun Fre, Man
    });
  });

  describe('buildKontrolTabelViewModel - Table width', () => {
    it('beregner tableWidthPx baseret på kolonner', () => {
      const input: InspektionModelInput = {
        stamdataValues: {
          journalnr: '',
          advokat: '',
          sagsbehandler: '',
          skadelidte: '',
          skadestype: undefined,
          skadedato: iso(''),
        },
        erstatningsopgoerelseValues: {
          vedroererPeriodeFra: toISODateString('2024-01-01'),
          vedroererPeriodeTil: toISODateString('2024-01-01'),
          tafPerioder: [],
          svieSmertePerioder: [],
        } as any,
      };

      const inspektionDays = buildInspektionCoreModel(input);
      const viewModel = buildKontrolTabelViewModel(inspektionDays);

      const expectedWidth = viewModel.columns.reduce(
        (sum, col) => sum + col.width,
        0
      );

      expect(viewModel.tableWidthPx).toBe(expectedWidth);
      expect(viewModel.tableWidthPx).toBeGreaterThan(0);
    });
  });
});
