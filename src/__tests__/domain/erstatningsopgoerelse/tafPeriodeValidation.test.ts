import {
  evaluateTafPerioder,
  type TafPeriodeBoundsContext,
} from '../../../domain/erstatningsopgoerelse/validation/tafPeriodeValidation';
import {
  FRA_OG_TIL_DATO_IKKE_ANGIVET_MESSAGE,
  TAF_OVERLAP_LINJE,
} from '../../../domain/erstatningsopgoerelse/validation/tafRowRules';
import type { AnyFieldRef } from '../../../inputCore/fieldDescriptor';
import type { FieldIssue } from '../../../inputCore/inputIssue';
import { DATE_ORDER_ERROR_MESSAGE } from '../../../utils/dateOrderValidation';
import { toISODateString } from '../../../types/branded';

const iso = (value: string) => toISODateString(value);

const fieldRef = (id: string): AnyFieldRef => ({
  descriptor: { id, label: id, controlKind: 'text' },
  address: {},
} as unknown as AnyFieldRef);

const issue = (code: string, message: string): FieldIssue => ({
  kind: 'field',
  code,
  severity: 'error',
  field: fieldRef(code),
  reason: 'rule',
  message,
});

const context = (patch: Partial<TafPeriodeBoundsContext> = {}): TafPeriodeBoundsContext => ({
  skadedatoISO: iso('2010-01-01'),
  erErhvervssygdom: false,
  differencekravDato: undefined,
  endeligEETBeregnetDato: undefined,
  midlertidigEETBeregnetDato: undefined,
  aktivMidlertidigEETBeregnetDato: undefined,
  verserendeKlageEet: false,
  ...patch,
});

