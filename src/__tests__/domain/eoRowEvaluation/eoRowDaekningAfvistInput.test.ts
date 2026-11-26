import { buildEoSvieSmerteRows } from '../../../domain/eoRowEvaluation/eoRowSvieSmerteRows';
import { buildEoTaftRows } from '../../../domain/eoRowEvaluation/eoRowTaftRows';
import type { EoRowModel } from '../../../domain/eoRowEvaluation/eoRowTypes';
import {
  buildSvieSmerteContext,
  buildTaftContext,
} from '../../../domain/erstatningsopgoerelse/validation/eoPeriodeBlockingContext';
import { createErstatningsopgoerelseInitialValues } from '../../../domain/erstatningsopgoerelse/helpers/erstatningsopgoerelseInitialValues';
import { STAMDATA_INITIAL_VALUES } from '../../../domain/stamdata/stamdataInitialValues';
import { toAnyFieldRef, type FieldRef } from '../../../inputCore/fieldDescriptor';
import {
  eoDifferencekravDatoField,
  eoEndeligEETVirkningsdatoField,
  eoEndeligEETAfgoerelseDatoField,
  eoFerieperiodeTilField,
  eoMenAfgoerelseDatoField,
  eoSvieSmertePeriodeFraField,
  eoTafPeriodeFraField,
} from '../../../inputCore/catalog/erstatningsopgoerelseDescriptors';
import { buildFieldIssueSet, EMPTY_FIELD_ISSUE_SET, type FieldIssue, type FieldIssueSet } from '../../../inputCore/inputIssue';
import type { ErstatningsopgoerelseValues, StamdataValues } from '../../../schemas/formSchemas';
import { toISODateString } from '../../../types/branded';

const iso = (value: string) => toISODateString(value);

const STAMDATA: StamdataValues = { ...STAMDATA_INITIAL_VALUES, skadestype: 'Arbejdsulykke', skadedato: iso('2024-01-01') };

/** En afvist råtekst: readeren giver feltet som tomt, og feltet bærer et `format`-issue. */
const afvist = <T,>(field: FieldRef<T>): FieldIssue => ({
  kind: 'field',
  code: `${field.descriptor.id}.format`,
  severity: 'error',
  field: toAnyFieldRef(field),
  reason: 'format',
  message: 'Datoen findes ikke i kalenderen',
});

const issues = (...fieldIssues: FieldIssue[]): FieldIssueSet => buildFieldIssueSet(fieldIssues);

const row = (rows: readonly EoRowModel[], id: string): EoRowModel | undefined => rows.find((candidate) => candidate.id === id);

// ── TAF ─────────────────────────────────────────────────────────────────────────────────────────

/** Grundsag: erstatningsperiode hele 2024, TAF til 30-06-2024. */
const tafValues = (patch: Partial<ErstatningsopgoerelseValues> = {}): ErstatningsopgoerelseValues => ({
  ...createErstatningsopgoerelseInitialValues(),
  vedroererPeriodeFra: iso('2024-01-01'),
  vedroererPeriodeTil: iso('2024-12-31'),
  kravPaaTabtArbejdsfortjeneste: 'Ja',
  beregnesUdFra: 'Angivet dagsløn',
  dagsloenenUdgoer: { kind: 'number', value: 1000 },
  tafPerioder: [{ id: 'taf-1', fra: iso('2024-01-01'), til: iso('2024-06-30'), loseFeriedage: undefined }],
  ferieperioder: [],
  ...patch,
});

const tafRows = (values: ErstatningsopgoerelseValues, fieldIssues: FieldIssueSet = EMPTY_FIELD_ISSUE_SET) =>
  buildEoTaftRows(values, fieldIssues, buildTaftContext(STAMDATA, values));

const TAF_IKKE_REJST = 'Der er ikke rejst TAF-krav for hele EO-perioden';

