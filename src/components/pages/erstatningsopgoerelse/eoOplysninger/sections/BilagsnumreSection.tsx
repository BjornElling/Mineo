import { Box, Typography } from '@mui/material';
import ContentBox from '../../../../layout/ContentBox';
import StyledToggleSwitch from '../../../../inputs/StyledToggleSwitch';
import StyledTextField from '../../../../inputs/StyledTextField';
import { erBilagsnumreRelevant } from '../../../../../domain/erstatningsopgoerelse/helpers/eoInputRelevance';
import { useEoOplysningerVm } from '../eoOplysningerContext';

/** Sektion 9: Bilagsnumre. */
export default function BilagsnumreSection() {
  const { values, getChecked, handleToggleChange, handleStringBlur } = useEoOplysningerVm();

  return (
      <ContentBox className="content-box" data-section-id="bilagsnumre">
        <Typography className="section-header">Bilagsnumre</Typography>

        <Box className="row--label-right-hover">
          <Typography className="row--text">Indsæt bilagsnumre i erstatningsopgørelsen</Typography>
          <Box className="row--label-right-hover__content">
            <StyledToggleSwitch
              name="visBilagsnumre"
              checked={getChecked(values.visBilagsnumre)}
              onCommit={handleToggleChange('visBilagsnumre')}
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
                  <StyledTextField
                    width={130}
                    value={values.bilagsnumreMenAfgoerelse || ''}
                    name="bilagsnumreMenAfgoerelse"
                    onCommit={handleStringBlur('bilagsnumreMenAfgoerelse')}
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
                  <StyledTextField
                    width={130}
                    value={values.bilagsnumreEetAfgoerelser || ''}
                    name="bilagsnumreEetAfgoerelser"
                    onCommit={handleStringBlur('bilagsnumreEetAfgoerelser')}
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
                  <StyledTextField
                    width={130}
                    value={values.bilagsnumreSvieSmerteDokumentation || ''}
                    name="bilagsnumreSvieSmerteDokumentation"
                    onCommit={handleStringBlur('bilagsnumreSvieSmerteDokumentation')}
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
                  <StyledTextField
                    width={130}
                    value={values.bilagsnumreBeregningsgrundlagTaf || ''}
                    name="bilagsnumreBeregningsgrundlagTaf"
                    onCommit={handleStringBlur('bilagsnumreBeregningsgrundlagTaf')}
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
                  <StyledTextField
                    width={130}
                    value={values.bilagsnumreLoenISygeperioden || ''}
                    name="bilagsnumreLoenISygeperioden"
                    onCommit={handleStringBlur('bilagsnumreLoenISygeperioden')}
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
                  <StyledTextField
                    width={130}
                    value={values.bilagsnumreOffentligeYdelser || ''}
                    name="bilagsnumreOffentligeYdelser"
                    onCommit={handleStringBlur('bilagsnumreOffentligeYdelser')}
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
                  <StyledTextField
                    width={130}
                    value={values.bilagsnumreOevrigeErstatningskrav || ''}
                    name="bilagsnumreOevrigeErstatningskrav"
                    onCommit={handleStringBlur('bilagsnumreOevrigeErstatningskrav')}
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
