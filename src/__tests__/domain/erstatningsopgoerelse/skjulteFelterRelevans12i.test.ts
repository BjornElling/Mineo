// @vitest-environment jsdom
import { buildErstatningsopgoerelseReaderProjection } from '../../../domain/erstatningsopgoerelse/erstatningsopgoerelseReaderProjection';
import {
  createDefaultLoenindkomstAnsaettelsesforhold,
  createErstatningsopgoerelseInitialValues,
} from '../../../domain/erstatningsopgoerelse/helpers/erstatningsopgoerelseInitialValues';
import { resolveKildeReguleringsIntervalIso } from '../../../domain/erstatningsopgoerelse/helpers/reguleringKildeCoverage';
import { collectAllEoRows } from '../../../domain/eoRowEvaluation/eoRowAggregator';
import { selectEoSafetyNetInvariants } from '../../../domain/erstatningsopgoerelse/eoSafetyNetInvariants';
import { getProductionInputCatalog } from '../../../inputCore/catalog/productionCatalog';
import { createInputEvaluation } from '../../../inputCore/inputReader';
import {
  createEvaluationSourceToken,
  createInputRevision,
  createSettingsRevision,
} from '../../../inputCore/evaluationSource';
import { serializeFieldAddress, type FieldAddress } from '../../../inputCore/fieldAddress';
import {
  eoSfggAlleredeBetaltBeloebField,
  eoSfggManuelDagssatsField,
  eoSfggReferenceperiodeFraField,
  eoSfggReferenceperiodeFravaersdageUdenLoenField,
  eoSfggReferenceperiodeTilField,
  eoSfggSatsvalgField,
} from '../../../inputCore/catalog/erstatningsopgoerelseDescriptors';
import { eoStandardRowFields } from '../../../inputCore/catalog/erstatningsopgoerelseLoenDescriptors';
import { erSfggFeltRelevant, type SfggRelevansInput } from '../../../domain/erstatningsopgoerelse/helpers/eoLoenindkomstRelevance';
import { toISODateString, type ISODateString } from '../../../types/branded';
import type {
  ErstatningsopgoerelseValues,
  LoenindkomstAnsaettelsesforhold,
  StamdataValues,
  SygeferiegodtgoerelseAnsaettelsesforholdRow,
} from '../../../schemas/formSchemas';

// Brugerblik 12i: felter, der er skjult på Lønindkomst-fanen, er ikke udfyldt (BB-222/BB-228). Descriptorens
// `relevance` giver alle læsere tomværdien, ingen rød ring og ingen spærring – og værdien bevares og kommer
// tilbage, når feltet vises igen. Testene går gennem den rigtige reader og den rigtige projektion.

const catalog = getProductionInputCatalog();
const iso = (value: string): ISODateString => toISODateString(value);
const asAmount = (value: number) => ({ kind: 'number' as const, value });
const AF = 'af-1';

const stamdata: StamdataValues = {
  journalnr: 'J-1',
  advokat: 'Advokat A',
  sagsbehandler: 'Sagsbehandler S',
  skadelidte: 'Test Testesen',
  skadestype: 'Arbejdsulykke',
  skadedato: iso('2024-01-01'),
  skadelidteFodselsdato: iso('1980-01-01'),
};

const sfggRow = (patch: Partial<SygeferiegodtgoerelseAnsaettelsesforholdRow>): SygeferiegodtgoerelseAnsaettelsesforholdRow => ({
  ansaettelsesforholdId: AF,
  sfggBeregningskilde: 'Ferieloven',
  sfggReferenceperiodeFra: iso('2023-12-01'),
  sfggReferenceperiodeTil: iso('2023-12-31'),
  sfggReferenceperiodeFravaersdageUdenLoen: 0,
  sfggManuelDagssats: undefined,
  sfggManuelBeloebIHenholdTil: undefined,
  sfggManuelFoerstEfterSygeloen: 'Nej',
  sfggSatsvalg: undefined,
  sfggAlleredeBetaltBeloeb: undefined,
  ...patch,
});

