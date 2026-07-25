import { Box, Typography } from '@mui/material';
import ContentBox from '../../../../layout/ContentBox';
import InfoTooltipIcon from '../../../../common/InfoTooltipIcon';
import RadioField from '../../../../../inputCore/react/fields/RadioField';
import AmountField from '../../../../../inputCore/react/fields/AmountField';
import {
  eoKravPaaTabtArbejdsfortjenesteField,
  eoTidligereModtagetTafField,
} from '../../../../../inputCore/catalog/erstatningsopgoerelseDescriptors';
import TafPeriodeTable from '../../../../tables/TafPeriodeTable';
import FerieperiodeTable from '../../../../tables/FerieperiodeTable';
import { erTabtArbejdsfortjenesteSektionAktiv } from '../../../../../domain/erstatningsopgoerelse/helpers/eoInputRelevance';
import { useEoOplysningerVm } from '../eoOplysningerContext';
import { KRAV_JA_NEJ_SKJUL_OPTIONS, PERIODE_INFO_TOOLTIP } from '../eoOplysningerConstants';
import { APP_ROUTES } from '../../../../../config/pageNavigation';
import { EO_TAB_KEYS } from '../../../../../config/eoTabKeys';
// route + tabKey på location er eksplicit navigation-metadata (§3.7); alle felter i denne sektion bor på EO-oplysningerfanen.

/** Sektion 6: Tabt arbejdsfortjeneste (krav, TAF-perioder, ferie i perioden, øvrigt). */
export default function TabtArbejdsfortjenesteSection() {
  const {
    values,
    tafDerived,
    ferieFeriedageById,
  } = useEoOplysningerVm();

  return (
      <ContentBox className="content-box" data-section-id="taf">
        <Typography className="section-header">Tabt arbejdsfortjeneste</Typography>

        <Box className="row--label-right-hover">
          <Typography className="row--text">Er der krav på tabt arbejdsfortjeneste i erstatningsperioden</Typography>
          <Box className="row--label-right-hover__content">
            <RadioField
              field={eoKravPaaTabtArbejdsfortjenesteField.bind()}
              location={{ locationId: 'erstatningsopgoerelse.kravPaaTabtArbejdsfortjeneste', route: APP_ROUTES.erstatningsopgoerelse, tabKey: EO_TAB_KEYS.EO_OPLYSNINGER }}
              name="kravPaaTabtArbejdsfortjeneste"
              row={true}
              options={[...KRAV_JA_NEJ_SKJUL_OPTIONS]}
            />
          </Box>
        </Box>

        {erTabtArbejdsfortjenesteSektionAktiv(values) && (
          <>
            <Typography className="row--subheading">
              Periode:
              <InfoTooltipIcon title={PERIODE_INFO_TOOLTIP} />
            </Typography>
            <TafPeriodeTable
              committedRows={values.tafPerioder}
              derivedById={tafDerived.derivedById}
              derivedColumnHeader={tafDerived.kolonneOverskrift}
              saveOrderPath="erstatningsopgoerelse.tafPerioder"
            />

            <Typography className="row--subheading">Evt. ferie i perioden:</Typography>
            <FerieperiodeTable
              kind="taf"
              committedRows={values.ferieperioder}
              feriedageById={ferieFeriedageById}
              saveOrderPath="erstatningsopgoerelse.ferieperioder"
            />

            <Typography className="row--subheading">Øvrigt</Typography>

            <Box className="row--label-right-hover">
              <Typography className="row--text">Evt. allerede modtaget tabt arbejdsfortjeneste for nuværende erstatningsperiode:</Typography>
              <Box className="row--label-right-hover__content">
                <AmountField
                  field={eoTidligereModtagetTafField.bind()}
                  location={{ locationId: 'erstatningsopgoerelse.tidligereModtagetTaf', route: APP_ROUTES.erstatningsopgoerelse, tabKey: EO_TAB_KEYS.EO_OPLYSNINGER }}
                  name="tidligereModtagetTaf"
                  width={150}
                />
              </Box>
            </Box>

          </>
        )}
      </ContentBox>
  );
}