import { Box, Typography } from '@mui/material';
import ContentBox from '../../../../layout/ContentBox';
import InfoTooltipIcon from '../../../../common/InfoTooltipIcon';
import GreenfieldRadioField from '../../../../../inputCore/react/fields/GreenfieldRadioField';
import GreenfieldMappedToggleField from '../../../../../inputCore/react/fields/GreenfieldMappedToggleField';
import GreenfieldYearField from '../../../../../inputCore/react/fields/GreenfieldYearField';
import GreenfieldAmountField from '../../../../../inputCore/react/fields/GreenfieldAmountField';
import GreenfieldSvieSmerteTable from '../../../../tables/GreenfieldSvieSmerteTable';
import {
  eoKravPaaSvieSmerteGodtgoerelseField,
  eoSvieSmerteAktuelPeriodeField,
  eoSvieSmerteDelvisSygemeldingSatsField,
  eoSvieSmerteSatserAarField,
  eoSvieSmerteTidligereTotalField,
  eoTidligereSsMaxField,
} from '../../../../../inputCore/catalog/erstatningsopgoerelseDescriptors';
import {
  erSvieSmerteSektionAktiv,
  erSvieSmertePeriodeInputRelevant,
  erSvieSmerteTidligereTotalRelevant,
} from '../../../../../domain/erstatningsopgoerelse/helpers/eoInputRelevance';
import { useEoOplysningerVm } from '../eoOplysningerContext';
import {
  KRAV_JA_NEJ_SKJUL_OPTIONS,
  PERIODE_INFO_TOOLTIP,
  DELVIS_SYGEMELDING_SATS_INFO_TOOLTIP,
} from '../eoOplysningerConstants';
import { APP_ROUTES } from '../../../../../config/pageNavigation';
import { EO_TAB_KEYS } from '../../../../../config/eoTabKeys';
// route + tabKey på location er eksplicit navigation-metadata (§3.7); alle felter i denne sektion bor på EO-oplysningerfanen.

