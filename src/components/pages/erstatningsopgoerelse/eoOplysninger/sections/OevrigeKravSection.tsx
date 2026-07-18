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
              location={{ locationId: 'erstatningsopgoerelse.kravPaaOevrigeErstatningskrav' }}
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
