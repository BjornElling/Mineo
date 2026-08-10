import { Box, Typography } from '@mui/material';
import ContentBox from '../../../../layout/ContentBox';
import LabeledControlRow from '../../../../layout/LabeledControlRow';
import MappedToggleField from '../../../../../inputCore/react/fields/MappedToggleField';
import TextField from '../../../../../inputCore/react/fields/TextField';
import {
  eoBilagsnumreBeregningsgrundlagTafField,
  eoBilagsnumreEetAfgoerelserField,
  eoBilagsnumreLoenISygeperiodenField,
  eoBilagsnumreMenAfgoerelseField,
  eoBilagsnumreOffentligeYdelserField,
  eoBilagsnumreOevrigeErstatningskravField,
  eoBilagsnumreSvieSmerteDokumentationField,
  eoVisBilagsnumreField,
} from '../../../../../inputCore/catalog/erstatningsopgoerelseDescriptors';
import { erBilagsnumreRelevant } from '../../../../../domain/erstatningsopgoerelse/helpers/eoInputRelevance';
import { useEoOplysningerVm } from '../eoOplysningerContext';
import { APP_ROUTES } from '../../../../../config/pageNavigation';
import { EO_TAB_KEYS } from '../../../../../config/eoTabKeys';
// route + tabKey på location er eksplicit navigation-metadata (§3.7); alle felter i denne sektion bor på EO-oplysningerfanen.