const employment = (patch: Partial<LoenindkomstAnsaettelsesforhold> = {}): LoenindkomstAnsaettelsesforhold => ({
  ...createDefaultLoenindkomstAnsaettelsesforhold(),
  id: AF,
  navnPaaArbejdssted: 'Arbejdssted 1',
  ansatPaaSkadestidspunktet: true,
  harOverenskomst: false,
  feriePct: 12.5,
  pensionPct: 0,
  indtaegtsoplysningerTableData: [{
    id: 'loen-dec-2023',
    col0_maaned: '12',
    col1_maaned: '2023',
    col0_uge: '',
    col1_uge: '',
    col0_dag: undefined,
    col1_dag: undefined,
    col2: asAmount(30000),
    col3: undefined,
    col4: undefined,
    col5: undefined,
    fpFvShSoBeloeb: undefined,
    pensionBeloeb: undefined,
  }],
  ...patch,
});

const sag = (patch: Partial<ErstatningsopgoerelseValues> = {}): ErstatningsopgoerelseValues => {
  const initial = createErstatningsopgoerelseInitialValues();
  return {
    ...initial,
    eoNummer: '1',
    kravPaaSvieSmerteGodtgoerelse: 'Nej',
    kravPaaTabtArbejdsfortjeneste: 'Ja',
    tafArbejdsstatus: 'Uarbejdsdygtig',
    vedroererPeriodeFra: iso('2024-01-01'),
    vedroererPeriodeTil: iso('2024-01-31'),
    opgørelseLavetDen: iso('2024-02-15'),
    beregnesUdFra: 'Angivet månedsløn',
    maanedsloenenUdgoer: asAmount(30000),
    eoAngivetLoenLoenudvikling: { ...initial.eoAngivetLoenLoenudvikling, loenudviklingBeregningsgrundlag: 'Ingen' },
    tafPerioder: [{ id: 'taf-1', fra: iso('2024-01-15'), til: iso('2024-01-31'), loseFeriedage: undefined }],
    loenindkomstAnsaettelsesforhold: [employment()],
    sfggAnsaettelsesforhold: [sfggRow({})],
    ...patch,
  };
};

const project = (eo: ErstatningsopgoerelseValues) => {
  const input = catalog.validateSettledInput({
    sections: {
      stamdata, satser: null, aarsloen: null, faellesAarsloen: null, renteberegning: null,
      varigemen: null, forsoergertab: null, erstatningsopgoerelse: eo, erhvervsevnetab: null,
    },
    rejectedInputs: {},
  });
  const sourceToken = createEvaluationSourceToken(createInputRevision(1), createSettingsRevision(1));
  const evaluation = createInputEvaluation({ input, catalog, sourceToken });
  const projection = buildErstatningsopgoerelseReaderProjection(evaluation.reader, { revision: 'r' });
  const rows = collectAllEoRows(
    projection.stamdataValues,
    projection.stamdataErrors,
    projection.eoValues,
    projection.eoErrors,
    {},
    undefined,
    projection.snapshot.data?.canonicalOutput,
    projection.snapshot.data?.pdfModel,
  );
  const issueAt = (field: { address: FieldAddress }) => evaluation.issues.get(serializeFieldAddress(field.address));
  return { projection, rows, issueAt };
};

const failedMessages = (result: ReturnType<typeof project>): readonly string[] =>
  result.projection.snapshot.invariants
    .filter((invariant) => !invariant.passed && invariant.severity === 'error')
    .map((invariant) => invariant.message)
    .sort();

/**
 * Linjerne i «Fejl og advarsler», som boksen sammensætter dem: rækkeevalueringens fejl plus sikkerhedsnettets
 * validatorregler, der ikke allerede er dækket af en række. Her ville en dublet stå.
 */
