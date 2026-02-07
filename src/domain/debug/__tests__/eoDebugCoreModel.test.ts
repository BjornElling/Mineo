/**
 * Tests for eoDebugCoreModel
 */

import type { DebugModelInput } from '../eoDebugCoreModel';
import { buildDebugCoreModel } from '../eoDebugCoreModel';
import type { ISODateString } from '../../../types/branded';

// Test helper: Cast string literal til ISODateString (kun til tests)
const iso = (date: string): ISODateString => date as ISODateString;

describe('eoDebugCoreModel', () => {
  describe('buildDebugCoreModel - Step 1: Tidslinje basis', () => {
    it('returnerer tom array ved tom input', () => {
      const input: DebugModelInput = {
        stamdataValues: {
          journalnr: '',
          advokat: '',
          sagsbehandler: '',
          skadelidte: '',
          skadestype: '',
          skadesdato: iso(''),
        },
        erstatningsopgoerelseValues: {
          vedroererPeriodeFra: '',
          vedroererPeriodeTil: '',
          tafPerioder: [],
          svieSmertePerioder: [],
        } as any,
      };

      const result = buildDebugCoreModel(input);
      expect(result).toEqual([]);
    });

    it('genererer enkelt dag når start === end', () => {
      const input: DebugModelInput = {
        stamdataValues: {
          journalnr: '',
          advokat: '',
          sagsbehandler: '',
          skadelidte: '',
          skadestype: '',
          skadesdato: iso('2024-01-01'),
        },
        erstatningsopgoerelseValues: {
          vedroererPeriodeFra: '2024-01-01',
          vedroererPeriodeTil: '2024-01-01',
          tafPerioder: [],
          svieSmertePerioder: [],
        } as any,
      };

      const result = buildDebugCoreModel(input);
      expect(result.length).toBe(1);
      expect(result[0]?.iso).toBe('2024-01-01');
    });

    it('genererer inklusiv–inklusiv interval', () => {
      const input: DebugModelInput = {
        stamdataValues: {
          journalnr: '',
          advokat: '',
          sagsbehandler: '',
          skadelidte: '',
          skadestype: '',
          skadesdato: iso(''),
        },
        erstatningsopgoerelseValues: {
          vedroererPeriodeFra: '2024-01-01',
          vedroererPeriodeTil: '2024-01-03',
          tafPerioder: [],
          svieSmertePerioder: [],
        } as any,
      };

      const result = buildDebugCoreModel(input);
      expect(result.length).toBe(3);
      expect(result.map((d) => d.iso)).toEqual([
        '2024-01-01',
        '2024-01-02',
        '2024-01-03',
      ]);
    });

    it('sætter weekday korrekt', () => {
      const input: DebugModelInput = {
        stamdataValues: {
          journalnr: '',
          advokat: '',
          sagsbehandler: '',
          skadelidte: '',
          skadestype: '',
          skadesdato: iso(''),
        },
        erstatningsopgoerelseValues: {
          vedroererPeriodeFra: '2024-01-01', // Mandag
          vedroererPeriodeTil: '2024-01-07', // Søndag
          tafPerioder: [],
          svieSmertePerioder: [],
        } as any,
      };

      const result = buildDebugCoreModel(input);

      // 2024-01-01 er mandag (weekday=1)
      expect(result[0]?.weekday).toBe(1);
      expect(result[0]?.isWeekend).toBe(false);

      // 2024-01-06 er lørdag (weekday=6)
      expect(result[5]?.weekday).toBe(6);
      expect(result[5]?.isWeekend).toBe(true);

      // 2024-01-07 er søndag (weekday=0)
      expect(result[6]?.weekday).toBe(0);
      expect(result[6]?.isWeekend).toBe(true);
    });
  });

  describe('buildDebugCoreModel - Step 2: Søgnehelligdage', () => {
    it('markerer Nytårsdag som søgnehelligdag', () => {
      const input: DebugModelInput = {
        stamdataValues: {
          journalnr: '',
          advokat: '',
          sagsbehandler: '',
          skadelidte: '',
          skadestype: '',
          skadesdato: iso(''),
        },
        erstatningsopgoerelseValues: {
          vedroererPeriodeFra: '2024-01-01',
          vedroererPeriodeTil: '2024-01-02',
          tafPerioder: [],
          svieSmertePerioder: [],
        } as any,
      };

      const result = buildDebugCoreModel(input);

      // 2024-01-01 er nytårsdag (mandag) → søgnehelligdag
      expect(result[0]?.isSognehelligdag).toBe(true);
      expect(result[0]?.isArbejdsdag).toBe(false);

      // 2024-01-02 er ikke helligdag
      expect(result[1]?.isSognehelligdag).toBe(false);
    });

    it('markerer juledag som søgnehelligdag når det er hverdag', () => {
      const input: DebugModelInput = {
        stamdataValues: {
          journalnr: '',
          advokat: '',
          sagsbehandler: '',
          skadelidte: '',
          skadestype: '',
          skadesdato: iso(''),
        },
        erstatningsopgoerelseValues: {
          vedroererPeriodeFra: '2024-12-24',
          vedroererPeriodeTil: '2024-12-26',
          tafPerioder: [],
          svieSmertePerioder: [],
        } as any,
      };

      const result = buildDebugCoreModel(input);

      // 2024-12-25 er juledag (onsdag) → søgnehelligdag
      const juledag = result.find((d) => d.iso === '2024-12-25');
      expect(juledag?.isSognehelligdag).toBe(true);
      expect(juledag?.isArbejdsdag).toBe(false);
    });

    it('markerer arbejdsdage korrekt (hverdag OG ikke søgnehelligdag)', () => {
      const input: DebugModelInput = {
        stamdataValues: {
          journalnr: '',
          advokat: '',
          sagsbehandler: '',
          skadelidte: '',
          skadestype: '',
          skadesdato: iso(''),
        },
        erstatningsopgoerelseValues: {
          vedroererPeriodeFra: '2024-01-01', // Nytårsdag (mandag, men helligdag)
          vedroererPeriodeTil: '2024-01-03', // Onsdag (normal arbejdsdag)
          tafPerioder: [],
          svieSmertePerioder: [],
        } as any,
      };

      const result = buildDebugCoreModel(input);

      // 2024-01-01 (mandag, men nytårsdag) → IKKE arbejdsdag
      expect(result[0]?.isArbejdsdag).toBe(false);

      // 2024-01-02 (tirsdag, normal dag) → arbejdsdag
      expect(result[1]?.isArbejdsdag).toBe(true);

      // 2024-01-03 (onsdag, normal dag) → arbejdsdag
      expect(result[2]?.isArbejdsdag).toBe(true);
    });
  });

  describe('buildDebugCoreModel - Step 3: TAF-perioder', () => {
    it('markerer TAF-periode korrekt', () => {
      const input: DebugModelInput = {
        stamdataValues: {
          journalnr: '',
          advokat: '',
          sagsbehandler: '',
          skadelidte: '',
          skadestype: '',
          skadesdato: iso(''),
        },
        erstatningsopgoerelseValues: {
          vedroererPeriodeFra: '2024-01-01',
          vedroererPeriodeTil: '2024-01-05',
          tafPerioder: [
            {
              id: 'taf-1',
              fra: '2024-01-02',
              til: '2024-01-04',
              loseFeriedage: '',
            },
          ],
          svieSmertePerioder: [],
        } as any,
      };

      const result = buildDebugCoreModel(input);

      // 2024-01-01 → ingen TAF
      expect(result[0]?.tafFlags.size).toBe(0);

      // 2024-01-02 → TAF aktiv
      expect(result[1]?.tafFlags.has('taf-1')).toBe(true);

      // 2024-01-03 → TAF aktiv
      expect(result[2]?.tafFlags.has('taf-1')).toBe(true);

      // 2024-01-04 → TAF aktiv
      expect(result[3]?.tafFlags.has('taf-1')).toBe(true);

      // 2024-01-05 → ingen TAF
      expect(result[4]?.tafFlags.size).toBe(0);
    });

    it('håndterer overlappende TAF-perioder', () => {
      const input: DebugModelInput = {
        stamdataValues: {
          journalnr: '',
          advokat: '',
          sagsbehandler: '',
          skadelidte: '',
          skadestype: '',
          skadesdato: iso(''),
        },
        erstatningsopgoerelseValues: {
          vedroererPeriodeFra: '2024-01-01',
          vedroererPeriodeTil: '2024-01-05',
          tafPerioder: [
            {
              id: 'taf-1',
              fra: '2024-01-01',
              til: '2024-01-03',
              loseFeriedage: '',
            },
            {
              id: 'taf-2',
              fra: '2024-01-03',
              til: '2024-01-05',
              loseFeriedage: '',
            },
          ],
          svieSmertePerioder: [],
        } as any,
      };

      const result = buildDebugCoreModel(input);

      // 2024-01-01 → kun taf-1
      expect(result[0]?.tafFlags.has('taf-1')).toBe(true);
      expect(result[0]?.tafFlags.has('taf-2')).toBe(false);

      // 2024-01-03 → begge (overlap/touching)
      expect(result[2]?.tafFlags.has('taf-1')).toBe(true);
      expect(result[2]?.tafFlags.has('taf-2')).toBe(true);

      // 2024-01-05 → kun taf-2
      expect(result[4]?.tafFlags.has('taf-1')).toBe(false);
      expect(result[4]?.tafFlags.has('taf-2')).toBe(true);
    });
  });

  describe('buildDebugCoreModel - Step 4: Svie/smerte', () => {
    it('markerer svie/smerte-periode korrekt', () => {
      const input: DebugModelInput = {
        stamdataValues: {
          journalnr: '',
          advokat: '',
          sagsbehandler: '',
          skadelidte: '',
          skadestype: '',
          skadesdato: iso(''),
        },
        erstatningsopgoerelseValues: {
          vedroererPeriodeFra: '2024-01-01',
          vedroererPeriodeTil: '2024-01-05',
          tafPerioder: [],
          svieSmertePerioder: [
            {
              id: 'ss-1',
              fra: '2024-01-02',
              til: '2024-01-04',
              tilstand: 'sygemeldt',
            },
          ],
        } as any,
      };

      const result = buildDebugCoreModel(input);

      // 2024-01-01 → Ingen
      expect(result[0]?.svieSmerte).toBe('Ingen');

      // 2024-01-02 → Fuld
      expect(result[1]?.svieSmerte).toBe('Fuld');

      // 2024-01-03 → Fuld
      expect(result[2]?.svieSmerte).toBe('Fuld');

      // 2024-01-04 → Fuld
      expect(result[3]?.svieSmerte).toBe('Fuld');

      // 2024-01-05 → Ingen
      expect(result[4]?.svieSmerte).toBe('Ingen');
    });

    it('mapper tilstand korrekt til niveau', () => {
      const input: DebugModelInput = {
        stamdataValues: {
          journalnr: '',
          advokat: '',
          sagsbehandler: '',
          skadelidte: '',
          skadestype: '',
          skadesdato: iso(''),
        },
        erstatningsopgoerelseValues: {
          vedroererPeriodeFra: '2024-01-01',
          vedroererPeriodeTil: '2024-01-06',
          tafPerioder: [],
          svieSmertePerioder: [
            {
              id: 'ss-1',
              fra: '2024-01-01',
              til: '2024-01-02',
              tilstand: 'sygemeldt',
            },
            {
              id: 'ss-2',
              fra: '2024-01-03',
              til: '2024-01-04',
              tilstand: 'delvist-sygemeldt',
            },
            {
              id: 'ss-3',
              fra: '2024-01-05',
              til: '2024-01-06',
              tilstand: '',
            },
          ],
        } as any,
      };

      const result = buildDebugCoreModel(input);

      // sygemeldt → Fuld
      expect(result[0]?.svieSmerte).toBe('Fuld');

      // delvist-sygemeldt → Delvis
      expect(result[2]?.svieSmerte).toBe('Delvis');

      // tom/ugyldig → Ingen
      expect(result[4]?.svieSmerte).toBe('Ingen');
    });

    it('højeste niveau vinder ved overlap', () => {
      const input: DebugModelInput = {
        stamdataValues: {
          journalnr: '',
          advokat: '',
          sagsbehandler: '',
          skadelidte: '',
          skadestype: '',
          skadesdato: iso(''),
        },
        erstatningsopgoerelseValues: {
          vedroererPeriodeFra: '2024-01-01',
          vedroererPeriodeTil: '2024-01-03',
          tafPerioder: [],
          svieSmertePerioder: [
            {
              id: 'ss-1',
              fra: '2024-01-01',
              til: '2024-01-02',
              tilstand: 'delvist-sygemeldt',
            },
            {
              id: 'ss-2',
              fra: '2024-01-02',
              til: '2024-01-03',
              tilstand: 'sygemeldt',
            },
          ],
        } as any,
      };

      const result = buildDebugCoreModel(input);

      // 2024-01-01 → kun Delvis
      expect(result[0]?.svieSmerte).toBe('Delvis');

      // 2024-01-02 → overlap, Fuld vinder
      expect(result[1]?.svieSmerte).toBe('Fuld');

      // 2024-01-03 → kun Fuld
      expect(result[2]?.svieSmerte).toBe('Fuld');
    });
  });

  describe('buildDebugCoreModel - Kantscenarier', () => {
    it('håndterer månedsskifte', () => {
      const input: DebugModelInput = {
        stamdataValues: {
          journalnr: '',
          advokat: '',
          sagsbehandler: '',
          skadelidte: '',
          skadestype: '',
          skadesdato: iso(''),
        },
        erstatningsopgoerelseValues: {
          vedroererPeriodeFra: '2024-01-30',
          vedroererPeriodeTil: '2024-02-02',
          tafPerioder: [],
          svieSmertePerioder: [],
        } as any,
      };

      const result = buildDebugCoreModel(input);

      expect(result.length).toBe(4);
      expect(result.map((d) => d.iso)).toEqual([
        '2024-01-30',
        '2024-01-31',
        '2024-02-01',
        '2024-02-02',
      ]);
    });

    it('håndterer skudår', () => {
      const input: DebugModelInput = {
        stamdataValues: {
          journalnr: '',
          advokat: '',
          sagsbehandler: '',
          skadelidte: '',
          skadestype: '',
          skadesdato: iso(''),
        },
        erstatningsopgoerelseValues: {
          vedroererPeriodeFra: '2024-02-28',
          vedroererPeriodeTil: '2024-03-01',
          tafPerioder: [],
          svieSmertePerioder: [],
        } as any,
      };

      const result = buildDebugCoreModel(input);

      expect(result.length).toBe(3);
      expect(result.map((d) => d.iso)).toEqual([
        '2024-02-28',
        '2024-02-29',
        '2024-03-01',
      ]);
    });

    it('afgrænser TAF-perioder til erstatningsperioden', () => {
      const input: DebugModelInput = {
        stamdataValues: {
          journalnr: '',
          advokat: '',
          sagsbehandler: '',
          skadelidte: '',
          skadestype: '',
          skadesdato: iso(''),
        },
        erstatningsopgoerelseValues: {
          vedroererPeriodeFra: '2024-01-05',
          vedroererPeriodeTil: '2024-01-10',
          tafPerioder: [
            {
              id: 'taf-1',
              fra: '2024-01-01', // Før EO-periode
              til: '2024-01-15', // Efter EO-periode
              loseFeriedage: '',
            },
          ],
          svieSmertePerioder: [],
        } as any,
      };

      const result = buildDebugCoreModel(input);

      // Tidslinjen skal kun dække erstatningsperioden
      expect(result.length).toBe(6);
      expect(result[0]?.iso).toBe('2024-01-05');
      expect(result[result.length - 1]?.iso).toBe('2024-01-10');
    });
  });
});
