import { resolveEoIssueFocusTarget } from '../../../domain/eoRowEvaluation/eoRowIssueCatalog';
import { focusOnSenesteTil, resolveSenestSluttendePeriodeId } from '../../../domain/eoRowEvaluation/eoRowShared';
import { eoOffentligeYdelserFraDatoField, eoTafPeriodeTilField } from '../../../inputCore/catalog/erstatningsopgoerelseDescriptors';
import { toISODateString } from '../../../types/branded';

// Fejllinks skal ramme den række, beskeden handler om – ikke blot tabellens første række.
describe('EO-fejllinks til den rigtige række', () => {
  it('peger «ikke rejst krav for hele EO-perioden» på den senest sluttende periode', () => {
    const perioder = [
      { id: 'foraar', til: toISODateString('2024-06-30') },
      { id: 'vinter', til: toISODateString('2024-03-31') },
      { id: 'tom', til: undefined },
    ];
    expect(resolveSenestSluttendePeriodeId(perioder)).toBe('foraar');
    expect(focusOnSenesteTil('foraar', eoTafPeriodeTilField)).toEqual({
      focusTarget: { kind: 'fieldAddress', address: eoTafPeriodeTilField.bind('foraar').address },
    });
    expect(focusOnSenesteTil(undefined, eoTafPeriodeTilField)).toEqual({});
  });

  it('peger «afgørelse uden ydelser» på den tomme indtastningsrække, ikke en udfyldt første række', () => {
    expect(resolveEoIssueFocusTarget({
      id: 'midlertidigtEetKonsistens.afgorelseUdenYdelser',
      label: 'Midlertidigt EET',
      displayValue: 'Advarsel (Der er angivet en midlertidig EET-afgørelse men ikke indtastet ydelser)',
      status: 'warning',
      summaryDisplay: 'messageOnly',
    })).toEqual({ kind: 'collectionField', template: eoOffentligeYdelserFraDatoField.template, row: 'entry' });
  });
});
