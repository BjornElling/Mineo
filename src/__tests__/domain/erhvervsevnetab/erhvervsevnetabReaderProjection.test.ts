// @vitest-environment jsdom
import { buildErhvervsevnetabReaderProjection } from '../../../domain/erhvervsevnetab/erhvervsevnetabReaderProjection';
import { computeEetSnapshot } from '../../../domain/erhvervsevnetab/eetSnapshot';
import { ERHVERVSEVNETAB_INITIAL_VALUES } from '../../../domain/erhvervsevnetab/erhvervsevnetabInitialValues';
import { createErstatningsopgoerelseInitialValues } from '../../../domain/erstatningsopgoerelse/helpers/erstatningsopgoerelseInitialValues';
import { getProductionInputCatalog } from '../../../inputCore/catalog/productionCatalog';
import { createInputEvaluation } from '../../../inputCore/inputReader';
import { serializeFieldAddress } from '../../../inputCore/fieldAddress';
import type { FieldDescriptor } from '../../../inputCore/fieldDescriptor';
import {
  buildCollectionCellSpec,
  collectionLocationPrefix,
} from '../../../inputCore/react/cellSpecBuilder';
import {
  aslAfgoerelseAfgoerelseTypeField,
  aslAfgoerelseAfgoerelsesDatoField,
  aslAfgoerelseEetPctField,
  aslAfgoerelseKapDatoField,
  aslAfgoerelseKapPctField,
  aslAfgoerelseTidlKapDatoField,
  aslAfgoerelseVirkningsDatoField,
  erhvervsevnetabAslAfgoerelserCollectionRef,
} from '../../../inputCore/catalog/erhvervsevnetabDescriptors';
import { emptyAslAfgoerelseRowFields } from '../../../domain/erhvervsevnetab/eetAslAfgoerelser';
import { APP_ROUTES } from '../../../config/pageNavigation';

/** De celler, kryds-række-reglerne kan placere et issue på – samme sæt som tabellen renderer. */
const ASL_RULE_CELL_DESCRIPTORS = [
  aslAfgoerelseAfgoerelsesDatoField,
  aslAfgoerelseVirkningsDatoField,
  aslAfgoerelseEetPctField,
  aslAfgoerelseAfgoerelseTypeField,
  aslAfgoerelseKapDatoField,
  aslAfgoerelseKapPctField,
  aslAfgoerelseTidlKapDatoField,
] as const;
import {
  createEvaluationSourceToken,
  createInputRevision,
  createSettingsRevision,
} from '../../../inputCore/evaluationSource';
import { toISODateString } from '../../../types/branded';
import type {
  ErhvervsevnetabComposedValues,
  ErhvervsevnetabValues,
  FaellesAarsloenValues,
  StamdataValues,
} from '../../../schemas/formSchemas';

// Erhvervsevnetabs reader-projektion (§3.4/§5.4/§1.10): beviser at projektionen (a) kører den
// EKSISTERENDE `computeEetSnapshot` byte-identisk på reader-læste værdier (§5.4 hårdt stop mod talændring, inkl. den
// rekonstruerede aslAfgoerelser-collection), (b) fører canonical bounds-feltfejl (§1.6) på ealEetPct + rækkeceller ind
// i snapshottets per-fane-gate, og (c) bevarer den DEPENDENCY-SPECIFIKKE per-fane-blokering (§1.10): en ealEetPct-fejl
// blokerer EET-efter-EAL og differencekravet, som genbruger EAL-resultatet, mens de ASL-uafhængige faner bevares.

const catalog = getProductionInputCatalog();

const asAmount = (value: number) => ({ kind: 'number' as const, value });

const validErhvervsevnetab: ErhvervsevnetabValues = {
  ...ERHVERVSEVNETAB_INITIAL_VALUES,
  beregningsdato: toISODateString('2026-03-19'),
  koen: 'Kvinde',
  ealEetPct: 25,
  // Ren midlertidig afgørelse: ingen kapitalisering → ingen af de indbyrdes kapPct-/EET-regler udløses,
  // så det gyldige fixture har præcis tomme fieldErrors (nødvendigt for byte-identitets-goldenen).
  aslAfgoerelser: [
    {
      id: 'eet_asl_row1',
      afgoerelsesDato: toISODateString('2026-02-01'),
      virkningsDato: toISODateString('2026-02-01'),
      eetPct: 25,
      kapDato: undefined,
      kapPct: undefined,
      afgoerelseType: 'Midlertidig',
      tidlKapDato: undefined,
      fsTilbageholdtEet: 'Nej',
    },
  ],
};
const validFaellesAarsloen: FaellesAarsloenValues = {
  aslAarsloen: asAmount(600000),
  ealAarsloen: asAmount(600000),
};
const validStamdata: StamdataValues = {
  journalnr: 'J',
  advokat: 'A',
  sagsbehandler: 'S',
  skadelidte: 'Test',
  skadestype: 'Arbejdsulykke',
  skadedato: toISODateString('2024-07-01'),
  skadelidteFodselsdato: toISODateString('1980-01-01'),
};

