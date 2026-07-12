import { Box, Typography } from '@mui/material';
import ContentBox from '../../../../layout/ContentBox';
import StyledPercentField from '../../../../inputs/StyledPercentField';
import StyledFractionField from '../../../../inputs/StyledFractionField';
import StyledDateField from '../../../../inputs/StyledDateField';
import { dateRanges_erstatningsopgoerelse } from '../../../../../config/dateRanges';
import { useEoOplysningerVm } from '../eoOplysningerContext';

/** Sektion 2: Forlig om ansvarsgrad + evt. forligsdato. */
export default function ForligSection() {
  const {
    values,
    handleNumberBlur,
    handleStringBlur,
    handleIsoDateBlur,
    reportForligAnsvarsgradProcentInputError,
    reportForligAnsvarsgradBroekInputError,
    reportForligDatoInputErrorSafe,
    forligFejl,
    skadedatoMinRule,
  } = useEoOplysningerVm();

  return (
      <ContentBox className="content-box" data-section-id="forlig">
        <Typography className="section-header">Forlig</Typography>

        <Box className="row--label-right-hover">
          <Typography className="row--text">Forlig om ansvarsgrad</Typography>
          <Box className="row--label-right-hover__content">
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <Typography className="row--text">Procent</Typography>
              <StyledPercentField
                name="forligAnsvarsgradProcent"
                width={100}
                value={values.forligAnsvarsgradProcent}
                onCommit={handleNumberBlur('forligAnsvarsgradProcent')}
                onFieldError={reportForligAnsvarsgradProcentInputError}
                useDefaultPercentRange
                // En ansvarsgrad på 0 % er ikke gyldig: 0 afvises straks i feltet med rød ring
                // + tooltip via enforceRange — samme kanoniske vej som en værdi over 100 %.
                minValue={1}
                error={forligFejl.harFejl}
                helperText={forligFejl.fejlbesked}
              />
              <Typography className="row--text">eller brøk</Typography>
              <StyledFractionField
                name="forligAnsvarsgradBroek"
                width={120}
                value={values.forligAnsvarsgradBroek}
                onCommit={handleStringBlur('forligAnsvarsgradBroek')}
                onFieldError={reportForligAnsvarsgradBroekInputError}
                error={forligFejl.harFejl}
                helperText={forligFejl.fejlbesked}
              />
            </Box>
          </Box>
        </Box>

        <Box className="row--label-right-hover">
          <Typography className="row--text">Evt. dato for forlig</Typography>
          <Box className="row--label-right-hover__content">
            <StyledDateField
              name="forligDato"
              value={values.forligDato}
              onCommit={handleIsoDateBlur('forligDato')}
              onFieldError={reportForligDatoInputErrorSafe}
              minDate={skadedatoMinRule.minDate}
              maxDate={dateRanges_erstatningsopgoerelse.forligDato.max}
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
