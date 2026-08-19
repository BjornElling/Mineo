// @vitest-environment jsdom
import {
  buildErstatningsopgoerelseReaderProjection,
} from '../../../domain/erstatningsopgoerelse/erstatningsopgoerelseReaderProjection';
import { getProductionInputCatalog } from '../../../inputCore/catalog/productionCatalog';
import { createInputEvaluation } from '../../../inputCore/inputReader';
import {
  createEvaluationSourceToken,
  createInputRevision,
  createSettingsRevision,
} from '../../../inputCore/evaluationSource';
import { serializeFieldAddress } from '../../../inputCore/fieldAddress';
import { resolveFieldIssueTooltip } from '../../../inputCore/inputIssue';
import {
  eoOffentligeYdelserFraDatoField,
  eoOffentligeYdelserTilDatoField,
  eoFerieperiodeFraField,
  eoFerieperiodeTilField,
  eoFravaerPeriodeFraField,
  eoFravaerPeriodeTilField,
  eoSfggReferenceperiodeFraField,
  eoSfggReferenceperiodeTilField,
  eoSvieSmertePeriodeFraField,
  eoSvieSmertePeriodeTilField,
  eoTafBeregningsperiodeFraField,
  eoTafBeregningsperiodeTilField,
  eoTafPeriodeFraField,
  eoTafPeriodeTilField,
  eoVedroererPeriodeFraField,
  eoVedroererPeriodeTilField,
} from '../../../inputCore/catalog/erstatningsopgoerelseDescriptors';
import {
  eoStandardRowFields,
} from '../../../inputCore/catalog/erstatningsopgoerelseLoenDescriptors';
import {
  createDefaultLoenindkomstAnsaettelsesforhold,
  createErstatningsopgoerelseInitialValues,
} from '../../../domain/erstatningsopgoerelse/helpers/erstatningsopgoerelseInitialValues';
import { createEmptyStandardLoenRow } from '../../../domain/aarsloen/standardLoenRowInitialValues';
import { toISODateString } from '../../../types/branded';
import type { ErstatningsopgoerelseValues, StamdataValues } from '../../../schemas/formSchemas';

// Kronologireglen for et dato-par skal give en STRUKTUREL feltfejl på BEGGE felter.
//
// Reglen fandtes før kun i række-evaluerings-motoren som `{ message, field: 'fra' | 'til' }`. Et kolonne-hint
// er ikke en feltadresse, og rød ring/tooltip kræver et `FieldIssue` med en strukturel `FieldRef` – derfor
// kunne fejlen stå i "Fejl og advarsler", scrolle til det rigtige felt og ALLIGEVEL efterlade feltet neutralt.
//
// Testen måler dét, de eksisterende suiter ikke gjorde: ikke at reglen findes i ét lag, men at den når HELE
// vejen fra afsluttet input til den feltadresse, UI'et tegner ringen på. 138 grønne tests i de enkelte lag
// var netop forenelige med, at sammenføjningen manglede.

const catalog = getProductionInputCatalog();

const validStamdata: StamdataValues = {
  journalnr: 'J-1',
  advokat: 'Advokat A',
  sagsbehandler: 'Sagsbehandler S',
  skadelidte: 'Test Testesen',
  skadestype: 'Arbejdsulykke',
  skadedato: toISODateString('2022-03-01'),
  skadelidteFodselsdato: toISODateString('1980-01-01'),
};

const buildReader = (eo: ErstatningsopgoerelseValues) => {
  const input = catalog.validateSettledInput({
    sections: {
      stamdata: validStamdata, satser: null, aarsloen: null, faellesAarsloen: null,
      renteberegning: null, varigemen: null, forsoergertab: null,
      erstatningsopgoerelse: eo, erhvervsevnetab: null,
    },
    rejectedInputs: {},
  });
  const sourceToken = createEvaluationSourceToken(createInputRevision(1), createSettingsRevision(1));
  return createInputEvaluation({ input, catalog, sourceToken });
};

const baseEo = (): ErstatningsopgoerelseValues => ({
  ...createErstatningsopgoerelseInitialValues(),
  eoNummer: 'EO-1',
  loenindkomstAnsaettelsesforhold: [],
});

/** Feltets aktive issue fra præcis det snapshot, `useFieldEditor` abonnerer på. */
const issueAt = (
  evaluation: ReturnType<typeof buildReader>,
  field: { address: Parameters<typeof serializeFieldAddress>[0] }
) => evaluation.issues.get(serializeFieldAddress(field.address));

