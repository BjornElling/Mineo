/**
 * Differencekravets bilagsvalg, som det gælder for det FRISKE snapshot.
 *
 * To invarianter mellem fladen og generatoren (BB-188):
 *
 *  1. «Opgørelse» er ikke et valg, men forsiden. Fladen viser feltet låst til (`lockedOn`), og
 *     generatoren kaster, hvis det mangler. Låsningen skal derfor også gælde KILDEN – ellers ville en
 *     sag, der bærer `opgoerelse: false` (håndredigeret `.eo` eller en fil fra før feltet fandtes,
 *     hvis defaulten en dag ændres), blokere dokumentet på et felt, brugeren ikke kan rette.
 *  2. Et bilag, der ikke findes i den aktuelle beregning, slås fra i kilden. Uden det kunne et valg,
 *     brugeren traf i en sag med kapitaliseringer, gælde videre i en sag uden – og dokumentet ville
 *     udelade bilaget tavst, mens afkrydsningsfeltet stod markeret.
 */
import { __testResolveDifferencekravBilagSelection } from '../../../domain/erhvervsevnetab/eetDocumentDefinitions';
import type { EetDifferencekravComputation } from '../../../domain/erhvervsevnetab/eetDifferencekravCalculation';
import type { ErhvervsevnetabReaderProjection } from '../../../domain/erhvervsevnetab/erhvervsevnetabReaderProjection';
import { ERHVERVSEVNETAB_INITIAL_VALUES } from '../../../domain/erhvervsevnetab/erhvervsevnetabInitialValues';

const buildProjection = (
  bilagSelection: Record<string, boolean>
): ErhvervsevnetabReaderProjection => ({
  values: {
    ...ERHVERVSEVNETAB_INITIAL_VALUES,
    indregnMerErstatningVedForhoejetPensionsalder: true,
    eetDifferencekravBilagSelection: bilagSelection,
  },
} as unknown as ErhvervsevnetabReaderProjection);

const buildComputation = (overrides: Partial<EetDifferencekravComputation> = {}): EetDifferencekravComputation => ({
  loebendeComputation: { afgoerelser: [{ rowId: 'r1' }] },
  kapComputation: { afgoerelser: [{ rowId: 'r1' }] },
  proformaKapitalisering: null,
  resterendeLoebendeYdelser: null,
  merErstatningPensionsalder: null,
  ealComputation: {},
  ...overrides,
} as unknown as EetDifferencekravComputation);

describe('differencekravets bilagsvalg i dokumentkilden', () => {
  it('tvinger opgoerelse sandt, når sagen bærer et falsk valg', () => {
    // Testdataene sætter valget FALSK, så et grønt resultat ikke kan forklares af default-værdien
    // (som er sand) – kun låsningen selv kan give udfaldet.
    const selection = __testResolveDifferencekravBilagSelection(
      buildProjection({ ...ERHVERVSEVNETAB_INITIAL_VALUES.eetDifferencekravBilagSelection, opgoerelse: false }),
      buildComputation()
    );

    expect(selection.opgoerelse).toBe(true);
  });

  it('slår et valgt bilag fra, når beregningen ikke har noget indhold til det', () => {
    const selection = __testResolveDifferencekravBilagSelection(
      buildProjection({
        ...ERHVERVSEVNETAB_INITIAL_VALUES.eetDifferencekravBilagSelection,
        kapitalisering: true,
        loebendeYdelser: true,
      }),
      buildComputation({
        kapComputation: { afgoerelser: [] } as unknown as EetDifferencekravComputation['kapComputation'],
      })
    );

    expect(selection.kapitalisering).toBe(false);
    // Skelnetest: kun det tomme bilag slås fra.
    expect(selection.loebendeYdelser).toBe(true);
  });

  it('bevarer brugerens egne fravalg for bilag, der findes', () => {
    const selection = __testResolveDifferencekravBilagSelection(
      buildProjection({
        ...ERHVERVSEVNETAB_INITIAL_VALUES.eetDifferencekravBilagSelection,
        opgoerelse: false,
        loebendeYdelser: false,
        kapitalisering: true,
      }),
      buildComputation()
    );

    expect(selection.opgoerelse).toBe(true);
    expect(selection.loebendeYdelser).toBe(false);
    expect(selection.kapitalisering).toBe(true);
  });

  it('slår udvidet-spec-togglen fra, når løbende-ydelsesbilaget er fravalgt', () => {
    const selection = __testResolveDifferencekravBilagSelection(
      buildProjection({
        ...ERHVERVSEVNETAB_INITIAL_VALUES.eetDifferencekravBilagSelection,
        loebendeYdelser: false,
        visUdvidetSpecifikationLoebendeYdelserBilag: true,
      }),
      buildComputation()
    );

    expect(selection.visUdvidetSpecifikationLoebendeYdelserBilag).toBe(false);
  });
});
