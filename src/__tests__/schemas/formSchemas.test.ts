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
  faellesAarsloenSchema,
  aslAfgoerelseRowSchema,
  svieSmertePeriodeRowSchema,
  tafPeriodeRowSchema,
  ferieperiodeRowSchema,
  oevrigeKravRowSchema,
  offentligeYdelserRowSchema,
} from '../../schemas/formSchemas';
import { tableIsoDateCellString } from '../../schemas/formSchemas/baseSchemas';
import { createErstatningsopgoerelseInitialValues, createDefaultLoenindkomstAnsaettelsesforhold } from '../../domain/erstatningsopgoerelse/helpers/erstatningsopgoerelseInitialValues';
import { ERHVERVSEVNETAB_INITIAL_VALUES } from '../../domain/erhvervsevnetab/erhvervsevnetabInitialValues';
import { FORSOERGERTAB_INITIAL_VALUES } from '../../domain/forsoergertab/forsoergertabInitialValues';
import { FAELLES_AARSLOEN_INITIAL_VALUES } from '../../domain/aslEalAarsloen/faellesAarsloenInitialValues';
import { createRenteberegningInitialValues } from '../../domain/renteberegning/renteberegningInitialValues';
import { VARIGE_MEN_INITIAL_VALUES } from '../../domain/varigemen/varigeMenInitialValues';
import { STAMDATA_INITIAL_VALUES } from '../../domain/stamdata/stamdataInitialValues';
import { isAslAfgoerelseRowEmpty } from '../../domain/erhvervsevnetab/eetAslAfgoerelser';
import { toISODateString } from '../../types/branded';

// ─── aarsloenSchema ────────────────────────────────────────────────────────────

describe('aarsloenSchema', () => {
  it('bevarer en parsebar procent over 100 som canonical værdi', () => {
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

    expect(result.success).toBe(true);
    if (result.success) expect(result.data.feriePct).toBe(1234);
  });

  it('normaliserer dagkolonner i løntabel til ISO-datoer', () => {
    const result = aarsloenSchema.safeParse({
      feriePct: undefined,
      fritvalgPct: undefined,
      shSoPct: undefined,
      storeBededagPct: undefined,
      pensionPct: undefined,
      loenperiode: 'dag',
      tableData: [{ id: 'r1', col0_dag: toISODateString('2024-01-01'), col1_dag: toISODateString('2024-01-31') }],
      omregningTilFuldtAar: false,
      fuldLoenUnderFerie: false,
      retTilSjetteFerieuge: false,
      antalFeriedage: undefined,
      loenPaaHelligdage: 'Almindelig løn',
    });

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.tableData[0]?.col0_dag).toBe(toISODateString('2024-01-01'));
      expect(result.data.tableData[0]?.col1_dag).toBe(toISODateString('2024-01-31'));
    }
  });
});

// ─── tillaegAngivesSom (Beløb-tilstand) ──────────────────────────────────────────