describe('EO dato-par: kronologien er en strukturel feltfejl på begge felter', () => {
  it('«Vedrører perioden» fra > til markerer BEGGE felter og navngiver modparten', () => {
    const evaluation = buildReader({
      ...baseEo(),
      vedroererPeriodeFra: toISODateString('2026-01-01'),
      vedroererPeriodeTil: toISODateString('2025-01-01'),
    });

    const fra = issueAt(evaluation, eoVedroererPeriodeFraField.bind());
    const til = issueAt(evaluation, eoVedroererPeriodeTilField.bind());

    expect(fra?.reason).toBe('rule');
    expect(til?.reason).toBe('rule');
    // Hver tooltip navngiver den MODGÅENDE dato, ikke feltets egen.
    expect(fra?.message).toBe('Fra-dato skal være før til-dato (01-01-2025)');
    expect(til?.message).toBe('Til-dato skal være efter fra-dato (01-01-2026)');
    // `rule` vises ORDRET i tooltippet (§4) – ellers ville netop modpartsdatoen forsvinde.
    expect(resolveFieldIssueTooltip(fra!)).toBe(fra!.message);
    expect(resolveFieldIssueTooltip(til!)).toBe(til!.message);
  });

  it('en gyldig periode og et éndags-interval giver ingen feltfejl', () => {
    const ok = buildReader({
      ...baseEo(),
      vedroererPeriodeFra: toISODateString('2025-01-01'),
      vedroererPeriodeTil: toISODateString('2026-01-01'),
    });
    expect(issueAt(ok, eoVedroererPeriodeFraField.bind())).toBeUndefined();
    expect(issueAt(ok, eoVedroererPeriodeTilField.bind())).toBeUndefined();

    // Fra == til er et lovligt éndags-interval og bruges i praksis; sammenligningen er streng.
    const sameDay = buildReader({
      ...baseEo(),
      vedroererPeriodeFra: toISODateString('2025-06-01'),
      vedroererPeriodeTil: toISODateString('2025-06-01'),
    });
    expect(issueAt(sameDay, eoVedroererPeriodeFraField.bind())).toBeUndefined();
    expect(issueAt(sameDay, eoVedroererPeriodeTilField.bind())).toBeUndefined();
  });

  it('en halvt udfyldt periode er `missing`, ikke en rød feltfejl', () => {
    // Tomhed er consumerens `missing` (§1.6). Havde reglen markeret et tomt felt rødt, ville enhver
    // halvt indtastet periode blinke rødt midt i brugerens indtastning.
    const evaluation = buildReader({
      ...baseEo(),
      vedroererPeriodeFra: toISODateString('2026-01-01'),
    });
    expect(issueAt(evaluation, eoVedroererPeriodeFraField.bind())).toBeUndefined();
    expect(issueAt(evaluation, eoVedroererPeriodeTilField.bind())).toBeUndefined();
  });

  it('rækkedato-par markeres pr. række – og kun den fejlbehæftede række', () => {
    const evaluation = buildReader({
      ...baseEo(),
      offentligeYdelserRows: [
        {
          id: 'r-ok',
          fraDato: toISODateString('2026-01-12'),
          tilDato: toISODateString('2026-01-25'),
          ydelsestype: 'efterloen',
          ydelse: { kind: 'number', value: 1000 },
        },
        {
          id: 'r-fejl',
          fraDato: toISODateString('2026-02-26'),
          tilDato: toISODateString('2026-02-06'),
          ydelsestype: 'efterloen',
          ydelse: { kind: 'number', value: 1000 },
        },
      ],
    });

    expect(issueAt(evaluation, eoOffentligeYdelserFraDatoField.bind('r-ok'))).toBeUndefined();
    expect(issueAt(evaluation, eoOffentligeYdelserTilDatoField.bind('r-ok'))).toBeUndefined();

    const fejlFra = issueAt(evaluation, eoOffentligeYdelserFraDatoField.bind('r-fejl'));
    const fejlTil = issueAt(evaluation, eoOffentligeYdelserTilDatoField.bind('r-fejl'));
    expect(fejlFra?.message).toBe('Fra-dato skal være før til-dato (06-02-2026)');
    expect(fejlTil?.message).toBe('Til-dato skal være efter fra-dato (26-02-2026)');
    // Adressen bærer rækken: en fejl i én række må aldrig farve en anden rækkes celle.
    expect(fejlFra?.field.address.path.some(
      (s) => s.kind === 'entity' && s.entityId === 'r-fejl'
    )).toBe(true);
  });

  it('dækker alle fem rækkekollektioner med dato-par', () => {
    // Fabrikken `rowDatePair` er det ene sted, parret dannes. Registreres en kollektion uden den,
    // er kronologien tavs igen præcis dér – derfor dækkes hver af de fem konkrete kollektioner.
    const evaluation = buildReader({
      ...baseEo(),
      tafPerioder: [
        { id: 't1', fra: toISODateString('2022-06-30'), til: toISODateString('2022-04-01') },
      ],
      ferieperioder: [
        { id: 'f1', fra: toISODateString('2022-06-30'), til: toISODateString('2022-04-01') },
      ],
      fravaerPerioder: [
        { id: 'fr1', fra: toISODateString('2022-06-30'), til: toISODateString('2022-04-01') },
      ],
      svieSmertePerioder: [
        {
          id: 's1',
          fra: toISODateString('2022-06-30'),
          til: toISODateString('2022-04-01'),
          tilstand: 'sygemeldt',
        },
      ],
      offentligeYdelserRows: [
        {
          id: 'o1',
          fraDato: toISODateString('2022-06-30'),
          tilDato: toISODateString('2022-04-01'),
          ydelse: { kind: 'number', value: 1000 },
          ydelsestype: 'efterloen',
        },
      ],
    });

    expect(issueAt(evaluation, eoTafPeriodeFraField.bind('t1'))?.reason).toBe('rule');
    expect(issueAt(evaluation, eoTafPeriodeTilField.bind('t1'))?.reason).toBe('rule');
    expect(issueAt(evaluation, eoFerieperiodeFraField.bind('f1'))?.reason).toBe('rule');
    expect(issueAt(evaluation, eoFerieperiodeTilField.bind('f1'))?.reason).toBe('rule');
    expect(issueAt(evaluation, eoFravaerPeriodeFraField.bind('fr1'))?.reason).toBe('rule');
    expect(issueAt(evaluation, eoFravaerPeriodeTilField.bind('fr1'))?.reason).toBe('rule');
    expect(issueAt(evaluation, eoSvieSmertePeriodeFraField.bind('s1'))?.reason).toBe('rule');
    expect(issueAt(evaluation, eoSvieSmertePeriodeTilField.bind('s1'))?.reason).toBe('rule');
    expect(issueAt(evaluation, eoOffentligeYdelserFraDatoField.bind('o1'))?.reason).toBe('rule');
    expect(issueAt(evaluation, eoOffentligeYdelserTilDatoField.bind('o1'))?.reason).toBe('rule');
  });

  it('en maskeret dato giver IKKE også en falsk «mangler»-besked', () => {
    // Readerens maskering gør en rødmarkeret værdi `undefined` for legacy-validatoren, som da konkluderer,
    // at feltet er tomt. Uden undertrykkelsen fik brugeren FIRE beskeder om én fejl: to sande kronologifejl
    // plus to usande «Fra-dato mangler»/«Til-dato mangler» om datoer, der tydeligvis står i felterne.
    const evaluation = buildReader({
      ...baseEo(),
      kravPaaTabtArbejdsfortjeneste: 'Ja',
      beregnesUdFra: 'Beregningsperiode',
      tafBeregningsperiodeFra: toISODateString('2022-04-01'),
      tafBeregningsperiodeTil: toISODateString('2022-06-30'),
      tafPerioder: [
        { id: 'taf-1', fra: toISODateString('2022-06-30'), til: toISODateString('2022-04-01'), loseFeriedage: 0 },
      ],
      svieSmertePerioder: [
        { id: 'svie-mangler', fra: undefined, til: toISODateString('2022-04-01'), tilstand: 'sygemeldt' },
      ],
      // Kontrolgruppe: en urelateret legacy-fejl, som IKKE afhænger af de maskerede datoer. Uden den
      // kunne testen ikke skelne en smal undertrykkelse fra en, der swallower enhver legacy-besked.
      uspecificeredeFerieFridage: 999,
    });
    const projection = buildErstatningsopgoerelseReaderProjection(evaluation.reader, { revision: 'r' });
    const failed = projection.snapshot.invariants.filter((i) => !i.passed);

    expect(failed.some((i) => (
      i.message === 'Fra-dato mangler'
      && i.evidence?.includes('tafPerioder[0].fra')
    ))).toBe(false);
    expect(failed.some((i) => (
      i.message === 'Til-dato mangler'
      && i.evidence?.includes('tafPerioder[0].til')
    ))).toBe(false);
    // De to ægte kronologifejl står tilbage.
    expect(failed.filter((i) => i.id.startsWith('reader_field:eo.tafPerioder'))).toHaveLength(2);
    // Undertrykkelsen skal være SMAL: den urelaterede legacy-fejl må IKKE ryge med. Uden denne
    // kontrolgruppe ville en mutation, der swallowede ENHVER legacy-besked, bestå testen – grøn af
    // tomhed frem for grøn af bevis. Assertionen går på BESKEDEN, fordi id'et for netop denne fejl
    // omskrives til `beregningsperiode:…` og derfor ikke kan skelne kilden.
    expect(failed.some((i) => i.message.includes('Uspecificerede ferie-/feriefridage overstiger'))).toBe(true);
    // En anden rækkes reelle tomhed må ikke blive skjult, selv om den har samme feltnavn.
    expect(failed.some((i) => (
      i.message === 'Fra-dato mangler'
      && i.evidence?.includes('svieSmertePerioder[0].fra')
    ))).toBe(true);
  });

  it('en ÆGTE tom dato giver stadig sin «mangler»-besked', () => {
    // Undertrykkelsen må kun ramme den maskerings-inducerede halvdel. Er feltet reelt tomt – uden nogen
    // feltfejl at maskere – er «mangler» den rigtige og eneste besked.
    const evaluation = buildReader({
      ...baseEo(),
      kravPaaTabtArbejdsfortjeneste: 'Ja',
      beregnesUdFra: 'Beregningsperiode',
      tafBeregningsperiodeFra: toISODateString('2022-04-01'),
      tafBeregningsperiodeTil: toISODateString('2022-06-30'),
      tafPerioder: [
        { id: 'taf-1', fra: toISODateString('2022-04-01'), loseFeriedage: 0 },
      ],
    });
    const projection = buildErstatningsopgoerelseReaderProjection(evaluation.reader, { revision: 'r' });
    const failed = projection.snapshot.invariants.filter((i) => !i.passed);
    expect(failed.some((i) => i.message === 'Til-dato mangler')).toBe(true);
  });

  it('dækker også beregningsperioden, SFGG-referenceperioden og indtægtstabellens dato-par', () => {
    // De tre par lå uden for den første rettelse. Beregningsperioden og SFGG er skalar-/rækkepar, mens
    // indtægtstabellens rækker er NESTET under et ansættelsesforhold og derfor skal bindes med begge
    // entity-id'er – glemmes ejeren, rammer opslaget en anden ansættelses række.
    const evaluation = buildReader({
      ...baseEo(),
      beregnesUdFra: 'Beregningsperiode',
      tafBeregningsperiodeFra: toISODateString('2022-06-30'),
      tafBeregningsperiodeTil: toISODateString('2022-04-01'),
      sfggAnsaettelsesforhold: [{
        ansaettelsesforholdId: 'sfgg-1',
        sfggBeregningskilde: undefined,
        sfggReferenceperiodeFra: toISODateString('2022-06-30'),
        sfggReferenceperiodeTil: toISODateString('2022-04-01'),
        sfggReferenceperiodeFravaersdageUdenLoen: undefined,
        sfggManuelDagssats: undefined,
        sfggManuelBeloebIHenholdTil: undefined,
        sfggManuelFoerstEfterSygeloen: 'Nej',
        sfggSatsvalg: undefined,
        sfggAlleredeBetaltBeloeb: undefined,
      }],
      loenindkomstAnsaettelsesforhold: [{
        ...createDefaultLoenindkomstAnsaettelsesforhold(),
        id: 'employment-1',
        indtaegtsoplysningerTableData: [{
          ...createEmptyStandardLoenRow('income-1'),
          col0_dag: toISODateString('2022-06-30'),
          col1_dag: toISODateString('2022-04-01'),
        }],
      }],
    });
    expect(issueAt(evaluation, eoTafBeregningsperiodeFraField.bind())?.reason).toBe('rule');
    expect(issueAt(evaluation, eoTafBeregningsperiodeTilField.bind())?.reason).toBe('rule');
    expect(issueAt(evaluation, eoSfggReferenceperiodeFraField.bind('sfgg-1'))?.reason).toBe('rule');
    expect(issueAt(evaluation, eoSfggReferenceperiodeTilField.bind('sfgg-1'))?.reason).toBe('rule');
    expect(issueAt(evaluation, eoStandardRowFields.col0_dag.bind('employment-1', 'income-1'))?.reason).toBe('rule');
    expect(issueAt(evaluation, eoStandardRowFields.col1_dag.bind('employment-1', 'income-1'))?.reason).toBe('rule');
  });

  it('feltfejlen når frem til snapshottets blokerende invarianter (samme adresse, ét sprog)', () => {
    // Navigation, rød ring, gating og reader skal læse SAMME repræsentation. Blev fejlen kun en ring,
    // ville en ugyldig periode stadig kunne fodre motoren.
    const evaluation = buildReader({
      ...baseEo(),
      vedroererPeriodeFra: toISODateString('2026-01-01'),
      vedroererPeriodeTil: toISODateString('2025-01-01'),
    });
    const projection = buildErstatningsopgoerelseReaderProjection(evaluation.reader, { revision: 'r' });

    const blocking = projection.snapshot.invariants.filter(
      (i) => !i.passed && i.id.startsWith('reader_field:eo.vedroererPeriode')
    );
    expect(blocking.length).toBe(2);
    expect(blocking.every((i) => i.blocksAuthoritativeComputation)).toBe(true);
  });
});
