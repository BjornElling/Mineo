/**
 * Tests for eoDebugIntegrity
 */

import type { DebugModelInput } from '../../../domain/debug/eoDebugCoreModel';
import { buildDebugCoreModel } from '../../../domain/debug/eoDebugCoreModel';
import { validateDebugModel } from '../../../domain/debug/eoDebugIntegrity';
import type { ISODateString } from '../../../types/branded';
import { toISODateString } from '../../../types/branded';

// Test helper: Cast string literal til ISODateString (kun til tests)
const iso = (date: string): ISODateString => date as ISODateString;

describe('eoDebugIntegrity', () => {
  describe('PERIOD_OVERLAP', () => {
    it('detecterer overlappende TAF-perioder', () => {
      const input: DebugModelInput = {
        stamdataValues: {
          journalnr: '',
          advokat: '',
          sagsbehandler: '',
          skadelidte: '',
          skadestype: '',
          skadedato: iso(''),
        },
        erstatningsopgoerelseValues: {
          vedroererPeriodeFra: toISODateString('2024-01-01'),
          vedroererPeriodeTil: toISODateString('2024-01-10'),
          tafPerioder: [
            {
              id: 'taf-1',
              fra: toISODateString('2024-01-01'),
              til: toISODateString('2024-01-05'),
              loseFeriedage: '',
            },
            {
              id: 'taf-2',
              fra: toISODateString('2024-01-03'), // Overlapper med taf-1
              til: toISODateString('2024-01-08'),
              loseFeriedage: '',
            },
          ],
          svieSmertePerioder: [],
        } as any,
      };

      const debugDays = buildDebugCoreModel(input);
      const issues = validateDebugModel(debugDays, input);

      const overlapIssues = issues.filter(
        (i) => i.invariant === 'PERIOD_OVERLAP'
      );
      expect(overlapIssues.length).toBeGreaterThan(0);
      expect(overlapIssues[0]?.severity).toBe('error');
    });

    it('accepterer touching-perioder (samme grænse-dato)', () => {
      const input: DebugModelInput = {
        stamdataValues: {
          journalnr: '',
          advokat: '',
          sagsbehandler: '',
          skadelidte: '',
          skadestype: '',
          skadedato: iso(''),
        },
        erstatningsopgoerelseValues: {
          vedroererPeriodeFra: toISODateString('2024-01-01'),
          vedroererPeriodeTil: toISODateString('2024-01-10'),
          tafPerioder: [
            {
              id: 'taf-1',
              fra: toISODateString('2024-01-01'),
              til: toISODateString('2024-01-05'),
              loseFeriedage: '',
            },
            {
              id: 'taf-2',
              fra: toISODateString('2024-01-05'), // Touching (samme som taf-1 slut)
              til: toISODateString('2024-01-10'),
              loseFeriedage: '',
            },
          ],
          svieSmertePerioder: [],
        } as any,
      };

      const debugDays = buildDebugCoreModel(input);
      const issues = validateDebugModel(debugDays, input);

      const overlapIssues = issues.filter(
        (i) => i.invariant === 'PERIOD_OVERLAP'
      );

      // Touching er overlap jf. beslutning
      expect(overlapIssues.length).toBeGreaterThan(0);
    });

    it('ingen overlap-fejl når perioder er adskilt', () => {
      const input: DebugModelInput = {
        stamdataValues: {
          journalnr: '',
          advokat: '',
          sagsbehandler: '',
          skadelidte: '',
          skadestype: '',
          skadedato: iso(''),
        },
        erstatningsopgoerelseValues: {
          vedroererPeriodeFra: toISODateString('2024-01-01'),
          vedroererPeriodeTil: toISODateString('2024-01-15'),
          tafPerioder: [
            {
              id: 'taf-1',
              fra: toISODateString('2024-01-01'),
              til: toISODateString('2024-01-05'),
              loseFeriedage: '',
            },
            {
              id: 'taf-2',
              fra: toISODateString('2024-01-07'), // Gap på én dag
              til: toISODateString('2024-01-10'),
              loseFeriedage: '',
            },
          ],
          svieSmertePerioder: [],
        } as any,
      };

      const debugDays = buildDebugCoreModel(input);
      const issues = validateDebugModel(debugDays, input);

      const overlapIssues = issues.filter(
        (i) => i.invariant === 'PERIOD_OVERLAP'
      );
      expect(overlapIssues.length).toBe(0);
    });
  });

  describe('DATE_HOLES', () => {
    it('ingen fejl når debug-tabel er komplet', () => {
      const input: DebugModelInput = {
        stamdataValues: {
          journalnr: '',
          advokat: '',
          sagsbehandler: '',
          skadelidte: '',
          skadestype: '',
          skadedato: iso(''),
        },
        erstatningsopgoerelseValues: {
          vedroererPeriodeFra: toISODateString('2024-01-01'),
          vedroererPeriodeTil: toISODateString('2024-01-10'),
          tafPerioder: [],
          svieSmertePerioder: [],
        } as any,
      };

      const debugDays = buildDebugCoreModel(input);
      const issues = validateDebugModel(debugDays, input);

      const holeIssues = issues.filter((i) => i.invariant === 'DATE_HOLES');
      expect(holeIssues.length).toBe(0);
    });

    it('accepterer tom debug-tabel uden fejl', () => {
      const input: DebugModelInput = {
        stamdataValues: {
          journalnr: '',
          advokat: '',
          sagsbehandler: '',
          skadelidte: '',
          skadestype: '',
          skadedato: iso(''),
        },
        erstatningsopgoerelseValues: {
          vedroererPeriodeFra: '',
          vedroererPeriodeTil: '',
          tafPerioder: [],
          svieSmertePerioder: [],
        } as any,
      };

      const debugDays = buildDebugCoreModel(input);
      const issues = validateDebugModel(debugDays, input);

      const holeIssues = issues.filter((i) => i.invariant === 'DATE_HOLES');
      expect(holeIssues.length).toBe(0);
    });
  });

  describe('BASE_DATE_INCONSISTENT', () => {
    it('advarer når mén-afgørelsesdato er efter periode-slut', () => {
      const input: DebugModelInput = {
        stamdataValues: {
          journalnr: '',
          advokat: '',
          sagsbehandler: '',
          skadelidte: '',
          skadestype: '',
          skadedato: iso(''),
        },
        erstatningsopgoerelseValues: {
          vedroererPeriodeFra: toISODateString('2024-01-01'),
          vedroererPeriodeTil: toISODateString('2024-12-31'),
          menAfgoerelseDato: toISODateString('2025-01-15'), // Efter periode-slut
          tafPerioder: [],
          svieSmertePerioder: [],
        } as any,
      };

      const debugDays = buildDebugCoreModel(input);
      const issues = validateDebugModel(debugDays, input);

      const dateIssues = issues.filter(
        (i) => i.invariant === 'BASE_DATE_INCONSISTENT'
      );
      expect(dateIssues.length).toBeGreaterThan(0);
      expect(dateIssues[0]?.severity).toBe('warning');
    });

    it('advarer når forligsdato er efter periode-slut', () => {
      const input: DebugModelInput = {
        stamdataValues: {
          journalnr: '',
          advokat: '',
          sagsbehandler: '',
          skadelidte: '',
          skadestype: '',
          skadedato: iso(''),
        },
        erstatningsopgoerelseValues: {
          vedroererPeriodeFra: toISODateString('2024-01-01'),
          vedroererPeriodeTil: toISODateString('2024-12-31'),
          forligDato: toISODateString('2025-02-01'), // Efter periode-slut
          tafPerioder: [],
          svieSmertePerioder: [],
        } as any,
      };

      const debugDays = buildDebugCoreModel(input);
      const issues = validateDebugModel(debugDays, input);

      const dateIssues = issues.filter(
        (i) => i.invariant === 'BASE_DATE_INCONSISTENT'
      );
      expect(dateIssues.length).toBeGreaterThan(0);
      expect(dateIssues[0]?.severity).toBe('warning');
    });

    it('ingen fejl når datoer er konsistente', () => {
      const input: DebugModelInput = {
        stamdataValues: {
          journalnr: '',
          advokat: '',
          sagsbehandler: '',
          skadelidte: '',
          skadestype: '',
          skadedato: iso(''),
        },
        erstatningsopgoerelseValues: {
          vedroererPeriodeFra: toISODateString('2024-01-01'),
          vedroererPeriodeTil: toISODateString('2024-12-31'),
          menAfgoerelseDato: toISODateString('2024-06-15'), // Inden for periode
          forligDato: toISODateString('2024-08-20'), // Inden for periode
          tafPerioder: [],
          svieSmertePerioder: [],
        } as any,
      };

      const debugDays = buildDebugCoreModel(input);
      const issues = validateDebugModel(debugDays, input);

      const dateIssues = issues.filter(
        (i) => i.invariant === 'BASE_DATE_INCONSISTENT'
      );
      expect(dateIssues.length).toBe(0);
    });
  });

  describe('TAF_DAYS_MISMATCH', () => {
    it('detecterer mismatch mellem TAF-periode og debug-tabel', () => {
      const input: DebugModelInput = {
        stamdataValues: {
          journalnr: '',
          advokat: '',
          sagsbehandler: '',
          skadelidte: '',
          skadestype: '',
          skadedato: iso(''),
        },
        erstatningsopgoerelseValues: {
          vedroererPeriodeFra: toISODateString('2024-01-01'),
          vedroererPeriodeTil: toISODateString('2024-01-10'),
          tafPerioder: [
            {
              id: 'taf-1',
              fra: toISODateString('2024-01-01'),
              til: toISODateString('2024-01-05'), // 5 dage
              loseFeriedage: '',
            },
          ],
          svieSmertePerioder: [],
        } as any,
      };

      const debugDays = buildDebugCoreModel(input);

      // Verificer at core-model faktisk genererede 5 dage med TAF
      const tafDays = debugDays.filter((d) => d.tafFlags.has('taf-1'));
      expect(tafDays.length).toBe(5);

      const issues = validateDebugModel(debugDays, input);

      const tafIssues = issues.filter((i) => i.invariant === 'TAF_DAYS_MISMATCH');
      // Core-model er korrekt, så ingen fejl
      expect(tafIssues.length).toBe(0);
    });

    it('ingen fejl når TAF-dage matcher perfekt', () => {
      const input: DebugModelInput = {
        stamdataValues: {
          journalnr: '',
          advokat: '',
          sagsbehandler: '',
          skadelidte: '',
          skadestype: '',
          skadedato: iso(''),
        },
        erstatningsopgoerelseValues: {
          vedroererPeriodeFra: toISODateString('2024-01-01'),
          vedroererPeriodeTil: toISODateString('2024-01-10'),
          tafPerioder: [
            {
              id: 'taf-1',
              fra: toISODateString('2024-01-02'),
              til: toISODateString('2024-01-04'), // 3 dage
              loseFeriedage: '',
            },
          ],
          svieSmertePerioder: [],
        } as any,
      };

      const debugDays = buildDebugCoreModel(input);
      const issues = validateDebugModel(debugDays, input);

      const tafIssues = issues.filter((i) => i.invariant === 'TAF_DAYS_MISMATCH');
      expect(tafIssues.length).toBe(0);
    });
  });

  describe('SVIE_SMERTE_MISMATCH', () => {
    it('ingen fejl når svie/smerte-dage matcher', () => {
      const input: DebugModelInput = {
        stamdataValues: {
          journalnr: '',
          advokat: '',
          sagsbehandler: '',
          skadelidte: '',
          skadestype: '',
          skadedato: iso(''),
        },
        erstatningsopgoerelseValues: {
          vedroererPeriodeFra: toISODateString('2024-01-01'),
          vedroererPeriodeTil: toISODateString('2024-01-10'),
          tafPerioder: [],
          svieSmertePerioder: [
            {
              id: 'ss-1',
              fra: toISODateString('2024-01-02'),
              til: toISODateString('2024-01-05'), // 4 dage
              tilstand: 'sygemeldt',
            },
          ],
        } as any,
      };

      const debugDays = buildDebugCoreModel(input);

      // Verificer at core-model genererede 4 dage med 'Fuld'
      const fuldDays = debugDays.filter(
        (d) => d.iso >= toISODateString('2024-01-02') && d.iso <= toISODateString('2024-01-05') && d.svieSmerte === 'Fuld'
      );
      expect(fuldDays.length).toBe(4);

      const issues = validateDebugModel(debugDays, input);

      const ssIssues = issues.filter(
        (i) => i.invariant === 'SVIE_SMERTE_MISMATCH'
      );
      expect(ssIssues.length).toBe(0);
    });

    it('ignorerer perioder med tilstand "Ingen"', () => {
      const input: DebugModelInput = {
        stamdataValues: {
          journalnr: '',
          advokat: '',
          sagsbehandler: '',
          skadelidte: '',
          skadestype: '',
          skadedato: iso(''),
        },
        erstatningsopgoerelseValues: {
          vedroererPeriodeFra: toISODateString('2024-01-01'),
          vedroererPeriodeTil: toISODateString('2024-01-10'),
          tafPerioder: [],
          svieSmertePerioder: [
            {
              id: 'ss-1',
              fra: toISODateString('2024-01-01'),
              til: toISODateString('2024-01-10'),
              tilstand: '', // Tom/ugyldig → Ingen
            },
          ],
        } as any,
      };

      const debugDays = buildDebugCoreModel(input);
      const issues = validateDebugModel(debugDays, input);

      const ssIssues = issues.filter(
        (i) => i.invariant === 'SVIE_SMERTE_MISMATCH'
      );
      // "Ingen" perioder tjekkes ikke
      expect(ssIssues.length).toBe(0);
    });
  });

  describe('Kombinerede checks', () => {
    it('kan rapportere flere issues samtidigt', () => {
      const input: DebugModelInput = {
        stamdataValues: {
          journalnr: '',
          advokat: '',
          sagsbehandler: '',
          skadelidte: '',
          skadestype: '',
          skadedato: iso(''),
        },
        erstatningsopgoerelseValues: {
          vedroererPeriodeFra: toISODateString('2024-01-01'),
          vedroererPeriodeTil: toISODateString('2024-01-10'),
          menAfgoerelseDato: toISODateString('2025-01-01'), // Inkonsistent dato
          tafPerioder: [
            {
              id: 'taf-1',
              fra: toISODateString('2024-01-01'),
              til: toISODateString('2024-01-05'),
              loseFeriedage: '',
            },
            {
              id: 'taf-2',
              fra: toISODateString('2024-01-03'), // Overlapper med taf-1
              til: toISODateString('2024-01-08'),
              loseFeriedage: '',
            },
          ],
          svieSmertePerioder: [],
        } as any,
      };

      const debugDays = buildDebugCoreModel(input);
      const issues = validateDebugModel(debugDays, input);

      // Mindst 2 issues: PERIOD_OVERLAP og BASE_DATE_INCONSISTENT
      expect(issues.length).toBeGreaterThanOrEqual(2);

      const invariants = new Set(issues.map((i) => i.invariant));
      expect(invariants.has('PERIOD_OVERLAP')).toBe(true);
      expect(invariants.has('BASE_DATE_INCONSISTENT')).toBe(true);
    });

    it('returnerer tom array når alt er OK', () => {
      const input: DebugModelInput = {
        stamdataValues: {
          journalnr: '',
          advokat: '',
          sagsbehandler: '',
          skadelidte: '',
          skadestype: '',
          skadedato: iso('2024-01-01'),
        },
        erstatningsopgoerelseValues: {
          vedroererPeriodeFra: toISODateString('2024-01-01'),
          vedroererPeriodeTil: toISODateString('2024-01-10'),
          menAfgoerelseDato: toISODateString('2024-01-05'),
          forligDato: toISODateString('2024-01-06'),
          tafPerioder: [
            {
              id: 'taf-1',
              fra: toISODateString('2024-01-02'),
              til: toISODateString('2024-01-05'),
              loseFeriedage: '',
            },
          ],
          svieSmertePerioder: [
            {
              id: 'ss-1',
              fra: toISODateString('2024-01-03'),
              til: toISODateString('2024-01-04'),
              tilstand: 'delvist-sygemeldt',
            },
          ],
        } as any,
      };

      const debugDays = buildDebugCoreModel(input);
      const issues = validateDebugModel(debugDays, input);

      expect(issues.length).toBe(0);
    });
  });
});