const fejlOgAdvarsler = (result: ReturnType<typeof project>): readonly string[] => {
  const displayedRows = result.rows.errors;
  const net = selectEoSafetyNetInvariants({
    authoritativeBlockingInvariants: result.projection.snapshot.invariants
      .filter((invariant) => !invariant.passed && invariant.blocksAuthoritativeComputation),
    displayedRows,
    hasOtherErrorContent: displayedRows.length > 0,
  });
  return [
    ...displayedRows.map((row) => row.summaryText ?? row.message ?? row.label),
    ...net.map((invariant) => invariant.message),
  ];
};

/** Linjer i boksen, der indeholder `tekst` (rækketekster kan bære feltnavnet foran beskeden). */
const linjerMed = (result: ReturnType<typeof project>, tekst: string): readonly string[] =>
  fejlOgAdvarsler(result).filter((line) => line.includes(tekst));

const sfggProjected = (result: ReturnType<typeof project>) => result.projection.eoValues.sfggAnsaettelsesforhold[0];

describe('skjulte felter på Lønindkomst-fanen (brugerblik 12i)', () => {
  describe('sygeferiegodtgørelsens felter', () => {
    it('skjuler referenceperioden bag «Manuelt angivet»: ingen rød ring, ingen spærring, tom for læserne', () => {
      // En omvendt referenceperiode og 400 fraværsdage er røde, når felterne vises.
      const skjult = sfggRow({
        sfggBeregningskilde: 'Manuelt angivet',
        sfggManuelDagssats: asAmount(500),
        sfggReferenceperiodeFra: iso('2023-12-31'),
        sfggReferenceperiodeTil: iso('2023-12-01'),
        sfggReferenceperiodeFravaersdageUdenLoen: 400,
      });
      const uden = sfggRow({
        sfggBeregningskilde: 'Manuelt angivet',
        sfggManuelDagssats: asAmount(500),
        sfggReferenceperiodeFra: undefined,
        sfggReferenceperiodeTil: undefined,
        sfggReferenceperiodeFravaersdageUdenLoen: undefined,
      });

      const med = project(sag({ sfggAnsaettelsesforhold: [skjult] }));
      const reference = project(sag({ sfggAnsaettelsesforhold: [uden] }));

      expect(med.issueAt(eoSfggReferenceperiodeFraField.bind(AF))).toBeUndefined();
      expect(med.issueAt(eoSfggReferenceperiodeTilField.bind(AF))).toBeUndefined();
      expect(med.issueAt(eoSfggReferenceperiodeFravaersdageUdenLoenField.bind(AF))).toBeUndefined();
      expect(sfggProjected(med)).toMatchObject({
        sfggReferenceperiodeFra: undefined,
        sfggReferenceperiodeTil: undefined,
        sfggReferenceperiodeFravaersdageUdenLoen: undefined,
        sfggManuelDagssats: asAmount(500),
      });
      expect(failedMessages(med)).toEqual(failedMessages(reference));
      expect(med.rows.errors.map((row) => row.message)).toEqual(reference.rows.errors.map((row) => row.message));
      expect(med.projection.snapshot.data?.pdfModel.samlet).toEqual(reference.projection.snapshot.data?.pdfModel.samlet);
    });

    it('bevarer de skjulte værdier, så de vender tilbage med «Ferieloven» – og røde igen, når de er det', () => {
      const tilbage = project(sag({
        sfggAnsaettelsesforhold: [sfggRow({ sfggManuelDagssats: asAmount(500), sfggReferenceperiodeFravaersdageUdenLoen: 3 })],
      }));
      expect(sfggProjected(tilbage)).toMatchObject({
        sfggReferenceperiodeFra: iso('2023-12-01'),
        sfggReferenceperiodeTil: iso('2023-12-31'),
        sfggReferenceperiodeFravaersdageUdenLoen: 3,
        // Dagssatsen hører til «Manuelt angivet» og er nu skjult.
        sfggManuelDagssats: undefined,
      });

      const roed = project(sag({ sfggAnsaettelsesforhold: [sfggRow({ sfggReferenceperiodeFravaersdageUdenLoen: 400 })] }));
      // Loftet bor nu på feltet: rød ring med validatorens ordlyd, og linjen står kun én gang.
      expect(roed.issueAt(eoSfggReferenceperiodeFravaersdageUdenLoenField.bind(AF))?.message)
        .toBe('Antal dage skal være mellem 0 og 366');
      expect(linjerMed(roed, 'Antal dage skal være mellem 0 og 366')).toHaveLength(1);
    });

    it.each(['Nej', 'Skjul'] as const)('skjuler hele sektionen ved TAF-krav «%s»', (tafValg) => {
      const result = project(sag({
        kravPaaTabtArbejdsfortjeneste: tafValg,
        sfggAnsaettelsesforhold: [sfggRow({ sfggReferenceperiodeFravaersdageUdenLoen: 400, sfggAlleredeBetaltBeloeb: asAmount(100) })],
      }));
      expect(result.issueAt(eoSfggReferenceperiodeFravaersdageUdenLoenField.bind(AF))).toBeUndefined();
      expect(sfggProjected(result)).toMatchObject({
        sfggReferenceperiodeFra: undefined,
        sfggReferenceperiodeFravaersdageUdenLoen: undefined,
        sfggAlleredeBetaltBeloeb: undefined,
      });
      expect(linjerMed(result, 'Antal dage skal være mellem 0 og 366')).toEqual([]);
      expect(failedMessages(result)).not.toContain('Antal dage skal være mellem 0 og 366');
    });

    it('skjuler sektionen for et ansættelsesforhold, der ikke var ansat på skadestidspunktet', () => {
      const result = project(sag({
        loenindkomstAnsaettelsesforhold: [employment({ ansatPaaSkadestidspunktet: false })],
        sfggAnsaettelsesforhold: [sfggRow({ sfggReferenceperiodeFravaersdageUdenLoen: 400 })],
      }));
      expect(result.issueAt(eoSfggReferenceperiodeFravaersdageUdenLoenField.bind(AF))).toBeUndefined();
      expect(sfggProjected(result)?.sfggReferenceperiodeFravaersdageUdenLoen).toBeUndefined();
    });

    it('kræver ikke en skjult referenceperiode ved «Overenskomst» uden aktiv overenskomst', () => {
      const result = project(sag({
        sfggAnsaettelsesforhold: [sfggRow({
          sfggBeregningskilde: 'Overenskomst',
          sfggReferenceperiodeFra: undefined,
          sfggReferenceperiodeTil: undefined,
        })],
      }));
      const messages = failedMessages(result);
      expect(messages).toContain(
        'Der skal være valgt en overenskomst på ansættelsesforholdet for at beregne sygeferiegodtgørelse ud fra overenskomst'
      );
      expect(messages).not.toContain('Referenceperiode fra-dato mangler');
      expect(messages).not.toContain('Referenceperiode til-dato mangler');
    });

    it('følger sektionens synlighed felt for felt', () => {
      const input = (patch: Partial<SfggRelevansInput>): SfggRelevansInput => ({
        kravPaaTabtArbejdsfortjeneste: 'Ja',
        employment: { ansatPaaSkadestidspunktet: true, harOverenskomst: false, overenskomstId: undefined },
        sfggBeregningskilde: 'Ferieloven',
        ...patch,
      });
      expect(erSfggFeltRelevant('referenceperiode', input({}))).toBe(true);
      expect(erSfggFeltRelevant('alleredeBetalt', input({}))).toBe(true);
      expect(erSfggFeltRelevant('manuel', input({}))).toBe(false);
      expect(erSfggFeltRelevant('alleredeBetalt', input({ sfggBeregningskilde: 'Ingen' }))).toBe(false);
      expect(erSfggFeltRelevant('alleredeBetalt', input({ sfggBeregningskilde: undefined }))).toBe(false);
      expect(erSfggFeltRelevant('manuel', input({ sfggBeregningskilde: 'Manuelt angivet' }))).toBe(true);
      // «Overenskomst» uden aktiv overenskomst viser hverken referenceperiode eller «allerede betalt».
      expect(erSfggFeltRelevant('referenceperiode', input({ sfggBeregningskilde: 'Overenskomst' }))).toBe(false);
      expect(erSfggFeltRelevant('alleredeBetalt', input({ sfggBeregningskilde: 'Overenskomst' }))).toBe(false);
      // En SFGG-række uden ansættelsesforhold vises ingen steder.
      expect(erSfggFeltRelevant('referenceperiode', input({ employment: undefined }))).toBe(false);
    });

    it('binder satsvalg, dagssats og «allerede betalt» til deres egen kilde', () => {
      const result = project(sag({
        sfggAnsaettelsesforhold: [sfggRow({
          sfggBeregningskilde: 'Ingen',
          sfggSatsvalg: 'Faglaert-Koebenhavn',
          sfggManuelDagssats: asAmount(500),
          sfggAlleredeBetaltBeloeb: asAmount(100),
        })],
      }));
      expect(sfggProjected(result)).toMatchObject({
        sfggSatsvalg: undefined,
        sfggManuelDagssats: undefined,
        sfggAlleredeBetaltBeloeb: undefined,
        sfggReferenceperiodeFra: undefined,
      });
      expect(result.issueAt(eoSfggSatsvalgField.bind(AF))).toBeUndefined();
      expect(result.issueAt(eoSfggManuelDagssatsField.bind(AF))).toBeUndefined();
      expect(result.issueAt(eoSfggAlleredeBetaltBeloebField.bind(AF))).toBeUndefined();
    });
  });

  describe('dublerede og usande linjer om SFGG-referenceperioden', () => {
    it('melder ikke «… mangler» om en omvendt referenceperiode, hvis datoer står i felterne (V7)', () => {
      const result = project(sag({
        sfggAnsaettelsesforhold: [sfggRow({ sfggReferenceperiodeFra: iso('2023-12-31'), sfggReferenceperiodeTil: iso('2023-12-01') })],
      }));
      expect(result.issueAt(eoSfggReferenceperiodeFraField.bind(AF))?.reason).toBe('rule');
      expect(result.issueAt(eoSfggReferenceperiodeTilField.bind(AF))?.reason).toBe('rule');
      expect(linjerMed(result, 'Referenceperiode fra-dato mangler')).toEqual([]);
      expect(linjerMed(result, 'Referenceperiode til-dato mangler')).toEqual([]);
      expect(failedMessages(result)).not.toContain('Referenceperiode fra-dato mangler');
      expect(failedMessages(result)).not.toContain('Referenceperiode til-dato mangler');
    });

    it('melder fortsat en reelt manglende referenceperiode', () => {
      const result = project(sag({
        sfggAnsaettelsesforhold: [sfggRow({ sfggReferenceperiodeFra: undefined, sfggReferenceperiodeTil: undefined })],
      }));
      expect(failedMessages(result)).toEqual(expect.arrayContaining([
        'Referenceperiode fra-dato mangler',
        'Referenceperiode til-dato mangler',
      ]));
    });

    it('melder en referenceperiode før reguleringsgrundlagets første sats én gang, på feltet (V6)', () => {
      // SBLON2 har satser fra 1-1-2016; referenceperioden ligger før.
      const initial = createErstatningsopgoerelseInitialValues();
      const regulering = {
        ...initial.eoAngivetLoenLoenudvikling,
        loenudviklingBeregningsgrundlag: 'Statistik' as const,
        loenudviklingStatistikModel: 'SBLON2 (Danmarks Statistik)' as const,
      };
      expect(resolveKildeReguleringsIntervalIso({ ...employment(), ...regulering })?.fraIso).toBe('2016-01-01');
      const result = project(sag({
        eoAngivetLoenLoenudvikling: regulering,
        sfggAnsaettelsesforhold: [sfggRow({ sfggReferenceperiodeFra: iso('2015-11-01'), sfggReferenceperiodeTil: iso('2015-12-31') })],
      }));
      // Reglen projekteres på feltet (`collectLoenudviklingCoverageIssues`), så til-datoen får rød ring.
      const tilAdresse = serializeFieldAddress(eoSfggReferenceperiodeTilField.bind(AF).address);
      expect(result.projection.eoErrors.all
        .filter((issue) => serializeFieldAddress(issue.field.address) === tilAdresse)
        .map((issue) => issue.message)).toEqual([expect.stringMatching(/^Referenceperioden slutter før/)]);
      // Validatoren melder den ikke længere selv (den gav samme linje en gang til).
      expect(result.projection.snapshot.invariants
        .filter((invariant) => invariant.id.startsWith('validation:') && invariant.message.startsWith('Referenceperioden slutter før')))
        .toEqual([]);
      expect(linjerMed(result, 'Referenceperioden slutter før')).toHaveLength(1);
    });

    it('melder en samlet negativ løn i referenceperioden én gang i «Fejl og advarsler» (V11)', () => {
      const negativ = employment({
        indtaegtsoplysningerTableData: [{
          ...employment().indtaegtsoplysningerTableData[0]!,
          col2: asAmount(-30000),
        }],
      });
      const result = project(sag({ loenindkomstAnsaettelsesforhold: [negativ] }));
      expect(linjerMed(result, 'Lønnen i referenceperioden er samlet negativ')).toHaveLength(1);
    });
  });

  describe('indtægtstabellens celler', () => {
    const tabelSag = (patch: Partial<LoenindkomstAnsaettelsesforhold>) => sag({
      loenindkomstAnsaettelsesforhold: [employment({
        ...patch,
        indtaegtsoplysningerTableData: [{
          ...employment().indtaegtsoplysningerTableData[0]!,
          // En omvendt uge-periode er rød, når uge-kolonnerne vises.
          col0_uge: '10/2023',
          col1_uge: '05/2023',
          fpFvShSoBeloeb: asAmount(1200),
          pensionBeloeb: asAmount(800),
        }],
      })],
    });
    const cell = <T,>(result: ReturnType<typeof project>, key: 'col0_uge' | 'col1_uge' | 'fpFvShSoBeloeb' | 'pensionBeloeb') =>
      result.projection.eoValues.loenindkomstAnsaettelsesforhold[0]?.indtaegtsoplysningerTableData[0]?.[key] as T;

    it('skjuler uge-kolonnerne ved «Løn indtastes som» = måned og viser dem igen ved uge', () => {
      const maaned = project(tabelSag({ loenperiode: 'maaned' }));
      expect(maaned.issueAt(eoStandardRowFields.col0_uge.bind(AF, 'loen-dec-2023'))).toBeUndefined();
      expect(maaned.issueAt(eoStandardRowFields.col1_uge.bind(AF, 'loen-dec-2023'))).toBeUndefined();
      expect(cell(maaned, 'col0_uge')).toBe('');

      const uge = project(tabelSag({ loenperiode: 'uge' }));
      expect(uge.issueAt(eoStandardRowFields.col0_uge.bind(AF, 'loen-dec-2023'))?.reason).toBe('rule');
      expect(uge.issueAt(eoStandardRowFields.col1_uge.bind(AF, 'loen-dec-2023'))?.reason).toBe('rule');
    });

    it('læser tillægs- og pensionsbeløbene kun ved «Tillæg angives som» = beløb', () => {
      const procent = project(tabelSag({ tillaegAngivesSom: 'procent' }));
      expect(cell(procent, 'fpFvShSoBeloeb')).toBeUndefined();
      expect(cell(procent, 'pensionBeloeb')).toBeUndefined();

      const beloeb = project(tabelSag({ tillaegAngivesSom: 'beloeb' }));
      expect(cell(beloeb, 'fpFvShSoBeloeb')).toEqual(asAmount(1200));
      expect(cell(beloeb, 'pensionBeloeb')).toEqual(asAmount(800));
    });
  });
});