describe('tillaegAngivesSom og Beløb-tilstandens rækkefelter', () => {
  it('aarsloen: en ældre .eo uden tillaegAngivesSom loades med default "procent" (forward/backward-tolerant)', () => {
    const result = aarsloenSchema.safeParse({
      loenperiode: 'maaned',
      tableData: [],
      antalFeriedage: undefined,
    });
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.tillaegAngivesSom).toBe('procent');
  });

  it('aarsloen: round-trip bevarer både satser, tillaegAngivesSom og de direkte tillægsbeløb', () => {
    const result = aarsloenSchema.safeParse({
      feriePct: 12.5,
      tillaegAngivesSom: 'beloeb',
      loenperiode: 'maaned',
      tableData: [{
        id: 'r1',
        col0_maaned: '5',
        col1_maaned: '2016',
        col2: { kind: 'number', value: 25000 },
        fpFvShSoBeloeb: { kind: 'number', value: 4218 },
        pensionBeloeb: { kind: 'number', value: 2581.92 },
      }],
      antalFeriedage: undefined,
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.tillaegAngivesSom).toBe('beloeb');
      expect(result.data.feriePct).toBe(12.5);
      expect(result.data.tableData[0]?.fpFvShSoBeloeb).toEqual({ kind: 'number', value: 4218 });
      expect(result.data.tableData[0]?.pensionBeloeb).toEqual({ kind: 'number', value: 2581.92 });
    }
  });

  it('aarsloen: en ældre løntabel-række uden de nye tillægsbeløbsfelter loades uændret', () => {
    const result = aarsloenSchema.safeParse({
      loenperiode: 'maaned',
      tableData: [{ id: 'r1', col0_maaned: '1', col1_maaned: '2024', col2: { kind: 'number', value: 30000 } }],
      antalFeriedage: undefined,
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.tableData[0]?.fpFvShSoBeloeb).toBeUndefined();
      expect(result.data.tableData[0]?.pensionBeloeb).toBeUndefined();
    }
  });

  it('EO: nyt ansættelsesforhold defaulter til tillaegAngivesSom "procent"', () => {
    const af = createDefaultLoenindkomstAnsaettelsesforhold();
    expect(af.tillaegAngivesSom).toBe('procent');
  });

  it('EO: en ældre AF uden tillaegAngivesSom loades med default "procent"', () => {
    const initial = createErstatningsopgoerelseInitialValues();
    const af = createDefaultLoenindkomstAnsaettelsesforhold();
    const { tillaegAngivesSom: _omit, ...afUdenFelt } = af;
    const parsed = erstatningsopgoerelseSchema.safeParse({
      ...initial,
      loenindkomstAnsaettelsesforhold: [afUdenFelt],
    });
    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect(parsed.data.loenindkomstAnsaettelsesforhold[0]?.tillaegAngivesSom).toBe('procent');
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

  it('udfylder konservative defaults ved load af ældre EO-data', () => {
    const values = createErstatningsopgoerelseInitialValues();
    const legacyAnsaettelsesforhold = {
      id: 'legacy-ansaettelse-1',
      loenPaaHelligdage: 'Almindelig løn',
      harOverenskomst: undefined,
      ansatPaaSkadestidspunktet: undefined,
      ansaettelsesforholdOphoert: undefined,
      loenperiode: undefined,
      fuldLoenUnderFerie: undefined,
      harAnciennitetstillaegEfterSkadedatoen: undefined,
      anciennitetstillaegSatsAngivesPer: undefined,
    };
    const legacy = {
      ...values,
      varigeMenAfgorelse: undefined,
      verserendeKlageMen: undefined,
      midlertidigtEETAfgorelse: undefined,
      endeligtEETAfgorelse: undefined,
      verserendeKlageEet: undefined,
      tidligereSsMax: undefined,
      svieSmerteDelvisSygemeldingSats: undefined,
      beregnesUdFra: undefined,
      erstatningsopgoerelseAfsluttesMed: undefined,
      eoBilagSelection: {},
      loenindkomstAnsaettelsesforhold: [legacyAnsaettelsesforhold],
    };

    const result = erstatningsopgoerelseSchema.safeParse(legacy);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.varigeMenAfgorelse).toBe('Nej');
      expect(result.data.svieSmerteDelvisSygemeldingSats).toBe('halv');
      expect(result.data.beregnesUdFra).toBe('Beregningsperiode');
      expect(result.data.erstatningsopgoerelseAfsluttesMed).toBe('Bekræftet godkendt');
      expect(result.data.eoBilagSelection.shDage).toBe(false);
      expect(result.data.loenindkomstAnsaettelsesforhold[0]?.harOverenskomst).toBe(false);
      expect(result.data.loenindkomstAnsaettelsesforhold[0]?.loenperiode).toBe('maaned');
      expect(result.data.loenindkomstAnsaettelsesforhold[0]?.anciennitetstillaegSatsAngivesPer).toBe('Måned');
    }
  });

  it('materialiserer fulde objekt-defaults når eoBilagSelection og eoAngivetLoenLoenudvikling helt mangler', () => {
    // Zod 4 .default() returnerer default-værdien direkte uden at re-parse den. Defaulten på disse
    // to objekt-felter udledes derfor via underschemaets egne parse({})-defaults – IKKE en tom .default({}),
    // som ville give et tomt objekt og dermed stiltiende tabe alle underfelter ved load af en fil der
    // mangler feltet. Denne test fanger den regression.
    const {
      eoBilagSelection: _omitBilag,
      eoAngivetLoenLoenudvikling: _omitAngivetLoen,
      ...withoutDefaultedObjects
    } = createErstatningsopgoerelseInitialValues();

    const result = erstatningsopgoerelseSchema.safeParse(withoutDefaultedObjects);
    expect(result.success).toBe(true);
    if (result.success) {
      // Alle 8 bilag-flag skal være til stede med deres felt-defaults.
      expect(result.data.eoBilagSelection).toEqual({
        opgoerelse: true,
        loenindkomst: true,
        offentligeYdelser: true,
        midlertidigEet: true,
        shDage: false,
        regulering: true,
        okSatser: true,
        sygeferiegodtgoerelse: false,
      });
      // Underschemaet skal være fuldt udfyldt (ikke et tomt objekt).
      expect(result.data.eoAngivetLoenLoenudvikling.anciennitetstillaegSatsAngivesPer).toBe('Måned');
      expect(result.data.eoAngivetLoenLoenudvikling.harAnciennitetstillaegEfterSkadedatoen).toBe(false);
      expect(result.data.eoAngivetLoenLoenudvikling.loenudviklingManuelTableData).toEqual([]);
      expect(result.data.eoAngivetLoenLoenudvikling.overenskomstFilter).toEqual({});
    }
  });

  it('afviser bogstav-input i offentlige løntrin med dansk heltalsbesked', () => {
    const values = createErstatningsopgoerelseInitialValues();
    const result = erstatningsopgoerelseSchema.safeParse({
      ...values,
      eoAngivetLoenLoenudvikling: {
        ...values.eoAngivetLoenLoenudvikling,
        offentligLoenTrin: 'abc',
      },
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues.some((issue) => issue.message === 'Skal være et heltal')).toBe(true);
    }
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
      skadedato: toISODateString('2023-06-15'),
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

  it('accepterer skadelidteFodselsdato som gyldigt felt', () => {
    const result = stamdataSchema.safeParse({
      skadelidteFodselsdato: toISODateString('1990-01-01'),
    });
    expect(result.success).toBe(true);
  });

  it('normaliserer null i tekstfelter til undefined', () => {
    const result = stamdataSchema.safeParse({
      journalnr: null,
      advokat: null,
      sagsbehandler: null,
      skadelidte: null,
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.journalnr).toBeUndefined();
      expect(result.data.advokat).toBeUndefined();
    }
  });

  it('initialValues materialiseres til undefined for tomme tekstfelter', () => {
    const result = stamdataSchema.safeParse(STAMDATA_INITIAL_VALUES);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.journalnr).toBeUndefined();
      expect(result.data.skadelidte).toBeUndefined();
    }
  });

  it('bevarer skadedato før fødselsdato som canonical input til den afledte issue-model', () => {
    const result = stamdataSchema.safeParse({
      skadelidteFodselsdato: toISODateString('1990-01-01'),
      skadedato: toISODateString('1989-12-31'),
    });
    expect(result.success).toBe(true);
  });
});

