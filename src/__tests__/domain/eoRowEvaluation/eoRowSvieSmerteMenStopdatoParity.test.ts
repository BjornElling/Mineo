/// <reference types="vitest/globals" />

import { createErstatningsopgoerelseInitialValues } from '../../../domain/erstatningsopgoerelse/helpers/erstatningsopgoerelseInitialValues';
import { buildEoSvieSmerteRows } from '../../../domain/eoRowEvaluation/eoRowSvieSmerteRows';
import { resolveSvieSmerteCutoffDate } from '../../../domain/erstatningsopgoerelse/validation/svieSmerteConstraints';
import { toISODateString } from '../../../types/branded';
import { EMPTY_FIELD_ISSUE_SET } from '../../../inputCore/inputIssue';

const iso = (value: string) => toISODateString(value);

// Rækkeevalueringen skal bruge motorens ménstopdato (`resolveSvieSmerteCutoffDate`), så reglen – afgørelse «Ja»
// og klage «Nej» – kun står ét sted. Før havde rækkerne deres egen formulering («ingen klage»).
describe('buildEoSvieSmerteRows – ménafgørelsens stopdato følger motoren', () => {
  const build = (verserendeKlageMen: 'Ja' | 'Nej') => {
    const values = {
      ...createErstatningsopgoerelseInitialValues(),
      kravPaaSvieSmerteGodtgoerelse: 'Ja' as const,
      tidligereSsMax: 'Nej' as const,
      vedroererPeriodeFra: iso('2024-01-01'),
      vedroererPeriodeTil: iso('2024-12-31'),
      varigeMenAfgorelse: 'Ja' as const,
      verserendeKlageMen,
      menAfgoerelseDato: iso('2024-03-01'),
      svieSmertePerioder: [
        { id: 'a', fra: iso('2024-01-01'), til: iso('2024-02-29'), tilstand: 'sygemeldt' as const },
      ],
    };
    const rows = buildEoSvieSmerteRows(values, EMPTY_FIELD_ISSUE_SET, {
      skadedatoISO: iso('2023-01-01'),
      erErhvervssygdom: false,
      menAfgoerelseDatoForTabel: undefined,
      verserendeKlageMen: verserendeKlageMen === 'Ja',
    });
    return { values, ophoer: rows.find((row) => row.id === 'sviesmerte.ophoerSkyldes')?.displayValue };
  };

  it.each(['Ja', 'Nej'] as const)('klage «%s»: «Ménafgørelse» som ophørsårsag præcis når motoren har en stopdato', (klage) => {
    const { values, ophoer } = build(klage);
    const motorensStopdato = resolveSvieSmerteCutoffDate(values);
    expect(motorensStopdato === undefined ? ophoer !== 'Ménafgørelse' : ophoer === 'Ménafgørelse').toBe(true);
    expect(motorensStopdato).toBe(klage === 'Nej' ? iso('2024-03-01') : undefined);
  });
});
