import React from 'react';
import { Box, Typography } from '@mui/material';
import StyledDateField from '../../inputs/StyledDateField';
import StyledAmountField from '../../inputs/StyledAmountField';
import StyledPercentField from '../../inputs/StyledPercentField';
import InsertTodayDateButton from '../../inputs/InsertTodayDateButton';
import ContentBox from '../../layout/ContentBox';
import EetAslAfgoerelserTable from '../../tables/EetAslAfgoerelserTable';
import { dateRanges_stamdata, dateRanges_erhvervsevnetab } from '../../../config/dateRanges';
import {
  stamdataSchema,
  type ErhvervsevnetabValues,
} from '../../../schemas/formSchemas';
import { coerceToISODateString } from '../../../types/branded';
import { usePersistedForm } from '../../../hooks/usePersistedForm';
import { STAMDATA_INITIAL_VALUES } from '../../../domain/stamdata/stamdataInitialValues';
import { createCommitEvent, type CommitHandler } from '../../inputs/fieldEvents';
import { validatePercentDivisibleBy5FromValue } from '../../../domain/erhvervsevnetab/eetAslAfgoerelser';

export type EetOplysningerTabProps = {
  values: ErhvervsevnetabValues;
  setValues: React.Dispatch<React.SetStateAction<ErhvervsevnetabValues>>;
  handleChange: <K extends keyof ErhvervsevnetabValues>(
    key: K
  ) => CommitHandler<ErhvervsevnetabValues[K]>;
};

const EetOplysningerTab: React.FC<EetOplysningerTabProps> = ({
  values,
  setValues,
  handleChange,
}) => {
  const { values: stamValues, handleChange: handleStamChange } = usePersistedForm(
    stamdataSchema,
    'stamdata',
    STAMDATA_INITIAL_VALUES
  );

  const beregningsdatoInputRef = React.useRef<HTMLInputElement>(null);

  const skadesdatoMin = React.useMemo(() => {
    const iso = coerceToISODateString(stamValues.skadesdato);
    return iso ?? dateRanges_erhvervsevnetab.beregningsdato.fallbackMin;
  }, [stamValues.skadesdato]);

  const ealEetPctError = React.useMemo(
    () => validatePercentDivisibleBy5FromValue(values.ealEetPct, 'EET %'),
    [values.ealEetPct]
  );

  const handleAslAfgoerelserChange = React.useCallback(
    (rows: ErhvervsevnetabValues['aslAfgoerelser']) => {
      setValues((prev) => ({ ...prev, aslAfgoerelser: rows }));
    },
    [setValues]
  );

  return (
    <>
      <ContentBox className="content-box" data-section-id="eet-oplysninger-stamdata">
        <Typography className="section-header">Stamdata</Typography>

        <Box className="row--label-right-hover">
          <Typography className="row--text">Fødselsdato</Typography>
          <Box className="row--label-right-hover__content">
            <StyledDateField
              value={stamValues.fodselsdato || undefined}
              onCommit={handleStamChange('fodselsdato')}
              minDate={dateRanges_stamdata.fodselsdato.min}
              maxDate={dateRanges_stamdata.fodselsdato.max}
            />
          </Box>
        </Box>

        <Box className="row--label-right-hover">
          <Typography className="row--text">Beregningsdato</Typography>
          <Box className="row--label-right-hover__content" sx={{ gap: 1 }}>
            <StyledDateField
              value={values.beregningsdato || undefined}
              onCommit={handleChange('beregningsdato')}
              minDate={skadesdatoMin}
              maxDate={dateRanges_erhvervsevnetab.beregningsdato.max}
              noValidRangeCause="Skadesdato i Stamdata"
              inputRef={beregningsdatoInputRef}
            />
            <InsertTodayDateButton
              onCommit={(today) => {
                setValues((prev) => ({ ...prev, beregningsdato: today }));
              }}
              focusRef={beregningsdatoInputRef}
            />
          </Box>
        </Box>
      </ContentBox>

      <ContentBox className="content-box" data-section-id="eet-oplysninger-asl">
        <Typography className="section-header">Arbejdsskadesikringsloven</Typography>

        <Box className="row--label-right-hover">
          <Typography className="row--text">Årsløn</Typography>
          <Box className="row--label-right-hover__content">
            <StyledAmountField
              value={values.aslAarsloen}
              onCommit={handleChange('aslAarsloen')}
              allowNegative={false}
              allowDecimals={false}
              minValue={1000}
              maxValue={9999999}
              width={140}
              placeholder="0 kr."
            />
          </Box>
        </Box>

        <Typography className="row--subheading" sx={{ mt: 2 }}>
          Afgørelser
        </Typography>

        <EetAslAfgoerelserTable
          tableData={values.aslAfgoerelser}
          skadesdatoMin={skadesdatoMin}
          beregningsdato={coerceToISODateString(values.beregningsdato)}
          fodselsdato={coerceToISODateString(stamValues.fodselsdato)}
          onTableDataChange={handleAslAfgoerelserChange}
        />
      </ContentBox>

      <ContentBox className="content-box" data-section-id="eet-oplysninger-eal">
        <Typography className="section-header">
          Erstatningsansvarsloven
        </Typography>

        <Box className="row--label-right-hover">
          <Typography className="row--text">Årsløn (hvis forskellig fra ASL)</Typography>
          <Box className="row--label-right-hover__content">
            <StyledAmountField
              value={values.ealAarsloen}
              onCommit={handleChange('ealAarsloen')}
              allowNegative={false}
              allowDecimals={false}
              minValue={1000}
              maxValue={9999999}
              width={140}
              placeholder="0 kr."
            />
          </Box>
        </Box>

        <Box className="row--label-right-hover">
          <Typography className="row--text">EET % (hvis afviger fra ASL)</Typography>
          <Box className="row--label-right-hover__content">
            <StyledPercentField
              value={values.ealEetPct}
              onCommit={(event) => {
                const nextValue = event.target.value === 0 ? undefined : event.target.value;
                handleChange('ealEetPct')(createCommitEvent(nextValue));
              }}
              allowDecimals={false}
              minValue={0}
              maxValue={100}
              useDefaultPercentRange={false}
              placeholder="0"
              error={Boolean(ealEetPctError)}
              helperText={ealEetPctError ?? ''}
            />
          </Box>
        </Box>
      </ContentBox>
    </>
  );
};

EetOplysningerTab.displayName = 'EetOplysningerTab';

export default EetOplysningerTab;
