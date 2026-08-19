import {
  rentekravBelobField,
  rentekravRenterFraField,
  rentekravTillaegstidField,
} from '../../../inputCore/catalog/renteberegningDescriptors';
import { getProductionInputCatalog } from '../../../inputCore/catalog/productionCatalog';
import { createInputEvaluation } from '../../../inputCore/inputReader';
import {
  createEvaluationSourceToken,
  createInputRevision,
  createSettingsRevision,
} from '../../../inputCore/evaluationSource';
import { resolveFieldIssueTooltip } from '../../../inputCore/inputIssue';
import type { RentekravRow } from '../../../schemas/formSchemas';
import { toISODateString } from '../../../types/branded';
import type { TillaegstidEnhed } from '../../../schemas/formSchemas/enumSchemas';

// De to feltregler, brugerfundene BB-037 og BB-038 førte til. Begge findes, fordi motorens afvisning
// (`validateInterestCalculation`) blev kastet væk: rækken mistede tavst sin beregning, hele sidens
// download blev grå med «Indtastning mangler», og INTET felt var rødt. Reglerne flytter afvisningen
// hen til det felt, brugeren skal rette.

const catalog = getProductionInputCatalog();
const ROW_ID = 'row-1';

const buildReader = (
  row: Partial<RentekravRow>,
  beregningsdato: string | undefined
) => {
  const input = catalog.validateSettledInput({
    sections: {
      stamdata: null, satser: null, aarsloen: null, faellesAarsloen: null,
      renteberegning: {
        beregningsdato: beregningsdato === undefined ? undefined : toISODateString(beregningsdato),
        kommentarer: undefined,
        rentekravRows: [{
          id: ROW_ID,
          belob: { kind: 'number', value: 100_000 },
          renterFra: toISODateString('2020-01-01'),
          tillaegstid: undefined,
          enhed: 'dage' as TillaegstidEnhed,
          ...row,
        } as RentekravRow],
      },
      varigemen: null, forsoergertab: null, erstatningsopgoerelse: null, erhvervsevnetab: null,
    },
    rejectedInputs: {},
  });
  const sourceToken = createEvaluationSourceToken(createInputRevision(1), createSettingsRevision(1));
  return createInputEvaluation({ input, catalog, sourceToken }).reader;
};

describe('rentekravBelobField — nulbeløb (BB-038)', () => {
  it('markerer et beløb på 0 kr. rødt med en konkret ordret tooltip', () => {
    const reader = buildReader({ belob: { kind: 'number', value: 0 } }, '2026-08-19');
    const read = reader.read(rentekravBelobField.bind(ROW_ID));

    expect(read.status).toBe('error');
    if (read.status !== 'error') return;
    expect(read.issue.reason).toBe('rule');
    expect(read.issue.message).toBe('Beløbet skal være større end 0 kr.');
    // `rule` står på allowlisten af reasons, hvis fulde besked vises ordret — netop fordi den
    // fortæller HVAD rettelsen er. Bliver den generisk, skjules rettelsen dér, hvor brugeren kigger.
    expect(resolveFieldIssueTooltip(read.issue)).toBe('Beløbet skal være større end 0 kr.');
  });

  it('lader ethvert beløb over nul passere', () => {
    const reader = buildReader({ belob: { kind: 'number', value: 0.01 } }, '2026-08-19');
    expect(reader.read(rentekravBelobField.bind(ROW_ID)).status).toBe('usable');
  });

  it('markerer ikke et tomt beløbsfelt — en mangel er ikke en fejl', () => {
    const reader = buildReader({ belob: undefined }, '2026-08-19');
    expect(reader.read(rentekravBelobField.bind(ROW_ID)).status).not.toBe('error');
  });
});

