import React from 'react';
import { Box, MenuItem, Typography } from '@mui/material';
import StyledDateField from '../../inputs/StyledDateField';
import StyledPercentField from '../../inputs/StyledPercentField';
import StyledDropdown from '../../inputs/StyledDropdown';
import InsertTodayDateButton from '../../inputs/InsertTodayDateButton';
import ContentBox from '../../layout/ContentBox';
import EetAslAfgoerelserTable from '../../tables/EetAslAfgoerelserTable';
import { CellInvalidDraftScopeProvider } from '../../../contexts/CellInvalidDraftScopeContext';
import { CELL_TABLE_IDS } from '../../../config/cellInvalidDraftScopes';
import { dateRanges_erhvervsevnetab } from '../../../config/dateRanges';
import {
  koenEnum,
  type ErhvervsevnetabComposedValues,
  type ErhvervsevnetabValues,
} from '../../../schemas/formSchemas';
import { coerceToISODateString } from '../../../types/branded';
import { SKAERING_2015_03_01 } from '../../../domain/erhvervsevnetab/eetSkaeringsdatoer';
import { useFormFieldErrorReporter, useFormFieldErrors } from '../../../hooks/useFormFieldErrors';
import type { CommitHandler } from '../../../types/fieldEvents';
import {
  validatePercentDivisibleBy5FromValue,
} from '../../../domain/erhvervsevnetab/eetAslAfgoerelser';
import AarsloenAmountFieldRow from '../../inputs/AarsloenAmountFieldRow';
import { type SetFieldValue, type SetValuesUpdater } from '../../../hooks/usePersistedForm';
import { opregulerMedAkkumuleretReguleringssats } from '../../../domain/satser/opreguleringsmotorer';
import { reguleringssats } from '../../../data/lovbestemteRates';

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
  // Køn-reglen (køn påkrævet ved beregning/kapitalisering før 1. marts 2015) rapporteres til den
  // centrale fejl-model, så Gem blokeres på linje med Erstatningsopgørelse og forlig-reglerne. Tidligere
  // viste fejlen kun en lokal rød ring og blokerede ikke save — samme inkonsistens som forlig-fixet rettede.
  const reportKoenRuleError = useFormFieldErrorReporter('erhvervsevnetab', 'koen', {
    severity: 'error',
    source: 'rule',
  });

  const beregningsdatoInputRef = React.useRef<HTMLInputElement>(null);

  const skadedatoMin = React.useMemo(() => {
    const iso = coerceToISODateString(skadedato);
    return iso ?? dateRanges_erhvervsevnetab.beregningsdato.fallbackMin;
  }, [skadedato]);
  const visKoenValg = React.useMemo(() => {
    const iso = coerceToISODateString(skadedato);
    if (!iso) return false;
    return iso < SKAERING_2015_03_01;
  }, [skadedato]);
  const hasKapDatoFoer2015 = React.useMemo(() => {
    return values.aslAfgoerelser.some((row) => {
      const kapDato = coerceToISODateString(row.kapDato);
      return kapDato !== undefined && kapDato < SKAERING_2015_03_01;
    });
  }, [values.aslAfgoerelser]);
  const hasBeregningsdatoFoer2015 = React.useMemo(() => {
    const beregningsdato = coerceToISODateString(values.beregningsdato);
    return beregningsdato !== undefined && beregningsdato < SKAERING_2015_03_01;
  }, [values.beregningsdato]);
  const visKoenFelt = visKoenValg || hasKapDatoFoer2015 || hasBeregningsdatoFoer2015;

  const ealEetPctError = React.useMemo(
    () => validatePercentDivisibleBy5FromValue(values.ealEetPct, 'EET %'),
    [values.ealEetPct]
  );
  const ealReguleringssatsError = React.useMemo(() => {
    const skadedatoIso = coerceToISODateString(skadedato);
    const beregningsdatoIso = coerceToISODateString(values.beregningsdato);
    if (!skadedatoIso || !beregningsdatoIso) return undefined;
    const skadesaar = Number.parseInt(skadedatoIso.slice(0, 4), 10);
    const beregningsaar = Number.parseInt(beregningsdatoIso.slice(0, 4), 10);
    if (!Number.isInteger(skadesaar) || !Number.isInteger(beregningsaar)) return undefined;
    const { manglendeAar } = opregulerMedAkkumuleretReguleringssats(
      { kildeAar: skadesaar, maalAar: beregningsaar },
      reguleringssats
    );
    if (manglendeAar.length === 0) return undefined;
    return `EAL-beregningen kan ikke gennemføres, fordi der mangler reguleringssats for ${manglendeAar.join(', ')}.`;
  }, [skadedato, values.beregningsdato]);

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

  // Samme committed-værdier driver både den lokale røde ring (helperText nedenfor) og den centrale
  // save-gating. Reporteren rydder selv sin fejl, når reglen ikke længere er overtrådt (koenError === undefined).
  React.useEffect(() => {
    reportKoenRuleError(koenError);
  }, [koenError, reportKoenRuleError]);

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
              error={Boolean(ealReguleringssatsError)}
              helperText={ealReguleringssatsError ?? ''}
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

        <CellInvalidDraftScopeProvider pageKey="erhvervsevnetab" tableId={CELL_TABLE_IDS.eetAslAfgoerelser}>
          <EetAslAfgoerelserTable
            tableData={values.aslAfgoerelser}
            skadedato={coerceToISODateString(skadedato)}
            skadedatoMin={skadedatoMin}
            beregningsdato={coerceToISODateString(values.beregningsdato)}
            skadelidteFodselsdato={coerceToISODateString(values.skadelidteFodselsdato)}
            onTableDataChange={handleAslAfgoerelserChange}
            saveOrderPath="erhvervsevnetab.aslAfgoerelser"
          />
        </CellInvalidDraftScopeProvider>
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
