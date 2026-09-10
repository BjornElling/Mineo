import { EMPTY_FIELD_ISSUE_SET } from '../../../inputCore/inputIssue';
import {
  stamdataAdvokatField,
  stamdataSagsbehandlerField,
} from '../../../inputCore/catalog/stamdataDescriptors';
import { STAMDATA_INITIAL_VALUES } from '../../../domain/stamdata/stamdataInitialValues';
import { buildEoStamdataRows } from '../../../domain/eoRowEvaluation/eoRowStamdataModel';
import { buildTestFieldIssueSetFrom } from '../../utils/fieldIssueTestSupport';

describe('buildEoStamdataRows – Advokat/Sagsbehandler', () => {
  it('samler begge feltfejl i den ene række med Advokat før Sagsbehandler', () => {
    const rows = buildEoStamdataRows(
      { ...STAMDATA_INITIAL_VALUES, advokat: ' AB ', sagsbehandler: ' CD ' },
      buildTestFieldIssueSetFrom([
        { field: stamdataSagsbehandlerField.bind(), message: '  Ugyldige initialer  ' },
        { field: stamdataAdvokatField.bind(), message: '  Ugyldige initialer  ' },
      ])
    );

    expect(rows.find((row) => row.id === 'stamdata.advokatSagsbehandler')).toMatchObject({
      displayValue: 'Fejl (Advokat: Ugyldige initialer; Sagsbehandler: Ugyldige initialer)',
      status: 'error',
    });
  });

  it('viser de to afsluttede værdier samlet, når ingen feltfejl findes', () => {
    const rows = buildEoStamdataRows(
      { ...STAMDATA_INITIAL_VALUES, advokat: ' AB ', sagsbehandler: ' CD ' },
      EMPTY_FIELD_ISSUE_SET
    );

    expect(rows.find((row) => row.id === 'stamdata.advokatSagsbehandler')).toMatchObject({
      displayValue: 'AB / CD',
      status: 'ok',
    });
  });
});
