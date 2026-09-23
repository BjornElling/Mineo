/// <reference types="vitest/globals" />

import type { ErstatningsopgoerelseValues } from '../../../schemas/formSchemas';
import { createErstatningsopgoerelseInitialValues } from '../../../domain/erstatningsopgoerelse/helpers/erstatningsopgoerelseInitialValues';
import { buildEoSvieSmerteRows } from '../../../domain/eoRowEvaluation/eoRowSvieSmerteRows';
import { toISODateString } from '../../../types/branded';
import { EMPTY_FIELD_ISSUE_SET } from '../../../inputCore/inputIssue';
import { erSvieSmerteSatserHoejere } from '../../../domain/erstatningsopgoerelse/helpers/svieSmerteSatsAar';

const iso = (value: string) => toISODateString(value);

const context = {
  skadedatoISO: iso('2023-01-01'),
  erErhvervssygdom: false,
  menAfgoerelseDatoForTabel: undefined,
  verserendeKlageMen: false,
} as const;

const getSatserAarRow = (patch: Partial<ErstatningsopgoerelseValues> = {}) => {
  const values: ErstatningsopgoerelseValues = {
    ...createErstatningsopgoerelseInitialValues(),
    kravPaaSvieSmerteGodtgoerelse: 'Ja',
    tidligereSsMax: 'Nej',
    revideretOpgoerelse: 'Nej',
    // Satsåret ligger før det år, der gælder én måned efter opgørelsens dato, så forslaget udløses.
    opgørelseLavetDen: iso('2025-02-01'),
    svieSmerteSatserAar: 2024,
    vedroererPeriodeFra: iso('2024-01-01'),
    vedroererPeriodeTil: iso('2024-12-31'),
    svieSmertePerioder: [
      { id: 'ss-1', fra: iso('2024-02-01'), til: iso('2024-02-28'), tilstand: 'sygemeldt' },
    ],
    ...patch,
  };

  return buildEoSvieSmerteRows(values, EMPTY_FIELD_ISSUE_SET, context).find(
    (row) => row.id === 'sviesmerte.satserAar'
  );
};

/**
 * Et skjult felt er ikke udfyldt og må aldrig påvirke beregninger eller fejlmeddelelser.
 * Satsårsadvarslen overlevede sit eget felt, når «Tidligere beregnet S/S til max.» fjernede det –
 * en opfordring til at gøre noget, der ikke kan gøres, med et link uden mål (BB-222).
 */
describe('buildEoSvieSmerteRows – satsårsadvarslen følger feltets synlighed', () => {
  it('viser forslaget, mens satsårsfeltet er synligt', () => {
    const row = getSatserAarRow();

    expect(row?.status).toBe('warning');
    expect(row?.message).toBe('Svie/smerte-satsen for 2025 kan anvendes.');
  });

  it('tier, når «Tidligere beregnet S/S til max.» har fjernet satsårsfeltet', () => {
    const row = getSatserAarRow({ tidligereSsMax: 'Ja' });

    expect(row?.status).not.toBe('warning');
    expect(row?.message).toBeUndefined();
  });

  it('tier, når hele sektionen er fravalgt', () => {
    expect(getSatserAarRow({ kravPaaSvieSmerteGodtgoerelse: 'Nej' })?.status).not.toBe('warning');
    expect(getSatserAarRow({ kravPaaSvieSmerteGodtgoerelse: 'Skjul' })?.status).not.toBe('warning');
  });
});

/**
 * Satsåret er lovbestemt og uafhængigt af sygeperiodernes placering (udviklerafgørelse 2026-09-23,
 * `eo-snapshot-contract.md` §16): kravet anses for rejst én måned efter «Opgørelse lavet den», og den sats,
 * der gælder dér, kan kræves. Brugeren vælger året; programmet advarer alene, når en senere HØJERE sats
 * kunne være anvendt.
 */
describe('buildEoSvieSmerteRows – satsårsadvarslen følger den lovbestemte regel', () => {
  it('advarer ud fra opgørelsens dato, uanset hvornår sygeperioderne ligger', () => {
    const row = getSatserAarRow({
      svieSmerteSatserAar: 2019,
      vedroererPeriodeFra: iso('2019-01-01'),
      vedroererPeriodeTil: iso('2019-12-31'),
      svieSmertePerioder: [{ id: 'ss-1', fra: iso('2019-02-01'), til: iso('2019-02-28'), tilstand: 'sygemeldt' }],
    });

    expect(row?.status).toBe('warning');
    expect(row?.message).toBe('Svie/smerte-satsen for 2025 kan anvendes.');
  });

  it('tier, når det valgte år er det, der gælder én måned efter opgørelsen', () => {
    expect(getSatserAarRow({ svieSmerteSatserAar: 2025 })?.status).toBe('ok');
  });

  it('peger på det nyeste satsår med satser, når næste års satser endnu ikke findes', () => {
    // 15-12-2026 + én måned = 2027, hvor der endnu ikke er satser; 2026 er da det bedste år.
    const row = getSatserAarRow({ opgørelseLavetDen: iso('2026-12-15'), svieSmerteSatserAar: 2024 });

    expect(row?.status).toBe('warning');
    expect(row?.message).toBe('Svie/smerte-satsen for 2026 kan anvendes.');
  });
});

describe('erSvieSmerteSatserHoejere', () => {
  const rates = {
    prDag: { 2024: 230, 2025: 230, 2026: 240 },
    max: { 2024: 88500, 2025: 88500, 2026: 88500 },
  };

  it('er kun sand, når det senere år faktisk har en højere sats', () => {
    expect(erSvieSmerteSatserHoejere(2025, 2024, rates)).toBe(false);
    expect(erSvieSmerteSatserHoejere(2026, 2024, rates)).toBe(true);
    expect(erSvieSmerteSatserHoejere(2027, 2024, rates)).toBe(false);
  });
});
