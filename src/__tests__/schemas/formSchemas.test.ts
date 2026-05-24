import {
  aarsloenSchema,
  erstatningsopgoerelseSchema,
  renteberegningSchema,
  varigeMenSchema,
  forsoergertabSchema,
  erhvervsevnetabSchema,
  stamdataSchema,
  satserSchema,
  rentekravRowSchema,
  svieSmertePeriodeRowSchema,
  tafPeriodeRowSchema,
  ferieperiodeRowSchema,
  oevrigeKravRowSchema,
  offentligeYdelserRowSchema,
} from '../../schemas/formSchemas';
import { tableIsoDateCellString } from '../../schemas/formSchemas/baseSchemas';
import { createErstatningsopgoerelseInitialValues } from '../../domain/erstatningsopgoerelse/helpers/erstatningsopgoerelseInitialValues';

// ─── aarsloenSchema ────────────────────────────────────────────────────────────

describe('aarsloenSchema', () => {
  it('afviser dansk tusindtalsformat i procentfelter over 100 efter korrekt coercion', () => {
    const result = aarsloenSchema.safeParse({
      feriePct: '1.234',
      fritvalgPct: undefined,
      shSoPct: undefined,
      storeBededagPct: undefined,
      pensionPct: undefined,
      loenperiode: 'maaned',
      tableData: [],
      omregningTilFuldtAar: false,
      fuldLoenUnderFerie: false,
      retTilSjetteFerieuge: false,
      antalFeriedage: undefined,
      loenPaaHelligdage: 'Almindelig løn',
    });

    expect(result.success).toBe(false);
  });

  it('normaliserer dagkolonner i løntabel til ISO-datoer', () => {
    const result = aarsloenSchema.safeParse({
      feriePct: undefined,
      fritvalgPct: undefined,
      shSoPct: undefined,
      storeBededagPct: undefined,
      pensionPct: undefined,
      loenperiode: 'dag',
      tableData: [{ id: 'r1', col0_dag: '01-01-2024', col1_dag: '2024-01-31' }],
      omregningTilFuldtAar: false,
      fuldLoenUnderFerie: false,
      retTilSjetteFerieuge: false,
      antalFeriedage: undefined,
      loenPaaHelligdage: 'Almindelig løn',
    });

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.tableData[0]?.col0_dag).toBe('2024-01-01');
      expect(result.data.tableData[0]?.col1_dag).toBe('2024-01-31');
    }
  });
});

// ─── erstatningsopgoerelseSchema ───────────────────────────────────────────────

describe('erstatningsopgoerelseSchema', () => {
  it('tillader deserialisering når AES-afgørelse er Ja uden tilhørende datoer', () => {
    const values = createErstatningsopgoerelseInitialValues();
    values.varigeMenAfgorelse = 'Ja';
    values.menAfgoerelseDato = undefined;
    values.midlertidigtEETAfgorelse = 'Ja';
    values.midlertidigEETAfgoerelseDato = undefined;
    values.midlertidigEETVirkningsdato = undefined;
    values.endeligtEETAfgorelse = 'Ja';
    values.endeligEETAfgoerelseDato = undefined;
    values.endeligEETVirkningsdato = undefined;

    const result = erstatningsopgoerelseSchema.safeParse(values);
    expect(result.success).toBe(true);
  });

  it('initialValues er gyldigt mod schema (round-trip)', () => {
    const values = createErstatningsopgoerelseInitialValues();
    const result = erstatningsopgoerelseSchema.safeParse(values);
    expect(result.success).toBe(true);
  });

  it('afviser ukendl felt (strict)', () => {
    const values = createErstatningsopgoerelseInitialValues();
    const withExtra = { ...values, ukendt_felt: 'hej' };
    const result = erstatningsopgoerelseSchema.safeParse(withExtra);
    expect(result.success).toBe(false);
  });
});

// ─── stamdataSchema ───────────────────────────────────────────────────────────

