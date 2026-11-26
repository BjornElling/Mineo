import { Box, Typography } from '@mui/material';
import ContentBox from '../../../../layout/ContentBox';
import PercentField from '../../../../../inputCore/react/fields/PercentField';
import FractionField from '../../../../../inputCore/react/fields/FractionField';
import DateField from '../../../../../inputCore/react/fields/DateField';
import {
  eoForligAnsvarsgradBroekField,
  eoForligAnsvarsgradProcentField,
  eoForligDatoField,
} from '../../../../../inputCore/catalog/erstatningsopgoerelseDescriptors';
import { useEoOplysningerVm } from '../eoOplysningerContext';
import { createFieldWarning } from '../../../../../inputCore/fieldWarning';
import { resolveForligDatoEfterOpgoerelseMessage } from '../../../../../domain/erstatningsopgoerelse/validation/forligOgStatusDatoEfterOpgoerelse';
import { APP_ROUTES } from '../../../../../config/pageNavigation';
import { EO_TAB_KEYS } from '../../../../../config/eoTabKeys';
// route + tabKey på location er eksplicit navigation-metadata (§2.7); alle felter i denne sektion bor på EO-oplysningerfanen.

/** Sektion 2: Forlig om ansvarsgrad + evt. forligsdato. */
export default function ForligSection() {
  const { values } = useEoOplysningerVm();
  // Gul ring på en forligsdato efter «Opgørelse lavet den» – samme regel og tekst som «Fejl og advarsler»
  // . Kun her: EET oplysninger har ingen dokumentdato at sammenligne med.
  const forligDatoMessage = resolveForligDatoEfterOpgoerelseMessage(values);
  const forligDatoWarning = forligDatoMessage === undefined ? undefined : createFieldWarning(forligDatoMessage);

  return (
      <ContentBox className="content-box" data-section-id="forlig">
        <Typography className="section-header">Forlig</Typography>

        <Box className="row--label-right-hover">
          <Typography className="row--text">Forlig om ansvarsgrad</Typography>
          <Box className="row--label-right-hover__content">
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <Typography className="row--text">Procent</Typography>
              <PercentField
                field={eoForligAnsvarsgradProcentField.bind()}
                location={{ locationId: 'erstatningsopgoerelse.forligAnsvarsgradProcent', route: APP_ROUTES.erstatningsopgoerelse, tabKey: EO_TAB_KEYS.EO_OPLYSNINGER }}
                name="forligAnsvarsgradProcent"
                width={100}
              />
              <Typography className="row--text">eller brøk</Typography>
              <FractionField
                field={eoForligAnsvarsgradBroekField.bind()}
                location={{ locationId: 'erstatningsopgoerelse.forligAnsvarsgradBroek', route: APP_ROUTES.erstatningsopgoerelse, tabKey: EO_TAB_KEYS.EO_OPLYSNINGER }}
                name="forligAnsvarsgradBroek"
                width={120}
              />
            </Box>
          </Box>
        </Box>

        <Box className="row--label-right-hover">
          <Typography className="row--text">Evt. dato for forlig</Typography>
          <Box className="row--label-right-hover__content">
            <DateField
              field={eoForligDatoField.bind()}
              location={{ locationId: 'erstatningsopgoerelse.forligDato', route: APP_ROUTES.erstatningsopgoerelse, tabKey: EO_TAB_KEYS.EO_OPLYSNINGER }}
              name="forligDato"
              {...(forligDatoWarning === undefined ? {} : { warning: forligDatoWarning })}
            />
          </Box>
        </Box>
      </ContentBox>
  );
}
