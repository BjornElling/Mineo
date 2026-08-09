import { EMPTY_FIELD_ISSUE_SET } from '../../../inputCore/inputIssue';
import { buildEoAesRows } from '../../../domain/eoRowEvaluation/eoRowOverviewRows';
import { createErstatningsopgoerelseInitialValues } from '../../../domain/erstatningsopgoerelse/helpers/erstatningsopgoerelseInitialValues';
import {
  eoEndeligEETAfgoerelseDatoField,
  eoMenAfgoerelseDatoField,
  eoMidlertidigEETAfgoerelseDatoField,
} from '../../../inputCore/catalog/erstatningsopgoerelseDescriptors';
import { buildTestFieldIssueSetFrom } from '../../utils/fieldIssueTestSupport';

describe('buildEoAesRows manglende afgørelsesdatoer', () => {
  it('viser de tre manglende dato-situationer som ikke-blokerende advarsler', () => {
    const values = createErstatningsopgoerelseInitialValues();
    values.varigeMenAfgorelse = 'Ja';
    values.midlertidigtEETAfgorelse = 'Ja';
    values.endeligtEETAfgorelse = 'Ja';

    const rows = buildEoAesRows(values, EMPTY_FIELD_ISSUE_SET);

    expect(rows.filter((row) => row.status === 'error')).toEqual([]);
    expect(rows).toEqual(expect.arrayContaining([
      expect.objectContaining({
        id: 'aes.menAfgoerelseDato',
        status: 'warning',
        displayValue: 'Advarsel (Afgørelsesdato mangler)',
      }),
      expect.objectContaining({
        id: 'aes.midlertidigEETAfgoerelseDato',
        status: 'warning',
        displayValue: 'Advarsel (Afgørelsesdato eller virkningsdato mangler)',
      }),
      expect.objectContaining({
        id: 'aes.endeligEETAfgoerelseDato',
        status: 'warning',
        displayValue: 'Advarsel (Afgørelsesdato eller virkningsdato mangler)',
      }),
    ]));
  });

  it('bevarer rejected afgørelsesdatoer som blokerende fejl', () => {
    const values = createErstatningsopgoerelseInitialValues();
    values.varigeMenAfgorelse = 'Ja';
    values.midlertidigtEETAfgorelse = 'Ja';
    values.endeligtEETAfgorelse = 'Ja';

    const rows = buildEoAesRows(values, buildTestFieldIssueSetFrom([
      { field: eoMenAfgoerelseDatoField.bind(), message: 'Ugyldig dato' },
      { field: eoMidlertidigEETAfgoerelseDatoField.bind(), message: 'Ugyldig dato' },
      { field: eoEndeligEETAfgoerelseDatoField.bind(), message: 'Ugyldig dato' },
    ]));

    expect(rows).toEqual(expect.arrayContaining([
      expect.objectContaining({
        id: 'aes.menAfgoerelseDato',
        status: 'error',
        displayValue: 'Fejl (Ugyldig dato)',
      }),
      expect.objectContaining({
        id: 'aes.midlertidigEETAfgoerelseDato',
        status: 'error',
        displayValue: 'Fejl (Ugyldig dato)',
      }),
      expect.objectContaining({
        id: 'aes.endeligEETAfgoerelseDato',
        status: 'error',
        displayValue: 'Fejl (Ugyldig dato)',
      }),
    ]));
  });
});
