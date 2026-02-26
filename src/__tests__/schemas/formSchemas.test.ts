import {
  aarsloenSchema,
  erstatningsopgoerelseSchema,
  renteberegningSchema,
  varigeMenSchema,
  stamdataSchema,
  satserSchema,
  rentekravRowSchema,
  svieSmertePeriodeRowSchema,
  tafPeriodeRowSchema,
  ferieperiodeRowSchema,
  oevrigeKravRowSchema,
  offentligeYdelserRowSchema,
} from '../../schemas/formSchemas';
import { createErstatningsopgoerelseInitialValues } from '../../domain/erstatningsopgoerelse/erstatningsopgoerelseInitialValues';
import { buildPersistenceDefaults } from '../../config/persistenceDefaults';

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
});

// ─── erstatningsopgoerelseSchema ───────────────────────────────────────────────

describe('erstatningsopgoerelseSchema', () => {
  it('tillader deserialisering når AES-afgørelse er Ja uden tilhørende datoer', () => {
    const values = createErstatningsopgoerelseInitialValues();
    values.varigeMenAfgorelse = 'Ja';
    values.menAfgoerelseDato = undefined;
    values.midlertidigtEetAfgorelse = 'Ja';
    values.midlertidigEETAfgoerelseDato = undefined;
    values.midlertidigEETVirkningsdato = undefined;
    values.endeligtEetAfgorelse = 'Ja';
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
      skadesdato: undefined,
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
      skadesdato: undefined,
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
      skadesdato: '2023-06-15',
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
      skadesdato: '15-06-2023',
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
      skadesdato: undefined,
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
      skadesdato: undefined,
      ukendt: 'felt',
    });
    expect(result.success).toBe(false);
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
  });
});

// ─── renteberegningSchema round-trip ─────────────────────────────────────────

describe('renteberegningSchema', () => {
  it('persistenceDefaults er gyldige mod renteberegningSchema', () => {
    const defaults = buildPersistenceDefaults().renteberegning;
    const result = renteberegningSchema.safeParse(defaults);
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

  it('stripTopLevelKey: activeTab strippes fra input', () => {
    const result = renteberegningSchema.safeParse({
      activeTab: 'some-tab',
      rentekravRows: [],
    });
    expect(result.success).toBe(true);
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
      fodselsdato: undefined,
      mengrad: undefined,
      beregningsdato: undefined,
    });
    expect(result.success).toBe(true);
  });

  it('accepterer gyldige værdier', () => {
    const result = varigeMenSchema.safeParse({
      fodselsdato: '1980-06-15',
      mengrad: 0.25,
      beregningsdato: '2023-01-01',
    });
    expect(result.success).toBe(true);
  });

  it('stripTopLevelKey: activeTab strippes fra input', () => {
    const result = varigeMenSchema.safeParse({
      activeTab: 'some-tab',
      fodselsdato: undefined,
      mengrad: undefined,
      beregningsdato: undefined,
    });
    expect(result.success).toBe(true);
  });

  it('ukendt felt afvises (strict)', () => {
    const result = varigeMenSchema.safeParse({
      fodselsdato: undefined,
      mengrad: undefined,
      beregningsdato: undefined,
      ukendt: 'felt',
    });
    expect(result.success).toBe(false);
  });
});

// ─── aarsloenSchema round-trip ────────────────────────────────────────────────

describe('aarsloenSchema (round-trip)', () => {
  it('persistenceDefaults er gyldige mod aarsloenSchema', () => {
    const defaults = buildPersistenceDefaults().aarsloen;
    const result = aarsloenSchema.safeParse(defaults);
    expect(result.success).toBe(true);
  });

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
