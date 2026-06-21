import { Box, Typography } from '@mui/material';
import ContentBox from '../../../../layout/ContentBox';
import StyledToggleSwitch from '../../../../inputs/StyledToggleSwitch';
import StyledDateField from '../../../../inputs/StyledDateField';
import { dateRanges_erstatningsopgoerelse } from '../../../../../config/dateRanges';
import {
  erVarigeMenAfgoerelseAktiv,
  erMidlertidigtEETAfgoerelseAktiv,
  erEndeligtEETAfgoerelseAktiv,
  erEETKlageRelevant,
} from '../../../../../domain/erstatningsopgoerelse/helpers/eoInputRelevance';
import { useEoOplysningerVm } from '../eoOplysningerContext';

/** Sektion 3: AES-afgørelser (varige mén, midlertidigt + endeligt EET, øvrigt). */
export default function AesAfgoerelserSection() {
  const {
    values,
    getChecked,
    handleToggleChange,
    handleIsoDateBlur,
    skadedatoMinRule,
    reportMenAfgoerelseDatoInputError,
    reportMidlertidigEETAfgoerelseDatoInputError,
    reportMidlertidigEETVirkningsdatoInputError,
    reportEndeligEETAfgoerelseDatoInputError,
    reportEndeligEETVirkningsdatoInputError,
    reportDifferencekravDatoInputError,
  } = useEoOplysningerVm();

  return (
      <ContentBox className="content-box" data-section-id="aes">
        <Typography className="section-header">AES-afgørelser</Typography>

        {/* Varige mén */}
        <Typography className="row--subheading">
          Varige mén
        </Typography>

        <Box className="row--label-right-hover">
          <Typography className="row--text">Truffet afgørelse om varige mén på 5 % eller derover</Typography>
          <Box className="row--label-right-hover__content">
            <StyledToggleSwitch
              name="varigeMenAfgorelse"
              checked={getChecked(values.varigeMenAfgorelse)}
              onCommit={handleToggleChange('varigeMenAfgorelse')}
            />
          </Box>
        </Box>

        {erVarigeMenAfgoerelseAktiv(values) && (
          <>
            <Box className="row--label-right-hover">
              <Typography className="row--text">Dato for første ménafgørelse</Typography>
              <Box className="row--label-right-hover__content">
                <StyledDateField
                  name="menAfgoerelseDato"
                  value={values.menAfgoerelseDato}
                  onCommit={handleIsoDateBlur('menAfgoerelseDato')}
                  onFieldError={reportMenAfgoerelseDatoInputError}
                  minDate={skadedatoMinRule.minDate}
                  maxDate={dateRanges_erstatningsopgoerelse.menAfgoerelseDato.max}
                  specialRangeErrors={{
                    minBoundKind: skadedatoMinRule.minBoundKind,
                    minBoundReferenceISO: skadedatoMinRule.minBoundReferenceISO,
                  }}
                />
              </Box>
            </Box>

            <Box className="row--label-right-hover">
              <Typography className="row--text">Verserende klagesag over ménafgørelse?</Typography>
              <Box className="row--label-right-hover__content">
                <StyledToggleSwitch
                  name="verserendeKlageMen"
                  checked={getChecked(values.verserendeKlageMen)}
                  onCommit={handleToggleChange('verserendeKlageMen')}
                />
              </Box>
            </Box>
          </>
        )}

        {/* Erhvervsevnetab */}
        <Typography className="row--subheading">
          Midlertidigt erhvervsevnetab
        </Typography>

        <Box className="row--label-right-hover">
          <Typography className="row--text">Truffet afgørelse om midlertidigt erhvervsevnetab på 15 % eller derover</Typography>
          <Box className="row--label-right-hover__content">
            <StyledToggleSwitch
              name="midlertidigtEETAfgorelse"
              checked={getChecked(values.midlertidigtEETAfgorelse)}
              onCommit={handleToggleChange('midlertidigtEETAfgorelse')}
            />
          </Box>
        </Box>

        {erMidlertidigtEETAfgoerelseAktiv(values) && (
          <>
            <Box className="row--label-right-hover">
              <Typography className="row--text">Dato for første midlertidige erhvervsevnetabsafgørelse</Typography>
              <Box className="row--label-right-hover__content">
                <StyledDateField
                  name="midlertidigEETAfgoerelseDato"
                  value={values.midlertidigEETAfgoerelseDato}
                  onCommit={handleIsoDateBlur('midlertidigEETAfgoerelseDato')}
                  onFieldError={reportMidlertidigEETAfgoerelseDatoInputError}
                  minDate={skadedatoMinRule.minDate}
                  maxDate={dateRanges_erstatningsopgoerelse.midlertidigEETAfgoerelseDato.max}
                  specialRangeErrors={{
                    minBoundKind: skadedatoMinRule.minBoundKind,
                    minBoundReferenceISO: skadedatoMinRule.minBoundReferenceISO,
                  }}
                />
              </Box>
            </Box>

            <Box className="row--label-right-hover">
              <Typography className="row--text">Virkningsdato (hvis forskellig fra afgørelsesdatoen)</Typography>
              <Box className="row--label-right-hover__content">
                <StyledDateField
                  name="midlertidigEETVirkningsdato"
                  value={values.midlertidigEETVirkningsdato}
                  onCommit={handleIsoDateBlur('midlertidigEETVirkningsdato')}
                  onFieldError={reportMidlertidigEETVirkningsdatoInputError}
                  minDate={skadedatoMinRule.minDate}
                  maxDate={dateRanges_erstatningsopgoerelse.midlertidigEETVirkningsdato.max}
                  specialRangeErrors={{
                    minBoundKind: skadedatoMinRule.minBoundKind,
                    minBoundReferenceISO: skadedatoMinRule.minBoundReferenceISO,
                  }}
                />
              </Box>
            </Box>
          </>
        )}

        <Typography className="row--subheading">
          Endeligt erhvervsevnetab
        </Typography>

        <Box className="row--label-right-hover">
          <Typography className="row--text">Truffet afgørelse om endeligt erhvervsevnetab på 15 % eller derover</Typography>
          <Box className="row--label-right-hover__content">
            <StyledToggleSwitch
              name="endeligtEETAfgorelse"
              checked={getChecked(values.endeligtEETAfgorelse)}
              onCommit={handleToggleChange('endeligtEETAfgorelse')}
            />
          </Box>
        </Box>

        {erEndeligtEETAfgoerelseAktiv(values) && (
          <>
            <Box className="row--label-right-hover">
              <Typography className="row--text">Dato for endelig erhvervsevnetabsafgørelse</Typography>
              <Box className="row--label-right-hover__content">
                <StyledDateField
                  name="endeligEETAfgoerelseDato"
                  value={values.endeligEETAfgoerelseDato}
                  onCommit={handleIsoDateBlur('endeligEETAfgoerelseDato')}
                  onFieldError={reportEndeligEETAfgoerelseDatoInputError}
                  minDate={skadedatoMinRule.minDate}
                  maxDate={dateRanges_erstatningsopgoerelse.endeligEETAfgoerelseDato.max}
                  specialRangeErrors={{
                    minBoundKind: skadedatoMinRule.minBoundKind,
                    minBoundReferenceISO: skadedatoMinRule.minBoundReferenceISO,
                  }}
                />
              </Box>
            </Box>

            <Box className="row--label-right-hover">
              <Typography className="row--text">Virkningsdato (hvis forskellig fra afgørelsesdatoen)</Typography>
              <Box className="row--label-right-hover__content">
                <StyledDateField
                  name="endeligEETVirkningsdato"
                  value={values.endeligEETVirkningsdato}
                  onCommit={handleIsoDateBlur('endeligEETVirkningsdato')}
                  onFieldError={reportEndeligEETVirkningsdatoInputError}
                  minDate={skadedatoMinRule.minDate}
                  maxDate={dateRanges_erstatningsopgoerelse.endeligEETVirkningsdato.max}
                  specialRangeErrors={{
                    minBoundKind: skadedatoMinRule.minBoundKind,
                    minBoundReferenceISO: skadedatoMinRule.minBoundReferenceISO,
                  }}
                />
              </Box>
            </Box>
          </>
        )}

        <Typography className="row--subheading">
          Øvrigt
        </Typography>

        {erEETKlageRelevant(values) && (
          <Box className="row--label-right-hover">
            <Typography className="row--text">Verserende klagesag over EET-afgørelse?</Typography>
            <Box className="row--label-right-hover__content">
              <StyledToggleSwitch
                name="verserendeKlageEet"
                checked={getChecked(values.verserendeKlageEet)}
                onCommit={handleToggleChange('verserendeKlageEet')}
              />
            </Box>
          </Box>
        )}

        <Box className="row--label-right-hover">
          <Typography className="row--text">Evt. differencekrav opgjort per</Typography>
          <Box className="row--label-right-hover__content">
            <StyledDateField
              name="differencekravDato"
              value={values.differencekravDato}
              onCommit={handleIsoDateBlur('differencekravDato')}
              onFieldError={reportDifferencekravDatoInputError}
              minDate={skadedatoMinRule.minDate}
              maxDate={dateRanges_erstatningsopgoerelse.differencekravDato.max}
              specialRangeErrors={{
                minBoundKind: skadedatoMinRule.minBoundKind,
                minBoundReferenceISO: skadedatoMinRule.minBoundReferenceISO,
              }}
            />
          </Box>
        </Box>
      </ContentBox>
  );
}
