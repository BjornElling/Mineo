import React from 'react';
import {
  Box,
  Typography,
  Tooltip,
} from '@mui/material';
import { Download } from '@mui/icons-material';
import StyledDateField from '../../inputs/StyledDateField';
import InsertTodayDateButton from '../../inputs/InsertTodayDateButton';
import StyledPercentField from '../../inputs/StyledPercentField';
import ContentBox from '../../layout/ContentBox';
import { dateRanges_stamdata } from '../../../config/dateRanges';
import {
  stamdataSchema,
  type VarigeMenValues,
} from '../../../schemas/formSchemas';
import { coerceToISODateString, parseISODate, toISODateString } from '../../../types/branded';
import { beregnVarigeMenGodtgoerelseWithRates } from '../../../domain/varigemen/varigeMenCalculations';
import { usePersistedForm } from '../../../hooks/usePersistedForm';
import { useNavigate } from 'react-router-dom';
import { varigeMenPrGrad, varigeMenPrGradYearBounds } from '../../../data/regulationRates';
import { useAppSettings } from '../../../contexts/AppSettingsContext';
import { formatIsoDateLong } from '../../../utils/dateFormatting';
import { createCommitEvent, type CommitHandler } from '../../inputs/fieldEvents';
import { downloadVarigeMenPdf } from '../../../utils/pdf/pdfService';
import { STAMDATA_INITIAL_VALUES } from '../../../domain/stamdata/stamdataInitialValues';

const VARIGE_MEN_BEREGNINGSDATO_MIN = toISODateString(
  `${varigeMenPrGradYearBounds.minYear}-01-01`
);

const VARIGE_MEN_BEREGNINGSDATO_MAX = toISODateString(
  `${varigeMenPrGradYearBounds.maxYear}-12-31`
);

