/// <reference types="vitest/globals" />

import { createErstatningsopgoerelseInitialValues } from '../../../domain/erstatningsopgoerelse/helpers/erstatningsopgoerelseInitialValues';
import { buildEoSvieSmerteRows } from '../../../domain/eoRowEvaluation/eoRowSvieSmerteRows';
import { collectAllEoRows } from '../../../domain/eoRowEvaluation/eoRowAggregator';
import { STAMDATA_INITIAL_VALUES } from '../../../domain/stamdata/stamdataInitialValues';
import { toISODateString } from '../../../types/branded';
import { EMPTY_FIELD_ISSUE_SET } from '../../../inputCore/inputIssue';

const iso = (value: string) => toISODateString(value);

const context = {
  skadedatoISO: iso('2023-01-01'),
  erErhvervssygdom: false,
  menAfgoerelseDatoForTabel: undefined,
  verserendeKlageMen: false,
} as const;

const noErrors = EMPTY_FIELD_ISSUE_SET;

// Parallelt til `taf.ingenTafIEoPerioden`: når der slet ikke er angivet svie/smerte-perioder i
// EO-perioden (og svie/smerte kræves), vises en særskilt advarsel, der undertrykker den sekundære
// "Ikke rejst svie/smerte-krav for hele perioden"-advarsel på `sviesmerte.ophoerSkyldes`.
describe('buildEoSvieSmerteRows – ingen svie/smerte-perioder i EO-perioden', () => {
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
      label: 'Periode',
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

describe('collectAllEoRows – suppression af sekundær svie/smerte-advarsel', () => {
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
      EMPTY_FIELD_ISSUE_SET,
      eoValues,
      EMPTY_FIELD_ISSUE_SET
    );

    const warningIds = warnings.map((row) => row.id);
    expect(warningIds).toContain('sviesmerte.ingenSvieSmerteIEoPerioden');
    // Den sekundære advarsel undertrykkes, så brugeren kun ser den ene, entydige advarsel.
    expect(warningIds).not.toContain('sviesmerte.ophoerSkyldes');
  });
});

// Parallelt til `taf.perioder.clampedAway`: perioder, der alle ligger uden for EO-perioden, giver 0 kr. og en gul linje,
// der siger det – og den sekundære «Ikke rejst …»-advarsel står ikke ved siden af (BB-374).
describe('collectAllEoRows – svie/smerte-perioder uden for EO-perioden (BB-374)', () => {
  const eoValues = (fra: string, til: string) => ({
    ...createErstatningsopgoerelseInitialValues(),
    kravPaaSvieSmerteGodtgoerelse: 'Ja' as const,
    kravPaaTabtArbejdsfortjeneste: 'Nej' as const,
    tidligereSsMax: 'Nej' as const,
    vedroererPeriodeFra: iso('2026-05-25'),
    vedroererPeriodeTil: iso('2026-09-20'),
    svieSmertePerioder: [{ id: 'ss-1', fra: iso(fra), til: iso(til), tilstand: 'sygemeldt' as const }],
  });
  const stamdata = { ...STAMDATA_INITIAL_VALUES, skadestype: 'Arbejdsulykke' as const, skadedato: iso('2025-07-11') };

  it('advarer, når alle perioder ligger før EO-perioden', () => {
    const { warnings } = collectAllEoRows(stamdata, EMPTY_FIELD_ISSUE_SET, eoValues('2025-07-11', '2026-03-31'), EMPTY_FIELD_ISSUE_SET);
    const advarsel = warnings.find((row) => row.id === 'sviesmerte.perioder.clampedAway');

    expect(advarsel?.summaryText).toBe(
      'Der er indtastet svie/smerte-perioder, men ingen af perioderne ligger inden for EO-perioden. Svie/smerte beregnes derfor til 0 kr.'
    );
    expect(warnings.map((row) => row.id)).not.toContain('sviesmerte.ophoerSkyldes');
  });

  it('tier, når en periode ligger i EO-perioden', () => {
    const { warnings } = collectAllEoRows(stamdata, EMPTY_FIELD_ISSUE_SET, eoValues('2026-06-01', '2026-06-30'), EMPTY_FIELD_ISSUE_SET);
    expect(warnings.map((row) => row.id)).not.toContain('sviesmerte.perioder.clampedAway');
  });
});
