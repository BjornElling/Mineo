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
  type ErhvervsevnetabComposedValues,
  type ErhvervsevnetabValues,
} from '../../../schemas/formSchemas';
import { coerceToISODateString } from '../../../types/branded';
import { useFormFieldErrorReporter, useFormFieldErrors } from '../../../hooks/useFormFieldErrors';
import type { CommitHandler } from '../../../types/fieldEvents';
import {
  validatePercentDivisibleBy5FromValue,
} from '../../../domain/erhvervsevnetab/eetAslAfgoerelser';
import AarsloenAmountFieldRow from '../../inputs/AarsloenAmountFieldRow';
import { type SetFieldValue, type SetValuesUpdater } from '../../../hooks/usePersistedForm';

export type EetOplysningerTabProps = {
  values: ErhvervsevnetabComposedValues;
  setValues: SetValuesUpdater<ErhvervsevnetabValues>;
  setFieldValue: SetFieldValue<ErhvervsevnetabValues>;
  handleAslAarsloenChange: CommitHandler<ErhvervsevnetabComposedValues['aslAarsloen']>;
  handleEalAarsloenChange: CommitHandler<ErhvervsevnetabComposedValues['ealAarsloen']>;
  skadedato: string | undefined;
};

const EetOplysningerTab = ({
  values,
  setValues,
  setFieldValue,
  handleAslAarsloenChange,
  handleEalAarsloenChange,
  skadedato,
}: EetOplysningerTabProps) => {
  const faellesAarsloenFieldErrors = useFormFieldErrors('faellesAarsloen');
  const reportAslAarsloenInputError = useFormFieldErrorReporter('faellesAarsloen', 'aslAarsloen', {
    severity: 'error',
    source: 'input',
  });
  const reportEalAarsloenInputError = useFormFieldErrorReporter('faellesAarsloen', 'ealAarsloen', {
    severity: 'error',
    source: 'input',
  });

  const beregningsdatoInputRef = React.useRef<HTMLInputElement>(null);

  const skadedatoMin = React.useMemo(() => {
    const iso = coerceToISODateString(skadedato);
    return iso ?? dateRanges_erhvervsevnetab.beregningsdato.fallbackMin;
  }, [skadedato]);
  const visKoenValg = React.useMemo(() => {
    const iso = coerceToISODateString(skadedato);
    if (!iso) return false;
    return iso < '2015-03-01';
  }, [skadedato]);
  const hasKapDatoFoer2015 = React.useMemo(() => {
    return values.aslAfgoerelser.some((row) => {
      const kapDato = coerceToISODateString(row.kapDato);
      return kapDato !== undefined && kapDato < '2015-03-01';
    });
  }, [values.aslAfgoerelser]);
  const hasBeregningsdatoFoer2015 = React.useMemo(() => {
    const beregningsdato = coerceToISODateString(values.beregningsdato);
    return beregningsdato !== undefined && beregningsdato < '2015-03-01';
  }, [values.beregningsdato]);
  const visKoenFelt = visKoenValg || hasKapDatoFoer2015 || hasBeregningsdatoFoer2015;

  const ealEetPctError = React.useMemo(
    () => validatePercentDivisibleBy5FromValue(values.ealEetPct, 'EET %'),
    [values.ealEetPct]
  );

  const koenError = React.useMemo(() => {
    if (values.koen) return undefined;
    if (hasKapDatoFoer2015) {
      return 'Ved kapitalisering før 1. marts 2015 skal køn angives.';
    }
    if (hasBeregningsdatoFoer2015) {
      return 'Ved beregning før 1. marts 2015 skal køn angives.';
    }
    return undefined;
  }, [hasBeregningsdatoFoer2015, hasKapDatoFoer2015, values.koen]);

  const handleAslAfgoerelserChange = React.useCallback(
    (rows: ErhvervsevnetabValues['aslAfgoerelser'], origin?: { fieldPath?: string }) => {
      setValues((prev) => ({ ...prev, aslAfgoerelser: rows }), origin);
    },
    [setValues]
  );

  return (
    <>
      <ContentBox className="content-box" data-section-id="eet-oplysninger-grundlaeggende">
        <Typography className="section-header">Grundlæggende oplysninger</Typography>

        {visKoenFelt && (
          <Box className="row--label-right-hover">
            <Typography className="row--text">Køn</Typography>
            <Box className="row--label-right-hover__content">
              <StyledDropdown
                name="koen"
                value={values.koen}
                onChange={(event) => {
                  const parsed = koenEnum.safeParse(event.target.value);
                  setFieldValue('koen', parsed.success ? parsed.data : undefined);
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
              name="beregningsdato"
              value={values.beregningsdato || undefined}
              onCommit={(event) => setFieldValue('beregningsdato', event.target.value)}
              minDate={skadedatoMin}
              maxDate={dateRanges_erhvervsevnetab.beregningsdato.max}
              specialRangeErrors={{ maxBoundKind: 'eetDataMax', maxBoundFieldLabel: 'Beregningsdato' }}
              inputRef={beregningsdatoInputRef}
            />
            <InsertTodayDateButton
              onCommit={(today) => {
                setValues((prev) => ({ ...prev, beregningsdato: today }), { fieldPath: 'beregningsdato' });
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
          name="aslAarsloen"
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
          skadedato={coerceToISODateString(skadedato)}
          skadedatoMin={skadedatoMin}
          beregningsdato={coerceToISODateString(values.beregningsdato)}
          skadelidteFodselsdato={coerceToISODateString(values.skadelidteFodselsdato)}
          onTableDataChange={handleAslAfgoerelserChange}
          saveOrderPath="erhvervsevnetab.aslAfgoerelser"
        />
      </ContentBox>

      <ContentBox className="content-box" data-section-id="eet-oplysninger-eal">
        <Typography className="section-header">
          Erstatningsansvarsloven
        </Typography>

        <AarsloenAmountFieldRow
          label="Årsløn (hvis forskellig fra ASL)"
          name="ealAarsloen"
          value={values.ealAarsloen}
          onCommit={handleEalAarsloenChange}
          errorMessage={faellesAarsloenFieldErrors.ealAarsloen?.message}
          onFieldError={reportEalAarsloenInputError}
        />

        <Box className="row--label-right-hover">
          <Typography className="row--text">EET % (hvis afviger fra ASL)</Typography>
          <Box className="row--label-right-hover__content">
            <StyledPercentField
              name="ealEetPct"
              value={values.ealEetPct}
              onCommit={(event) => {
                const nextValue = event.target.value === 0 ? undefined : event.target.value;
                setFieldValue('ealEetPct', nextValue);
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