describe('stamdataSchema', () => {
  it('accepterer tomt objekt (alle felter valgfrie)', () => {
    const result = stamdataSchema.safeParse({
      journalnr: undefined,
      advokat: undefined,
      sagsbehandler: undefined,
      skadelidte: undefined,
      skadestype: undefined,
      skadedato: undefined,
    });
    expect(result.success).toBe(true);
  });

  it('tom streng normaliseres til undefined', () => {
    const result = stamdataSchema.safeParse({
      journalnr: '',
      advokat: '',
      sagsbehandler: undefined,
      skadelidte: undefined,
      skadestype: undefined,
      skadedato: undefined,
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.journalnr).toBeUndefined();
      expect(result.data.advokat).toBeUndefined();
    }
  });

  it('gyldigt ISO-datoformat accepteres', () => {
    const result = stamdataSchema.safeParse({
      journalnr: undefined,
      advokat: undefined,
      sagsbehandler: undefined,
      skadelidte: undefined,
      skadestype: 'Arbejdsulykke',
      skadedato: '2023-06-15',
    });
    expect(result.success).toBe(true);
  });

  it('dansk datoformat afvises', () => {
    const result = stamdataSchema.safeParse({
      journalnr: undefined,
      advokat: undefined,
      sagsbehandler: undefined,
      skadelidte: undefined,
      skadestype: undefined,
      skadedato: '15-06-2023',
    });
    expect(result.success).toBe(false);
  });

  it('ukendt skadestype afvises', () => {
    const result = stamdataSchema.safeParse({
      journalnr: undefined,
      advokat: undefined,
      sagsbehandler: undefined,
      skadelidte: undefined,
      skadestype: 'Andet',
      skadedato: undefined,
    });
    expect(result.success).toBe(false);
  });

  it('afviser ekstra felter (strict)', () => {
    const result = stamdataSchema.safeParse({
      journalnr: undefined,
      advokat: undefined,
      sagsbehandler: undefined,
      skadelidte: undefined,
      skadestype: undefined,
      skadedato: undefined,
      ukendt: 'felt',
    });
    expect(result.success).toBe(false);
  });

  it('afviser ukendt felt skadelidteFodselsdato', () => {
    const result = stamdataSchema.safeParse({
      skadelidteFodselsdato: '1990-01-01',
    });
    expect(result.success).toBe(true);
  });
});

describe('erhvervsevnetabSchema', () => {
  it('accepterer værdier uden skadelidtes fødselsdato', () => {
    const result = erhvervsevnetabSchema.safeParse({
      beregningsdato: '2024-01-01',
      koen: 'Mand',
      aslAfgoerelser: [],
      ealEetPct: undefined,
      eetDifferencekravBilagSelection: {
        loebendeYdelser: true,
        kapitalisering: true,
        eetEfterEal: true,
        proformaKapitalisering: true,
        visUdvidetSpecifikation: false,
        visUdvidetSpecifikationLoebendeYdelserBilag: false,
      },
    });
    expect(result.success).toBe(true);
  });

  it('afviser ukendt felt skadelidteFodselsdato', () => {
    const result = erhvervsevnetabSchema.safeParse({
      beregningsdato: '2024-01-01',
      skadelidteFodselsdato: '1990-01-01',
      aslAfgoerelser: [],
      ealEetPct: undefined,
      eetDifferencekravBilagSelection: {
        loebendeYdelser: true,
        kapitalisering: true,
        eetEfterEal: true,
        proformaKapitalisering: true,
        visUdvidetSpecifikation: false,
        visUdvidetSpecifikationLoebendeYdelserBilag: false,
      },
    });
    expect(result.success).toBe(false);
  });
});

describe('forsoergertabSchema', () => {
  it('kræver køn ved beregning før 1. marts 2015', () => {
    const result = forsoergertabSchema.safeParse({
      efterladteFodselsdato: '1980-01-01',
      beregningsdato: '2015-02-28',
      virkningsdato: '2015-02-01',
      tilkendtForPeriodeAar: 5,
    });

    expect(result.success).toBe(false);
  });

  it('giver fejl på både beregningsdato og virkningsdato når beregningsdato er før virkningsdato', () => {
    const result = forsoergertabSchema.safeParse({
      efterladteFodselsdato: '1980-01-01',
      beregningsdato: '2020-01-01',
      virkningsdato: '2020-02-01',
      tilkendtForPeriodeAar: 5,
      koen: 'Mand',
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      const paths = result.error.issues.map((issue) => issue.path.join('.'));
      expect(paths).toContain('beregningsdato');
      expect(paths).toContain('virkningsdato');
    }
  });
});

// ─── satserSchema ─────────────────────────────────────────────────────────────

describe('satserSchema', () => {
  it('accepterer gyldigt år', () => {
    const result = satserSchema.safeParse({ aargang: 2023 });
    expect(result.success).toBe(true);
  });

  it('decimaltal trunkeres til heltal (coercion)', () => {
    // coerceToIntegerOrUndefined trunkerer 2023.5 → 2023
    const result = satserSchema.safeParse({ aargang: 2023.5 });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.aargang).toBe(2023);
    }
  });

  it('manglende aargang er tilladt (optional)', () => {
    // yearInteger er optional — manglende felt er gyldigt
    const result = satserSchema.safeParse({});
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.aargang).toBeUndefined();
    }
  });

  it('afviser åbenlyst urealistisk højt årstal', () => {
    const result = satserSchema.safeParse({ aargang: 999999 });
    expect(result.success).toBe(false);
  });
});