describe('erhvervsevnetabSchema', () => {
  it('initialValues er gyldigt mod schema (round-trip)', () => {
    const result = erhvervsevnetabSchema.safeParse(ERHVERVSEVNETAB_INITIAL_VALUES);
    expect(result.success).toBe(true);
  });

  it('accepterer værdier uden skadelidtes fødselsdato', () => {
    const result = erhvervsevnetabSchema.safeParse({
      beregningsdato: toISODateString('2024-01-01'),
      koen: 'Mand',
      aslAfgoerelser: [],
      ealEetPct: undefined,
      eetDifferencekravBilagSelection: {
        loebendeYdelser: true,
        kapitalisering: true,
        eetEfterEal: true,
        proformaKapitalisering: true,
    merErstatningPensionsalder: false,
        visUdvidetSpecifikation: false,
        visUdvidetSpecifikationLoebendeYdelserBilag: false,
      },
    });
    expect(result.success).toBe(true);
  });

  it('afviser ukendt felt skadelidteFodselsdato', () => {
    const result = erhvervsevnetabSchema.safeParse({
      beregningsdato: toISODateString('2024-01-01'),
      skadelidteFodselsdato: toISODateString('1990-01-01'),
      aslAfgoerelser: [],
      ealEetPct: undefined,
      eetDifferencekravBilagSelection: {
        loebendeYdelser: true,
        kapitalisering: true,
        eetEfterEal: true,
        proformaKapitalisering: true,
    merErstatningPensionsalder: false,
        visUdvidetSpecifikation: false,
        visUdvidetSpecifikationLoebendeYdelserBilag: false,
      },
    });
    expect(result.success).toBe(false);
  });

  it('afviser ugyldige kønsværdier', () => {
    expect(erhvervsevnetabSchema.safeParse({ ...ERHVERVSEVNETAB_INITIAL_VALUES, koen: 'mand' }).success).toBe(false);
    expect(erhvervsevnetabSchema.safeParse({ ...ERHVERVSEVNETAB_INITIAL_VALUES, koen: 'Andet' }).success).toBe(false);
  });

  it('normaliserer tomt køn til undefined uden at droppe sektionen (kanonisk optional-enum-mønster)', () => {
    const result = erhvervsevnetabSchema.safeParse({ ...ERHVERVSEVNETAB_INITIAL_VALUES, koen: '' });
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.koen).toBeUndefined();
  });
});

