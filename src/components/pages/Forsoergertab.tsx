import React from 'react';
import { Box, Typography } from '@mui/material';
import StyledDateField from '../inputs/StyledDateField';
import StyledIntegerField from '../inputs/StyledIntegerField';
import InsertTodayDateButton from '../inputs/InsertTodayDateButton';
import { createCommitEvent } from '../inputs/fieldEvents';
import ContentBox from '../layout/ContentBox';
import { dateRanges_forsoergertab } from '../../config/dateRanges';
import { usePersistedForm } from '../../hooks/usePersistedForm';
import { usePersistedSection } from '../../hooks/usePersistedSection';
import { useFormFieldErrorReporter, useFormFieldErrors } from '../../hooks/useFormFieldErrors';
import { useAslAarsloenRuleReporter } from '../../hooks/useAslAarsloenRuleReporter';
import { faellesAarsloenSchema, forsoergertabSchema } from '../../schemas/formSchemas';
import { FAELLES_AARSLOEN_INITIAL_VALUES } from '../../domain/faellesAarsloen/faellesAarsloenInitialValues';
import { FORSOERGERTAB_INITIAL_VALUES } from '../../domain/forsoergertab/forsoergertabInitialValues';
import { coerceToISODateString, type ISODateString } from '../../types/branded';
import EetPdfDownloadButton from './erhvervsevnetab/EetPdfDownloadButton';
import AarsloenAmountFieldRow from '../inputs/AarsloenAmountFieldRow';

const maxIso = (a: ISODateString, b: ISODateString): ISODateString => (a > b ? a : b);
const minIso = (a: ISODateString, b: ISODateString): ISODateString => (a < b ? a : b);