describe('rentekravTillaegstidField — rentedato efter beregningsdato (BB-037)', () => {
  it('markerer tillægstiden rødt og navngiver den senest mulige rentedato', () => {
    // 99 måneder efter 01-01-2020 er 01-04-2028 — efter beregningsdatoen 19-08-2026.
    const reader = buildReader({ tillaegstid: 99, enhed: 'maaneder' }, '2026-08-19');
    const read = reader.read(rentekravTillaegstidField.bind(ROW_ID));

    expect(read.status).toBe('error');
    if (read.status !== 'error') return;
    expect(read.issue.reason).toBe('rule');
    expect(read.issue.message).toBe('Beregnet rentedato kan senest være 19-08-2026');
    expect(resolveFieldIssueTooltip(read.issue)).toBe('Beregnet rentedato kan senest være 19-08-2026');
  });

  it('rammer også dage og uger som enhed', () => {
    expect(buildReader({ tillaegstid: 40, enhed: 'dage' }, '2020-02-01')
      .read(rentekravTillaegstidField.bind(ROW_ID)).status).toBe('error');
    expect(buildReader({ tillaegstid: 6, enhed: 'uger' }, '2020-02-01')
      .read(rentekravTillaegstidField.bind(ROW_ID)).status).toBe('error');
  });

  it('accepterer en rentedato præcis PÅ beregningsdatoen — grænsen er inklusiv', () => {
    // 31 dage efter 01-01-2020 er 01-02-2020. Renteperioden er tom, men lovlig.
    const reader = buildReader({ tillaegstid: 31, enhed: 'dage' }, '2020-02-01');
    expect(reader.read(rentekravTillaegstidField.bind(ROW_ID)).status).toBe('usable');
  });

  it('tier, når beregningsdatoen mangler — grænsen findes ikke endnu', () => {
    const reader = buildReader({ tillaegstid: 99, enhed: 'maaneder' }, undefined);
    expect(reader.read(rentekravTillaegstidField.bind(ROW_ID)).status).not.toBe('error');
  });

  it('tier, når «Renter fra» mangler — det felt bærer selv sin egen mangel', () => {
    const reader = buildReader({ renterFra: undefined, tillaegstid: 99, enhed: 'maaneder' }, '2026-08-19');
    expect(reader.read(rentekravTillaegstidField.bind(ROW_ID)).status).not.toBe('error');
  });

  it('tier ved tillægstid 0 — enheden er da uden virkning', () => {
    const reader = buildReader({ tillaegstid: 0, enhed: 'maaneder' }, '2026-08-19');
    expect(reader.read(rentekravTillaegstidField.bind(ROW_ID)).status).toBe('usable');
  });
});

describe('rentekravRenterFraField — grænsens afsender (BB-043)', () => {
  it('navngiver beregningsdatoen frem for at kalde grænsen «dags dato»', () => {
    // Beskeden genkendte grænsen på dens VÆRDI: var beregningsdatoen dags dato — det hyppigste
    // tilfælde, fordi der er en knap til det — tilskrev den grænsen kalenderen og sagde, at datoen
    // lå i fremtiden. Problemet var i virkeligheden, at beregningsdatoen skulle flyttes.
    const beregningsdato = '2026-06-30';
    const reader = buildReader({ renterFra: toISODateString('2026-07-15') }, beregningsdato);
    const read = reader.read(rentekravRenterFraField.bind(ROW_ID));

    expect(read.status).toBe('error');
    if (read.status !== 'error') return;
    expect(read.issue.message).toBe('Datoen er efter beregningsdatoen (30-06-2026)');
  });

  it('bruger samme ordlyd, uanset om beregningsdatoen tilfældigvis er dags dato', () => {
    const today = new Date();
    const iso = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
    const dayAfter = new Date(today.getTime() + 24 * 60 * 60 * 1000);
    const isoDayAfter = `${dayAfter.getFullYear()}-${String(dayAfter.getMonth() + 1).padStart(2, '0')}-${String(dayAfter.getDate()).padStart(2, '0')}`;

    const reader = buildReader({ renterFra: toISODateString(isoDayAfter) }, iso);
    const read = reader.read(rentekravRenterFraField.bind(ROW_ID));

    expect(read.status).toBe('error');
    if (read.status !== 'error') return;
    expect(read.issue.message).toContain('efter beregningsdatoen');
    expect(read.issue.message).not.toContain('dags dato');
  });
});
