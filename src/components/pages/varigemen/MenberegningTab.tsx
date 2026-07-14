import React from 'react';
import {
  Box,
  Typography,
  Tooltip,
} from '@mui/material';
import DocumentDownloadButton from '../../inputs/DocumentDownloadButton';
import StyledDateField from '../../inputs/StyledDateField';
import InsertTodayDateButton from '../../inputs/InsertTodayDateButton';
import StyledPercentField from '../../inputs/StyledPercentField';
import ContentBox from '../../layout/ContentBox';
import {
  VARIGE_MEN_MAX_MENGRAD,
  type VarigeMenValues,
  type StamdataValues,
} from '../../../schemas/formSchemas';
import { coerceToISODateString, parseISODate } from '../../../types/branded';
import { resolveMenSatsForBeregningsdato } from '../../../domain/varigemen/varigeMenCalculations';
import { computeVarigeMenEngine } from '../../../domain/varigemen/varigeMenEngine';
import type { SetFieldValue } from '../../../hooks/usePersistedForm';
import { useNavigate } from 'react-router-dom';
import { varigeMenPrGrad } from '../../../data/lovbestemteRates';
import { dateRanges_varigemen } from '../../../config/dateRanges';
import { useAppSettings } from '../../../contexts/useAppSettings';
import { calculateUtcAgeInWholeYears } from '../../../utils/dateUtils';
import { formatIsoDateLong } from '../../../utils/dateFormatting';
import { formatAsAmount } from '../../../utils/formatUtils';
import { downloadVarigeMenDokument } from '../../../document/service/documentService';
import { evaluateVarigeMenDownloadGate } from '../../../domain/varigemen/varigeMenDownloadGate';
import { useFormFieldErrorReporter, useFormFieldErrors } from '../../../hooks/useFormFieldErrors';
import { resolveStamdataDatoLabel } from '../../../domain/policies/stamdataCalculations';

type MenberegningStamdataView = Pick<
  StamdataValues,
  'journalnr' | 'advokat' | 'sagsbehandler' | 'skadelidteFodselsdato' | 'skadedato' | 'skadestype'
>;