describe('aslAfgoerelseRowSchema', () => {
  const baseRow = {
    id: 'r1',
    afgoerelsesDato: undefined,
    virkningsDato: undefined,
    eetPct: undefined,
    kapDato: undefined,
    kapPct: undefined,
    afgoerelseType: undefined,
    tidlKapDato: undefined,
  };

  it('sætter fsTilbageholdtEet til Nej når feltet mangler', () => {
    const result = aslAfgoerelseRowSchema.safeParse(baseRow);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.fsTilbageholdtEet).toBe('Nej');
    }
  });

  it('bevarer ikke-delelige procentværdier canonical til den afledte domænevalidator', () => {
    expect(aslAfgoerelseRowSchema.safeParse({ ...baseRow, eetPct: 7.5 }).success).toBe(true);
    expect(aslAfgoerelseRowSchema.safeParse({ ...baseRow, eetPct: 7 }).success).toBe(true);
    expect(aslAfgoerelseRowSchema.safeParse({ ...baseRow, kapPct: 12.5 }).success).toBe(true);
    expect(aslAfgoerelseRowSchema.safeParse({ ...baseRow, kapPct: 12 }).success).toBe(true);
  });

  it('behandler explicit 0 som udfyldt committed procentværdi', () => {
    expect(aslAfgoerelseRowSchema.safeParse({ ...baseRow, eetPct: 0, kapPct: 0 }).success).toBe(true);
    expect(isAslAfgoerelseRowEmpty({ ...baseRow, eetPct: 0, fsTilbageholdtEet: 'Nej' })).toBe(false);
    expect(isAslAfgoerelseRowEmpty({ ...baseRow, kapPct: 0, fsTilbageholdtEet: 'Nej' })).toBe(false);
  });

  it('normaliserer tom afgoerelseType til undefined uden at droppe rækken', () => {
    const result = aslAfgoerelseRowSchema.safeParse({ ...baseRow, afgoerelseType: '' });
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.afgoerelseType).toBeUndefined();
  });
});

