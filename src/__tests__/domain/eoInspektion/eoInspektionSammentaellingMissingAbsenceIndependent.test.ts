import { STAMDATA_INITIAL_VALUES } from '../../../domain/stamdata/stamdataInitialValues';
import {
  createErstatningsopgoerelseInitialValues,
} from '../../../domain/erstatningsopgoerelse/helpers/erstatningsopgoerelseInitialValues';
import { TAF_BEREGNES_SOM } from '../../../domain/erstatningsopgoerelse/helpers/tafBeregningsenhed';
import { getSammentaellingControlStatus } from '../../../domain/erstatningsopgoerelse/control/eoControlMismatch';
import { buildEOInspektionModel } from '../../../domain/eoInspektion/eoInspektionKontrolModel';
import {
  buildEOInspektionSammentaellingModel,
  buildSvieSmerteContext,
  buildTaftContext,
} from '../../../domain/eoInspektion/eoInspektionSammentaelling';
import type { ErstatningsopgoerelseValues } from '../../../schemas/formSchemas';
import { toISODateString } from '../../../types/branded';

const buildSammentaelling = () => {
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
  return buildEOInspektionSammentaellingModel({
    values,
    model,
    svieSmerteContext: buildSvieSmerteContext(STAMDATA_INITIAL_VALUES, values),
    taftContext: buildTaftContext(STAMDATA_INITIAL_VALUES, values),
  });
};

/**
 * Facit-testen blev skrevet 2026-09-14 og fastholdt dengang også `tabelValue: 5` ved siden af
 * `beregnetValue: null`. Netop den asymmetri viste sig 2026-09-17 at være en fejl: kontrolmodellen
 * læser «beregnet=-, tabel=5» som en uoverensstemmelse, og `control:sammentaelling_mismatch` er en
 * SYSTEMFEJL, der åbner notitsen «Teknisk fejl registreret». En bruger, der lige har sat «Øvrigt
 * fravær uden løn» til Ja og endnu ikke har tastet antallet, fik altså programmet til at melde sig
 * selv som defekt midt i en helt normal indtastning.
 *
 * Testens EGEN pointe – at der ikke vises et beregnet beregningsgrundlag, før fraværsantallet er
 * afsluttet – er uændret. Tabelsiden deler nu blot samme inputgate, jf. `eo-snapshot-contract.md` §6.1.
 */
describe('EO-sammentællingens manglende øvrige fraværsdage', () => {
  it('viser ikke et beregnet beregningsgrundlag før fraværsantallet er afsluttet', () => {
    const sammentaelling = buildSammentaelling();

    expect(sammentaelling.beregningsenhed).toBe(TAF_BEREGNES_SOM.MAANEDER);
    expect(sammentaelling.beregningsperiode).toMatchObject({
      beregnetValue: null,
      beregnetDisplay: '-',
      // Tabelsiden venter med: uden et afsluttet fraværsantal findes der intet gyldigt
      // beregningsgrundlag, og dermed heller ikke et tabeltal at holde den beregnede side op imod.
      tabelValue: null,
      tabelDisplay: '-',
      loseFeriedage: 0,
      oevrigeFravaersdage: 0,
    });
  });

  it('melder ingen kontroluoverensstemmelse, mens fraværsantallet mangler', () => {
    // Den ægte mangel bæres af det røde felt; en systemfejl oven i ville sende brugeren efter en
    // kodefejl i stedet for efter sin egen indtastning.
    expect(getSammentaellingControlStatus(buildSammentaelling().beregningsperiode)).toBe('ok');
  });
});