const MenberegningTab: React.FC<{
  values: VarigeMenValues;
  setValues: React.Dispatch<React.SetStateAction<VarigeMenValues>>;
  handleChange: <K extends keyof VarigeMenValues>(
    key: K
  ) => CommitHandler<VarigeMenValues[K]>;
}> = ({ values, setValues, handleChange }) => {
  const { values: stamValues, handleChange: handleStamChange } = usePersistedForm(stamdataSchema, 'stamdata', STAMDATA_INITIAL_VALUES);

  const { settings } = useAppSettings();
  const navigate = useNavigate();

  // State til rystebevægelse animation
  const [downloadShake, setDownloadShake] = React.useState(false);



// --- Feltvalidering ---
const [mengradError, setMengradError] = React.useState<string | undefined>(undefined);
const [fodselsdatoError, setFodselsdatoError] = React.useState<string | undefined>(undefined);
const [beregningsdatoError, setBeregningsdatoError] = React.useState<string | undefined>(undefined);
const beregningsdatoInputRef = React.useRef<HTMLInputElement>(null);

const handleMengradError = React.useCallback((errorMsg: string | undefined) => {
  setMengradError(errorMsg);
}, []);
const handleFodselsdatoError = React.useCallback((errorMsg: string | undefined) => {
  setFodselsdatoError(errorMsg);
}, []);
const handleBeregningsdatoError = React.useCallback((errorMsg: string | undefined) => {
  setBeregningsdatoError(errorMsg);
}, []);

// Tjek om der er fejl - kun baseret på felt-errors fra onBlur
const beregningsFejl = React.useMemo(() => {
  // Kun tjek for fejl-beskeder fra input-felterne (som sættes ved onBlur)
  if (fodselsdatoError || beregningsdatoError || mengradError) {
    return 'Fejl i indtastning';
  }
  return null;
}, [mengradError, fodselsdatoError, beregningsdatoError]);

// Tjek om indtastninger mangler (altid, uafhængigt af onBlur)
const manglendeFelter = React.useMemo(() => {
  if (!stamValues.fodselsdato || !stamValues.skadesdato || !values.beregningsdato || values.mengrad === undefined) {
    return 'Indtastning mangler';
  }
  if (values.mengrad === 0) {
    return 'Méngrad mangler';
  }
  return null;
}, [stamValues.fodselsdato, stamValues.skadesdato, values.beregningsdato, values.mengrad]);

// Beregn alder på skadestidspunkt (bruges flere steder)
const alderVedSkade = React.useMemo(() => {
  const fodselsdatoISO = coerceToISODateString(stamValues.fodselsdato);
  const skadesdatoISO = coerceToISODateString(stamValues.skadesdato);

  if (!fodselsdatoISO || !skadesdatoISO) return undefined;

  const fodselsdato = parseISODate(fodselsdatoISO);
  const skadesdato = parseISODate(skadesdatoISO);

  if (!fodselsdato || !skadesdato) return undefined;

  let alder = skadesdato.getUTCFullYear() - fodselsdato.getUTCFullYear();

  if (
    skadesdato.getUTCMonth() < fodselsdato.getUTCMonth() ||
    (skadesdato.getUTCMonth() === fodselsdato.getUTCMonth() &&
      skadesdato.getUTCDate() < fodselsdato.getUTCDate())
  ) {
    alder--;
  }

  return alder;
}, [stamValues.fodselsdato, stamValues.skadesdato]);

const beregningsResultat = React.useMemo(() => {
  // Hvis der er onBlur-fejl eller manglende felter, vis ikke resultat
  if (beregningsFejl || manglendeFelter) return undefined;

  const skadesdatoISO = coerceToISODateString(stamValues.skadesdato);
  if (!skadesdatoISO) return undefined;

  const resultat = beregnVarigeMenGodtgoerelseWithRates(values, skadesdatoISO, varigeMenPrGrad, coerceToISODateString(stamValues.fodselsdato));
  if (!resultat) return undefined;

  return resultat;
}, [values, stamValues.skadesdato, beregningsFejl, manglendeFelter]);

// Beregn aldersreduktionsbeløb (kun én gang)
const aldersreduktionsBeloeb = React.useMemo(() => {
  if (!beregningsResultat || beregningsResultat.aldersreduktionPct === 0) return 0;
  return beregningsResultat.grundbeloebUdenReduktion * beregningsResultat.aldersreduktionPct / 100;
}, [beregningsResultat]);

  // PDF download handler
  const handlePdfDownload = React.useCallback(async () => {
    // Tjek om der er fejl eller manglende felter
    if (beregningsFejl || manglendeFelter || !beregningsResultat) {
      // Trigger rystebevægelse
      setDownloadShake(true);
      setTimeout(() => setDownloadShake(false), 500);

      // Find første fejlcelle og markér den
      // Prioritering: Fødselsdato -> Skadesdato -> Méngrad -> Beregningsdato
      if (!stamValues.fodselsdato || fodselsdatoError) {
        // Markér fødselsdato-feltet (trigger focus vil markere det rødt)
        const fodselsdatoInput = document.querySelector('input[value*="' + (stamValues.fodselsdato || '') + '"]') as HTMLInputElement;
        if (fodselsdatoInput) {
          fodselsdatoInput.focus();
          fodselsdatoInput.blur();
        }
      } else if (!stamValues.skadesdato) {
        // Skadesdato kan ikke markeres direkte, men brugeren vil se fejlen
      } else if (values.mengrad === undefined || values.mengrad === 0 || mengradError) {
        // Markér méngrad-feltet
        const mengradInput = document.querySelector('input[type="text"][value*="%"]') as HTMLInputElement;
        if (mengradInput) {
          mengradInput.focus();
          mengradInput.blur();
        }
      } else if (!values.beregningsdato || beregningsdatoError) {
        // Markér beregningsdato-feltet
        const beregningsdatoInput = document.querySelector('input[value*="' + (values.beregningsdato || '') + '"]') as HTMLInputElement;
        if (beregningsdatoInput) {
          beregningsdatoInput.focus();
          beregningsdatoInput.blur();
        }
      }

      return;
    }

    const result = await downloadVarigeMenPdf({
      fodselsdato: coerceToISODateString(stamValues.fodselsdato),
      skadesdato: coerceToISODateString(stamValues.skadesdato),
      mengrad: values.mengrad,
      beregningsdato: coerceToISODateString(values.beregningsdato),
      beregningsResultat: beregningsResultat,
      settings,
      persistedStamdata: stamValues,
    });
    if (!result.success) {
      setDownloadShake(true);
      setTimeout(() => setDownloadShake(false), 500);
    }
  }, [beregningsFejl, manglendeFelter, beregningsResultat, values, stamValues, fodselsdatoError, mengradError, beregningsdatoError, settings]);

  const skadesdatoLabel = React.useMemo(() => {
    if (stamValues.skadestype === 'Erhvervssygdom') return 'Anmeldelsesdato';
    if (stamValues.skadestype === 'Arbejdsulykke') return 'Skadesdato';
    return 'Skadesdato';
  }, [stamValues.skadestype]);

  const formatSkadesdato = (iso: string | undefined): string => {
    if (!iso) return 'Mangler (angiv i Stamdata)';
    const formatted = formatIsoDateLong(coerceToISODateString(iso) ?? undefined);
    return formatted || 'Mangler (angiv i Stamdata)';
  };

  return (
    <ContentBox className="content-box">
      <Typography className="section-header">Méngodtgørelse</Typography>

      <Typography className="row--subheading">Stamdata</Typography>

      <Box className="row--label-right-hover">
        <Typography className="row--text">Fødselsdato</Typography>
        <Box className="row--label-right-hover__content">
          <StyledDateField
            value={stamValues.fodselsdato || undefined}
            onCommit={handleStamChange('fodselsdato')}
            minDate={dateRanges_stamdata.fodselsdato.min}
            maxDate={dateRanges_stamdata.fodselsdato.max}
            onFieldError={handleFodselsdatoError}
          />
        </Box>
      </Box>

      <Box className="row--label-right">
        <Typography className="row--text">{skadesdatoLabel}</Typography>
        <Box
          className="row--label-right-hover__content"
          style={{ justifyContent: 'flex-end' }}
        >
          <Typography
            className="row--text"
            color={stamValues.skadesdato ? 'text.primary' : 'text.disabled'}
          >
            {stamValues.skadesdato ? (
              formatSkadesdato(stamValues.skadesdato)
            ) : (
              <>
                Mangler (angiv i&nbsp; {' '}
                <Typography
                  component="span"
                  className="icon-text-link"
                  color="inherit"
                  onClick={() => navigate('/stamdata')}
                  sx={{ cursor: 'pointer' }}
                >
                  Stamdata
                </Typography>
                )
              </>
            )}
          </Typography>
        </Box>
      </Box>

      <Box className="row--label-right">
        <Typography className="row--text">Alder på skadestidspunkt</Typography>
        <Box
          className="row--label-right-hover__content"
          style={{ justifyContent: 'flex-end' }}
        >
          {fodselsdatoError || !stamValues.fodselsdato || !stamValues.skadesdato ? (
            <Tooltip title={fodselsdatoError || (!stamValues.fodselsdato || !stamValues.skadesdato ? 'Indtastning mangler' : '')} arrow>
              <Typography className="row--text" color="text.disabled">
                {fodselsdatoError || 'Indtastning mangler'}
              </Typography>
            </Tooltip>
          ) : (
            <Typography className="row--text">
              {alderVedSkade !== undefined ? `${alderVedSkade} år` : ''}
            </Typography>
          )}
        </Box>
      </Box>

      <Typography className="row--subheading">Beregningsgrundlag</Typography>

      <Box className="row--label-right-hover">
        <Typography className="row--text">Méngrad</Typography>
        <Box className="row--label-right-hover__content">
          <StyledPercentField
            value={values.mengrad}
            onCommit={(event) => {
              const raw = event.target.value;
              const intValue =
                typeof raw === 'number' && Number.isFinite(raw)
                  ? Math.trunc(raw)
                  : undefined;
              handleChange('mengrad')(createCommitEvent(intValue));
            }}
            allowDecimals={false}
            minValue={0}
            maxValue={100}
            useDefaultPercentRange={false}
            placeholder="0"
            // Fanger valideringsfejl fra feltet
            onFieldError={handleMengradError}
          />
        </Box>
      </Box>

      <Box className="row--label-right-hover">
        <Typography className="row--text">Beregningsdato</Typography>
        <Box className="row--label-right-hover__content" sx={{ gap: 1 }}>
          <StyledDateField
            value={values.beregningsdato || undefined}
            onCommit={handleChange('beregningsdato')}
            minDate={VARIGE_MEN_BEREGNINGSDATO_MIN}
            maxDate={VARIGE_MEN_BEREGNINGSDATO_MAX}
            noValidRangeCause="Varige mén-satser"
            onFieldError={handleBeregningsdatoError}
            inputRef={beregningsdatoInputRef}
          />
          <InsertTodayDateButton
            onCommit={(today) => {
              setValues((prev) => ({
                ...prev,
                beregningsdato: today,
              }));
            }}
            focusRef={beregningsdatoInputRef}
          />
        </Box>
      </Box>

      <Typography className="row--subheading">Beregnet méngodtgørelse</Typography>

      {/* Grundbeløb */}
      {beregningsResultat && (
        <Box className="row--label-right">
          <Typography className="row--text">
            {`Grundbeløb: ${values.mengrad} % mén á ${beregningsResultat.satsPerMengrad.toLocaleString('da-DK', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} kr.`}
          </Typography>
          <Box
            className="row--label-right-hover__content"
            style={{ justifyContent: 'flex-end' }}
          >
            <Typography className="row--text">
              {beregningsResultat.grundbeloebUdenReduktion.toLocaleString('da-DK', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} kr.
            </Typography>
          </Box>
        </Box>
      )}

      {/* Aldersreduktion */}
      {beregningsResultat && (
        <Box className="row--label-right">
          <Typography className="row--text">
            {`Aldersreduktion, ${alderVedSkade} år = - ${beregningsResultat.aldersreduktionPct} %`}
          </Typography>
          <Box
            className="row--label-right-hover__content"
            style={{ justifyContent: 'flex-end' }}
          >
            <Typography className="row--text">
              {`- ${aldersreduktionsBeloeb.toLocaleString('da-DK', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} kr.`}
            </Typography>
          </Box>
        </Box>
      )}

      <Box className="row--label-right">
        <Typography className="row--text">
          Beregnet méngodtgørelse
        </Typography>
        <Box
          className="row--label-right-hover__content"
          style={{ justifyContent: 'flex-end' }}
        >
          {beregningsFejl || manglendeFelter ? (
            <Tooltip title={beregningsFejl || manglendeFelter} arrow>
              <Typography className="row--text" color="text.disabled">
                {beregningsFejl || manglendeFelter}
              </Typography>
            </Tooltip>
          ) : beregningsResultat ? (
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <Typography className="row--text">
                {beregningsResultat.beregnetGodtgoerelse.toLocaleString('da-DK')} kr.
              </Typography>
              <Box
                onClick={handlePdfDownload}
                tabIndex={-1}
                sx={{
                  width: '32px',
                  height: '32px',
                  borderRadius: '6px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  cursor: 'pointer',
                  transition: 'background-color 0.2s',
                  animation: downloadShake ? 'shake 0.5s' : 'none',
                  '&:hover': {
                    backgroundColor: '#e3f2fd',
                  },
                  '&:active': {
                    backgroundColor: '#bbdefb',
                  },
                  '@keyframes shake': {
                    '0%, 100%': { transform: 'translateX(0)' },
                    '10%, 30%, 50%, 70%, 90%': { transform: 'translateX(-5px)' },
                    '20%, 40%, 60%, 80%': { transform: 'translateX(5px)' },
                  },
                }}
              >
                <Download
                  sx={{
                    fontSize: '24px',
                    color: 'primary.main',
                  }}
                />
              </Box>
            </Box>
          ) : null}
        </Box>
      </Box>
    </ContentBox>
  );
};

MenberegningTab.displayName = 'MenberegningTab';

export default MenberegningTab;