describe('forsoergertabSchema canonical input', () => {
  it('bevarer manglende køn ved beregning før 1. marts 2015 til den afledte validator', () => {
    const result = forsoergertabSchema.safeParse({
      efterladteFodselsdato: toISODateString('1980-01-01'),
      beregningsdato: toISODateString('2015-02-28'),
      virkningsdato: toISODateString('2015-02-01'),
      tilkendtForPeriodeAar: 5,
    });

    expect(result.success).toBe(true);
  });

  it('bevarer beregningsdato før virkningsdato til den afledte validator', () => {
    const result = forsoergertabSchema.safeParse({
      efterladteFodselsdato: toISODateString('1980-01-01'),
      beregningsdato: toISODateString('2020-01-01'),
      virkningsdato: toISODateString('2020-02-01'),
      tilkendtForPeriodeAar: 5,
      koen: 'Mand',
    });

    expect(result.success).toBe(true);
  });
});

describe('faellesAarsloenSchema', () => {
  it('initialValues og positive beløb er gyldige', () => {
    expect(faellesAarsloenSchema.safeParse(FAELLES_AARSLOEN_INITIAL_VALUES).success).toBe(true);
    expect(faellesAarsloenSchema.safeParse({
      aslAarsloen: { kind: 'number', value: 500000 },
      ealAarsloen: { kind: 'number', value: 600000 },
    }).success).toBe(true);
  });

  it('bevarer nul og negative beløb canonical, men afviser ukendte felter', () => {
    expect(faellesAarsloenSchema.safeParse({ aslAarsloen: { kind: 'number', value: 0 } }).success).toBe(true);
    expect(faellesAarsloenSchema.safeParse({ ealAarsloen: { kind: 'number', value: -1 } }).success).toBe(true);
    expect(faellesAarsloenSchema.safeParse({ ukendt: 'felt' }).success).toBe(false);
  });
});

// ─── satserSchema ─────────────────────────────────────────────────────────────

describe('satserSchema', () => {
  it('accepterer gyldigt år', () => {
    const result = satserSchema.safeParse({ aargang: 2023 });
    expect(result.success).toBe(true);
  });

  it('decimaltal afvises uden implicit trunkering', () => {
    const result = satserSchema.safeParse({ aargang: 2023.5 });
    expect(result.success).toBe(false);
  });

  it('manglende aargang er tilladt (optional)', () => {
    // Heltalssyntaksen er optional – manglende felt er gyldigt.
    const result = satserSchema.safeParse({});
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.aargang).toBeUndefined();
    }
  });

  it('bevarer et sikkert heltal uden at håndhæve årstal-bounds', () => {
    const result = satserSchema.safeParse({ aargang: 999999 });
    expect(result.success).toBe(true);
  });
});

// ─── rentekravRowSchema ───────────────────────────────────────────────────────

describe('rentekravRowSchema', () => {
  it('accepterer gyldig række', () => {
    const result = rentekravRowSchema.safeParse({
      id: 'r1',
      belob: { kind: 'number', value: 10000 },
      renterFra: toISODateString('2023-01-01'),
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
      renterFra: toISODateString('2023-01-01'),
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
      fra: toISODateString('2023-01-01'),
      til: toISODateString('2023-12-31'),
      loseFeriedage: 5,
    });
    expect(result.success).toBe(true);
  });

  it('negative løse feriedage bevares canonical til den afledte validator', () => {
    const result = tafPeriodeRowSchema.safeParse({
      id: 'r1',
      fra: undefined,
      til: undefined,
      loseFeriedage: -1,
    });
    expect(result.success).toBe(true);
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
      fraDato: toISODateString('2023-01-01'),
      tilDato: toISODateString('2023-01-31'),
      ydelse: { kind: 'number', value: 5000 },
      tillaeg: undefined,
      ydelsestype: 'sygedagpenge',
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.fraDato).toBe(toISODateString('2023-01-01'));
      expect(result.data.tilDato).toBe(toISODateString('2023-01-31'));
    }
  });
});

