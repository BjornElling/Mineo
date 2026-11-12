import type { AmountValue } from '../../../schemas/amountExpressionSchema';
import { FAELLES_AARSLOEN_INITIAL_VALUES } from '../../../domain/aslEalAarsloen/faellesAarsloenInitialValues';
import { ERHVERVSEVNETAB_INITIAL_VALUES } from '../../../domain/erhvervsevnetab/erhvervsevnetabInitialValues';
import { createErstatningsopgoerelseInitialValues } from '../../../domain/erstatningsopgoerelse/helpers/erstatningsopgoerelseInitialValues';
import {
  evaluateErhvervsevnetabDownloadGates,
  type ErhvervsevnetabDownloadGates,
} from '../../../domain/erhvervsevnetab/erhvervsevnetabDownloadGate';
import { buildErhvervsevnetabReaderProjection } from '../../../domain/erhvervsevnetab/erhvervsevnetabReaderProjection';
import { getProductionInputCatalog } from '../../../inputCore/catalog/productionCatalog';
import { createInputEvaluation } from '../../../inputCore/inputReader';
import {
  createEvaluationSourceToken,
  createInputRevision,
  createSettingsRevision,
} from '../../../inputCore/evaluationSource';
import { toISODateString } from '../../../types/branded';
import type {
  ErhvervsevnetabValues,
  FaellesAarsloenValues,
  StamdataValues,
} from '../../../schemas/formSchemas';

const iso = (value: string) => toISODateString(value);
const asAmount = (value: number): AmountValue => ({ kind: 'number', value });

const values: ErhvervsevnetabValues = {
  ...ERHVERVSEVNETAB_INITIAL_VALUES,
  beregningsdato: iso('2022-04-01'),
  koen: 'Kvinde',
  ealEetPct: 50,
  // Én endelig afgørelse uden kapitalisering gør ASL-fradraget synligt som løbende ydelse. Den
  // overordnede beregningsdato ligger inden for to år til folkepension, så rest-EET proformakapitaliseres
  // med særfaktoren nedsat til de tre resterende måneder (3/24).
  aslAfgoerelser: [{
    id: 'eet-independent-row',
    afgoerelsesDato: iso('2019-06-01'),
    virkningsDato: iso('2019-06-01'),
    eetPct: 60,
    kapDato: undefined,
    kapPct: undefined,
    afgoerelseType: 'Endelig',
    tidlKapDato: undefined,
    fsTilbageholdtEet: 'Nej',
  }],
  // Begge toggles slås fra, så oracle-scenariet kun indeholder de tre håndberegnede beløb nedenfor.
  endeligEetGoerMidlertidigEndeligMedTilbagevirkendeKraft: false,
  indregnMerErstatningVedForhoejetPensionsalder: false,
};

const faellesAarsloen: FaellesAarsloenValues = {
  ...FAELLES_AARSLOEN_INITIAL_VALUES,
  aslAarsloen: asAmount(401000),
  ealAarsloen: asAmount(900000),
};

const stamdata: StamdataValues = {
  journalnr: 'EET-oracle',
  advokat: '',
  sagsbehandler: '',
  skadelidte: 'Uafhængig facit',
  skadestype: 'Arbejdsulykke',
  skadedato: iso('2019-04-01'),
  skadelidteFodselsdato: iso('1955-07-01'),
};

const buildProjection = () => {
  const erstatningsopgoerelse = {
    ...createErstatningsopgoerelseInitialValues(),
    forligAnsvarsgradProcent: 50,
    forligAnsvarsgradBroek: '',
  };
  const catalog = getProductionInputCatalog();
  const input = catalog.validateSettledInput({
    sections: {
      stamdata,
      satser: null,
      aarsloen: null,
      faellesAarsloen: faellesAarsloen,
      renteberegning: null,
      varigemen: null,
      forsoergertab: null,
      erstatningsopgoerelse,
      erhvervsevnetab: values,
    },
    rejectedInputs: {},
  });
  const sourceToken = createEvaluationSourceToken(createInputRevision(1), createSettingsRevision(1));
  const evaluation = createInputEvaluation({ input, catalog, sourceToken });
  return buildErhvervsevnetabReaderProjection(evaluation.reader);
};

const expectAllowedGates = (gates: ErhvervsevnetabDownloadGates): void => {
  for (const gate of Object.values(gates)) {
    expect(gate.canDownload).toBe(true);
    expect(gate.reasons).toEqual([]);
  }
};

