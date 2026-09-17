import { EMPTY_FIELD_ISSUE_SET } from '../../../inputCore/inputIssue';
import {
  stamdataAdvokatField,
  stamdataSagsbehandlerField,
} from '../../../inputCore/catalog/stamdataDescriptors';
import { STAMDATA_INITIAL_VALUES } from '../../../domain/stamdata/stamdataInitialValues';
import { buildEoStamdataRows } from '../../../domain/eoRowEvaluation/eoRowStamdataModel';
import { buildTestFieldIssueSetFrom } from '../../utils/fieldIssueTestSupport';
import type { AfsluttesMed } from '../../../schemas/formSchemas';

describe('buildEoStamdataRows – Advokat/Sagsbehandler', () => {
  it('samler begge feltfejl i den ene række med Advokat før Sagsbehandler', () => {
    const rows = buildEoStamdataRows(
      { ...STAMDATA_INITIAL_VALUES, advokat: ' AB ', sagsbehandler: ' CD ' },
      buildTestFieldIssueSetFrom([
        { field: stamdataSagsbehandlerField.bind(), message: '  Ugyldige initialer  ' },
        { field: stamdataAdvokatField.bind(), message: '  Ugyldige initialer  ' },
      ]),
      'Bekræftet godkendt'
    );

    expect(rows.find((row) => row.id === 'stamdata.advokatSagsbehandler')).toMatchObject({
      displayValue: 'Fejl (Advokat: Ugyldige initialer; Sagsbehandler: Ugyldige initialer)',
      status: 'error',
    });
  });

  it('viser de to afsluttede værdier samlet, når ingen feltfejl findes', () => {
    const rows = buildEoStamdataRows(
      { ...STAMDATA_INITIAL_VALUES, advokat: ' AB ', sagsbehandler: ' CD ' },
      EMPTY_FIELD_ISSUE_SET,
      'Bekræftet godkendt'
    );

    expect(rows.find((row) => row.id === 'stamdata.advokatSagsbehandler')).toMatchObject({
      displayValue: 'AB / CD',
      status: 'ok',
    });
  });
});

describe('buildEoStamdataRows – Skadelidtes navn og afslutningsformen', () => {
  const rowsFor = (skadelidte: string, afsluttesMed: AfsluttesMed) =>
    buildEoStamdataRows(
      { ...STAMDATA_INITIAL_VALUES, skadelidte },
      EMPTY_FIELD_ISSUE_SET,
      afsluttesMed
    ).find((row) => row.id === 'stamdata.skadelidte');

  it('blokerer med en navngiven årsag, når navnet mangler og opgørelsen afsluttes med en underskrift-linje', () => {
    // Uden reglen skrev dokumentet ordret `*skadelidtes navn*` under underskriftslinjen, mens download
    // var tilladt og den eneste advarsel handlede om brevhovedet (BB-214).
    expect(rowsFor('', 'Underskrift-linje')).toMatchObject({
      displayValue: 'Fejl (Skadelidtes navn skal angives, når opgørelsen afsluttes med en underskrift-linje)',
      status: 'error',
    });
  });

  it.each<AfsluttesMed>(['Bekræftet godkendt', 'Ingen'])(
    'lader et manglende navn blive en ren advarsel ved «%s»',
    (afsluttesMed) => {
      expect(rowsFor('', afsluttesMed)).toMatchObject({ displayValue: '-', status: 'warning' });
    }
  );

  it('er i orden, når navnet er udfyldt og underskrift-linjen er valgt', () => {
    expect(rowsFor(' Anne Berg ', 'Underskrift-linje')).toMatchObject({
      displayValue: 'Anne Berg',
      status: 'ok',
    });
  });
});