describe('buildEoTaftRows – dækningsadvarslen venter på en afvist dato', () => {
  it('forklarer ophøret med en gyldig differencekravsdato', () => {
    expect(row(tafRows(tafValues({ differencekravDato: iso('2024-07-01') })), 'taf.ophoerSkyldes')).toMatchObject({
      displayValue: 'Differencekrav opgjort (01-07-2024)',
      status: 'ok',
    });
  });

  it('advarer om dækningen, når differencekravsdatoen er tom', () => {
    expect(row(tafRows(tafValues()), 'taf.ophoerSkyldes')).toMatchObject({ displayValue: TAF_IKKE_REJST, status: 'warning' });
  });

  it('tier om dækningen, mens differencekravsdatoen er afvist', () => {
    const rows = tafRows(tafValues(), issues(afvist(eoDifferencekravDatoField.bind())));
    expect(row(rows, 'taf.ophoerSkyldes')).toBeUndefined();
  });

  it('tier også under EET-klage: differencekravet gælder fortsat', () => {
    const values = tafValues({ verserendeKlageEet: 'Ja' });
    expect(row(tafRows(values, issues(afvist(eoDifferencekravDatoField.bind()))), 'taf.ophoerSkyldes')).toBeUndefined();
  });

  it('tier, mens en dato i en TAF-række er afvist', () => {
    const values = tafValues({
      tafPerioder: [
        { id: 'taf-1', fra: iso('2024-01-01'), til: iso('2024-03-31'), loseFeriedage: undefined },
        { id: 'taf-2', fra: undefined, til: iso('2024-06-30'), loseFeriedage: undefined },
      ],
    });
    expect(row(tafRows(values, issues(afvist(eoTafPeriodeFraField.bind('taf-2')))), 'taf.ophoerSkyldes')).toBeUndefined();
  });

  it('tier, mens en endelig EET-afgørelses dato er afvist og intet andet forklarer ophøret', () => {
    const values = tafValues({ endeligtEETAfgorelse: 'Ja' });
    expect(row(tafRows(values, issues(afvist(eoEndeligEETAfgoerelseDatoField.bind()))), 'taf.ophoerSkyldes')).toBeUndefined();
  });

  it('lader en gyldig afgørelsesdato forklare ophøret, når kun virkningsdatoen er afvist', () => {
    const values = tafValues({ endeligtEETAfgorelse: 'Ja', endeligEETAfgoerelseDato: iso('2024-07-01') });
    expect(row(tafRows(values, issues(afvist(eoEndeligEETVirkningsdatoField.bind()))), 'taf.ophoerSkyldes')).toMatchObject({
      displayValue: 'Endelig EET-afgørelse (01-07-2024)',
      status: 'ok',
    });
  });

  it('lader en gyldig differencekravsdato forklare ophøret under EET-klage', () => {
    const values = tafValues({
      endeligtEETAfgorelse: 'Ja',
      verserendeKlageEet: 'Ja',
      differencekravDato: iso('2024-07-01'),
    });
    expect(row(tafRows(values, issues(afvist(eoEndeligEETAfgoerelseDatoField.bind()))), 'taf.ophoerSkyldes')).toMatchObject({
      displayValue: 'Differencekrav opgjort (01-07-2024)',
      status: 'ok',
    });
  });

  it('advarer fortsat, når den afviste EET-dato ikke kan afskære TAF under en verserende klage', () => {
    const values = tafValues({ endeligtEETAfgorelse: 'Ja', verserendeKlageEet: 'Ja' });
    expect(row(tafRows(values, issues(afvist(eoEndeligEETAfgoerelseDatoField.bind()))), 'taf.ophoerSkyldes')).toMatchObject({
      displayValue: TAF_IKKE_REJST,
      status: 'warning',
    });
  });
});

// ── Svie/smerte ─────────────────────────────────────────────────────────────────────────────────

/** Grundsag: erstatningsperioden januar 2024, «Sygemeldt», krav «Ja». */
const ssValues = (patch: Partial<ErstatningsopgoerelseValues> = {}): ErstatningsopgoerelseValues => ({
  ...createErstatningsopgoerelseInitialValues(),
  vedroererPeriodeFra: iso('2024-01-01'),
  vedroererPeriodeTil: iso('2024-01-31'),
  kravPaaSvieSmerteGodtgoerelse: 'Ja',
  svieSmerteHelbredsstatus: 'Sygemeldt',
  tidligereSsMax: 'Nej',
  svieSmertePerioder: [{ id: 'ss-1', fra: iso('2024-01-01'), til: iso('2024-01-10'), tilstand: 'sygemeldt' }],
  ...patch,
});

