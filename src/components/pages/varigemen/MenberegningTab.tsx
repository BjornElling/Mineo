import React from 'react';
import { Box, Typography, Tooltip } from '@mui/material';
import DocumentDownloadButton from '../../inputs/DocumentDownloadButton';
import DateField from '../../../inputCore/react/fields/DateField';
import NumericTextField from '../../../inputCore/react/fields/NumericTextField';
import InsertTodayDateButton from '../../inputs/InsertTodayDateButton';
import InputUnitAdornment from '../../inputs/InputUnitAdornment';
import ContentBox from '../../layout/ContentBox';
import { PageMessageRow } from '../../layout/PageMessageBox';
import { pageMessage } from '../../layout/pageMessage';
import { integerAdmission } from '../../inputs/draftAdmission';
import { resolveIntegerCharPolicy } from '../../../inputCore/react/fields/charLengthPolicy';
import { INPUT_UNIT_SUFFIX } from '../../../utils/inputUnit';
import { coerceToISODateString, parseISODate } from '../../../types/branded';
import { useNavigate } from 'react-router-dom';
import { formatIsoDateLong } from '../../../utils/dateFormatting';
import { formatAsAmount } from '../../../utils/formatUtils';
import { calculateUtcAgeInWholeYears } from '../../../utils/dateUtils';
import { varigeMenPrGrad } from '../../../data/lovbestemteRates';
import { resolveMenSatsForBeregningsdato } from '../../../domain/varigemen/varigeMenCalculations';
import { resolveVarigeMenWarning } from '../../../domain/varigemen/varigeMenPolicy';
import { resolveSkadestypeDatoLabel } from '../../../domain/policies/stamdataCalculations';
import { APP_ROUTES, PAGE_DEFAULT_TAB } from '../../../config/pageNavigation';
import { varigeMenDocumentDefinition } from '../../../domain/varigemen/varigeMenDocumentDefinition';
import { useMineoDocumentOutput } from '../../../document/runtime/react/useMineoDocumentOutput';
import { buildVarigeMenReaderProjection } from '../../../domain/varigemen/varigeMenReaderProjection';
import {
  varigeMenBeregningsdatoField,
  varigeMenMengradField,
} from '../../../inputCore/catalog/varigeMenDescriptors';
import {
  stamdataSkadedatoField,
  stamdataSkadelidteFodselsdatoField,
  stamdataSkadestypeField,
} from '../../../inputCore/catalog/stamdataDescriptors';
import { useInputEvaluation } from '../../../inputCore/react/useInputEvaluation';
import { useFieldEditor } from '../../../inputCore/react/useFieldEditor';
import { scrollToFieldAddress } from '../../../utils/scrollToFieldAddress';
import { blinkFieldAttention } from '../../../inputCore/react/fieldAttentionBlink';

// MenberegningTab: Hele fanen kører
// nu på inputCore: méngrad + beregningsdato skriver/læser gennem den offentlige `InputReader` + den ene
// write-grænse (ingen `usePersistedForm`/`setFieldValue`-prop); de tværsektionelle stamdata-datoer læses gennem
// samme reader (ingen rå `usePersistedSectionSelector`). Den ENE reader-afledte projektion
// (`buildVarigeMenReaderProjection`) driver både beregningsvisning og download-gaten. Beregningstal og synlig
// adfærd er uændrede (§5.4).

const mengradRef = varigeMenMengradField.bind();
/** Méngradens tegn- og længdepolitik fra dens eget codec — én erklæring for formular og grid. */
const MENGRAD_CHAR_POLICY = resolveIntegerCharPolicy(varigeMenMengradField.bind());
const beregningsdatoRef = varigeMenBeregningsdatoField.bind();
const fodselsdatoRef = stamdataSkadelidteFodselsdatoField.bind();
const skadedatoRef = stamdataSkadedatoField.bind();
const skadestypeRef = stamdataSkadestypeField.bind();