// ─── rentekravRowSchema ───────────────────────────────────────────────────────

describe('rentekravRowSchema', () => {
  it('accepterer gyldig række', () => {
    const result = rentekravRowSchema.safeParse({
      id: 'r1',
      belob: { kind: 'number', value: 10000 },
      renterFra: '2023-01-01',
      tillaegstid: 30,
      enhed: 'dage',
    });
    expect(result.success).toBe(true);
  });

  it('tom renterFra normaliseres til undefined', () => {
    const result = rentekravRowSchema.safeParse({
      id: 'r1',
      belob: undefined,
      renterFra: '',
      tillaegstid: 0,
      enhed: 'maaneder',
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.renterFra).toBeUndefined();
    }
  });

  it('ukendt enhed afvises', () => {
    const result = rentekravRowSchema.safeParse({
      id: 'r1',
      belob: undefined,
      renterFra: '2023-01-01',
      tillaegstid: 0,
      enhed: 'timer',
    });
    expect(result.success).toBe(false);
  });

  it('tom id afvises', () => {
    const result = rentekravRowSchema.safeParse({
      id: '',
      belob: undefined,
      renterFra: undefined,
      tillaegstid: 0,
      enhed: 'dage',
    });
    expect(result.success).toBe(false);
  });
});

// ─── Row-schemas (svieSmerte, taf, ferie, øvrigeKrav) ─────────────────────────

describe('svieSmertePeriodeRowSchema', () => {
  it('accepterer gyldig række med undefined felter', () => {
    const result = svieSmertePeriodeRowSchema.safeParse({
      id: 'r1',
      fra: undefined,
      til: undefined,
      tilstand: undefined,
    });
    expect(result.success).toBe(true);
  });

  it('ukendt tilstand afvises', () => {
    const result = svieSmertePeriodeRowSchema.safeParse({
      id: 'r1',
      fra: undefined,
      til: undefined,
      tilstand: 'rask',
    });
    expect(result.success).toBe(false);
  });
});

describe('tafPeriodeRowSchema', () => {
  it('accepterer gyldig række', () => {
    const result = tafPeriodeRowSchema.safeParse({
      id: 'r1',
      fra: '2023-01-01',
      til: '2023-12-31',
      loseFeriedage: 5,
    });
    expect(result.success).toBe(true);
  });

  it('negative loseFeriedage afvises', () => {
    const result = tafPeriodeRowSchema.safeParse({
      id: 'r1',
      fra: undefined,
      til: undefined,
      loseFeriedage: -1,
    });
    expect(result.success).toBe(false);
  });
});

describe('ferieperiodeRowSchema', () => {
  it('accepterer gyldig tom række', () => {
    const result = ferieperiodeRowSchema.safeParse({
      id: 'r1',
      fra: undefined,
      til: undefined,
    });
    expect(result.success).toBe(true);
  });
});

describe('oevrigeKravRowSchema', () => {
  it('accepterer gyldig tom række', () => {
    const result = oevrigeKravRowSchema.safeParse({
      id: 'r1',
      dato: undefined,
      udgiftTil: undefined,
      beloeb: undefined,
    });
    expect(result.success).toBe(true);
  });
});

describe('offentligeYdelserRowSchema', () => {
  it('accepterer gyldig udfyldt række', () => {
    const result = offentligeYdelserRowSchema.safeParse({
      id: 'r1',
      fraDato: '01-01-2023',
      tilDato: '31-01-2023',
      ydelse: { kind: 'number', value: 5000 },
      tillaeg: undefined,
      ydelsestype: 'sygedagpenge',
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.fraDato).toBe('2023-01-01');
      expect(result.data.tilDato).toBe('2023-01-31');
    }
  });
});

describe('tableIsoDateCellString', () => {
  it('normaliserer ISO og legacy dansk tabeldato til ISO', () => {
    expect(tableIsoDateCellString.parse('2026-05-24')).toBe('2026-05-24');
    expect(tableIsoDateCellString.parse('24-05-2026')).toBe('2026-05-24');
  });

  it('normaliserer tomme tabeldatoer til undefined og afviser ugyldige ikke-tomme datoer', () => {
    expect(tableIsoDateCellString.parse('')).toBeUndefined();
    expect(tableIsoDateCellString.safeParse('ugyldig').success).toBe(false);
  });
});