/** Sektion 4: Svie- og smertegodtgørelse (krav, periode-tabel, satser, tidligere godtgørelse). */
export default function SvieSmerteSection() {
  const {
    values,
    svie,
  } = useEoOplysningerVm();

  return (
      <ContentBox className="content-box" data-section-id="sviesmerte">
        <Typography className="section-header">Svie- og smertegodtgørelse</Typography>

        <Box className="row--label-right-hover">
          <Typography className="row--text">Er der krav på svie- og smertegodtgørelse i erstatningsperioden</Typography>
          <Box className="row--label-right-hover__content">
            <GreenfieldRadioField
              field={eoKravPaaSvieSmerteGodtgoerelseField.bind()}
              location={{ locationId: 'erstatningsopgoerelse.kravPaaSvieSmerteGodtgoerelse', route: APP_ROUTES.erstatningsopgoerelse, tabKey: EO_TAB_KEYS.EO_OPLYSNINGER }}
              name="kravPaaSvieSmerteGodtgoerelse"
              row={true}
              options={[...KRAV_JA_NEJ_SKJUL_OPTIONS]}
            />
          </Box>
        </Box>

        {erSvieSmerteSektionAktiv(values) && (
          <>
            <Box className="row--label-right-hover">
              <Typography className="row--text">Tidligere beregnet S/S til max.</Typography>
              <Box className="row--label-right-hover__content">
                <GreenfieldMappedToggleField
                  field={eoTidligereSsMaxField.bind()}
                  location={{ locationId: 'erstatningsopgoerelse.tidligereSsMax', route: APP_ROUTES.erstatningsopgoerelse, tabKey: EO_TAB_KEYS.EO_OPLYSNINGER }}
                  checkedValue="Ja"
                  uncheckedValue="Nej"
                  name="tidligereSsMax"
                />
              </Box>
            </Box>

            {/* Periode-input deler præcis beregningens relevans-prædikat (sektion aktiv +
                ikke "tidligere S/S til max"), så synlighed og neutralisering ikke kan divergere. */}
            {erSvieSmertePeriodeInputRelevant(values) && (
              <>
                <Typography className="row--subheading">
                  Periode:
                  <InfoTooltipIcon title={PERIODE_INFO_TOOLTIP} />
                </Typography>
                <GreenfieldSvieSmerteTable
                  committedRows={values.svieSmertePerioder}
                  derivedById={svie.derivedById}
                  saveOrderPath="erstatningsopgoerelse.svieSmertePerioder"
                />

                <Box className="row--label-right-hover">
                  <Typography className="row--text">Hvilket års svie/smerte-satser lægges til grund?</Typography>
                  <Box className="row--label-right-hover__content">
                    <GreenfieldYearField
                      field={eoSvieSmerteSatserAarField.bind()}
                      location={{ locationId: 'erstatningsopgoerelse.svieSmerteSatserAar', route: APP_ROUTES.erstatningsopgoerelse, tabKey: EO_TAB_KEYS.EO_OPLYSNINGER }}
                      name="svieSmerteSatserAar"
                      width={100}
                    />
                  </Box>
                </Box>

                <Box className="row--label-right-hover">
                  <Typography className="row--text">
                    Svie/smerte-sats ved delvis sygemelding:
                    <InfoTooltipIcon title={DELVIS_SYGEMELDING_SATS_INFO_TOOLTIP} />
                  </Typography>
                  <Box className="row--label-right-hover__content">
                    <GreenfieldRadioField
                      field={eoSvieSmerteDelvisSygemeldingSatsField.bind()}
                      location={{ locationId: 'erstatningsopgoerelse.svieSmerteDelvisSygemeldingSats', route: APP_ROUTES.erstatningsopgoerelse, tabKey: EO_TAB_KEYS.EO_OPLYSNINGER }}
                      name="svieSmerteDelvisSygemeldingSats"
                      row={true}
                      options={[
                        { value: 'fuld', label: 'Fuld sats' },
                        { value: 'halv', label: 'Halv sats' },
                      ]}
                    />
                  </Box>
                </Box>

                <Typography className="row--subheading">Tidligere svie- og smertegodtgørelse</Typography>

                {/* Synlighed deler samme predikat som beregningens neutralisering,
                    så feltet aldrig kan være skjult i UI'en men aktivt i beregningen. */}
                {erSvieSmerteTidligereTotalRelevant(values) && (
                  <Box className="row--label-right-hover">
                    <Typography className="row--text">Svie/smerte-krav i tidligere erstatningsopgørelser:</Typography>
                    <Box className="row--label-right-hover__content">
                      <GreenfieldAmountField
                        field={eoSvieSmerteTidligereTotalField.bind()}
                        location={{ locationId: 'erstatningsopgoerelse.svieSmerteTidligereTotal', route: APP_ROUTES.erstatningsopgoerelse, tabKey: EO_TAB_KEYS.EO_OPLYSNINGER }}
                        name="svieSmerteTidligereTotal"
                        width={150}
                      />
                    </Box>
                  </Box>
                )}

                <Box className="row--label-right-hover">
                  <Typography className="row--text">Evt. allerede modtaget svie/smerte for nuværende erstatningsperiode:</Typography>
                  <Box className="row--label-right-hover__content">
                    <GreenfieldAmountField
                      field={eoSvieSmerteAktuelPeriodeField.bind()}
                      location={{ locationId: 'erstatningsopgoerelse.svieSmerteAktuelPeriode', route: APP_ROUTES.erstatningsopgoerelse, tabKey: EO_TAB_KEYS.EO_OPLYSNINGER }}
                      name="svieSmerteAktuelPeriode"
                      width={150}
                    />
                  </Box>
                </Box>
              </>
            )}
          </>
        )}
      </ContentBox>
  );
}