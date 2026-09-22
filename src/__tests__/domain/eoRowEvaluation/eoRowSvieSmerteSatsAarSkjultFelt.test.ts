/// <reference types="vitest/globals" />

import type { ErstatningsopgoerelseValues } from '../../../schemas/formSchemas';
import { createErstatningsopgoerelseInitialValues } from '../../../domain/erstatningsopgoerelse/helpers/erstatningsopgoerelseInitialValues';
import { buildEoSvieSmerteRows } from '../../../domain/eoRowEvaluation/eoRowSvieSmerteRows';
import { toISODateString } from '../../../types/branded';
import { EMPTY_FIELD_ISSUE_SET } from '../../../inputCore/inputIssue';

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