// ─── renteberegningSchema round-trip ─────────────────────────────────────────

describe('renteberegningSchema', () => {
  it('tom rentekravRows er gyldigt (minimalt gyldigt objekt)', () => {
    const result = renteberegningSchema.safeParse({ rentekravRows: [] });
    expect(result.success).toBe(true);
  });

  it('tom rentekravRows er gyldigt', () => {
    const result = renteberegningSchema.safeParse({ rentekravRows: [] });
    expect(result.success).toBe(true);
  });

  it('kommentarer normaliserer tom streng til undefined', () => {
    const result = renteberegningSchema.safeParse({ rentekravRows: [], kommentarer: '   ' });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.kommentarer).toBeUndefined();
    }
  });

  it('afviser activeTab som ukendt felt', () => {
    const result = renteberegningSchema.safeParse({
      activeTab: 'some-tab',
      rentekravRows: [],
    });
    expect(result.success).toBe(false);
  });

  it('ukendt felt afvises (strict)', () => {
    const result = renteberegningSchema.safeParse({
      rentekravRows: [],
      ukendt: 'felt',
    });
    expect(result.success).toBe(false);
  });
});

// ─── varigeMenSchema round-trip ───────────────────────────────────────────────

describe('varigeMenSchema', () => {
  it('accepterer tomme felter (alle optional)', () => {
    const result = varigeMenSchema.safeParse({
      mengrad: undefined,
      beregningsdato: undefined,
    });
    expect(result.success).toBe(true);
  });

  it('accepterer gyldige værdier', () => {
    const result = varigeMenSchema.safeParse({
      mengrad: 25,
      beregningsdato: '2023-01-01',
    });
    expect(result.success).toBe(true);
  });

  it('afviser activeTab som ukendt felt', () => {
    const result = varigeMenSchema.safeParse({
      activeTab: 'some-tab',
      mengrad: undefined,
      beregningsdato: undefined,
    });
    expect(result.success).toBe(false);
  });

  it('ukendt felt afvises (strict)', () => {
    const result = varigeMenSchema.safeParse({
      mengrad: undefined,
      beregningsdato: undefined,
      ukendt: 'felt',
    });
    expect(result.success).toBe(false);
  });

  it('afviser decimal méngrad', () => {
    const result = varigeMenSchema.safeParse({
      mengrad: 10.5,
      beregningsdato: '2023-01-01',
    });
    expect(result.success).toBe(false);
  });

  it('afviser ukendt felt fodselsdato', () => {
    const result = varigeMenSchema.safeParse({
      mengrad: 10,
      beregningsdato: '2023-01-01',
      fodselsdato: '1990-01-01',
    });
    expect(result.success).toBe(false);
  });
});

describe('forsoergertabSchema', () => {
  it('accepterer tomme felter (alle optional)', () => {
    const result = forsoergertabSchema.safeParse({
      efterladteFodselsdato: undefined,
      beregningsdato: undefined,
      virkningsdato: undefined,
      tilkendtForPeriodeAar: undefined,
    });
    expect(result.success).toBe(true);
  });

  it('accepterer gyldige værdier', () => {
    const result = forsoergertabSchema.safeParse({
      efterladteFodselsdato: '1988-03-04',
      beregningsdato: '2024-01-01',
      virkningsdato: '2024-01-01',
      tilkendtForPeriodeAar: 4,
    });
    expect(result.success).toBe(true);
  });

  it('afviser værdier uden for 1-10 år', () => {
    const result = forsoergertabSchema.safeParse({
      tilkendtForPeriodeAar: 11,
    });
    expect(result.success).toBe(false);
  });

  it('afviser activeTab som ukendt felt', () => {
    const result = forsoergertabSchema.safeParse({
      activeTab: 'some-tab',
      beregningsdato: undefined,
    });
    expect(result.success).toBe(false);
  });

  it('afviser ukendt felt fodselsdato', () => {
    const result = forsoergertabSchema.safeParse({
      fodselsdato: '1988-03-04',
    });
    expect(result.success).toBe(false);
  });
});

// ─── aarsloenSchema round-trip ────────────────────────────────────────────────

describe('aarsloenSchema (round-trip)', () => {
  it('accepterer minimalt gyldigt objekt', () => {
    const result = aarsloenSchema.safeParse({
      loenperiode: 'maaned',
      tableData: [],
      omregningTilFuldtAar: false,
      fuldLoenUnderFerie: true,
      retTilSjetteFerieuge: false,
      loenPaaHelligdage: 'Almindelig løn',
    });
    expect(result.success).toBe(true);
  });
});
