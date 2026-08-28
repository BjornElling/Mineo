import {
  createEmptySettledInput,
  createEvaluationSourceToken,
  createInputEvaluation,
  createInputRevision,
  createSettingsRevision,
  insertRow,
  reduceInputCommand,
  resetSection,
  serializeFieldAddress,
  setImmediateField,
  settleField,
  type InputMutationCommand,
  type SettledInput,
} from '../../../inputCore';
import { toAnyFieldRef } from '../../../inputCore/fieldDescriptor';
import {
  aarsloenLoenperiodeField,
  aarsloenTableCol0DagField,
  aarsloenTableCol0MaanedField,
  aarsloenTableCol0UgeField,
  aarsloenTableCol1DagField,
  aarsloenTableCol1UgeField,
  aarsloenTableCol2Field,
} from '../../../inputCore/catalog/aarsloenDescriptors';
import {
  forsoergertabBeregningsdatoField,
  forsoergertabVirkningsdatoField,
} from '../../../inputCore/catalog/forsoergertabDescriptors';
import {
  renteberegningBeregningsdatoField,
  rentekravBelobField,
  rentekravRenterFraField,
  rentekravRowsCollectionRef,
  rentekravTillaegstidField,
} from '../../../inputCore/catalog/renteberegningDescriptors';
import {
  eoForligDatoField,
  eoOffentligeYdelserTillaegField,
  eoOffentligeYdelserYdelseField,
  eoOevrigeKravBeloebField,
  eoOevrigeKravDatoField,
} from '../../../inputCore/catalog/erstatningsopgoerelseDescriptors';
import {
  erhvervsevnetabBeregningsdatoField,
  aslAfgoerelseAfgoerelseTypeField,
  aslAfgoerelseAfgoerelsesDatoField,
  aslAfgoerelseKapDatoField,
  aslAfgoerelseTidlKapDatoField,
  aslAfgoerelseEetPctField,
  erhvervsevnetabAslAfgoerelserCollectionRef,
  erhvervsevnetabEalEetPctField,
} from '../../../inputCore/catalog/erhvervsevnetabDescriptors';
import { getProductionInputCatalog } from '../../../inputCore/catalog/productionCatalog';
import {
  stamdataSkadedatoField,
  stamdataSkadelidteFodselsdatoField,
} from '../../../inputCore/catalog/stamdataDescriptors';
import { createEmptyStandardLoenRow } from '../../../domain/aarsloen/standardLoenRowInitialValues';
import { createEmptyAslAfgoerelseRow } from '../../../domain/erhvervsevnetab/eetAslAfgoerelser';
import { createEmptyRentekravCommittedRow } from '../../../domain/renteberegning/rentekravTableModel';
import { createCollectionRef } from '../../../inputCore/fieldAddress';
import { toISODateString } from '../../../types/branded';
import { DATE_ORDER_ERROR_MESSAGE } from '../../../utils/dateOrderValidation';
import { varigeMenBeregningsdatoField } from '../../../inputCore/catalog/varigeMenDescriptors';
import {
  eoEmploymentManual,
  eoEmploymentFields,
  eoStandardRowFields,
} from '../../../inputCore/catalog/erstatningsopgoerelseLoenDescriptors';
import { createDefaultLoenindkomstAnsaettelsesforhold } from '../../../domain/erstatningsopgoerelse/helpers/erstatningsopgoerelseInitialValues';

const catalog = getProductionInputCatalog();
const token = createEvaluationSourceToken(createInputRevision(1), createSettingsRevision(1));
const empty = (): SettledInput => catalog.validateSettledInput(createEmptySettledInput());
const dispatch = <TField, TEntity>(input: SettledInput, command: InputMutationCommand<TField, TEntity>): SettledInput =>
  reduceInputCommand(input, command, catalog).input;
const evaluate = (input: SettledInput) => createInputEvaluation({ input, catalog, sourceToken: token });

const tableRef = createCollectionRef({ section: 'aarsloen', path: [], collection: 'tableData' });
const employmentCollectionRef = createCollectionRef({
  section: 'erstatningsopgoerelse',
  path: [],
  collection: 'loenindkomstAnsaettelsesforhold',
});