const buildReader = (
  erhvervsevnetab: ErhvervsevnetabValues,
  faellesAarsloen: FaellesAarsloenValues,
  stamdata: StamdataValues | null
) => {
  const input = catalog.validateSettledInput({
    sections: {
      stamdata, satser: null, aarsloen: null, faellesAarsloen,
      renteberegning: null,
      varigemen: null, forsoergertab: null, erstatningsopgoerelse: null, erhvervsevnetab,
    },
    rejectedInputs: {},
  });
  const sourceToken = createEvaluationSourceToken(createInputRevision(1), createSettingsRevision(1));
  return createInputEvaluation({ input, catalog, sourceToken }).reader;
};

/** Det composed values-objekt som projektionen fodrer snapshottet med for det gyldige fixture. */
const expectedComposedValues = (): ErhvervsevnetabComposedValues => ({
  ...validErhvervsevnetab,
  ...validFaellesAarsloen,
  skadelidteFodselsdato: validStamdata.skadelidteFodselsdato,
});

describe('buildErhvervsevnetabReaderProjection', () => {
  it('kører computeEetSnapshot byte-identisk på de reader-læste værdier, inkl. aslAfgoerelser-collection (§5.4)', () => {
    const reader = buildReader(validErhvervsevnetab, validFaellesAarsloen, validStamdata);
    const projection = buildErhvervsevnetabReaderProjection(reader);

    // Golden: præcis samme snapshot som et direkte kald med de committede værdier (tomme fieldErrors, intet forlig-
    // problem). Bemærk: forlig er tomt (ingen procent/brøk), så evaluateForligsgrad giver 'empty' → ingen blokering.
    const expected = computeEetSnapshot({
      values: expectedComposedValues(),
      stamdata: {
        skadedato: validStamdata.skadedato,
        skadelidteFodselsdato: validStamdata.skadelidteFodselsdato,
        journalnr: '', advokat: '', sagsbehandler: '',
      } as StamdataValues,
      fieldErrors: { stamdata: {}, erhvervsevnetab: {}, faellesAarsloen: {} },
      forlig: {
        values: { forligAnsvarsgradProcent: undefined, forligAnsvarsgradBroek: undefined },
        dato: undefined,
        hasRejectedInput: false,
      },
    });

    expect(projection.snapshot).toEqual(expected);
    expect(projection.sourceToken).toBe(reader.sourceToken);
    expect(projection.aslAfgoerelserCommittedRows).toEqual(validErhvervsevnetab.aslAfgoerelser);
    expect(projection.values).toEqual(expectedComposedValues());
    expect(projection.snapshot.efterEal.hasBlockingErrors).toBe(false);
    expect(projection.snapshot.differencekrav.hasBlockingErrors).toBe(false);
  });

  it('fører en canonical bounds-feltfejl på ealEetPct ind på EET efter EAL og differencekrav', () => {
    // ealEetPct=150 er over bounds → readeren skjuler værdien og rejser en rød feltfejl. Kun EAL-fanen aftager
    // ealEetPct, så field-eal-eet-pct-issuet må KUN optræde dér – de øvrige faner er upåvirkede af feltet (§1.10).
    // (Løbende ydelser bærer for dette midlertidige-afgørelses-fixture kun en warning; det påvises separat.)
    const reader = buildReader(
      { ...validErhvervsevnetab, ealEetPct: 150 },
      validFaellesAarsloen,
      validStamdata
    );
    const projection = buildErhvervsevnetabReaderProjection(reader);

    expect(projection.snapshot.efterEal.issues.some((i) => i.id === 'field-eal-eet-pct')).toBe(true);
    // Løbende ydelser og kapitalisering er EAL-uafhængige; differencekrav genbruger EAL-resultatet.
    expect(projection.snapshot.loebendeYdelser.issues.some((i) => i.id === 'field-eal-eet-pct')).toBe(false);
    expect(projection.snapshot.kapitalisering.issues.some((i) => i.id === 'field-eal-eet-pct')).toBe(false);
    expect(projection.snapshot.differencekrav.issues.some((i) => i.id === 'field-eal-eet-pct')).toBe(true);
    expect(projection.snapshot.differencekrav.hasBlockingErrors).toBe(true);
    // Løbende ydelser er ikke blokeret af ealEetPct – kun en (uændret) EET-warning fra 2024-fixturet.
    expect(projection.snapshot.loebendeYdelser.hasBlockingErrors).toBe(false);
  });

  it('fører en rød rækkecelle-feltfejl (eetPct uden for bounds) ind som reader-feltfejl (§1.6)', () => {
    const reader = buildReader(
      {
        ...validErhvervsevnetab,
        aslAfgoerelser: [
          { ...validErhvervsevnetab.aslAfgoerelser[0], eetPct: 150 },
        ],
      },
      validFaellesAarsloen,
      validStamdata
    );
    const projection = buildErhvervsevnetabReaderProjection(reader);
    expect(projection.snapshot.loebendeYdelser.issues.some((i) => i.id === 'field-asl-afgoerelser')).toBe(true);
    expect(projection.snapshot.kapitalisering.issues.some((i) => i.id === 'field-asl-afgoerelser')).toBe(true);
    expect(projection.snapshot.differencekrav.issues.some((i) => i.id === 'field-asl-afgoerelser')).toBe(true);
    expect(projection.snapshot.loebendeYdelser.hasBlockingErrors).toBe(true);
  });

  it('fører ASL-årsløns-domænereglen (ikke delelig med 1.000) ind på faellesAarsloen.aslAarsloen (§1.10)', () => {
    const reader = buildReader(
      validErhvervsevnetab,
      { ...validFaellesAarsloen, aslAarsloen: asAmount(600500) },
      validStamdata
    );
    const projection = buildErhvervsevnetabReaderProjection(reader);
    // ASL-afhængige faner (løbende/kapitalisering/differencekrav) blokerer på field-aarsloen-asl.
    expect(projection.snapshot.loebendeYdelser.issues.some((i) => i.id === 'field-aarsloen-asl')).toBe(true);
    expect(projection.snapshot.kapitalisering.issues.some((i) => i.id === 'field-aarsloen-asl')).toBe(true);
  });

  it('fører ASL-afgørelsesrækkernes indbyrdes valideringsfejl (collectEetAslAfgoerelseValidationIssues) ind som field-asl-afgoerelser (§1.10)', () => {
    // En endelig afgørelse under 50 %, hvor samlet kap. % ikke svarer til EET %, udløser en row-valideringsfejl,
    // som KUN `collectEetAslAfgoerelseValidationIssues` producerer (ikke beregnermotoren). Beviser at projektionen
    // rekonstruerer rækkerne fra readeren og fører den første row-fejl ind i snapshottets field-asl-afgoerelser-kanal.
    const reader = buildReader(
      {
        ...validErhvervsevnetab,
        aslAfgoerelser: [
          {
            id: 'eet_asl_endelig',
            afgoerelsesDato: toISODateString('2026-02-01'),
            virkningsDato: toISODateString('2026-02-01'),
            eetPct: 25,
            kapDato: toISODateString('2026-03-01'),
            kapPct: 10,
            afgoerelseType: 'Endelig',
            tidlKapDato: undefined,
            fsTilbageholdtEet: 'Nej',
          },
        ],
      },
      validFaellesAarsloen,
      validStamdata
    );
    const projection = buildErhvervsevnetabReaderProjection(reader);
    expect(projection.snapshot.loebendeYdelser.issues.some((i) => i.id === 'field-asl-afgoerelser')).toBe(true);
    expect(projection.snapshot.kapitalisering.issues.some((i) => i.id === 'field-asl-afgoerelser')).toBe(true);
    // Kryds-række-reglerne er STRUKTURELLE feltissues med rigtige feltadresser – ikke en parallel
    // `${rowId}|${field}`-strengnøgle. Adressen er den, cellen og fokusnavigationen selv slår op på.
    const ruleIssues = projection.aslAfgoerelserRuleIssues.all;
    expect(ruleIssues.length).toBeGreaterThan(0);
    for (const issue of ruleIssues) {
      expect(issue.kind).toBe('field');
      expect(issue.reason).toBe('rule');
      expect(issue.field.address.section).toBe('erhvervsevnetab');
      // Adressen peger på RÆKKEN i collectionen – ikke på et top-level felt.
      expect(issue.field.address.path).toEqual([
        { kind: 'entity', collection: 'aslAfgoerelser', entityId: 'eet_asl_endelig' },
      ]);
      // Og issuet kan slås op på præcis den adresse, cellen bygger.
      expect(projection.aslAfgoerelserRuleIssues.get(serializeFieldAddress(issue.field.address)))
        .toBeDefined();
    }

    // AFGØRENDE for at brugeren faktisk SER fejlen: tabellen slår issuet op på den adresse,
    // `buildCollectionCellSpec` binder – ikke på projektionens egen binding. Divergerede de to, ville
    // markeringen forsvinde lydløst. Her hævdes, at de er identiske for netop denne collection.
    // Descriptorerne har forskellige værdityper (dato/procent/valg); adressen afhænger ikke af `T`, så de
    // behandles her som `FieldDescriptor<unknown>` udelukkende for at kunne slås op i én tabel.
    const descriptorById = new Map<string, FieldDescriptor<unknown>>(
      ASL_RULE_CELL_DESCRIPTORS.map((descriptor) =>
        [descriptor.id, descriptor as unknown as FieldDescriptor<unknown>])
    );
    for (const issue of ruleIssues) {
      const descriptor = descriptorById.get(issue.field.descriptor.id);
      expect(descriptor, `ukendt descriptor-id ${issue.field.descriptor.id}`).toBeDefined();
      const cellSpec = buildCollectionCellSpec(
        {
          collection: erhvervsevnetabAslAfgoerelserCollectionRef,
          locationPrefix: collectionLocationPrefix(erhvervsevnetabAslAfgoerelserCollectionRef),
          locationNav: { route: APP_ROUTES.erhvervsevnetab, tabKey: 'oplysninger' },
          createEmptyRow: (rowId: string) => ({ ...emptyAslAfgoerelseRowFields, id: rowId }),
        },
        { kind: 'existing', rowId: 'eet_asl_endelig' },
        descriptor!,
        0
      );
      expect(serializeFieldAddress(cellSpec.field.address))
        .toBe(serializeFieldAddress(issue.field.address));
    }
  });

  it('skift Endelig → Midlertidig bevarer kapitaliseringsfelterne og GENUDLEDER deres fejl', () => {
    // Kravet er TODELT, og begge dele er load-bearing:
    //
    //  1. Værdierne BEVARES. Et skift af afgørelsestype er et almindeligt valg, ikke en sletteknap (§7.5
    //     hovedregel). Rydnings-UNDTAGELSEN i §7.5 pkt. 2 rammer ikke her: den forudsætter, at valget gør
    //     feltet SKJULT (en `relevance`-regel på descriptoren), og kapitaliseringsfelterne forbliver
    //     synlige ved `Midlertidig`. Fejlen kan derfor ses og rettes, og så skal data blive stående.
    //  2. Fejlvurderingen FØLGER valget. Kapitaliseringsreglerne er afgørelsestype-afhængige, så de
    //     genudledes rent fra det nye snapshot – ikke fra det gamle.
    //
    // Det var netop punkt 2, auditten så: rækken blev stående med to røde kapitaliseringsfelter. Den røde
    // markering er efter reglerne KORREKT (en midlertidig afgørelse må ikke bære kapitaliseringsdata), og
    // beskeden siger præcis det. Testen pinner derfor, at fejlen er den NYE regels – og at den forsvinder
    // igen, når typen skifter tilbage.
    const rowWithType = (afgoerelseType: 'Endelig' | 'Midlertidig') => ({
      ...validErhvervsevnetab,
      aslAfgoerelser: [
        {
          id: 'eet_asl_obs001',
          // Datoerne ligger EFTER `validStamdata.skadedato` (2024-07-01), så ingen anden datoregel kommer
          // først. Testen skal isolere netop afgørelsestype-reglerne.
          afgoerelsesDato: toISODateString('2024-08-01'),
          virkningsDato: toISODateString('2024-08-01'),
          eetPct: 50,
          kapDato: toISODateString('2024-08-01'),
          kapPct: 50,
          afgoerelseType,
          tidlKapDato: undefined,
          fsTilbageholdtEet: 'Nej' as const,
        },
      ],
    });

    const messagesFor = (afgoerelseType: 'Endelig' | 'Midlertidig'): readonly string[] => {
      const projection = buildErhvervsevnetabReaderProjection(
        buildReader(rowWithType(afgoerelseType), validFaellesAarsloen, validStamdata)
      );
      // Værdierne står uændret i BEGGE tilstande – det er hele punkt 1.
      const row = projection.aslAfgoerelserCommittedRows[0];
      expect(row?.kapDato).toBe(toISODateString('2024-08-01'));
      expect(row?.kapPct).toBe(50);
      return projection.aslAfgoerelserRuleIssues.all.map((issue) => issue.message);
    };

    // Endelig 50 % med kap. 50 % er en fuldt gyldig række: ingen kapitaliseringsfejl.
    const endeligMessages = messagesFor('Endelig');
    expect(endeligMessages).not.toContain(
      'Kapitaliseringsdato må kun udfyldes ved endelig eller delvist endelig afgørelsestype.'
    );
    expect(endeligMessages).not.toContain(
      'Kapitaliseringsprocent må ikke udfyldes ved midlertidig eller ikke-valgt afgørelsestype.'
    );

    // Midlertidig med de SAMME bevarede værdier: nu gælder de to regler, så fejlene opstår – af den nye
    // afgørelsestype, ikke som en rest fra den gamle.
    const midlertidigMessages = messagesFor('Midlertidig');
    expect(midlertidigMessages).toContain(
      'Kapitaliseringsdato må kun udfyldes ved endelig eller delvist endelig afgørelsestype.'
    );
    expect(midlertidigMessages).toContain(
      'Kapitaliseringsprocent må ikke udfyldes ved midlertidig eller ikke-valgt afgørelsestype.'
    );
  });

  it('fører en canonical beregningsdato-bounds-feltfejl (før skadedato) ind som field-beregningsdato på de afhængige faner (§1.6/§1.10)', () => {
    // En beregningsdato FØR skadedato er uden for dynamisk min → readeren skjuler værdien og rejser en rød bounds-
    // feltfejl. computeEetSnapshot aftager field-beregningsdato på løbende ydelser, EET efter EAL og differencekrav.
    // (Regressionsvagt: uden denne bounds-validator på descriptoren ville en
    // out-of-range beregningsdato ville passere lydløst modsat legacy.)
    const reader = buildReader(
      { ...validErhvervsevnetab, beregningsdato: toISODateString('2020-01-01') },
      validFaellesAarsloen,
      validStamdata
    );
    const projection = buildErhvervsevnetabReaderProjection(reader);
    expect(projection.snapshot.loebendeYdelser.issues.some((i) => i.id === 'field-beregningsdato')).toBe(true);
    expect(projection.snapshot.efterEal.issues.some((i) => i.id === 'field-beregningsdato')).toBe(true);
    expect(projection.snapshot.differencekrav.issues.some((i) => i.id === 'field-beregningsdato')).toBe(true);
    expect(projection.snapshot.efterEal.hasBlockingErrors).toBe(true);
  });

  it('blokerer differencekrav ved et ugyldigt forlig (begge felter udfyldt)', () => {
    // Forlig med både procent og brøk udfyldt er 'invalid' → hele differencekrav-outputtet blokeres. Forlig deler
    // descriptor med EO-sektionen; her committes de i erstatningsopgoerelse-sektionen.
    const input = catalog.validateSettledInput({
      sections: {
        stamdata: validStamdata, satser: null, aarsloen: null, faellesAarsloen: validFaellesAarsloen,
        renteberegning: null, varigemen: null, forsoergertab: null,
        erstatningsopgoerelse: {
          ...createErstatningsopgoerelseInitialValues(),
          forligAnsvarsgradProcent: 50,
          forligAnsvarsgradBroek: '1/2',
        },
        erhvervsevnetab: validErhvervsevnetab,
      },
      rejectedInputs: {},
    });
    const sourceToken = createEvaluationSourceToken(createInputRevision(1), createSettingsRevision(1));
    const evaluation = createInputEvaluation({ input, catalog, sourceToken });
    const projection = buildErhvervsevnetabReaderProjection(evaluation.reader);
    expect(evaluation.issues.all
      .filter((issue) => issue.code === 'eo.forlig.beggeUdfyldt')).toHaveLength(2);
    expect(projection.snapshot.differencekrav.issues.some((i) => i.id === 'forlig-ansvarsgrad-invalid')).toBe(true);
    expect(projection.snapshot.differencekrav.hasBlockingErrors).toBe(true);
  });
});
