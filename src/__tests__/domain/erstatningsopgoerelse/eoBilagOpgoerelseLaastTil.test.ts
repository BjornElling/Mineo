import {
  __testResolveBilagSelection,
  __testResolveMidlertidigtEetGroups,
} from '../../../domain/erstatningsopgoerelse/eoDocumentDefinitions';
import type { ErstatningsopgoerelseReaderProjection } from '../../../domain/erstatningsopgoerelse/erstatningsopgoerelseReaderProjection';
import { createErstatningsopgoerelseInitialValues } from '../../../domain/erstatningsopgoerelse/helpers/erstatningsopgoerelseInitialValues';
import { toISODateString } from '../../../types/branded';

// «Opgørelse» er ikke et bilagsvalg, men et fast element: fladen viser feltet låst til (`lockedOn` i
// EOberegningTab), og `generateErstatningsopgoerelseDocument` kaster, hvis elementet mangler. Låsningen
// skal derfor også gælde KILDEN – ellers ville en sag, der bærer `opgoerelse: false` (gemt før låsningen
// eller håndredigeret i en .eo-fil), blokere dokumentet på et felt, brugeren ikke kan rette.

const buildProjection = (
  eoBilagSelection?: Record<string, boolean>,
  eoValues: Partial<ErstatningsopgoerelseReaderProjection['eoValues']> = {},
): ErstatningsopgoerelseReaderProjection => ({
  eoValues: {
    ...createErstatningsopgoerelseInitialValues(),
    eoBilagSelection,
    ...eoValues,
  },
  stamdataValues: { skadedato: toISODateString('2024-07-01') },
  snapshot: { data: undefined },
} as unknown as ErstatningsopgoerelseReaderProjection);

describe('bilagsvalg: opgørelsen er låst til', () => {
  it('tvinger opgoerelse sandt, når sagen bærer et falsk valg', () => {
    // Testdataene sætter valget FALSK, så et grønt resultat ikke kan forklares af default-værdien
    // (som er sand) – kun låsningen selv kan give udfaldet.
    const selection = __testResolveBilagSelection(buildProjection({ opgoerelse: false }));

    expect(selection.opgoerelse).toBe(true);
  });

  it('lader de øvrige bilagsvalg beholde sagens egne fravalg', () => {
    // Skelnetest: låsningen må ramme PRÆCIS opgørelsen. Slår den bredt til, er den forkert.
    const selection = __testResolveBilagSelection(
      buildProjection({ opgoerelse: false, shDage: false, sygeferiegodtgoerelse: false })
    );

    expect(selection.opgoerelse).toBe(true);
    expect(selection.shDage).toBe(false);
    expect(selection.sygeferiegodtgoerelse).toBe(false);
  });

  it('bruger standardvalget og bevarer tilgængeligt midlertidigt EET-bilag', () => {
    const selection = __testResolveBilagSelection(buildProjection(undefined, {
      kravPaaTabtArbejdsfortjeneste: 'Ja',
      midlertidigtEetFraEetSiden: 'Ja',
    }));

    expect(selection).toMatchObject({
      opgoerelse: true,
      midlertidigEet: true,
      shDage: false,
    });
  });

  it('returnerer ingen EET-grupper, når togglen er aktiv uden snapshotdata', () => {
    const groups = __testResolveMidlertidigtEetGroups(buildProjection(undefined, {
      midlertidigtEetFraEetSiden: 'Ja',
    }));

    expect(groups).toEqual([]);
  });
});
