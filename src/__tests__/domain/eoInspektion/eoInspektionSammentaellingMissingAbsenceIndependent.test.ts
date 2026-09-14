import { STAMDATA_INITIAL_VALUES } from '../../../domain/stamdata/stamdataInitialValues';
import {
  createErstatningsopgoerelseInitialValues,
} from '../../../domain/erstatningsopgoerelse/helpers/erstatningsopgoerelseInitialValues';
import { TAF_BEREGNES_SOM } from '../../../domain/erstatningsopgoerelse/helpers/tafBeregningsenhed';
import { buildEOInspektionModel } from '../../../domain/eoInspektion/eoInspektionKontrolModel';
import {
  buildEOInspektionSammentaellingModel,
  buildSvieSmerteContext,
  buildTaftContext,
} from '../../../domain/eoInspektion/eoInspektionSammentaelling';
import { EMPTY_FIELD_ISSUE_SET } from '../../../inputCore/inputIssue';
import type { ErstatningsopgoerelseValues } from '../../../schemas/formSchemas';
import { toISODateString } from '../../../types/branded';

describe('EO-sammentællingens manglende øvrige fraværsdage', () => {
  it('viser ikke et beregnet beregningsgrundlag før fraværsantallet er afsluttet', () => {
    const values: ErstatningsopgoerelseValues = {
      ...createErstatningsopgoerelseInitialValues(),
      beregnesUdFra: 'Beregningsperiode',
      tafBeregningsperiodeFra: toISODateString('2024-01-08'),
      tafBeregningsperiodeTil: toISODateString('2024-01-12'),
      oevrigtFravaerUdenLoen: 'Ja',
      oevrigeFravaersdage: undefined,
      tafPerioder: [],
      ferieperioder: [],
      fravaerPerioder: [],
    };

    const model = buildEOInspektionModel(values);
    const sammentaelling = buildEOInspektionSammentaellingModel({
      values,
      errors: EMPTY_FIELD_ISSUE_SET,
      model,
      svieSmerteContext: buildSvieSmerteContext(STAMDATA_INITIAL_VALUES, values),
      taftContext: buildTaftContext(STAMDATA_INITIAL_VALUES, values),
    });

    expect(sammentaelling.beregningsenhed).toBe(TAF_BEREGNES_SOM.MAANEDER);
    expect(sammentaelling.beregningsperiode).toMatchObject({
      beregnetValue: null,
      beregnetDisplay: '-',
      tabelValue: 5,
      tabelDisplay: '5',
      loseFeriedage: 0,
      oevrigeFravaersdage: 0,
    });
  });
});
