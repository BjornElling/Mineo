import { Box, Typography } from '@mui/material';
import ContentBox from '../../../../layout/ContentBox';
import GreenfieldRadioField from '../../../../../inputCore/react/fields/GreenfieldRadioField';
import GreenfieldOevrigeKravTable from '../../../../tables/GreenfieldOevrigeKravTable';
import {
  eoKravPaaOevrigeErstatningskravField,
} from '../../../../../inputCore/catalog/erstatningsopgoerelseDescriptors';
import { erOevrigeKravSektionAktiv } from '../../../../../domain/erstatningsopgoerelse/helpers/eoInputRelevance';
import { useEoOplysningerVm } from '../eoOplysningerContext';
import { KRAV_JA_NEJ_SKJUL_OPTIONS } from '../eoOplysningerConstants';
import { APP_ROUTES } from '../../../../../config/pageNavigation';
import { EO_TAB_KEYS } from '../../../../../config/eoTabKeys';
// route + tabKey på location er eksplicit navigation-metadata (§3.7); alle felter i denne sektion bor på EO-oplysningerfanen.

/** Sektion 7: Øvrige erstatningskrav. */
export default function OevrigeKravSection() {
  const {
    values,
  } = useEoOplysningerVm();

  return (
      <ContentBox className="content-box" data-section-id="oevrige-krav">
        <Typography className="section-header">Øvrige erstatningskrav</Typography>

        <Box className="row--label-right-hover">
          <Typography className="row--text">Er der øvrige krav i erstatningsperioden</Typography>
          <Box className="row--label-right-hover__content">
            <GreenfieldRadioField
              field={eoKravPaaOevrigeErstatningskravField.bind()}
              location={{ locationId: 'erstatningsopgoerelse.kravPaaOevrigeErstatningskrav', route: APP_ROUTES.erstatningsopgoerelse, tabKey: EO_TAB_KEYS.EO_OPLYSNINGER }}
              name="kravPaaOevrigeErstatningskrav"
              row={true}
              options={[...KRAV_JA_NEJ_SKJUL_OPTIONS]}
            />
          </Box>
        </Box>

        {erOevrigeKravSektionAktiv(values) && (
          <GreenfieldOevrigeKravTable
            committedRows={values.oevrigeKravPerioder}
            saveOrderPath="erstatningsopgoerelse.oevrigeKravPerioder"
          />
        )}
      </ContentBox>
  );
}