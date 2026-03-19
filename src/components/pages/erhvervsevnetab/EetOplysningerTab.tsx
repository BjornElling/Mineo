import React from 'react';
import { Box, MenuItem, Typography } from '@mui/material';
import StyledDateField from '../../inputs/StyledDateField';
import StyledPercentField from '../../inputs/StyledPercentField';
import StyledDropdown from '../../inputs/StyledDropdown';
import InsertTodayDateButton from '../../inputs/InsertTodayDateButton';
import ContentBox from '../../layout/ContentBox';
import EetAslAfgoerelserTable from '../../tables/EetAslAfgoerelserTable';
import { dateRanges_erhvervsevnetab } from '../../../config/dateRanges';
import {
  koenEnum,
  type FaellesPersondataValues,
  type ErhvervsevnetabComposedValues,
  type ErhvervsevnetabValues,
} from '../../../schemas/formSchemas';
import { coerceToISODateString } from '../../../types/branded';
import { useFormFieldErrorReporter, useFormFieldErrors } from '../../../hooks/useFormFieldErrors';
import { createCommitEvent, type CommitHandler } from '../../../types/fieldEvents';
import {
  validatePercentDivisibleBy5FromValue,
} from '../../../domain/erhvervsevnetab/eetAslAfgoerelser';
import AarsloenAmountFieldRow from '../../inputs/AarsloenAmountFieldRow';

export type EetOplysningerTabProps = {
  values: ErhvervsevnetabComposedValues;
  setValues: React.Dispatch<React.SetStateAction<ErhvervsevnetabValues>>;
  handleChange: <K extends keyof ErhvervsevnetabValues>(
    key: K
  ) => CommitHandler<ErhvervsevnetabValues[K]>;
  handleSkadelidteFodselsdatoChange: CommitHandler<FaellesPersondataValues['skadelidteFodselsdato']>;
  handleAslAarsloenChange: CommitHandler<ErhvervsevnetabComposedValues['aslAarsloen']>;
  handleEalAarsloenChange: CommitHandler<ErhvervsevnetabComposedValues['ealAarsloen']>;
  skadesdato: string | undefined;
};