// Foreloebig side-skitse til afklaring af layout og inputflow. Den endelige
// forretningslogik, beregninger og afledte resultater for forsoergertab
// implementeres senere, naar de faglige regler er fastlagt.
const Forsoergertab = React.memo(() => {
  const { values, handleChange } = usePersistedForm(
    forsoergertabSchema,
    'forsoergertab',
    FORSOERGERTAB_INITIAL_VALUES
  );
  const { values: faellesAarsloenValues, handleChange: handleFaellesAarsloenChange } = usePersistedForm(
    faellesAarsloenSchema,
    'faellesAarsloen',
    FAELLES_AARSLOEN_INITIAL_VALUES
  );
  const stamdata = usePersistedSection('stamdata');

  const forsoergertabFieldErrors = useFormFieldErrors('forsoergertab');
  const faellesAarsloenFieldErrors = useFormFieldErrors('faellesAarsloen');

  const reportBeregningsdatoError = useFormFieldErrorReporter('forsoergertab', 'beregningsdato', {
    severity: 'error',
    source: 'input',
  });
  const reportVirkningsdatoError = useFormFieldErrorReporter('forsoergertab', 'virkningsdato', {
    severity: 'error',
    source: 'input',
  });
  const reportTilkendtForPeriodeError = useFormFieldErrorReporter('forsoergertab', 'tilkendtForPeriodeAar', {
    severity: 'error',
    source: 'input',
  });
  const reportAslAarsloenError = useFormFieldErrorReporter('faellesAarsloen', 'aslAarsloen', {
    severity: 'error',
    source: 'input',
  });
  const reportEalAarsloenError = useFormFieldErrorReporter('faellesAarsloen', 'ealAarsloen', {
    severity: 'error',
    source: 'input',
  });
  const beregningsdatoInputRef = React.useRef<HTMLInputElement>(null);

  useAslAarsloenRuleReporter(faellesAarsloenValues.aslAarsloen, stamdata?.skadesdato);

  const skadesdatoMin = React.useMemo(() => {
    const iso = coerceToISODateString(stamdata?.skadesdato);
    return iso ?? dateRanges_forsoergertab.virkningsdato.fallbackMin;
  }, [stamdata?.skadesdato]);

  const beregningsdatoMin = React.useMemo(() => {
    const virkningsdato = coerceToISODateString(values.virkningsdato);
    return virkningsdato ? maxIso(skadesdatoMin, virkningsdato) : skadesdatoMin;
  }, [skadesdatoMin, values.virkningsdato]);

  const virkningsdatoMax = React.useMemo(() => {
    const beregningsdato = coerceToISODateString(values.beregningsdato);
    const eetMax = dateRanges_forsoergertab.virkningsdato.max;
    return beregningsdato ? minIso(eetMax, beregningsdato) : eetMax;
  }, [values.beregningsdato]);

  return (
    <Box>
      <Typography className="page-title">Forsørgertab</Typography>

      <ContentBox className="content-box">
        <Typography className="section-header">Beregning</Typography>

        <Box className="row--label-right-hover">
          <Typography className="row--text">Beregningsdato</Typography>
          <Box className="row--label-right-hover__content" sx={{ gap: 1 }}>
            <StyledDateField
              value={values.beregningsdato || undefined}
              onCommit={handleChange('beregningsdato')}
              minDate={beregningsdatoMin}
              maxDate={dateRanges_forsoergertab.beregningsdato.max}
              noValidRangeCause="Skadesdato i Stamdata og Virkningsdato"
              specialRangeErrors={{ maxBoundKind: 'dataCoverageMax', maxBoundFieldLabel: 'Beregningsdato' }}
              error={Boolean(forsoergertabFieldErrors.beregningsdato?.message)}
              helperText={forsoergertabFieldErrors.beregningsdato?.message ?? ''}
              onFieldError={reportBeregningsdatoError}
              inputRef={beregningsdatoInputRef}
            />
            <InsertTodayDateButton
              onCommit={(today) => {
                handleChange('beregningsdato')(createCommitEvent(today));
              }}
              focusRef={beregningsdatoInputRef}
            />
          </Box>
        </Box>

        <Box className="row--label-right-hover">
          <Typography className="row--text">Download specifikation</Typography>
          <Box className="row--label-right-hover__content">
            <EetPdfDownloadButton disabled />
          </Box>
        </Box>

        <Typography className="row--subheading">ASL-ydelse</Typography>

        <AarsloenAmountFieldRow
          label="Årsløn (efter ASL)"
          value={faellesAarsloenValues.aslAarsloen}
          onCommit={handleFaellesAarsloenChange('aslAarsloen')}
          errorMessage={faellesAarsloenFieldErrors.aslAarsloen?.message}
          onFieldError={reportAslAarsloenError}
        />

        <Box className="row--label-right-hover">
          <Typography className="row--text">Virkningsdato</Typography>
          <Box className="row--label-right-hover__content">
            <StyledDateField
              value={values.virkningsdato || undefined}
              onCommit={handleChange('virkningsdato')}
              minDate={skadesdatoMin}
              maxDate={virkningsdatoMax}
              noValidRangeCause="Skadesdato i Stamdata og Beregningsdato"
              specialRangeErrors={{ maxBoundKind: 'dataCoverageMax', maxBoundFieldLabel: 'Virkningsdato' }}
              error={Boolean(forsoergertabFieldErrors.virkningsdato?.message)}
              helperText={forsoergertabFieldErrors.virkningsdato?.message ?? ''}
              onFieldError={reportVirkningsdatoError}
            />
          </Box>
        </Box>

        <Box className="row--label-right-hover">
          <Typography className="row--text">Tilkendt for periode</Typography>
          <Box className="row--label-right-hover__content" sx={{ gap: 1 }}>
            <StyledIntegerField
              value={values.tilkendtForPeriodeAar}
              onCommit={handleChange('tilkendtForPeriodeAar')}
              minValue={1}
              maxValue={10}
              allowNegative={false}
              width={80}
              error={Boolean(forsoergertabFieldErrors.tilkendtForPeriodeAar?.message)}
              helperText={forsoergertabFieldErrors.tilkendtForPeriodeAar?.message ?? ''}
              onFieldError={reportTilkendtForPeriodeError}
            />
            <Typography className="row--text">år</Typography>
          </Box>
        </Box>

        <Typography className="row--subheading">EAL-ydelse</Typography>

        <AarsloenAmountFieldRow
          label="Årsløn (efter EAL)"
          value={faellesAarsloenValues.ealAarsloen}
          onCommit={handleFaellesAarsloenChange('ealAarsloen')}
          errorMessage={faellesAarsloenFieldErrors.ealAarsloen?.message}
          onFieldError={reportEalAarsloenError}
        />
      </ContentBox>
    </Box>
  );
});

Forsoergertab.displayName = 'Forsoergertab';

export default Forsoergertab;