describe('uafhængig EET-totalfacit', () => {
  it('matcher håndberegnet EAL, ASL-fradrag, differencekrav og alle fire document gates', () => {
    const projection = buildProjection();
    const { snapshot } = projection;
    const eal = snapshot.efterEal.computation;
    const loebende = snapshot.loebendeYdelser.computation;
    const difference = snapshot.differencekrav.computation;

    expect(eal).not.toBeNull();
    expect(loebende).not.toBeNull();
    expect(difference).not.toBeNull();
    if (!eal || !loebende || !difference) {
      throw new Error('Forventede en komplet EET-projektion');
    }

    // EAL-facit, uafhængigt af produktionsberegneren:
    // 900.000 x (1,022 x 1,023 x 1,012), afrundet til 4 decimaler og derefter 500 kr. = 952.000.
    // 952.000 x 10 x 50 % = 4.760.000. Alder 63 giver 52 % reduktion = 2.475.200,
    // så det ureducerede EAL-krav er 2.284.800 kr. Forliget på 50 % giver 1.142.400 kr.
    expect(eal).toEqual(expect.objectContaining({
      aarsloenOre: 90000000,
      aarsloenSource: 'eal',
      reguleringsaar: [2020, 2021, 2022],
      reguleringsPctRounded4: 5.8052,
      reguleretAarsloenOre: 95200000,
      eetPct: 50,
      eetPctSource: 'eal',
      eetBeregnetOre: 476000000,
      eetAnvendtOre: 476000000,
      alderVedSkade: 63,
      aldersreduktionPct: 52,
      aldersreduktionBeloebOre: 247520000,
      ealKravOre: 228480000,
    }));
    expect(eal?.forlig).toEqual({
      label: '50 %',
      dato: null,
      ealKravEfterForligOre: 114240000,
    });

    // ASL-facit, uafhængigt af periodemotoren:
    // grundløn = round(401.000 x 367.000 / 539.000) = 273.037 kr.
    // årsydelse ved 60 % i 2019–2022 bliver henholdsvis 183.768, 187.776, 192.156 og 194.400 kr.
    // Differencekravet bruger dagen før beregningsdatoen og får derfor 535.730 kr. i fradrag. Fane 2
    // selv inkluderer beregningsdatoen i sin visning, hvorfor dens sidste dag giver 536.270 kr.
    expect(loebende).toEqual(expect.objectContaining({
      skadesaar: 2019,
      aslAarsloenAfrundet1000Ore: 40100000,
      maxAarsloenISkadesaarOre: 53900000,
      grundloenOre: 27303700,
      erstatningsniveauPct: 83,
      amBidragPct: 8,
    }));
    expect(loebende?.afgoerelser).toHaveLength(1);
    expect(loebende?.afgoerelser[0]).toEqual(expect.objectContaining({
      rowId: 'eet-independent-row',
      eetPct: 60,
      virkningsdato: iso('2019-06-01'),
      ophoerDato: iso('2022-04-01'),
      ophoerAarsag: 'beregningsdato',
      iAltBeregnetEetOre: 53627000,
    }));

    // Rest-EET-facit: grundydelse round2(273.037 x 60 % x 83 % x 92 %) = 125.094,63 kr.;
    // årsydelse 2022 round2(125.094,63 x 1,554) = 194.397,06 kr. Særfaktor 1,245 (Vejl. 9864/2021)
    // nedsat til 3/24: round3(0,155625) = 0,156. Kapitalbeløb ceil(194.397,06 x 0,156) = 30.326 kr.
    // Differencefacit: 2.284.800 - 535.730 - 30.326 = 1.718.744 kr.; forliget reducerer
    // først dette samlede beløb, ikke det rene EAL-krav, og giver 859.372 kr.
    expect(difference).toEqual(expect.objectContaining({
      ealKravOre: 228480000,
      ealEetPct: 50,
      fradragLoebendeYdelserOre: 53573000,
      fradragKapitaliseretEetOre: 0,
      differencekravFoerForligOre: 171874400,
      forligFactor: 0.5,
      forligLabel: '50 %',
      forligDato: null,
      differencekravOre: 85937200,
    }));
    expect(difference.ealComputation?.forlig).toBeNull();
    expect(difference.resterendeLoebendeYdelser).toBeNull();
    expect(difference.proformaKapitalisering).toEqual(expect.objectContaining({
      loebendeEetPct: 60,
      kapitaliseringsdato: iso('2022-04-01'),
      grundydelseOre: 12509463,
      aarsydelseOre: 19439706,
      kapitaliseretPgaUnderToAarTilFp: true,
      saerfaktor: 1.245,
      maanederTilFolkepension: 3,
      kapitaliseringsfaktor: 0.156,
      proformaBeloebOre: 3032600,
    }));
    expect(difference.merErstatningPensionsalder).toBeNull();

    expectAllowedGates(evaluateErhvervsevnetabDownloadGates(projection));
  });
});