const EetOplysningerTab: React.FC<EetOplysningerTabProps> = ({
  values,
  setValues,
  handleChange,
  handleSkadelidteFodselsdatoChange,
  handleAslAarsloenChange,
  handleEalAarsloenChange,
  skadesdato,
}) => {
  const eetFieldErrors = useFormFieldErrors('erhvervsevnetab');
  const faellesPersondataFieldErrors = useFormFieldErrors('faellesPersondata');
  const faellesAarsloenFieldErrors = useFormFieldErrors('faellesAarsloen');
  const reportSkadelidteFodselsdatoInputError = useFormFieldErrorReporter('faellesPersondata', 'skadelidteFodselsdato', {
    severity: 'error',
    source: 'input',
  });
  const reportAslAarsloenInputError = useFormFieldErrorReporter('faellesAarsloen', 'aslAarsloen', {
    severity: 'error',
    source: 'input',
  });
  const reportEalAarsloenInputError = useFormFieldErrorReporter('faellesAarsloen', 'ealAarsloen', {
    severity: 'error',
    source: 'input',
  });

  const beregningsdatoInputRef = React.useRef<HTMLInputElement>(null);

  const skadesdatoMin = React.useMemo(() => {
    const iso = coerceToISODateString(skadesdato);
    return iso ?? dateRanges_erhvervsevnetab.beregningsdato.fallbackMin;
  }, [skadesdato]);
  const visKoenValg = React.useMemo(() => {
    const iso = coerceToISODateString(skadesdato);
    if (!iso) return false;
    return iso < '2015-03-01';
  }, [skadesdato]);

  const ealEetPctError = React.useMemo(
    () => validatePercentDivisibleBy5FromValue(values.ealEetPct, 'EET %'),
    [values.ealEetPct]
  );

  const koenError = React.useMemo(() => {
    if (values.koen) return undefined;
    const hasKapDatoFoer2015 = values.aslAfgoerelser.some((row) => {
      const kapDato = coerceToISODateString(row.kapDato);
      return kapDato !== undefined && kapDato < '2015-03-01';
    });
    if (hasKapDatoFoer2015) {
      return 'Ved kapitalisering før 1. marts 2015 skal køn angives.';
    }
    const beregningsdato = coerceToISODateString(values.beregningsdato);
    if (beregningsdato !== undefined && beregningsdato < '2015-03-01') {
      return 'Ved beregning før 1. marts 2015 skal køn angives.';
    }
    return undefined;
  }, [values.aslAfgoerelser, values.beregningsdato, values.koen]);

  const handleAslAfgoerelserChange = React.useCallback(
    (rows: ErhvervsevnetabValues['aslAfgoerelser']) => {
      setValues((prev) => ({ ...prev, aslAfgoerelser: rows }));
    },
    [setValues]
  );

  return (
    <>
      <ContentBox className="content-box" data-section-id="eet-oplysninger-grundlaeggende">
        <Typography className="section-header">Grundlæggende oplysninger</Typography>

        <Box className="row--label-right-hover">
          <Typography className="row--text">Fødselsdato</Typography>
          <Box className="row--label-right-hover__content">
            <StyledDateField
              value={values.skadelidteFodselsdato || undefined}
              onCommit={handleSkadelidteFodselsdatoChange}
              minDate={dateRanges_erhvervsevnetab.skadelidteFodselsdato.min}
              maxDate={dateRanges_erhvervsevnetab.skadelidteFodselsdato.max}
              error={Boolean(faellesPersondataFieldErrors.skadelidteFodselsdato?.message)}
              helperText={faellesPersondataFieldErrors.skadelidteFodselsdato?.message ?? ''}
              onFieldError={reportSkadelidteFodselsdatoInputError}
            />
          </Box>
        </Box>

        {(visKoenValg || Boolean(koenError)) && (
          <Box className="row--label-right-hover">
            <Typography className="row--text">Køn</Typography>
            <Box className="row--label-right-hover__content">
              <StyledDropdown
                value={values.koen}
                onChange={(event) => {
                  const parsed = koenEnum.safeParse(event.target.value);
                  handleChange('koen')(createCommitEvent(parsed.success ? parsed.data : undefined));
                }}
                placeholder="Vælg køn"
                width={130}
                error={Boolean(koenError)}
                helperText={koenError ?? ''}
              >
                <MenuItem value="Mand">Mand</MenuItem>
                <MenuItem value="Kvinde">Kvinde</MenuItem>
              </StyledDropdown>
            </Box>
          </Box>
        )}

        <Box className="row--label-right-hover">
          <Typography className="row--text">Beregningsdato</Typography>
          <Box className="row--label-right-hover__content" sx={{ gap: 1 }}>
            <StyledDateField
              value={values.beregningsdato || undefined}
              onCommit={handleChange('beregningsdato')}
              minDate={skadesdatoMin}
              maxDate={dateRanges_erhvervsevnetab.beregningsdato.max}
              specialRangeErrors={{ maxBoundKind: 'eetDataMax', maxBoundFieldLabel: 'Beregningsdato' }}
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

        <AarsloenAmountFieldRow
          label="Årsløn"
          value={values.aslAarsloen}
          onCommit={handleAslAarsloenChange}
          errorMessage={faellesAarsloenFieldErrors.aslAarsloen?.message}
          onFieldError={reportAslAarsloenInputError}
        />

        <Typography className="row--subheading" sx={{ mt: 2 }}>
          Afgørelser
        </Typography>

        <EetAslAfgoerelserTable
          tableData={values.aslAfgoerelser}
          skadesdato={coerceToISODateString(skadesdato)}
          skadesdatoMin={skadesdatoMin}
          beregningsdato={coerceToISODateString(values.beregningsdato)}
          skadelidteFodselsdato={coerceToISODateString(values.skadelidteFodselsdato)}
          onTableDataChange={handleAslAfgoerelserChange}
        />
      </ContentBox>

      <ContentBox className="content-box" data-section-id="eet-oplysninger-eal">
        <Typography className="section-header">
          Erstatningsansvarsloven
        </Typography>

        <AarsloenAmountFieldRow
          label="Årsløn (hvis forskellig fra ASL)"
          value={values.ealAarsloen}
          onCommit={handleEalAarsloenChange}
          errorMessage={faellesAarsloenFieldErrors.ealAarsloen?.message}
          onFieldError={reportEalAarsloenInputError}
        />

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

      <ContentBox className="content-box" data-section-id="eet-oplysninger-bemaerk">
        <Typography className="section-header">Bemærk</Typography>

        <Box className="row--label-right-hover">
          <Typography className="row--text">
            For skadelidte i fleksjob skal altid beregnes ny erhvervsevnetabsprocent efter EAL.
          </Typography>
          <Box className="row--label-right-hover__content" />
        </Box>

        <Box className="row--label-right-hover">
          <Typography className="row--text">
            Det er ikke muligt for programmet at tage højde for tilskadekomstpension til tidligere tjenestemænd.
          </Typography>
          <Box className="row--label-right-hover__content" />
        </Box>

        <Box className="row--label-right-hover">
          <Typography className="row--text">
            Programmet kan ikke foretage beregninger efter den grønlandske arbejdsskadesikringslov.
          </Typography>
          <Box className="row--label-right-hover__content" />
        </Box>
      </ContentBox>
    </>
  );
};

EetOplysningerTab.displayName = 'EetOplysningerTab';

export default EetOplysningerTab;