describe('produktdescriptors – dato-, periode- og relevansregler', () => {
  /**
   * Feltets label er kontekstuel: `Skadedato` hedder `Anmeldelsesdato`, når skadestypen er
   * Erhvervssygdom. Testen måler, at den AKTUELLE label – ikke descriptorens statiske navn – følger med
   * ud i en rejected datofejl.
   *
   * BB-128: en afvisning med en KONKRET årsag (`nonexistentDay`, `yearOutOfRepresentableRange`) bruger nu
   * årsagsteksten som `message`, ikke kun som tooltip. Den besked nævner ikke feltet, så labelen måles her
   * på et `malformed` input («abc»), der stadig har den generiske feltnavns-besked. Kontrasten uden
   * skadestype sikrer, at testen måler selve kontekstskiftet og ikke bare en konstant streng.
   */
  it('bruger den aktuelle kontekstuelle label i rejected datofejl', () => {
    let input = dispatch(empty(), resetSection('stamdata', { skadestype: 'Erhvervssygdom' }));
    input = dispatch(input, settleField(stamdataSkadedatoField.bind(), 'abc'));

    const evaluation = evaluate(input);
    expect(evaluation.reader.labelOf(stamdataSkadedatoField.bind())).toBe('Anmeldelsesdato');
    expect(evaluation.reader.read(stamdataSkadedatoField.bind())).toMatchObject({
      status: 'error',
      issue: {
        reason: 'format',
        message: "Der er udfyldt en ugyldig værdi i feltet 'Anmeldelsesdato'",
        field: { descriptor: { label: 'Anmeldelsesdato' } },
      },
    });

    // Uden Erhvervssygdom bærer præcis samme felt og input den anden label.
    const utenSkadestype = evaluate(dispatch(empty(), settleField(stamdataSkadedatoField.bind(), 'abc')));
    expect(utenSkadestype.reader.labelOf(stamdataSkadedatoField.bind())).toBe('Skadedato');
    expect(utenSkadestype.reader.read(stamdataSkadedatoField.bind())).toMatchObject({
      status: 'error',
      issue: { message: "Der er udfyldt en ugyldig værdi i feltet 'Skadedato'" },
    });
  });

  /**
   * BB-128: den konkrete årsag er selve beskeden. Før stod den kun i `detail.tooltip`, mens `message`
   * faldt tilbage til den generiske feltnavns-tekst – brugeren så altså «ugyldig værdi» frem for at få at
   * vide, at 31. februar ikke findes. Den kontekstuelle label lever videre på issuets descriptor.
   */
  it('bruger den konkrete årsag som besked i en rejected datofejl', () => {
    let input = dispatch(empty(), resetSection('stamdata', { skadestype: 'Erhvervssygdom' }));
    input = dispatch(input, settleField(stamdataSkadedatoField.bind(), '31-02-2020'));

    expect(evaluate(input).reader.read(stamdataSkadedatoField.bind())).toMatchObject({
      status: 'error',
      issue: {
        reason: 'format',
        message: 'Datoen findes ikke i kalenderen',
        detail: { dateInvalidKind: 'nonexistentDay', tooltip: 'Datoen findes ikke i kalenderen' },
        field: { descriptor: { label: 'Anmeldelsesdato' } },
      },
    });
  });

  it('afviser kontekstuelle labels uden canonical view i issue-adapteren', () => {
    expect(() => toAnyFieldRef(stamdataSkadedatoField.bind())).toThrow(
      'Kontekstuel feltlabel kan ikke opløses uden en canonical view'
    );
  });

  it('håndhæver Stamdatas faste datogrænser som afledte feltissues', () => {
    const invalidBirth = dispatch(empty(), resetSection('stamdata', {
      skadelidteFodselsdato: toISODateString('2100-12-31'),
    }));
    expect(evaluate(invalidBirth).reader.read(stamdataSkadelidteFodselsdatoField.bind())).toMatchObject({
      status: 'error',
      issue: { reason: 'bounds' },
    });

    const invalidDamage = dispatch(empty(), resetSection('stamdata', {
      skadedato: toISODateString('2004-12-31'),
    }));
    expect(evaluate(invalidDamage).reader.read(stamdataSkadedatoField.bind())).toMatchObject({
      status: 'error',
      issue: { reason: 'bounds', detail: { minDate: '2005-01-01' } },
    });
  });

  it('viser rækkefølgefejl på begge dato- og ugeceller i Årslønstabellen', () => {
    let input = dispatch(empty(), insertRow(tableRef, createEmptyStandardLoenRow('r1')));
    input = dispatch(input, setImmediateField(aarsloenLoenperiodeField.bind(), 'dag'));
    input = dispatch(input, settleField(aarsloenTableCol0DagField.bind('r1'), '02-01-2024'));
    input = dispatch(input, settleField(aarsloenTableCol1DagField.bind('r1'), '01-01-2024'));
    let evaluation = evaluate(input);
    expect(evaluation.reader.read(aarsloenTableCol0DagField.bind('r1')).status).toBe('error');
    expect(evaluation.reader.read(aarsloenTableCol1DagField.bind('r1')).status).toBe('error');

    input = dispatch(input, setImmediateField(aarsloenLoenperiodeField.bind(), 'uge'));
    input = dispatch(input, settleField(aarsloenTableCol0UgeField.bind('r1'), '2/2024'));
    input = dispatch(input, settleField(aarsloenTableCol1UgeField.bind('r1'), '1/2024'));
    evaluation = evaluate(input);
    expect(evaluation.reader.read(aarsloenTableCol0UgeField.bind('r1')).status).toBe('error');
    expect(evaluation.reader.read(aarsloenTableCol1UgeField.bind('r1')).status).toBe('error');
  });

  it('håndhæver Årslønstabellens faste nedre datogrænse', () => {
    let input = dispatch(empty(), insertRow(tableRef, createEmptyStandardLoenRow('r1')));
    input = dispatch(input, setImmediateField(aarsloenLoenperiodeField.bind(), 'dag'));
    input = dispatch(input, settleField(aarsloenTableCol0DagField.bind('r1'), '31-12-2004'));

    expect(evaluate(input).reader.read(aarsloenTableCol0DagField.bind('r1'))).toMatchObject({
      status: 'error',
      issue: { reason: 'bounds', detail: { minDate: '2005-01-01' } },
    });
  });

  it('rydder kun afvist input, når et periodeskift gør cellen irrelevant (§7.5 pkt. 2)', () => {
    // Undtagelsen i praksis på en produktionsdescriptor: råteksten i dag-kolonnen ville efter et skift til
    // måned blokere `.eo`-save globalt (§8) fra en celle, brugeren ikke længere kan se. Den ryddes derfor
    // tavst med valget. Havde cellen båret en GYLDIG dato, var den blevet bevaret (hovedreglen).
    let input = dispatch(empty(), insertRow(tableRef, createEmptyStandardLoenRow('r1')));
    input = dispatch(input, setImmediateField(aarsloenLoenperiodeField.bind(), 'dag'));
    input = dispatch(input, settleField(aarsloenTableCol0DagField.bind('r1'), 'ugyldig'));
    const address = serializeFieldAddress(aarsloenTableCol0DagField.bind('r1').address);
    expect(input.rejectedInputs[address]).toBeDefined();

    input = dispatch(input, setImmediateField(aarsloenLoenperiodeField.bind(), 'maaned'));
    expect(input.rejectedInputs[address]).toBeUndefined();
    expect(evaluate(input).reader.read(aarsloenTableCol0DagField.bind('r1'))).toMatchObject({ status: 'usable' });
  });

  it('BEVARER en gyldig celle, når samme periodeskift gør den irrelevant (§7.5 hovedregel)', () => {
    // Kontrasttesten til ovenstående, og den der beviser, at rydningen er betinget af den RØDE FEJL – ikke
    // blot af at cellen bliver skjult. Uden denne kunne rydningen udvides til alle skjulte celler, uden at
    // nogen test blev rød.
    let input = dispatch(empty(), insertRow(tableRef, createEmptyStandardLoenRow('r1')));
    input = dispatch(input, setImmediateField(aarsloenLoenperiodeField.bind(), 'dag'));
    input = dispatch(input, settleField(aarsloenTableCol0DagField.bind('r1'), '15-01-2020'));

    input = dispatch(input, setImmediateField(aarsloenLoenperiodeField.bind(), 'maaned'));
    // Værdien består skjult i den canonical sektion ...
    expect(input.sections.aarsloen?.tableData?.[0]?.col0_dag).toBe('2020-01-15');
    // ... og kommer uændret til syne igen ved skift tilbage.
    input = dispatch(input, setImmediateField(aarsloenLoenperiodeField.bind(), 'dag'));
    expect(evaluate(input).reader.read(aarsloenTableCol0DagField.bind('r1'))).toMatchObject({
      status: 'usable',
      value: '2020-01-15',
    });
  });

  it('udleverer aldrig et skjult ansættelsesforholds opsigelse til consumers', () => {
    // Den rå canonical værdi bevares, så et senere tilvalg kan vise den igen. Men alle consumerveje
    // går gennem readeren og får tomværdien, mens feltet er skjult.
    const employment = {
      ...createDefaultLoenindkomstAnsaettelsesforhold(),
      id: 'af-relevans',
      ansatPaaSkadestidspunktet: false,
      ansaettelsesforholdOphoert: true,
      sidsteArbejdsdag: toISODateString('2024-01-31'),
    };
    let input = dispatch(empty(), insertRow(employmentCollectionRef, employment));

    expect(input.sections.erstatningsopgoerelse?.loenindkomstAnsaettelsesforhold?.[0]).toMatchObject({
      ansaettelsesforholdOphoert: true,
      sidsteArbejdsdag: '2024-01-31',
    });
    let reader = evaluate(input).reader;
    expect(reader.read(eoEmploymentFields.ansaettelsesforholdOphoert.bind('af-relevans'))).toEqual({
      status: 'usable', value: false,
    });
    expect(reader.read(eoEmploymentFields.sidsteArbejdsdag.bind('af-relevans'))).toEqual({
      status: 'usable', value: undefined,
    });

    input = dispatch(input, setImmediateField(eoEmploymentFields.ansatPaaSkadestidspunktet.bind('af-relevans'), true));
    reader = evaluate(input).reader;
    expect(reader.read(eoEmploymentFields.ansaettelsesforholdOphoert.bind('af-relevans'))).toEqual({
      status: 'usable', value: true,
    });
    expect(reader.read(eoEmploymentFields.sidsteArbejdsdag.bind('af-relevans'))).toEqual({
      status: 'usable', value: '2024-01-31',
    });
  });

  it('afviser schema-gyldige, men codec-ugyldige strengværdier fra tolerant load', () => {
    const row = { ...createEmptyStandardLoenRow('r1'), col0_maaned: 'ugyldig' };
    let input = dispatch(empty(), insertRow(tableRef, row));
    input = dispatch(input, setImmediateField(aarsloenLoenperiodeField.bind(), 'maaned'));

    expect(evaluate(input).reader.read(aarsloenTableCol0MaanedField.bind('r1'))).toMatchObject({
      status: 'error',
      issue: { reason: 'schema' },
    });
  });

  it('håndhæver Renteberegnings globale og rækkeafhængige grænser', () => {
    expect(rentekravTillaegstidField.codec.maxDigits).toBe(2);
    let input = dispatch(empty(), settleField(renteberegningBeregningsdatoField.bind(), '01-01-2004'));
    expect(evaluate(input).reader.read(renteberegningBeregningsdatoField.bind()).status).toBe('error');

    input = dispatch(empty(), settleField(renteberegningBeregningsdatoField.bind(), '01-01-2024'));
    input = dispatch(input, insertRow(rentekravRowsCollectionRef, createEmptyRentekravCommittedRow('r1')));
    input = dispatch(input, settleField(rentekravRenterFraField.bind('r1'), '02-01-2024'));
    input = dispatch(input, settleField(rentekravTillaegstidField.bind('r1'), '100'));
    expect(evaluate(input).reader.read(rentekravRenterFraField.bind('r1')).status).toBe('error');
    expect(evaluate(input).reader.read(rentekravTillaegstidField.bind('r1')).status).toBe('error');
  });

  it('kræver at Varige mén-beregningsdatoen ligger på eller efter skadedatoen', () => {
    let input = dispatch(empty(), resetSection('stamdata', { skadedato: toISODateString('2024-06-15') }));
    input = dispatch(input, settleField(varigeMenBeregningsdatoField.bind(), '14-06-2024'));

    expect(evaluate(input).reader.read(varigeMenBeregningsdatoField.bind())).toMatchObject({
      status: 'error',
      issue: { reason: 'bounds', detail: { minDate: '2024-06-15' } },
    });
  });

  it('håndhæver EET-tabellens dato- og femprocentsregler i descriptorlaget', () => {
    let input = dispatch(empty(), insertRow(
      erhvervsevnetabAslAfgoerelserCollectionRef,
      { ...createEmptyAslAfgoerelseRow(), id: 'r1' }
    ));
    input = dispatch(input, settleField(aslAfgoerelseAfgoerelsesDatoField.bind('r1'), '31-12-2004'));
    input = dispatch(input, settleField(aslAfgoerelseEetPctField.bind('r1'), '12'));
    input = dispatch(input, settleField(erhvervsevnetabEalEetPctField.bind(), '12'));
    const evaluation = evaluate(input);

    expect(evaluation.reader.read(aslAfgoerelseAfgoerelsesDatoField.bind('r1')).status).toBe('error');
    expect(evaluation.reader.read(aslAfgoerelseEetPctField.bind('r1')).status).toBe('error');
    expect(evaluation.reader.read(erhvervsevnetabEalEetPctField.bind()).status).toBe('error');
  });

  it('bruger ikke en par- eller dækningsbesked, når den ydre grænse vinder', () => {
    let aarsloenInput = dispatch(empty(), insertRow(tableRef, createEmptyStandardLoenRow('r1')));
    aarsloenInput = dispatch(aarsloenInput, setImmediateField(aarsloenLoenperiodeField.bind(), 'dag'));
    aarsloenInput = dispatch(aarsloenInput, settleField(aarsloenTableCol0DagField.bind('r1'), '31-12-2100'));
    aarsloenInput = dispatch(aarsloenInput, settleField(aarsloenTableCol1DagField.bind('r1'), '31-12-2100'));
    const aarsloenIssue = evaluate(aarsloenInput).reader.read(aarsloenTableCol0DagField.bind('r1'));
    expect(aarsloenIssue.status).toBe('error');
    if (aarsloenIssue.status === 'error') {
      expect(aarsloenIssue.issue.message).not.toBe(DATE_ORDER_ERROR_MESSAGE);
    }

    let forsoergertabInput = dispatch(empty(), settleField(forsoergertabBeregningsdatoField.bind(), '01-01-2020'));
    forsoergertabInput = dispatch(forsoergertabInput, settleField(forsoergertabVirkningsdatoField.bind(), '02-01-2020'));
    const forsoergertabIssue = evaluate(forsoergertabInput).reader.read(forsoergertabVirkningsdatoField.bind());
    expect(forsoergertabIssue.status).toBe('error');
    if (forsoergertabIssue.status === 'error') {
      expect(forsoergertabIssue.issue.message).not.toContain('Virkningsdato kan senest være');
    }
  });

  it('viser ikke en skadedato, der ikke findes, i ASL-beskeden', () => {
    let input = dispatch(empty(), insertRow(
      erhvervsevnetabAslAfgoerelserCollectionRef,
      { ...createEmptyAslAfgoerelseRow(), id: 'r1' },
    ));
    input = dispatch(input, settleField(aslAfgoerelseAfgoerelsesDatoField.bind('r1'), '31-12-2004'));

    const issue = evaluate(input).reader.read(aslAfgoerelseAfgoerelsesDatoField.bind('r1'));
    expect(issue.status).toBe('error');
    if (issue.status === 'error') {
      expect(issue.issue.message).not.toContain('skadedatoen');
      expect(issue.issue.message).not.toContain('anmeldelsesdatoen');
    }
  });

  it('håndhæver den ydre minimumsgrænse, når ASL-kapitaliseringsdatoens afgørelse er tidligere', () => {
    let input = dispatch(empty(), insertRow(
      erhvervsevnetabAslAfgoerelserCollectionRef,
      { ...createEmptyAslAfgoerelseRow(), id: 'r1' },
    ));
    input = dispatch(input, settleField(aslAfgoerelseAfgoerelsesDatoField.bind('r1'), '31-12-2004'));
    input = dispatch(input, settleField(aslAfgoerelseKapDatoField.bind('r1'), '30-12-2004'));

    expect(evaluate(input).reader.read(aslAfgoerelseKapDatoField.bind('r1'))).toMatchObject({
      status: 'error',
      issue: { reason: 'bounds', detail: { minDate: '2005-01-01' } },
    });
  });

  it('viser midlertidig-afgørelsesfejlen før kap.datoens afgørelsesdatogrænse', () => {
    let input = dispatch(empty(), insertRow(
      erhvervsevnetabAslAfgoerelserCollectionRef,
      { ...createEmptyAslAfgoerelseRow(), id: 'r1' },
    ));
    input = dispatch(input, settleField(aslAfgoerelseAfgoerelsesDatoField.bind('r1'), '31-12-2024'));
    input = dispatch(input, setImmediateField(aslAfgoerelseAfgoerelseTypeField.bind('r1'), 'Midlertidig'));
    input = dispatch(input, settleField(aslAfgoerelseKapDatoField.bind('r1'), '30-12-2024'));

    const evaluation = evaluate(input);
    expect(evaluation.reader.read(aslAfgoerelseKapDatoField.bind('r1'))).toMatchObject({
      status: 'usable',
      value: expect.anything(),
    });
    expect(evaluation.issues.all).toContainEqual(expect.objectContaining({
      reason: 'rule',
      priority: 'context',
      message: 'Kapitaliseringsdato må kun udfyldes ved endelig eller delvist endelig afgørelsestype.',
    }));
  });

  it('viser "Kun relevant ved tidligere kapitalisering" før tidl. kap.datoens datogrænse', () => {
    let input = dispatch(empty(), insertRow(
      erhvervsevnetabAslAfgoerelserCollectionRef,
      { ...createEmptyAslAfgoerelseRow(), id: 'r1' },
    ));
    input = dispatch(input, settleField(aslAfgoerelseAfgoerelsesDatoField.bind('r1'), '31-12-2024'));
    input = dispatch(input, settleField(aslAfgoerelseTidlKapDatoField.bind('r1'), '31-12-2024'));

    const evaluation = evaluate(input);
    expect(evaluation.reader.read(aslAfgoerelseTidlKapDatoField.bind('r1'))).toMatchObject({
      status: 'usable',
      value: expect.anything(),
    });
    expect(evaluation.issues.all).toContainEqual(expect.objectContaining({
      reason: 'rule',
      priority: 'context',
      message: 'Kun relevant ved tidligere kapitalisering.',
    }));
  });

  it('viser formatfejl før kontekstfejlen ved delvist indtastet kap.dato', () => {
    let input = dispatch(empty(), insertRow(
      erhvervsevnetabAslAfgoerelserCollectionRef,
      { ...createEmptyAslAfgoerelseRow(), id: 'r1' },
    ));
    input = dispatch(input, setImmediateField(aslAfgoerelseAfgoerelseTypeField.bind('r1'), 'Midlertidig'));
    input = dispatch(input, settleField(aslAfgoerelseKapDatoField.bind('r1'), '15-06-202'));

    expect(evaluate(input).reader.read(aslAfgoerelseKapDatoField.bind('r1'))).toMatchObject({
      status: 'error',
      issue: {
        reason: 'format',
        message: "Der er udfyldt en ugyldig værdi i feltet 'Kap.dato'",
      },
    });
  });

  it('viser formatfejl før kontekstfejlen ved delvist indtastet tidligere kap.dato', () => {
    let input = dispatch(empty(), insertRow(
      erhvervsevnetabAslAfgoerelserCollectionRef,
      { ...createEmptyAslAfgoerelseRow(), id: 'r1' },
    ));
    input = dispatch(input, settleField(aslAfgoerelseTidlKapDatoField.bind('r1'), '15-06-202'));

    expect(evaluate(input).reader.read(aslAfgoerelseTidlKapDatoField.bind('r1'))).toMatchObject({
      status: 'error',
      issue: {
        reason: 'format',
        message: "Der er udfyldt en ugyldig værdi i feltet 'Hvis genopt. - tidl. kap.dato'",
      },
    });
  });

  it('erklærer to decimaler som grid-hovedregel og EET som eksplicit heltalsundtagelse', () => {
    expect(eoEmploymentManual.manualFields.feriepenge.codec.decimalPolicy).toBe('decimal');
    expect(eoEmploymentManual.manualPercentFields.procent.codec.decimalPolicy).toBe('decimal');
    expect(aslAfgoerelseEetPctField.codec.decimalPolicy).toBe('integerOnly');
    expect(erhvervsevnetabEalEetPctField.codec.decimalPolicy).toBe('integerOnly');
  });

  it('erklærer to decimaler for alle aktuelle grid-beløbskategorier', () => {
    const gridAmountDescriptors = [
      aarsloenTableCol2Field,
      eoStandardRowFields.col2,
      eoEmploymentManual.manualFields.grundloen,
      rentekravBelobField,
      eoOevrigeKravBeloebField,
      eoOffentligeYdelserYdelseField,
      eoOffentligeYdelserTillaegField,
    ];

    expect(gridAmountDescriptors.map((descriptor) => descriptor.codec.decimalPolicy))
      .toEqual(gridAmountDescriptors.map(() => 'decimal'));
  });
});