describe('tableIsoDateCellString', () => {
  it('normaliserer ISO og legacy dansk tabeldato til ISO', () => {
    expect(tableIsoDateCellString.parse(toISODateString('2026-05-24'))).toBe(toISODateString('2026-05-24'));
    expect(tableIsoDateCellString.parse('24-05-2026')).toBe(toISODateString('2026-05-24'));
  });

  it('normaliserer tomme tabeldatoer til undefined og afviser ugyldige ikke-tomme datoer', () => {
    expect(tableIsoDateCellString.parse('')).toBeUndefined();
    expect(tableIsoDateCellString.safeParse('ugyldig').success).toBe(false);
  });
});

// ─── renteberegningSchema round-trip ─────────────────────────────────────────

describe('renteberegningSchema', () => {
  it('tom rentekravRows bevares som gyldig canonical collection', () => {
    const result = renteberegningSchema.safeParse({ rentekravRows: [] });
    expect(result.success).toBe(true);
  });

  it('initialValues er gyldigt mod schema (round-trip)', () => {
    const result = renteberegningSchema.safeParse(createRenteberegningInitialValues());
    expect(result.success).toBe(true);
  });

  it('kommentarer normaliserer tom streng til undefined', () => {
    const result = renteberegningSchema.safeParse({
      ...createRenteberegningInitialValues(),
      kommentarer: '   ',
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.kommentarer).toBeUndefined();
    }
  });

  it('afviser activeTab som ukendt felt', () => {
    const result = renteberegningSchema.safeParse({
      ...createRenteberegningInitialValues(),
      activeTab: 'some-tab',
    });
    expect(result.success).toBe(false);
  });

  it('ukendt felt afvises (strict)', () => {
    const result = renteberegningSchema.safeParse({
      ...createRenteberegningInitialValues(),
      ukendt: 'felt',
    });
    expect(result.success).toBe(false);
  });
});

// ─── varigeMenSchema round-trip ───────────────────────────────────────────────

describe('varigeMenSchema', () => {
  it('initialValues er gyldigt mod schema (round-trip)', () => {
    const result = varigeMenSchema.safeParse(VARIGE_MEN_INITIAL_VALUES);
    expect(result.success).toBe(true);
  });

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
      beregningsdato: toISODateString('2023-01-01'),
    });
    expect(result.success).toBe(true);
  });

  it('bevarer heltals-méngrader uden for domænegrænsen canonical', () => {
    expect(varigeMenSchema.safeParse({ mengrad: 120 }).success).toBe(true);

    expect(varigeMenSchema.safeParse({ mengrad: 121 }).success).toBe(true);
    expect(varigeMenSchema.safeParse({ mengrad: 0 }).success).toBe(true);
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
      beregningsdato: toISODateString('2023-01-01'),
    });
    expect(result.success).toBe(false);
  });

  it('afviser decimalsyntaks uden at trunkere', () => {
    expect(varigeMenSchema.safeParse({ mengrad: '15.5' }).success).toBe(false);
  });

  it('afviser ukendt felt fodselsdato', () => {
    const result = varigeMenSchema.safeParse({
      mengrad: 10,
      beregningsdato: toISODateString('2023-01-01'),
      fodselsdato: toISODateString('1990-01-01'),
    });
    expect(result.success).toBe(false);
  });
});