describe('evaluateTafPerioder – direkte rækkegrene', () => {
  it('viser samlet datomangel for en række med kun løse feriedage', () => {
    const result = evaluateTafPerioder([
      { id: 'kun-lose', loseFeriedage: 3 },
      { id: 'tom' },
    ], context());

    expect(result.get('kun-lose')).toEqual({
      kind: 'error',
      message: `TAF-perioden med 3 løse ferie-/feriefridage: ${FRA_OG_TIL_DATO_IKKE_ANGIVET_MESSAGE}`,
      field: 'fra',
    });
    expect(result.get('tom')).toEqual({ kind: 'skip' });
  });

  it('medtager kun relevante celleissues og behandler en løse-feriedage-fejl som rækkeissue', () => {
    const result = evaluateTafPerioder([
      { id: 'r1', fra: iso('2024-01-01'), til: iso('2024-01-31'), loseFeriedage: 2 },
      { id: 'r2', fra: iso('2024-01-15'), til: iso('2024-02-01') },
    ], context(), (rowId) => rowId === 'r1'
      ? {
          fra: issue('taf.fra.tafCutoff', 'Fra-datoen er afskåret'),
          til: issue('taf.til.rule', 'Til-datoen skal rettes'),
          loseFeriedage: issue('taf.loseFeriedage.rule', 'For mange løse feriedage'),
        }
      : {});

    expect(result.get('r1')).toEqual({
      kind: 'error',
      message: 'TAF-perioden 01-01-2024 - 31-01-2024: Til-datoen skal rettes; For mange løse feriedage; Der er overlappende TAF-perioder',
      field: 'til',
    });
    expect(result.get('r2')).toEqual({ kind: 'error', message: TAF_OVERLAP_LINJE, field: 'fra' });
  });

  it('forankrer en cutoff-issue fra en delvist udfyldt række før datomanglen', () => {
    const result = evaluateTafPerioder([
      { id: 'mangler-til', fra: iso('2024-08-01') },
    ], context(), () => ({ fra: issue('taf.fra.tafCutoff', 'Fra-datoen ligger efter afskæringen') }));

    expect(result.get('mangler-til')).toEqual({
      kind: 'error',
      message: 'TAF-perioden fra 01-08-2024: Fra-datoen ligger efter afskæringen; Til-dato er ikke angivet',
      field: 'fra',
    });
  });

  it('giver én fælles overlaplinje for to komplette overlappende rækker', () => {
    const result = evaluateTafPerioder([
      { id: 'første', fra: iso('2024-01-01'), til: iso('2024-01-10') },
      { id: 'anden', fra: iso('2024-01-05'), til: iso('2024-01-15') },
    ], context());

    expect(result.get('første')).toEqual({ kind: 'error', message: TAF_OVERLAP_LINJE, field: 'fra' });
    expect(result.get('anden')).toEqual({ kind: 'error', message: TAF_OVERLAP_LINJE, field: 'fra' });
  });

  it('prioriterer datoordrefejlen og forankrer den til til-datoen', () => {
    const result = evaluateTafPerioder([
      { id: 'omvendt', fra: iso('2024-01-10'), til: iso('2024-01-01') },
    ], context());

    expect(result.get('omvendt')).toEqual({
      kind: 'error',
      message: `TAF-perioden 10-01-2024 - 01-01-2024: ${DATE_ORDER_ERROR_MESSAGE}`,
      field: 'til',
    });
  });

  it('forankrer en cutoff, der kun rammer til-datoen, til til-cellen', () => {
    const result = evaluateTafPerioder([
      { id: 'til-afskaaret', fra: iso('2024-01-01'), til: iso('2024-08-01') },
    ], context({ differencekravDato: iso('2024-07-01') }));

    const evaluation = result.get('til-afskaaret');
    expect(evaluation?.kind).toBe('error');
    if (evaluation?.kind !== 'error') return;
    expect(evaluation.field).toBe('til');
    expect(evaluation.message).toContain('differencekravet er opgjort pr. (01-07-2024)');
  });

  it('forankrer en ren øvre boundsfejl til til-datoen', () => {
    const result = evaluateTafPerioder([
      { id: 'for-sen', fra: iso('2024-01-01'), til: iso('2099-01-01') },
    ], context());

    const evaluation = result.get('for-sen');
    expect(evaluation?.kind).toBe('error');
    if (evaluation?.kind !== 'error') return;
    expect(evaluation.field).toBe('til');
    expect(evaluation.message).toContain('Dato skal være mellem 01-01-2024 og');
  });

  it('bruger anmeldelsesdatoen i den direkte erhvervssygdoms-boundsgren', () => {
    const result = evaluateTafPerioder([
      { id: 'for-tidlig', fra: iso('2013-05-31'), til: iso('2013-05-31') },
    ], context({ skadedatoISO: iso('2018-06-01'), erErhvervssygdom: true }));

    const evaluation = result.get('for-tidlig');
    expect(evaluation?.kind).toBe('error');
    if (evaluation?.kind !== 'error') return;
    expect(evaluation.field).toBe('fra');
    expect(evaluation.message).toContain('Værdien afgrænses af: anmeldelsesdato, til-dato i samme række');
  });

  it('medtager aktive EET-datoforgreninger og respekterer en verserende klage', () => {
    const aktiv = evaluateTafPerioder([
      { id: 'aktiv', fra: iso('2024-01-01'), til: iso('2024-01-10') },
    ], context({
      differencekravDato: iso('2025-07-01'),
      endeligEETBeregnetDato: iso('2025-08-01'),
      midlertidigEETBeregnetDato: iso('2025-09-01'),
      aktivMidlertidigEETBeregnetDato: iso('2025-09-01'),
    }));
    const klage = evaluateTafPerioder([
      { id: 'klage', fra: iso('2024-01-01'), til: iso('2024-01-10') },
    ], context({
      endeligEETBeregnetDato: iso('2023-01-01'),
      midlertidigEETBeregnetDato: iso('2023-02-01'),
      aktivMidlertidigEETBeregnetDato: iso('2023-02-01'),
      verserendeKlageEet: true,
    }));

    expect(aktiv.get('aktiv')).toEqual({ kind: 'ok' });
    expect(klage.get('klage')).toEqual({ kind: 'ok' });

    const udenSkadedato = evaluateTafPerioder([
      { id: 'uden-skadedato', fra: iso('2024-01-01'), til: iso('2024-01-10') },
    ], context({ skadedatoISO: undefined }));
    expect(udenSkadedato.get('uden-skadedato')).toEqual({ kind: 'ok' });
  });
});
