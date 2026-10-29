import { buildEoSygeferiegodtgoerelseRows } from '../../../domain/eoRowEvaluation/eoRowSygeferiegodtgoerelseRows';
import { createErstatningsopgoerelseInitialValues } from '../../../domain/erstatningsopgoerelse/helpers/erstatningsopgoerelseInitialValues';
import { STAMDATA_INITIAL_VALUES } from '../../../domain/stamdata/stamdataInitialValues';
import { toAnyFieldRef } from '../../../inputCore/fieldDescriptor';
import {
  eoSfggReferenceperiodeFraField,
  eoSfggReferenceperiodeTilField,
} from '../../../inputCore/catalog/erstatningsopgoerelseDescriptors';
import type { FieldIssue } from '../../../inputCore/inputIssue';
import type { ErstatningsopgoerelseValues, StamdataValues } from '../../../schemas/formSchemas';
import {
  asSfggAmount as asAmount,
  createSfggEmployment,
  createSfggIngenRow,
  sfggIso as iso,
} from '../../utils/sfggTestSupport';

/** Ferieloven med tom referenceperiode – fundets sag (BB-369). */
const values = (patch: Partial<ErstatningsopgoerelseValues['sfggAnsaettelsesforhold'][number]> = {}): ErstatningsopgoerelseValues => {
  const base = createErstatningsopgoerelseInitialValues();
  base.kravPaaTabtArbejdsfortjeneste = 'Ja';
  base.beregnesUdFra = 'Angivet månedsløn';
  base.maanedsloenenUdgoer = asAmount(30000);
  base.vedroererPeriodeFra = iso('2023-03-01');
  base.vedroererPeriodeTil = iso('2023-05-31');
  base.tafPerioder = [{ id: 'taf-1', fra: iso('2023-03-01'), til: iso('2023-05-31'), loseFeriedage: undefined }];
  base.loenindkomstAnsaettelsesforhold = [createSfggEmployment({ feriePct: 12.5 })];
  base.sfggAnsaettelsesforhold = [{ ...createSfggIngenRow('af-1'), sfggBeregningskilde: 'Ferieloven', ...patch }];
  return base;
};

const STAMDATA: StamdataValues = { ...STAMDATA_INITIAL_VALUES, skadestype: 'Arbejdsulykke', skadedato: iso('2023-03-01') };

const manglerRows = (eoValues: ErstatningsopgoerelseValues, fieldIssues: Readonly<Record<string, readonly FieldIssue[]>> = {}) =>
  buildEoSygeferiegodtgoerelseRows(eoValues, STAMDATA, undefined, undefined, fieldIssues)
    .filter((row) => row.id.startsWith('sfgg.referenceperiodeMangler.'));

describe('buildEoSygeferiegodtgoerelseRows – tom referenceperiode (BB-369)', () => {
  it('giver hver tom dato sin fejllinje med feltets navn og link til feltet', () => {
    const rows = manglerRows(values());

    expect(rows.map((row) => row.summaryText)).toEqual([
      'Referenceperiode, fra: Datoen er ikke udfyldt',
      'Referenceperiode, til: Datoen er ikke udfyldt',
    ]);
    expect(rows.every((row) => row.status === 'error' && row.employmentId === 'af-1')).toBe(true);
    expect(rows.map((row) => row.focusTarget)).toEqual([
      { kind: 'fieldAddress', address: eoSfggReferenceperiodeFraField.bind('af-1').address },
      { kind: 'fieldAddress', address: eoSfggReferenceperiodeTilField.bind('af-1').address },
    ]);
  });

  it('tier om en udfyldt dato og om en dato med egen rød fejl', () => {
    const rejectedTil: FieldIssue = {
      kind: 'field',
      code: 'eo.sfggAnsaettelsesforhold.sfggReferenceperiodeTil.format',
      severity: 'error',
      field: toAnyFieldRef(eoSfggReferenceperiodeTilField.bind('af-1')),
      reason: 'format',
      message: 'Ugyldig dato',
    };
    expect(manglerRows(values({ sfggReferenceperiodeFra: iso('2023-02-01') }), { 'af-1': [rejectedTil] })).toEqual([]);
  });

  it('kræver ingen referenceperiode, når satsen er angivet manuelt', () => {
    expect(manglerRows(values({ sfggBeregningskilde: 'Manuelt angivet' }))).toEqual([]);
  });
});