const ssRows = (values: ErstatningsopgoerelseValues, fieldIssues: FieldIssueSet = EMPTY_FIELD_ISSUE_SET) =>
  buildEoSvieSmerteRows(values, fieldIssues, buildSvieSmerteContext(STAMDATA, values));

const SS_IKKE_REJST = 'Ikke rejst svie/smerte-krav for hele perioden';

describe('buildEoSvieSmerteRows – dækningsadvarslen venter på en afvist dato', () => {
  it('advarer om dækningen, når perioderne slutter før EO-perioden', () => {
    expect(row(ssRows(ssValues()), 'sviesmerte.ophoerSkyldes')).toMatchObject({ displayValue: SS_IKKE_REJST, status: 'warning' });
  });

  it('tier, mens en dato i en svie/smerte-række er afvist', () => {
    const values = ssValues({
      svieSmertePerioder: [
        { id: 'ss-1', fra: iso('2024-01-01'), til: iso('2024-01-10'), tilstand: 'sygemeldt' },
        { id: 'ss-2', fra: undefined, til: undefined, tilstand: undefined },
      ],
    });
    expect(row(ssRows(values, issues(afvist(eoSvieSmertePeriodeFraField.bind('ss-2')))), 'sviesmerte.ophoerSkyldes')).toBeUndefined();
  });

  it('tier, mens den aktive ménafgørelses dato er afvist', () => {
    const values = ssValues({ varigeMenAfgorelse: 'Ja', verserendeKlageMen: 'Nej' });
    expect(row(ssRows(values, issues(afvist(eoMenAfgoerelseDatoField.bind()))), 'sviesmerte.ophoerSkyldes')).toBeUndefined();
  });

  it('advarer fortsat, når ménafgørelsen er påklaget og datoen derfor ikke kan afskære kravet', () => {
    const values = ssValues({ varigeMenAfgorelse: 'Ja', verserendeKlageMen: 'Ja' });
    expect(row(ssRows(values, issues(afvist(eoMenAfgoerelseDatoField.bind()))), 'sviesmerte.ophoerSkyldes')).toMatchObject({
      displayValue: SS_IKKE_REJST,
      status: 'warning',
    });
  });
});

// ── Ferie uden TAF-række ───────────────────────────────────────────────────────────────

describe('buildEoTaftRows – ferierække med kun Fra', () => {
  const ferie = [{ id: 'ferie-1', fra: iso('2024-01-03'), til: undefined }];
  const BESKED = 'Ferieperioden fra 03-01-2024: Til-dato er ikke angivet';

  it('melder den manglende Til-dato som gul linje med link til feltet, når der ingen TAF-række er', () => {
    const rows = tafRows(tafValues({ tafPerioder: [], ferieperioder: ferie }));
    expect(row(rows, 'taf.ferieDatoMangler.ferie-1')).toEqual({
      id: 'taf.ferieDatoMangler.ferie-1',
      label: 'Ferieperiode',
      displayValue: `Advarsel (${BESKED})`,
      status: 'warning',
      message: BESKED,
      summaryDisplay: 'messageOnly',
      focusTarget: { kind: 'fieldAddress', address: eoFerieperiodeTilField.bind('ferie-1').address },
    });
    expect(rows.some((candidate) => candidate.status === 'error')).toBe(false);
  });

  it('melder intet for en helt udfyldt ferierække uden TAF-række', () => {
    const rows = tafRows(tafValues({
      tafPerioder: [],
      ferieperioder: [{ id: 'ferie-1', fra: iso('2024-01-03'), til: iso('2024-01-04') }],
    }));
    expect(rows.filter((candidate) => candidate.id.startsWith('taf.ferieDatoMangler.'))).toEqual([]);
  });

  it('beholder den blokerende linje, når der er en TAF-række', () => {
    const rows = tafRows(tafValues({ ferieperioder: ferie }));
    expect(row(rows, 'taf.ferie.ferie-1')).toMatchObject({ displayValue: `Fejl (${BESKED})`, status: 'error' });
    expect(row(rows, 'taf.ferieDatoMangler.ferie-1')).toBeUndefined();
  });
});