/** Sektion 9: Bilagsnumre. */
export default function BilagsnumreSection() {
  const { values } = useEoOplysningerVm();

  return (
      <ContentBox className="content-box" data-section-id="bilagsnumre">
        <Typography className="section-header">Bilagsnumre</Typography>

        <LabeledControlRow label="Indsæt bilagsnumre i erstatningsopgørelsen">
          {({ labelledBy, controlId }) => (
            <MappedToggleField
              field={eoVisBilagsnumreField.bind()}
              location={{ locationId: 'erstatningsopgoerelse.visBilagsnumre', route: APP_ROUTES.erstatningsopgoerelse, tabKey: EO_TAB_KEYS.EO_OPLYSNINGER }}
              checkedValue="Ja"
              uncheckedValue="Nej"
              name="visBilagsnumre"
              id={controlId}
              labelledBy={labelledBy}
            />
          )}
        </LabeledControlRow>

        {erBilagsnumreRelevant(values) && (
          <>
            <Box className="row--label-right-hover">
              <Typography className="row--text">Ménafgørelse</Typography>
              <Box className="row--label-right-hover__content">
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <Typography className="row--text">Bilagsnr.</Typography>
                  <TextField
                    field={eoBilagsnumreMenAfgoerelseField.bind()}
                    location={{ locationId: 'erstatningsopgoerelse.bilagsnumreMenAfgoerelse', route: APP_ROUTES.erstatningsopgoerelse, tabKey: EO_TAB_KEYS.EO_OPLYSNINGER }}
                    width={130}
                    name="bilagsnumreMenAfgoerelse"
                    sx={{ '& .MuiInputBase-input': { textAlign: 'center' } }}
                  />
                </Box>
              </Box>
            </Box>

            <Box className="row--label-right-hover">
              <Typography className="row--text">EET-afgørelser</Typography>
              <Box className="row--label-right-hover__content">
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <Typography className="row--text">Bilagsnr.</Typography>
                  <TextField
                    field={eoBilagsnumreEetAfgoerelserField.bind()}
                    location={{ locationId: 'erstatningsopgoerelse.bilagsnumreEetAfgoerelser', route: APP_ROUTES.erstatningsopgoerelse, tabKey: EO_TAB_KEYS.EO_OPLYSNINGER }}
                    width={130}
                    name="bilagsnumreEetAfgoerelser"
                    sx={{ '& .MuiInputBase-input': { textAlign: 'center' } }}
                  />
                </Box>
              </Box>
            </Box>

            <Box className="row--label-right-hover">
              <Typography className="row--text">Svie/smerte-dokumentation</Typography>
              <Box className="row--label-right-hover__content">
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <Typography className="row--text">Bilagsnr.</Typography>
                  <TextField
                    field={eoBilagsnumreSvieSmerteDokumentationField.bind()}
                    location={{ locationId: 'erstatningsopgoerelse.bilagsnumreSvieSmerteDokumentation', route: APP_ROUTES.erstatningsopgoerelse, tabKey: EO_TAB_KEYS.EO_OPLYSNINGER }}
                    width={130}
                    name="bilagsnumreSvieSmerteDokumentation"
                    sx={{ '& .MuiInputBase-input': { textAlign: 'center' } }}
                  />
                </Box>
              </Box>
            </Box>

            <Box className="row--label-right-hover">
              <Typography className="row--text">Beregningsgrundlag for TAF</Typography>
              <Box className="row--label-right-hover__content">
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <Typography className="row--text">Bilagsnr.</Typography>
                  <TextField
                    field={eoBilagsnumreBeregningsgrundlagTafField.bind()}
                    location={{ locationId: 'erstatningsopgoerelse.bilagsnumreBeregningsgrundlagTaf', route: APP_ROUTES.erstatningsopgoerelse, tabKey: EO_TAB_KEYS.EO_OPLYSNINGER }}
                    width={130}
                    name="bilagsnumreBeregningsgrundlagTaf"
                    sx={{ '& .MuiInputBase-input': { textAlign: 'center' } }}
                  />
                </Box>
              </Box>
            </Box>

            <Box className="row--label-right-hover">
              <Typography className="row--text">Løn i sygeperioden</Typography>
              <Box className="row--label-right-hover__content">
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <Typography className="row--text">Bilagsnr.</Typography>
                  <TextField
                    field={eoBilagsnumreLoenISygeperiodenField.bind()}
                    location={{ locationId: 'erstatningsopgoerelse.bilagsnumreLoenISygeperioden', route: APP_ROUTES.erstatningsopgoerelse, tabKey: EO_TAB_KEYS.EO_OPLYSNINGER }}
                    width={130}
                    name="bilagsnumreLoenISygeperioden"
                    sx={{ '& .MuiInputBase-input': { textAlign: 'center' } }}
                  />
                </Box>
              </Box>
            </Box>

            <Box className="row--label-right-hover">
              <Typography className="row--text">Offentlige ydelser</Typography>
              <Box className="row--label-right-hover__content">
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <Typography className="row--text">Bilagsnr.</Typography>
                  <TextField
                    field={eoBilagsnumreOffentligeYdelserField.bind()}
                    location={{ locationId: 'erstatningsopgoerelse.bilagsnumreOffentligeYdelser', route: APP_ROUTES.erstatningsopgoerelse, tabKey: EO_TAB_KEYS.EO_OPLYSNINGER }}
                    width={130}
                    name="bilagsnumreOffentligeYdelser"
                    sx={{ '& .MuiInputBase-input': { textAlign: 'center' } }}
                  />
                </Box>
              </Box>
            </Box>

            <Box className="row--label-right-hover">
              <Typography className="row--text">Øvrige erstatningskrav</Typography>
              <Box className="row--label-right-hover__content">
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <Typography className="row--text">Bilagsnr.</Typography>
                  <TextField
                    field={eoBilagsnumreOevrigeErstatningskravField.bind()}
                    location={{ locationId: 'erstatningsopgoerelse.bilagsnumreOevrigeErstatningskrav', route: APP_ROUTES.erstatningsopgoerelse, tabKey: EO_TAB_KEYS.EO_OPLYSNINGER }}
                    width={130}
                    name="bilagsnumreOevrigeErstatningskrav"
                    sx={{ '& .MuiInputBase-input': { textAlign: 'center' } }}
                  />
                </Box>
              </Box>
            </Box>
          </>
        )}
      </ContentBox>
  );
}