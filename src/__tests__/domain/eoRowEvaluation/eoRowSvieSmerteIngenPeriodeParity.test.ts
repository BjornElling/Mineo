/// <reference types="vitest/globals" />

import { createErstatningsopgoerelseInitialValues } from '../../../domain/erstatningsopgoerelse/helpers/erstatningsopgoerelseInitialValues';
import { buildEoSvieSmerteRows } from '../../../domain/eoRowEvaluation/eoRowErstatningsopgoerelseModel';
import { collectAllEoRows } from '../../../domain/eoRowEvaluation/eoRowAggregator';
import { STAMDATA_INITIAL_VALUES } from '../../../domain/stamdata/stamdataInitialValues';
import { toISODateString } from '../../../types/branded';

const iso = (value: string) => toISODateString(value);

const context = {
  skadedatoISO: iso('2023-01-01'),
  erErhvervssygdom: false,
  menAfgoerelseDatoForTabel: undefined,
  verserendeKlageMen: false,
} as const;

const noErrors = {} as Parameters<typeof buildEoSvieSmerteRows>[1];

// Parallelt til `taf.ingenTafIEoPerioden`: når der slet ikke er angivet svie/smerte-perioder i
// EO-perioden (og svie/smerte kræves), vises en særskilt advarsel, der undertrykker den sekundære
// "Ikke rejst svie/smerte-krav for hele perioden"-advarsel på `sviesmerte.ophoerSkyldes`.
describe('buildEoSvieSmerteRows — ingen svie/smerte-perioder i EO-perioden', () => {
  it('emitterer den særskilte advarsel når ingen perioder er angivet', () => {
    const values = {
      ...createErstatningsopgoerelseInitialValues(),
      kravPaaSvieSmerteGodtgoerelse: 'Ja' as const,
      tidligereSsMax: 'Nej' as const,
      svieSmertePerioder: [],
    };

    const rows = buildEoSvieSmerteRows(values, noErrors, context);
    const advarsel = rows.find((row) => row.id === 'sviesmerte.ingenSvieSmerteIEoPerioden');

    expect(advarsel).toEqual({
      id: 'sviesmerte.ingenSvieSmerteIEoPerioden',
      label: 'Advarsel',
      displayValue: 'Advarsel (Der er ikke angivet nogen svie/smerte-periode i EO-perioden)',
      status: 'warning',
      summaryDisplay: 'messageOnly',
    });
  });

  it('emitterer ikke advarslen når tidligere beregnet til max (periode-tabellen skjult)', () => {
    const values = {
      ...createErstatningsopgoerelseInitialValues(),
      kravPaaSvieSmerteGodtgoerelse: 'Ja' as const,
      tidligereSsMax: 'Ja' as const,
      svieSmertePerioder: [],
    };

    const rows = buildEoSvieSmerteRows(values, noErrors, context);

    expect(rows.some((row) => row.id === 'sviesmerte.ingenSvieSmerteIEoPerioden')).toBe(false);
  });

  it('emitterer ikke advarslen når skadelidte er raskmeldt (egen ophørsårsag)', () => {
    const values = {
      ...createErstatningsopgoerelseInitialValues(),
      kravPaaSvieSmerteGodtgoerelse: 'Ja' as const,
      tidligereSsMax: 'Nej' as const,
      svieSmerteHelbredsstatus: 'Raskmeldt' as const,
      svieSmertePerioder: [],
    };

    const rows = buildEoSvieSmerteRows(values, noErrors, context);

    expect(rows.some((row) => row.id === 'sviesmerte.ingenSvieSmerteIEoPerioden')).toBe(false);
  });

  it('emitterer ikke advarslen når der findes mindst én udfyldt periode', () => {
    const values = {
      ...createErstatningsopgoerelseInitialValues(),
      kravPaaSvieSmerteGodtgoerelse: 'Ja' as const,
      tidligereSsMax: 'Nej' as const,
      svieSmertePerioder: [
        { id: 'a', fra: iso('2024-01-01'), til: iso('2024-01-31'), tilstand: 'sygemeldt' as const },
      ],
    };

    const rows = buildEoSvieSmerteRows(values, noErrors, context);

    expect(rows.some((row) => row.id === 'sviesmerte.ingenSvieSmerteIEoPerioden')).toBe(false);
  });
});

describe('collectAllEoRows — suppression af sekundær svie/smerte-advarsel', () => {
  it('undertrykker "Ikke rejst svie/smerte-krav for hele perioden" når den særskilte advarsel er aktiv', () => {
    const eoValues = {
      ...createErstatningsopgoerelseInitialValues(),
      kravPaaSvieSmerteGodtgoerelse: 'Ja' as const,
      kravPaaTabtArbejdsfortjeneste: 'Nej' as const,
      tidligereSsMax: 'Nej' as const,
      svieSmertePerioder: [],
    };

    const { warnings } = collectAllEoRows(
      STAMDATA_INITIAL_VALUES,
      {},
      eoValues,
      {}
    );

    const warningIds = warnings.map((row) => row.id);
    expect(warningIds).toContain('sviesmerte.ingenSvieSmerteIEoPerioden');
    // Den sekundære advarsel undertrykkes, så brugeren kun ser den ene, entydige advarsel.
    expect(warningIds).not.toContain('sviesmerte.ophoerSkyldes');
  });
});
