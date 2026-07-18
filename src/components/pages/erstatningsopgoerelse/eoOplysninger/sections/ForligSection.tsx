import { Box, Typography } from '@mui/material';
import ContentBox from '../../../../layout/ContentBox';
import GreenfieldPercentField from '../../../../../inputCore/react/fields/GreenfieldPercentField';
import GreenfieldFractionField from '../../../../../inputCore/react/fields/GreenfieldFractionField';
import GreenfieldDateField from '../../../../../inputCore/react/fields/GreenfieldDateField';
import {
  eoForligAnsvarsgradBroekField,
  eoForligAnsvarsgradProcentField,
  eoForligDatoField,
} from '../../../../../inputCore/catalog/erstatningsopgoerelseDescriptors';

/** Sektion 2: Forlig om ansvarsgrad + evt. forligsdato. */
export default function ForligSection() {
  return (
      <ContentBox className="content-box" data-section-id="forlig">
        <Typography className="section-header">Forlig</Typography>

        <Box className="row--label-right-hover">
          <Typography className="row--text">Forlig om ansvarsgrad</Typography>
          <Box className="row--label-right-hover__content">
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <Typography className="row--text">Procent</Typography>
              <GreenfieldPercentField
                field={eoForligAnsvarsgradProcentField.bind()}
                location={{ locationId: 'erstatningsopgoerelse.forligAnsvarsgradProcent' }}
                name="forligAnsvarsgradProcent"
                width={100}
              />
              <Typography className="row--text">eller brøk</Typography>
              <GreenfieldFractionField
                field={eoForligAnsvarsgradBroekField.bind()}
                location={{ locationId: 'erstatningsopgoerelse.forligAnsvarsgradBroek' }}
                name="forligAnsvarsgradBroek"
                width={120}
              />
            </Box>
          </Box>
        </Box>

        <Box className="row--label-right-hover">
          <Typography className="row--text">Evt. dato for forlig</Typography>
          <Box className="row--label-right-hover__content">
            <GreenfieldDateField
              field={eoForligDatoField.bind()}
              location={{ locationId: 'erstatningsopgoerelse.forligDato' }}
              name="forligDato"
            />
          </Box>
        </Box>
      </ContentBox>
  );
}