// route + tabKey er eksplicit navigation-metadata (§3.7); begge felter bor på menberegning-fanen.
const MENGRAD_LOCATION = { locationId: 'varigemen:mengrad', route: APP_ROUTES.varigemen, tabKey: PAGE_DEFAULT_TAB.varigemen } as const;
const BEREGNINGSDATO_LOCATION = { locationId: 'varigemen:beregningsdato', route: APP_ROUTES.varigemen, tabKey: PAGE_DEFAULT_TAB.varigemen } as const;

const MenberegningTab = React.memo(() => {
  const navigate = useNavigate();
  const evaluation = useInputEvaluation();
  const download = useMineoDocumentOutput(varigeMenDocumentDefinition, undefined);

  const mengradInputRef = React.useRef<HTMLInputElement>(null);
  const beregningsdatoInputRef = React.useRef<HTMLInputElement>(null);
  const beregningsdatoController = useFieldEditor(beregningsdatoRef, BEREGNINGSDATO_LOCATION);

  // Politikken læses af méngrad-feltets EGET codec frem for at være hardkodet her. Svaret er det
  // samme (méngrad er 1..120), men nu er det feltets erklæring og ikke en lokal gentagelse af den.
  const mengradAdmission = React.useMemo(
    () => integerAdmission({
      allowNegative: MENGRAD_CHAR_POLICY.allowNegative,
      maxDigits: MENGRAD_CHAR_POLICY.maxDigits,
    }),
    []
  );

  // Den ENE reader-afledte projektion (§3.4/§5.4) — beregningsvisning og download-gate deler præcis samme sandhed.
  const projection = React.useMemo(
    () => buildVarigeMenReaderProjection(evaluation.reader),
    [evaluation]
  );
  const projectionData = projection.status === 'ready' ? projection.value : null;
  const beregningsResultat = projectionData?.beregningsResultat ?? null;

  // Display-tilstande læses direkte gennem readeren: en rød feltfejl skjuler værdien (`error`), et tomt felt
  // giver en tom `usable`-værdi. Datoordenen (skadedato ≥ fødselsdato) er allerede en feltvalidator,
  // så en byttet orden viser sig her som en rød fejl på begge datoer.
  const fodselsdatoRead = evaluation.reader.read(fodselsdatoRef);
  const skadedatoRead = evaluation.reader.read(skadedatoRef);
  const skadestypeRead = evaluation.reader.read(skadestypeRef);
  const beregningsdatoRead = evaluation.reader.read(beregningsdatoRef);

  const fodselsdato = fodselsdatoRead.status === 'usable' ? fodselsdatoRead.value : undefined;
  const skadedato = skadedatoRead.status === 'usable' ? skadedatoRead.value : undefined;
  const skadestype = skadestypeRead.status === 'usable' ? skadestypeRead.value : undefined;
  const fodselsdatoError = fodselsdatoRead.status === 'error' ? fodselsdatoRead.issue.message : undefined;
  const skadedatoError = skadedatoRead.status === 'error' ? skadedatoRead.issue.message : undefined;
  const beregningsdatoError = beregningsdatoRead.status === 'error' ? beregningsdatoRead.issue.message : undefined;

  // Alder og sats vises uafhængigt af méngrad: alderen så snart begge datoer er gyldige, satsen så
  // snart beregningsdatoen har en lovsats for sit år — også når méngrad mangler og projektionen derfor er blokeret.
  const alderVedSkade = React.useMemo(() => {
    if (fodselsdato === undefined || skadedato === undefined) return undefined;
    const f = parseISODate(coerceToISODateString(fodselsdato) ?? undefined);
    const s = parseISODate(coerceToISODateString(skadedato) ?? undefined);
    if (!f || !s) return undefined;
    return calculateUtcAgeInWholeYears(f, s);
  }, [fodselsdato, skadedato]);
  const beregningsdato = beregningsdatoRead.status === 'usable' ? beregningsdatoRead.value : undefined;
  const mengradWarning = resolveVarigeMenWarning(projectionData?.mengrad);
  const menSats = React.useMemo(
    () => resolveMenSatsForBeregningsdato(coerceToISODateString(beregningsdato) ?? undefined, varigeMenPrGrad),
    [beregningsdato]
  );

  // Spejlet stamdata-værdi: navnet kommer fra feltets ene navneregel (§3.2a), aldrig fra en lokal ternary.
  const skadedatoLabel = resolveSkadestypeDatoLabel(skadestype);

  /**
   * Naviger til Stamdata OG markér det felt, der mangler.
   *
   * Bruges både af «Mangler (angiv i Stamdata)»-linkene og af blokerings-feedbacken nedenfor. Markeringen
   * er den DELTE `blinkFieldAttention` via `scrollToFieldAddress` — samme adfærd som fejl- og
   * advarselslinkene i resten af programmet, så der ikke findes en side-lokal «peg på feltet»-vej.
   */
  const goToStamdataField = React.useCallback(
    (address: Parameters<typeof scrollToFieldAddress>[0]) => {
      navigate(APP_ROUTES.stamdata);
      scrollToFieldAddress(address);
    },
    [navigate]
  );
  const goToFodselsdato = React.useCallback(
    () => goToStamdataField(fodselsdatoRef.address),
    [goToStamdataField]
  );
  const goToSkadedato = React.useCallback(
    () => goToStamdataField(skadedatoRef.address),
    [goToStamdataField]
  );

  // Fokusér det første blokerende felt efter en blokeret download (best-effort UI-hint fra render-tilstanden).
  // Prioritet: Fødselsdato → Skadedato → Méngrad → Beregningsdato.
  //
  // Stamdata-felterne føres nu HELT frem: tidligere navigerede fødselsdato-grenen til Stamdata uden at pege
  // på feltet, og skadedato-grenen returnerede uden at gøre NOGET som helst — brugeren fik en shake på
  // knappen og ingen anvisning. Begge bruger nu samme markering som sidens egne felter.
  const focusFirstBlockingField = React.useCallback(() => {
    if (fodselsdatoError !== undefined || fodselsdato === undefined) {
      goToFodselsdato();
      return;
    }
    if (skadedatoError !== undefined || skadedato === undefined) {
      goToSkadedato();
      return;
    }
    if (beregningsResultat === null && mengradInputRef.current) {
      mengradInputRef.current.focus();
      mengradInputRef.current.blur();
      blinkFieldAttention(mengradInputRef.current);
      return;
    }
    if (beregningsdatoError !== undefined && beregningsdatoInputRef.current) {
      beregningsdatoInputRef.current.focus();
      beregningsdatoInputRef.current.blur();
      blinkFieldAttention(beregningsdatoInputRef.current);
    }
  }, [
    beregningsResultat,
    beregningsdatoError,
    fodselsdato,
    fodselsdatoError,
    goToFodselsdato,
    goToSkadedato,
    skadedato,
    skadedatoError,
  ]);

  /**
   * Aktivering. Hele preflighten (settle, frisk capture, token-lighed, gate) ligger i definitionen;
   * det eneste sidespecifikke er blokerings-FEEDBACKEN — fokus på det første blokerende felt — som er
   * ren præsentation og bevidst ikke en del af definitionen (den er forskellig pr. side).
   *
   * Rystelsen er fjernet; fokusspringet er bevaret. Rystelsen fortalte kun, AT noget var galt
   * — det sagde knappens tooltip allerede mere præcist — mens fokusspringet fører brugeren hen til det
   * felt, der skal rettes.
   */
  const handlePdfDownload = React.useCallback(async () => {
    const outcome = await download.download(undefined);
    if (outcome.status === 'rejected' && outcome.rejection.kind === 'gate-blocked') {
      focusFirstBlockingField();
    }
  }, [download, focusFirstBlockingField]);

  // Gate-årsagen hører kun i knappens tooltip; en blokering besvares her visuelt med fokusspring.
  const pdfErrorMessage = pageMessage(download.errorMessage);

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
          {fodselsdato ? (
            <Typography className="row--text">
              {formatIsoDateLong(coerceToISODateString(fodselsdato) ?? undefined)}
            </Typography>
          ) : (
            <Typography className="row--text" color="text.secondary">
              Mangler (angiv i&nbsp; {' '}
              <Typography
                component="span"
                className="icon-text-link"
                color="inherit"
                onClick={goToFodselsdato}
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
        <Box className="row--label-right-hover__content" style={{ justifyContent: 'flex-end' }}>
          <Typography className="row--text" color={skadedato ? 'text.primary' : 'text.disabled'}>
            {skadedato ? (
              formatSkadedato(skadedato)
            ) : (
              <>
                Mangler (angiv i&nbsp; {' '}
                <Typography
                  component="span"
                  className="icon-text-link"
                  color="inherit"
                  onClick={goToSkadedato}
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
        <Box className="row--label-right-hover__content" style={{ justifyContent: 'flex-end' }}>
          {fodselsdatoError || fodselsdato === undefined || skadedato === undefined ? (
            <Tooltip
              title={fodselsdatoError || (fodselsdato === undefined || skadedato === undefined ? 'Indtastning mangler' : '')}
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
          <NumericTextField
            field={mengradRef}
            location={MENGRAD_LOCATION}
            admission={mengradAdmission}
            maxDraftLength={MENGRAD_CHAR_POLICY.maxDraftLength}
            name="mengrad"
            placeholder="0"
            width={100}
            textAlign="right"
            inputMode="numeric"
            endAdornment={({ isDraftEmpty }) => (
              <InputUnitAdornment unitSuffix={INPUT_UNIT_SUFFIX.percent} muted={isDraftEmpty} />
            )}
            warning={mengradWarning}
            inputRef={mengradInputRef}
          />
        </Box>
      </Box>

      <Box className="row--label-right-hover">
        <Typography className="row--text">Beregningsdato</Typography>
        <Box className="row--label-right-hover__content" sx={{ gap: 1 }}>
          <DateField
            field={beregningsdatoRef}
            location={BEREGNINGSDATO_LOCATION}
            name="beregningsdato"
            inputRef={beregningsdatoInputRef}
          />
          <InsertTodayDateButton
            onCommit={(today) => {
              beregningsdatoController.settleValue(today);
            }}
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

      <PageMessageRow message={pdfErrorMessage} />

      {beregningsResultat && projectionData && (
        <Box className="row--label-right-hover">
          <Typography className="row--text">
            {`Grundbeløb: ${projectionData.mengrad} % mén á ${formatAsAmount(beregningsResultat.satsPerMengrad, 2)} kr.`}
          </Typography>
          <Box className="row--label-right-hover__content" style={{ justifyContent: 'flex-end' }}>
            <Typography className="row--text">
              {formatAsAmount(beregningsResultat.grundbeloebUdenReduktion, 2)} kr.
            </Typography>
          </Box>
        </Box>
      )}

      {beregningsResultat && (
        <Box className="row--label-right-hover">
          <Typography className="row--text">
            {`Aldersreduktion, ${alderVedSkade} år = - ${beregningsResultat.aldersreduktionPct} %`}
          </Typography>
          <Box className="row--label-right-hover__content" style={{ justifyContent: 'flex-end' }}>
            <Typography className="row--text">
              {`- ${formatAsAmount(beregningsResultat.aldersreduktionBeloeb, 2)} kr.`}
            </Typography>
          </Box>
        </Box>
      )}

      <Box className="row--label-right-hover">
        <Typography className="row--text">Beregnet méngodtgørelse</Typography>
        <Box className="row--label-right-hover__content" style={{ justifyContent: 'flex-end' }}>
          {!download.canDownload ? (
            // Download-ikonet vises altid sammen med sin tekstlinje — her nedtonet/inaktivt, fordi beregningen
            // (og dermed download) er blokeret. Årsagen står KUN i ikonets tooltip: den stod tidligere
            // også som nedtonet tekst i værdikolonnen, så brugeren læste den samme besked to gange.
            <DocumentDownloadButton
              onClick={() => void handlePdfDownload()}
              disabled
              disabledReason={download.disabledReason}
              dataTestId="varigemen-download"
            />
          ) : beregningsResultat ? (
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <Typography className="row--text">
                {formatAsAmount(beregningsResultat.beregnetGodtgoerelse, 0)} kr.
              </Typography>
              <DocumentDownloadButton
                onClick={() => void handlePdfDownload()}
                dataTestId="varigemen-download"
              />
            </Box>
          ) : null}
        </Box>
      </Box>
    </ContentBox>
  );
});

MenberegningTab.displayName = 'MenberegningTab';

export default MenberegningTab;
