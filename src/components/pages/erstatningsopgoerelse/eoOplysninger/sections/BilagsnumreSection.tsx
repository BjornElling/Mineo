import { Box, Typography } from '@mui/material';
import ContentBox from '../../../../layout/ContentBox';
import GreenfieldMappedToggleField from '../../../../../inputCore/react/fields/GreenfieldMappedToggleField';
import GreenfieldTextField from '../../../../../inputCore/react/fields/GreenfieldTextField';
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

/** Sektion 9: Bilagsnumre. */
export default function BilagsnumreSection() {
  const { values } = useEoOplysningerVm();

  return (
      <ContentBox className="content-box" data-section-id="bilagsnumre">
        <Typography className="section-header">Bilagsnumre</Typography>

        <Box className="row--label-right-hover">
          <Typography className="row--text">Indsæt bilagsnumre i erstatningsopgørelsen</Typography>
          <Box className="row--label-right-hover__content">
            <GreenfieldMappedToggleField
              field={eoVisBilagsnumreField.bind()}
              location={{ locationId: 'erstatningsopgoerelse.visBilagsnumre' }}
              checkedValue="Ja"
              uncheckedValue="Nej"
              name="visBilagsnumre"
            />
          </Box>
        </Box>

        {erBilagsnumreRelevant(values) && (
          <>
            <Box className="row--label-right-hover">
              <Typography className="row--text">Ménafgørelse</Typography>
              <Box className="row--label-right-hover__content">
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <Typography className="row--text">Bilagsnr.</Typography>
                  <GreenfieldTextField
                    field={eoBilagsnumreMenAfgoerelseField.bind()}
                    location={{ locationId: 'erstatningsopgoerelse.bilagsnumreMenAfgoerelse' }}
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
                  <GreenfieldTextField
                    field={eoBilagsnumreEetAfgoerelserField.bind()}
                    location={{ locationId: 'erstatningsopgoerelse.bilagsnumreEetAfgoerelser' }}
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
                  <GreenfieldTextField
                    field={eoBilagsnumreSvieSmerteDokumentationField.bind()}
                    location={{ locationId: 'erstatningsopgoerelse.bilagsnumreSvieSmerteDokumentation' }}
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
                  <GreenfieldTextField
                    field={eoBilagsnumreBeregningsgrundlagTafField.bind()}
                    location={{ locationId: 'erstatningsopgoerelse.bilagsnumreBeregningsgrundlagTaf' }}
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
                  <GreenfieldTextField
                    field={eoBilagsnumreLoenISygeperiodenField.bind()}
                    location={{ locationId: 'erstatningsopgoerelse.bilagsnumreLoenISygeperioden' }}
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
                  <GreenfieldTextField
                    field={eoBilagsnumreOffentligeYdelserField.bind()}
                    location={{ locationId: 'erstatningsopgoerelse.bilagsnumreOffentligeYdelser' }}
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
                  <GreenfieldTextField
                    field={eoBilagsnumreOevrigeErstatningskravField.bind()}
                    location={{ locationId: 'erstatningsopgoerelse.bilagsnumreOevrigeErstatningskrav' }}
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