describe('forsoergertabSchema', () => {
  it('initialValues er gyldigt mod schema (round-trip)', () => {
    const result = forsoergertabSchema.safeParse(FORSOERGERTAB_INITIAL_VALUES);
    expect(result.success).toBe(true);
  });

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
      efterladteFodselsdato: toISODateString('1988-03-04'),
      beregningsdato: toISODateString('2024-01-01'),
      virkningsdato: toISODateString('2024-01-01'),
      tilkendtForPeriodeAar: 4,
    });
    expect(result.success).toBe(true);
  });

  it('bevarer heltalsværdier uden for 1-10 år canonical', () => {
    const result = forsoergertabSchema.safeParse({
      tilkendtForPeriodeAar: 11,
    });
    expect(result.success).toBe(true);
  });

  it('afviser decimaltal i tilkendt periode og ugyldige kønsværdier', () => {
    expect(forsoergertabSchema.safeParse({ tilkendtForPeriodeAar: 4.9 }).success).toBe(false);
    expect(forsoergertabSchema.safeParse({ tilkendtForPeriodeAar: '4,9' }).success).toBe(false);
    expect(forsoergertabSchema.safeParse({ koen: 'mand' }).success).toBe(false);
    expect(forsoergertabSchema.safeParse({ koen: 'Andet' }).success).toBe(false);
  });

  it('normaliserer tomt køn til undefined uden at droppe sektionen', () => {
    const result = forsoergertabSchema.safeParse({ koen: '' });
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.koen).toBeUndefined();
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
      fodselsdato: toISODateString('1988-03-04'),
    });
    expect(result.success).toBe(false);
  });
});

// ─── aarsloenSchema round-trip ────────────────────────────────────────────────

describe('aarsloenSchema (round-trip)', () => {
  it('udfylder defaults ved load af ældre .eo der mangler de påkrævede felter', () => {
    // Forward/backward-tolerant load: en gammel fil uden disse felter må ikke fejle hele
    // sektionen, men loades med de faste fallback-værdier (= det en ny, tom sag starter med).
    const result = aarsloenSchema.safeParse({});
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.loenperiode).toBe('maaned');
      expect(result.data.tableData).toEqual([]);
      expect(result.data.omregningTilFuldtAar).toBe(false);
      expect(result.data.fuldLoenUnderFerie).toBe(true);
      expect(result.data.retTilSjetteFerieuge).toBe(true);
      expect(result.data.loenPaaHelligdage).toBe('Almindelig løn');
      // De allerede-optionale procent-/feriedage-felter forbliver undefined.
      expect(result.data.feriePct).toBeUndefined();
      expect(result.data.antalFeriedage).toBeUndefined();
    }
  });

  it('bevarer eksplicitte værdier frem for defaults', () => {
    const result = aarsloenSchema.safeParse({
      loenperiode: 'uge',
      omregningTilFuldtAar: true,
      fuldLoenUnderFerie: false,
      retTilSjetteFerieuge: false,
      loenPaaHelligdage: 'Ingen',
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.loenperiode).toBe('uge');
      expect(result.data.omregningTilFuldtAar).toBe(true);
      expect(result.data.fuldLoenUnderFerie).toBe(false);
      expect(result.data.retTilSjetteFerieuge).toBe(false);
      expect(result.data.loenPaaHelligdage).toBe('Ingen');
      expect(result.data.tableData).toEqual([]);
    }
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

  it('accepterer minimal løntabelrække og afviser ukendte eller ugyldige felter', () => {
    expect(aarsloenSchema.safeParse({
      loenperiode: 'maaned',
      tableData: [{ id: 'r1' }],
      omregningTilFuldtAar: false,
      fuldLoenUnderFerie: true,
      retTilSjetteFerieuge: false,
      loenPaaHelligdage: 'Almindelig løn',
    }).success).toBe(true);

    expect(aarsloenSchema.safeParse({
      loenperiode: 'maaned',
      tableData: [{ id: 'r1', ukendt: 'felt' }],
      omregningTilFuldtAar: false,
      fuldLoenUnderFerie: true,
      retTilSjetteFerieuge: false,
      loenPaaHelligdage: 'Almindelig løn',
    }).success).toBe(false);

    expect(aarsloenSchema.safeParse({
      loenperiode: 'maaned',
      tableData: [{ id: 'r1', col0_dag: 'ugyldig' }],
      omregningTilFuldtAar: false,
      fuldLoenUnderFerie: true,
      retTilSjetteFerieuge: false,
      loenPaaHelligdage: 'Almindelig løn',
    }).success).toBe(false);
  });
});
