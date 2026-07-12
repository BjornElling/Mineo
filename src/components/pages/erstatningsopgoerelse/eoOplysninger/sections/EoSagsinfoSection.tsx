import { Box, MenuItem, Typography } from '@mui/material';
import ContentBox from '../../../../layout/ContentBox';
import StyledTextField from '../../../../inputs/StyledTextField';
import StyledToggleSwitch from '../../../../inputs/StyledToggleSwitch';
import StyledDateField from '../../../../inputs/StyledDateField';
import StyledDropdown from '../../../../inputs/StyledDropdown';
import InsertTodayDateButton from '../../../../inputs/InsertTodayDateButton';
import { dateRanges_erstatningsopgoerelse } from '../../../../../config/dateRanges';
import { afsluttesMedEnum } from '../../../../../schemas/formSchemas';
import { useEoOplysningerVm } from '../eoOplysningerContext';

/** Sektion 1: Erstatningsopgørelse-info (nummer, periode, status, bekræftelse). */
export default function EoSagsinfoSection() {
  const {
    values,
    getChecked,
    handleStringBlur,
    handleToggleChange,
    handleIsoDateBlur,
    handleHelbredsfoholdChange,
    handleArbejdssituationChange,
    handleAfsluttesMedChange,
    reportVedroererPeriodeFraInputError,
    reportVedroererPeriodeTilInputError,
    reportOpgoerelseLavetDenInputError,
    skadedatoMinRule,
    opgoerelseLavetDenMinRule,
    opgoerelseLavetDenInputRef,
    statusSubheaderLabel,
    setValues,
  } = useEoOplysningerVm();

  return (
      <ContentBox className="content-box">
        <Typography className="section-header">Erstatningsopgørelse</Typography>

        <Box className="row--label-right-hover" sx={{ '--label-width': '250px' }}>
          <Typography className="row--text">Erstatningsopgørelse</Typography>
          <Box className="row--label-right-hover__content">
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <Typography className="row--text">Nummer</Typography>
              <StyledTextField
                name="eoNummer"
                width={80}
                value={values.eoNummer || ''}
                onCommit={handleStringBlur('eoNummer')}
                sx={{ '& .MuiInputBase-input': { textAlign: 'center' } }}
              />
              <Typography className="row--text">+ evt. ledsagetekst</Typography>
              <StyledTextField
                name="eoLedsagetekst"
                width={200}
                value={values.eoLedsagetekst || ''}
                onCommit={handleStringBlur('eoLedsagetekst')}
              />
            </Box>
          </Box>
        </Box>

        <Box className="row--label-right-hover">
          <Typography className="row--text">Revideret opgørelse</Typography>
          <Box className="row--label-right-hover__content">
            <StyledToggleSwitch
              name="revideretOpgoerelse"
              checked={getChecked(values.revideretOpgoerelse)}
              onCommit={handleToggleChange('revideretOpgoerelse')}
            />
          </Box>
        </Box>

        <Box className="row--label-right-hover">
          <Typography className="row--text">Vedrører perioden</Typography>
          <Box className="row--label-right-hover__content">
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <StyledDateField
                name="vedroererPeriodeFra"
                value={values.vedroererPeriodeFra}
                onCommit={handleIsoDateBlur('vedroererPeriodeFra')}
                onFieldError={reportVedroererPeriodeFraInputError}
                minDate={skadedatoMinRule.minDate}
                maxDate={values.vedroererPeriodeTil || dateRanges_erstatningsopgoerelse.periodeFra.fallbackMax}
                specialRangeErrors={{
                  fraTilRole: 'fra',
                  minBoundKind: skadedatoMinRule.minBoundKind,
                  minBoundReferenceISO: skadedatoMinRule.minBoundReferenceISO,
                }}
              />
              <Typography className="row--text">til og med</Typography>
              <StyledDateField
                name="vedroererPeriodeTil"
                value={values.vedroererPeriodeTil}
                onCommit={handleIsoDateBlur('vedroererPeriodeTil')}
                onFieldError={reportVedroererPeriodeTilInputError}
                minDate={values.vedroererPeriodeFra || dateRanges_erstatningsopgoerelse.periodeTil.fallbackMin}
                maxDate={dateRanges_erstatningsopgoerelse.periodeTil.max}
                specialRangeErrors={{ fraTilRole: 'til' }}
              />
            </Box>
          </Box>
        </Box>

        <Box className="row--label-right-hover">
          <Typography className="row--text">Opgørelse lavet den</Typography>
          <Box className="row--label-right-hover__content">
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <StyledDateField
                name="opgørelseLavetDen"
                value={values.opgørelseLavetDen}
                onCommit={handleIsoDateBlur('opgørelseLavetDen')}
                onFieldError={reportOpgoerelseLavetDenInputError}
                inputRef={opgoerelseLavetDenInputRef}
                minDate={opgoerelseLavetDenMinRule.minDate}
                maxDate={dateRanges_erstatningsopgoerelse.opgoerelse.max}
                specialRangeErrors={{
                  minBoundKind: opgoerelseLavetDenMinRule.minBoundKind,
                  minBoundReferenceISO: opgoerelseLavetDenMinRule.minBoundReferenceISO,
                }}
              />
              <InsertTodayDateButton
                onCommit={(today) => {
                  return setValues((prev) => ({ ...prev, opgørelseLavetDen: today }), { fieldPath: 'opgørelseLavetDen' });
                }}
                focusRef={opgoerelseLavetDenInputRef}
              />
            </Box>
          </Box>
        </Box>

        <Box className="row--label-right-hover">
          <Typography className="row--text">Indsæt udkast-stempel</Typography>
          <Box className="row--label-right-hover__content">
            <StyledToggleSwitch
              name="indsaetUdkastStempel"
              checked={getChecked(values.indsaetUdkastStempel)}
              onCommit={handleToggleChange('indsaetUdkastStempel')}
            />
          </Box>
        </Box>

        <Typography className="row--subheading">{statusSubheaderLabel}</Typography>

        <Box className="row--label-right-hover">
          <Typography className="row--text">Helbredsforhold</Typography>
          <Box className="row--label-right-hover__content">
            <StyledDropdown
              name="svieSmerteHelbredsstatus"
              width={200}
              value={values.svieSmerteHelbredsstatus}
              onChange={handleHelbredsfoholdChange}
            >
              <MenuItem value="Sygemeldt">Sygemeldt</MenuItem>
              <MenuItem value="Delvist Sygemeldt">Delvist Sygemeldt</MenuItem>
              <MenuItem value="Raskmeldt">Raskmeldt</MenuItem>
            </StyledDropdown>
          </Box>
        </Box>

        <Box className="row--label-right-hover">
          <Typography className="row--text">Arbejdssituation</Typography>
          <Box className="row--label-right-hover__content">
            <StyledDropdown
              name="tafArbejdsstatus"
              width={200}
              value={values.tafArbejdsstatus}
              onChange={handleArbejdssituationChange}
            >
              <MenuItem value="Uarbejdsdygtig">Uarbejdsdygtig</MenuItem>
              <MenuItem value="Delvist raskmeldt">Delvist raskmeldt</MenuItem>
              <MenuItem value="Fuldt arbejdsdygtig">Fuldt arbejdsdygtig</MenuItem>
              <StyledDropdown.Divider />
              <MenuItem value="Efterløn">Efterløn</MenuItem>
              <MenuItem value="Fleksjob">Fleksjob</MenuItem>
              <MenuItem value="Folkepension">Folkepension</MenuItem>
              <MenuItem value="Førtidspension">Førtidspension</MenuItem>
              <MenuItem value="Kontanthjælp">Kontanthjælp</MenuItem>
              <MenuItem value="Revalidering">Revalidering</MenuItem>
              <MenuItem value="Seniorpension">Seniorpension</MenuItem>
              <MenuItem value="Uddannelse">Uddannelse</MenuItem>
            </StyledDropdown>
          </Box>
        </Box>

        <Typography className="row--subheading">Bekræftelse</Typography>

        <Box className="row--label-right-hover">
          <Typography className="row--text">Erstatningsopgørelse afsluttes med</Typography>
          <Box className="row--label-right-hover__content">
            <StyledDropdown
              name="erstatningsopgoerelseAfsluttesMed"
              allowEmpty={false}
              width={220}
              value={values.erstatningsopgoerelseAfsluttesMed}
              onChange={handleAfsluttesMedChange}
            >
              {afsluttesMedEnum.options.map((option) => (
                <MenuItem key={option} value={option}>
                  {option}
                </MenuItem>
              ))}
            </StyledDropdown>
          </Box>
        </Box>
      </ContentBox>
  );
}
