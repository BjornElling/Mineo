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
  aslAfgoerelseAfgoerelsesDatoField,
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
import { varigeMenBeregningsdatoField } from '../../../inputCore/catalog/varigeMenDescriptors';
import {
  eoEmploymentManual,
  eoStandardRowFields,
} from '../../../inputCore/catalog/erstatningsopgoerelseLoenDescriptors';

const catalog = getProductionInputCatalog();
const token = createEvaluationSourceToken(createInputRevision(1), createSettingsRevision(1));
const empty = (): SettledInput => catalog.validateSettledInput(createEmptySettledInput());
const dispatch = <TField, TEntity>(input: SettledInput, command: InputMutationCommand<TField, TEntity>): SettledInput =>
  reduceInputCommand(input, command, catalog).input;
const evaluate = (input: SettledInput) => createInputEvaluation({ input, catalog, sourceToken: token });

const tableRef = createCollectionRef({ section: 'aarsloen', path: [], collection: 'tableData' });

describe('produktdescriptors — dato-, periode- og relevansregler', () => {
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

  it('rydder kun afvist input, når et periodeskift gør cellen irrelevant', () => {
    let input = dispatch(empty(), insertRow(tableRef, createEmptyStandardLoenRow('r1')));
    input = dispatch(input, setImmediateField(aarsloenLoenperiodeField.bind(), 'dag'));
    input = dispatch(input, settleField(aarsloenTableCol0DagField.bind('r1'), 'ugyldig'));
    const address = serializeFieldAddress(aarsloenTableCol0DagField.bind('r1').address);
    expect(input.rejectedInputs[address]).toBeDefined();

    input = dispatch(input, setImmediateField(aarsloenLoenperiodeField.bind(), 'maaned'));
    expect(input.rejectedInputs[address]).toBeUndefined();
    expect(evaluate(input).reader.read(aarsloenTableCol0DagField.bind('r1'))).toMatchObject({ status: 'usable' });
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

// R3-F03: årsagsinputtene i det UMULIGE datointerval, målt gennem det ÆGTE produktionskatalog.
//
// Fundets reproduktion: sæt `stamdata.skadedato` til 2099-01-01. Skadedatoen bliver da EO-datofelternes nedre
// grænse og ligger efter deres konfigurerede øvre grænse, så intet er gyldigt. Beskeden viste før rettelsen de
// faktiske grænser, men ikke hvilke inputs der frembragte dem — brugeren fik at vide, at ingen dato var mulig,
// uden at vide hvad de skulle rette.
//
// Testen måler `issue.message` frem for blot `status`, fordi det er BESKEDEN, fundet handler om. En status-only
// assertion havde været grøn hele vejen igennem.
describe('produktdescriptors — umuligt datointerval navngiver sine årsagsinputs (R3-F03)', () => {
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

  it('EETs beregningsdato nævner Skadedato — en flade, der FØR rettelsen udelod årsagen helt', () => {
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