// Årsagsinputtene i det UMULIGE datointerval, målt gennem det ÆGTE produktionskatalog.
//
// Fundets reproduktion: sæt `stamdata.skadedato` til 2099-01-01. Skadedatoen bliver da EO-datofelternes nedre
// grænse og ligger efter deres konfigurerede øvre grænse, så intet er gyldigt. Beskeden viste før rettelsen de
// faktiske grænser, men ikke hvilke inputs der frembragte dem – brugeren fik at vide, at ingen dato var mulig,
// uden at vide hvad de skulle rette.
//
// Testen måler `issue.message` frem for blot `status`, fordi det er BESKEDEN, fundet handler om. En status-only
// assertion havde været grøn hele vejen igennem.
describe('produktdescriptors – umuligt datointerval navngiver sine årsagsinputs', () => {
  const withSkadedatoAfterCoverage = (): SettledInput =>
    dispatch(empty(), resetSection('stamdata', { skadedato: toISODateString('2099-01-01') }));

  it('forligsdatoen nævner Skadedato og Skadestype', () => {
    let input = withSkadedatoAfterCoverage();
    input = dispatch(input, settleField(eoForligDatoField.bind(), '15-06-2024'));

    const read = evaluate(input).reader.read(eoForligDatoField.bind());
    expect(read.status).toBe('error');
    if (read.status !== 'error') return;
    expect(read.issue.message).toContain('ingen gyldig dato');
    expect(read.issue.message).toContain('Grænserne kommer fra Skadedato og Skadestype.');
  });

  it('øvrige krav-datoen nævner de samme årsagsinputs', () => {
    const oevrigeKravRef = createCollectionRef({
      section: 'erstatningsopgoerelse', path: [], collection: 'oevrigeKravPerioder',
    });
    let input = withSkadedatoAfterCoverage();
    input = dispatch(input, insertRow(oevrigeKravRef, { id: 'ok-1' }));
    input = dispatch(input, settleField(eoOevrigeKravDatoField.bind('ok-1'), '15-06-2024'));

    const read = evaluate(input).reader.read(eoOevrigeKravDatoField.bind('ok-1'));
    expect(read.status).toBe('error');
    if (read.status !== 'error') return;
    expect(read.issue.message).toContain('Grænserne kommer fra Skadedato og Skadestype.');
  });

  it('EETs beregningsdato nævner Skadedato – en flade, der FØR rettelsen udelod årsagen helt', () => {
    // De to EO-felter ovenfor og denne var alle tavse om årsagen; EET-rækkernes kapitaliseringsdatoer var de
    // ENESTE, der navngav den. Netop asymmetrien var beviset for, at et valgfrit felt bliver udeladt.
    let input = withSkadedatoAfterCoverage();
    input = dispatch(input, settleField(erhvervsevnetabBeregningsdatoField.bind(), '15-06-2024'));

    const read = evaluate(input).reader.read(erhvervsevnetabBeregningsdatoField.bind());
    expect(read.status).toBe('error');
    if (read.status !== 'error') return;
    expect(read.issue.message).toContain('Grænserne kommer fra Skadedato.');
  });
});