const MenberegningTab = ({ values, setFieldValue, stamdata }: {
  values: VarigeMenValues;
  setFieldValue: SetFieldValue<VarigeMenValues>;
  stamdata: MenberegningStamdataView;
}) => {
  const stamValues = stamdata;

  const { settings } = useAppSettings();
  const navigate = useNavigate();
  const stamdataFieldErrors = useFormFieldErrors('stamdata');

  // State til rystebevægelse animation
  const [downloadShake, setDownloadShake] = React.useState(false);
  const [pdfErrorMessage, setPdfErrorMessage] = React.useState<string | null>(null);

// --- Feltvalidering ---
// Persisterede felters fejl føres gennem den centrale fejl-infrastruktur (jf.
// page-component-contract §8.1), ikke parallel lokal useState. Producenten (input-feltet)
// ejer fejlen via reporteren; sidens gating læser den opløste fejl via useFormFieldErrors.
const varigeMenFieldErrors = useFormFieldErrors('varigemen');
const reportMengradError = useFormFieldErrorReporter('varigemen', 'mengrad', {
  severity: 'error',
  source: 'input',
});
const reportBeregningsdatoError = useFormFieldErrorReporter('varigemen', 'beregningsdato', {
  severity: 'error',
  source: 'input',
});
const mengradInputRef = React.useRef<HTMLInputElement>(null);
const beregningsdatoInputRef = React.useRef<HTMLInputElement>(null);

const mengradError = varigeMenFieldErrors.mengrad?.message;
const beregningsdatoError = varigeMenFieldErrors.beregningsdato?.message;
const fodselsdatoError = stamdataFieldErrors.skadelidteFodselsdato?.message;

// Tjek om der er fejl - kun baseret på felt-errors fra onBlur
const beregningsFejl = React.useMemo(() => {
  // Kun tjek for fejl-beskeder fra input-felterne (som sættes ved onBlur)
  if (fodselsdatoError || beregningsdatoError || mengradError) {
    return 'Fejl i indtastning';
  }
  return null;
}, [mengradError, fodselsdatoError, beregningsdatoError]);

// Tjek om indtastninger mangler (altid, uafhængigt af onBlur). En ugyldig méngrad (fx 0)
// afvises i feltet og committes aldrig, så et manglende felt er præcist mengrad === undefined.
const manglendeFelter = React.useMemo(() => {
  if (!stamValues.skadelidteFodselsdato || !stamValues.skadedato || !values.beregningsdato || values.mengrad === undefined) {
    return 'Indtastning mangler';
  }
  return null;
}, [stamValues.skadelidteFodselsdato, stamValues.skadedato, values.beregningsdato, values.mengrad]);

// Beregn alder på skadestidspunkt (bruges flere steder)
const alderVedSkade = React.useMemo(() => {
  const fodselsdatoISO = coerceToISODateString(stamValues.skadelidteFodselsdato);
  const skadedatoISO = coerceToISODateString(stamValues.skadedato);

  if (!fodselsdatoISO || !skadedatoISO) return undefined;

  const fodselsdato = parseISODate(fodselsdatoISO);
  const skadedato = parseISODate(skadedatoISO);

  if (!fodselsdato || !skadedato) return undefined;

  return calculateUtcAgeInWholeYears(fodselsdato, skadedato);
}, [stamValues.skadelidteFodselsdato, stamValues.skadedato]);

const menSats = React.useMemo(() => {
  const iso = coerceToISODateString(values.beregningsdato);
  return resolveMenSatsForBeregningsdato(iso ?? undefined, varigeMenPrGrad);
}, [values.beregningsdato]);

const beregningsResultat = React.useMemo(() => {
  // Hvis der er onBlur-fejl eller manglende felter, vis ikke resultat
  if (beregningsFejl || manglendeFelter) return undefined;

  const skadedatoISO = coerceToISODateString(stamValues.skadedato);
  if (!skadedatoISO) return undefined;

  // Beregning sker udelukkende via den autoritative engine (varigemen-contract §1/§2),
  // så UI og PDF deler præcis samme beregningsvej. Engine-laget er et rent gennemløb
  // til beregningsfunktionen — outputtet er identisk med et direkte kald.
  const { result: resultat } = computeVarigeMenEngine({
    varigemen: values,
    skadestidspunkt: skadedatoISO,
    rates: varigeMenPrGrad,
    fodselsdato: coerceToISODateString(stamValues.skadelidteFodselsdato) ?? undefined,
  });
  if (!resultat) return undefined;

  return resultat;
}, [values, stamValues.skadelidteFodselsdato, stamValues.skadedato, beregningsFejl, manglendeFelter]);

  // Download-gaten bygges på det fælles documentGateTypes-primitiv (dokument-output-
  // kontrakt §A2): et samlet gate-resultat med auditerbare årsagskoder i stedet for et
  // inline-boolean-udtryk. Alle tre indgange er committed-afledte (onBlur-felt-fejl,
  // committed stamdata/værdier, autoritativ engine), så committed-only-reglen er
  // konstruktion frem for kommentar.
  const downloadGate = React.useMemo(
    () => evaluateVarigeMenDownloadGate({
      hasBlockingFieldErrors: beregningsFejl !== null,
      hasMissingFields: manglendeFelter !== null,
      hasBeregningsResultat: beregningsResultat !== undefined,
    }),
    [beregningsFejl, manglendeFelter, beregningsResultat],
  );

  // PDF download handler
  const handlePdfDownload = React.useCallback(async () => {
    // Tjek om der er fejl eller manglende felter
    if (!downloadGate.canDownload) {
      setPdfErrorMessage(null);
      // Trigger rystebevægelse
      setDownloadShake(true);
      setTimeout(() => setDownloadShake(false), 500);

      // Find første fejlcelle og markér den
      // Prioritering: Fødselsdato -> Skadedato -> Méngrad -> Beregningsdato
      if (!stamValues.skadelidteFodselsdato || fodselsdatoError) {
        navigate('/stamdata');
      } else if (!stamValues.skadedato) {
        // Skadedato kan ikke markeres direkte, men brugeren vil se fejlen
      } else if (values.mengrad === undefined || mengradError) {
        // Markér méngrad-feltet via ref (ikke skrøbelig DOM-query på value-attributten).
        const mengradInput = mengradInputRef.current;
        if (mengradInput) {
          mengradInput.focus();
          mengradInput.blur();
        }
      } else if (!values.beregningsdato || beregningsdatoError) {
        // Markér beregningsdato-feltet via ref (ikke skrøbelig DOM-query på value-attributten).
        const beregningsdatoInput = beregningsdatoInputRef.current;
        if (beregningsdatoInput) {
          beregningsdatoInput.focus();
          beregningsdatoInput.blur();
        }
      }

      return;
    }

    const mengrad = values.mengrad;
    if (typeof mengrad !== 'number' || !Number.isFinite(mengrad)) {
      setPdfErrorMessage(null);
      setDownloadShake(true);
      setTimeout(() => setDownloadShake(false), 500);
      return;
    }

    // gate.canDownload garanterer hasBeregningsResultat=true; denne guard narrower
    // typen (VarigeMenBeregningResult | undefined → VarigeMenBeregningResult) og er
    // ellers et no-op, da gaten allerede har blokeret det udefinerede tilfælde.
    if (beregningsResultat === undefined) {
      return;
    }

    const result = await downloadVarigeMenDokument({
      fodselsdato: coerceToISODateString(stamValues.skadelidteFodselsdato),
      skadedato: coerceToISODateString(stamValues.skadedato),
      mengrad,
      beregningsdato: coerceToISODateString(values.beregningsdato),
      beregningsResultat: beregningsResultat,
      settings,
      persistedStamdata: stamValues,
    });
    setPdfErrorMessage(result.success ? null : result.error);
  }, [downloadGate, beregningsResultat, values, stamValues, fodselsdatoError, mengradError, beregningsdatoError, settings, navigate]);

  const skadedatoLabel = React.useMemo(
    () => resolveStamdataDatoLabel(stamValues),
    [stamValues]
  );

  const formatSkadedato = (iso: string | undefined): string => {
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
        <Box className="row--label-right-hover__content" sx={{ justifyContent: 'flex-end' }}>
          {stamValues.skadelidteFodselsdato ? (
            <Typography className="row--text">
              {formatIsoDateLong(coerceToISODateString(stamValues.skadelidteFodselsdato) ?? undefined)}
            </Typography>
          ) : (
            <Typography className="row--text" color="text.secondary">
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
            </Typography>
          )}
        </Box>
      </Box>

      <Box className="row--label-right-hover">
        <Typography className="row--text">{skadedatoLabel}</Typography>
        <Box
          className="row--label-right-hover__content"
          style={{ justifyContent: 'flex-end' }}
        >
          <Typography
            className="row--text"
            color={stamValues.skadedato ? 'text.primary' : 'text.disabled'}
          >
            {stamValues.skadedato ? (
              formatSkadedato(stamValues.skadedato)
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

      <Box className="row--label-right-hover">
        <Typography className="row--text">Alder på skadestidspunkt</Typography>
        <Box
          className="row--label-right-hover__content"
          style={{ justifyContent: 'flex-end' }}
        >
          {fodselsdatoError || !stamValues.skadelidteFodselsdato || !stamValues.skadedato ? (
            <Tooltip
              title={
                fodselsdatoError ||
                (!stamValues.skadelidteFodselsdato || !stamValues.skadedato ? 'Indtastning mangler' : '')
              }
              arrow
            >
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
            name="mengrad"
            value={values.mengrad}
            onCommit={(event) => setFieldValue('mengrad', event.target.value)}
            allowDecimals={false}
            // Méngraden skal være i [1, 120]: 0 (og alt uden for intervallet) afvises straks i
            // feltet med rød ring + tooltip via enforceRange — samme kanoniske vej som >120.
            minValue={1}
            maxValue={VARIGE_MEN_MAX_MENGRAD}
            enforceRange
            useDefaultPercentRange={false}
            placeholder="0"
            // Fanger valideringsfejl fra feltet og rapporterer til den centrale fejlmodel
            onFieldError={reportMengradError}
            inputRef={mengradInputRef}
          />
        </Box>
      </Box>

      <Box className="row--label-right-hover">
        <Typography className="row--text">Beregningsdato</Typography>
        <Box className="row--label-right-hover__content" sx={{ gap: 1 }}>
          <StyledDateField
            name="beregningsdato"
            value={values.beregningsdato || undefined}
            onCommit={(event) => setFieldValue('beregningsdato', event.target.value)}
            minDate={dateRanges_varigemen.beregningsdato.min}
            maxDate={dateRanges_varigemen.beregningsdato.max}
            onFieldError={reportBeregningsdatoError}
            inputRef={beregningsdatoInputRef}
          />
          <InsertTodayDateButton
            onCommit={(today) => {
              return setFieldValue('beregningsdato', today);
            }}
            focusRef={beregningsdatoInputRef}
          />
        </Box>
      </Box>

      <Box className="row--label-right-hover">
        <Typography className="row--text">
          {menSats !== undefined
            ? `Sats per méngrad i år ${menSats.aar}`
            : 'Sats per méngrad i beregningsåret'}
        </Typography>
        <Box className="row--label-right-hover__content" style={{ justifyContent: 'flex-end' }}>
          {menSats !== undefined ? (
            <Typography className="row--text">
              {formatAsAmount(menSats.sats, 0)} kr.
            </Typography>
          ) : (
            <Tooltip title={beregningsdatoError || 'Beregningsdato mangler'} arrow>
              <Typography className="row--text" color="text.disabled">
                Beregningsdato mangler
              </Typography>
            </Tooltip>
          )}
        </Box>
      </Box>

      <Typography className="row--subheading">Beregnet méngodtgørelse</Typography>

      {pdfErrorMessage && (
        <Box className="row--label-right-hover">
          <Typography className="row--text" sx={{ color: 'error.main' }}>
            {pdfErrorMessage}
          </Typography>
          <Box />
        </Box>
      )}

      {/* Grundbeløb */}
      {beregningsResultat && (
        <Box className="row--label-right-hover">
          <Typography className="row--text">
            {`Grundbeløb: ${values.mengrad} % mén á ${formatAsAmount(beregningsResultat.satsPerMengrad, 2)} kr.`}
          </Typography>
          <Box
            className="row--label-right-hover__content"
            style={{ justifyContent: 'flex-end' }}
          >
            <Typography className="row--text">
              {formatAsAmount(beregningsResultat.grundbeloebUdenReduktion, 2)} kr.
            </Typography>
          </Box>
        </Box>
      )}

      {/* Aldersreduktion */}
      {beregningsResultat && (
        <Box className="row--label-right-hover">
          <Typography className="row--text">
            {`Aldersreduktion, ${alderVedSkade} år = - ${beregningsResultat.aldersreduktionPct} %`}
          </Typography>
          <Box
            className="row--label-right-hover__content"
            style={{ justifyContent: 'flex-end' }}
          >
            <Typography className="row--text">
              {`- ${formatAsAmount(beregningsResultat.aldersreduktionBeloeb, 2)} kr.`}
            </Typography>
          </Box>
        </Box>
      )}

      <Box className="row--label-right-hover">
        <Typography className="row--text">
          Beregnet méngodtgørelse
        </Typography>
        <Box
          className="row--label-right-hover__content"
          style={{ justifyContent: 'flex-end' }}
        >
          {beregningsFejl || manglendeFelter ? (
            // Download-ikonet vises altid sammen med sin tekstlinje — her nedtonet/inaktivt,
            // fordi beregningen (og dermed download) er blokeret. Fejl-/mangel-teksten står
            // fortsat i værdikolonnen, og ikonet placeres til højre for den.
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <Tooltip title={beregningsFejl || manglendeFelter} arrow>
                <Typography className="row--text" color="text.disabled">
                  {beregningsFejl || manglendeFelter}
                </Typography>
              </Tooltip>
              <DocumentDownloadButton
                onClick={() => void handlePdfDownload()}
                disabled
                disabledReason={(beregningsFejl || manglendeFelter) ?? undefined}
                dataTestId="varigemen-download"
              />
            </Box>
          ) : beregningsResultat ? (
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <Typography className="row--text">
                {formatAsAmount(beregningsResultat.beregnetGodtgoerelse, 0)} kr.
              </Typography>
              <DocumentDownloadButton
                onClick={() => void handlePdfDownload()}
                shake={downloadShake}
                dataTestId="varigemen-download"
              />
            </Box>
          ) : null}
        </Box>
      </Box>
    </ContentBox>
  );
};

MenberegningTab.displayName = 'MenberegningTab';

export default MenberegningTab;
