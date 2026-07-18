// @vitest-environment jsdom
import { buildForsoergertabReaderProjection } from '../../../domain/forsoergertab/forsoergertabReaderProjection';
import { computeForsoergertabSnapshot } from '../../../domain/forsoergertab/forsoergertabSnapshot';
import { getProductionInputCatalog } from '../../../inputCore/catalog/productionCatalog';
import { createInputEvaluation } from '../../../inputCore/inputReader';
import { DEFAULT_APP_SETTINGS } from '../../../settings/appSettingsSchema';
import { createEvaluationSourceToken, createInputRevision, createSettingsRevision } from '../../../inputCore/evaluationSource';
import { toISODateString } from '../../../types/branded';
import type {
  FaellesAarsloenValues,
  ForsoergertabValues,
  StamdataValues,
} from '../../../schemas/formSchemas';

// Greenfield Forsørgertab reader-projektion (§3.4/§5.4/§1.10, Fase 3-slice): beviser at projektionen (a) kører den
// EKSISTERENDE `computeForsoergertabSnapshot` byte-identisk på reader-læste værdier (§5.4 hårdt stop mod talændring),
// (b) fører en canonical bounds-feltfejl (§1.6) ind i snapshottets gate, og (c) bevarer den DEPENDENCY-SPECIFIKKE
// panel-visning (§1.10): en fejl på virkningsdato blokerer ASL + download, men bevarer EAL-panelet — som legacy.

const catalog = getProductionInputCatalog();

const asAmount = (value: number) => ({ kind: 'number' as const, value });

const validForsoergertab: ForsoergertabValues = {
  beregningsdato: toISODateString('2020-06-01'),
  efterladteFodselsdato: toISODateString('1973-01-01'),
  virkningsdato: toISODateString('2020-05-01'),
  koen: undefined,
  tilkendtForPeriodeAar: 10,
};
const validFaellesAarsloen: FaellesAarsloenValues = {
  aslAarsloen: asAmount(450000),
  ealAarsloen: asAmount(450000),
};
const validStamdata: StamdataValues = {
  journalnr: 'J',
  advokat: 'A',
  sagsbehandler: 'S',
  skadelidte: 'Test',
  skadestype: 'Arbejdsulykke',
  skadedato: toISODateString('2020-05-01'),
  skadelidteFodselsdato: toISODateString('1980-01-01'),
};

const buildReader = (
  forsoergertab: ForsoergertabValues,
  faellesAarsloen: FaellesAarsloenValues,
  stamdata: StamdataValues | null
) => {
  const input = catalog.validateSettledInput({
    sections: {
      stamdata, satser: null, aarsloen: null, faellesAarsloen,
      renteberegning: null,
      varigemen: null, forsoergertab, erstatningsopgoerelse: null, erhvervsevnetab: null,
    },
    rejectedInputs: {},
  });
  const sourceToken = createEvaluationSourceToken(createInputRevision(1), createSettingsRevision(1));
  return createInputEvaluation({ input, catalog, sourceToken, settings: DEFAULT_APP_SETTINGS }).reader;
};

describe('buildForsoergertabReaderProjection', () => {
  it('kører computeForsoergertabSnapshot byte-identisk på de reader-læste værdier (§5.4)', () => {
    const reader = buildReader(validForsoergertab, validFaellesAarsloen, validStamdata);
    const projection = buildForsoergertabReaderProjection(reader);

    // Golden: præcis samme snapshot-resultat som et direkte kald med de committede værdier (tomme fieldErrors,
    // fordi der ingen røde feltfejl er).
    const expected = computeForsoergertabSnapshot({
      values: validForsoergertab,
      faellesAarsloen: validFaellesAarsloen,
      stamdata: validStamdata,
      fieldErrors: { forsoergertab: {}, faellesAarsloen: {}, stamdata: {} },
    });
    expect(projection.snapshot.calculation.result).toEqual(expected.calculation.result);
    expect(projection.snapshot.pdfGate.canDownload).toBe(true);
  });

  it('fører en canonical bounds-feltfejl (tilkendt periode uden for 1..10) ind i gaten og blokerer (§1.6)', () => {
    const reader = buildReader(
      { ...validForsoergertab, tilkendtForPeriodeAar: 11 },
      validFaellesAarsloen,
      validStamdata
    );
    const projection = buildForsoergertabReaderProjection(reader);
    expect(projection.snapshot.fieldUi.tilkendtForPeriodeAar.hasError).toBe(true);
    expect(projection.snapshot.pdfGate.canDownload).toBe(false);
  });

  it('bevarer EAL-panelet men blokerer ASL + download ved en rød virkningsdato-fejl (§1.10)', () => {
    // En virkningsdato uden for bounds (før skadedatoMin) giver en rød feltfejl → readeren skjuler værdien. EAL
    // afhænger IKKE af virkningsdato, så EAL-panelet skal bevares; ASL og download blokeres.
    const reader = buildReader(
      { ...validForsoergertab, virkningsdato: toISODateString('2010-01-01') },
      validFaellesAarsloen,
      validStamdata
    );
    const projection = buildForsoergertabReaderProjection(reader);
    expect(projection.snapshot.fieldUi.virkningsdato.hasError).toBe(true);
    expect(projection.snapshot.canShowEal).toBe(true);
    expect(projection.snapshot.canShowAsl).toBe(false);
    expect(projection.snapshot.pdfGate.canDownload).toBe(false);
  });

  it('en byttet stamdata-datoorden giver en rød feltfejl og blokerer download (§1.6)', () => {
    const reader = buildReader(
      validForsoergertab,
      validFaellesAarsloen,
      {
        ...validStamdata,
        skadelidteFodselsdato: toISODateString('2020-01-02'),
        skadedato: toISODateString('2020-01-01'),
      }
    );
    const projection = buildForsoergertabReaderProjection(reader);
    expect(projection.snapshot.pdfGate.canDownload).toBe(false);
  });

  it('blokerer download når hverken EAL- eller ASL-delen kan dannes (tom beregningsdato/årsløn, §1.7)', () => {
    const reader = buildReader(
      { ...validForsoergertab, beregningsdato: undefined },
      { aslAarsloen: undefined, ealAarsloen: undefined },
      validStamdata
    );
    const projection = buildForsoergertabReaderProjection(reader);
    expect(projection.snapshot.canShowEal).toBe(false);
    expect(projection.snapshot.canShowAsl).toBe(false);
    expect(projection.snapshot.pdfGate.canDownload).toBe(false);
  });
});
