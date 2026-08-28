import React from 'react';
import { Box, Typography, Tooltip } from '@mui/material';
import DocumentDownloadButton from '../../inputs/DocumentDownloadButton';
import DateField from '../../../inputCore/react/fields/DateField';
import NumericTextField from '../../../inputCore/react/fields/NumericTextField';
import InsertTodayDateButton from '../../inputs/InsertTodayDateButton';
import InputUnitAdornment from '../../inputs/InputUnitAdornment';
import ContentBox from '../../layout/ContentBox';
import MirroredStamdataRow from '../../layout/MirroredStamdataRow';
import { PageMessageRow } from '../../layout/PageMessageBox';
import { pageMessage } from '../../layout/pageMessage';
import { integerAdmission } from '../../inputs/draftAdmission';
import { resolveIntegerCharPolicy } from '../../../inputCore/react/fields/charLengthPolicy';
import { INPUT_UNIT_SUFFIX } from '../../../utils/inputUnit';
import { coerceToISODateString, parseISODate } from '../../../types/branded';
import { useNavigate } from 'react-router-dom';
import { formatIsoDateLong } from '../../../utils/dateFormatting';
import { formatKr } from '../../../utils/formatUtils';
import { formatDeductionKr, formatDeductionPercent } from '../../../utils/deductionFormatting';
import { calculateUtcAgeInWholeYears, getTodayLocalISO } from '../../../utils/dateUtils';
import { varigeMenPrGrad } from '../../../data/lovbestemteRates';
import { resolveMenSatsForBeregningsdato } from '../../../domain/varigemen/varigeMenCalculations';
import { resolveVarigeMenWarning } from '../../../domain/varigemen/varigeMenPolicy';
import { resolveStamdataDatoReference } from '../../../domain/policies/stamdataCalculations';
import {
  ACTION_BLOCKED_INVALID_INPUT_MESSAGE,
  ACTION_BLOCKED_MISSING_INPUT_MESSAGE,
} from '../../inputs/actionGate';
import { dateRanges_varigemen } from '../../../config/dateRanges';
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
import { useInputReadPort } from '../../../inputCore/react/inputRuntimeContext';
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
/** Méngradens tegn- og længdepolitik fra dens eget codec – én erklæring for formular og grid. */
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

  // Den ENE reader-afledte projektion (§3.4/§5.4) – beregningsvisning og download-gate deler præcis samme sandhed.
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
  const mengradRead = evaluation.reader.read(mengradRef);

  const fodselsdato = fodselsdatoRead.status === 'usable' ? fodselsdatoRead.value : undefined;
  const skadedato = skadedatoRead.status === 'usable' ? skadedatoRead.value : undefined;
  const skadestype = skadestypeRead.status === 'usable' ? skadestypeRead.value : undefined;
  const fodselsdatoError = fodselsdatoRead.status === 'error' ? fodselsdatoRead.issue.message : undefined;
  const skadedatoError = skadedatoRead.status === 'error' ? skadedatoRead.issue.message : undefined;
  const beregningsdatoError = beregningsdatoRead.status === 'error' ? beregningsdatoRead.issue.message : undefined;
  const mengradForWarning = mengradRead.status === 'usable' ? mengradRead.value : undefined;

  // Alder og sats vises uafhængigt af méngrad: alderen så snart begge datoer er gyldige, satsen så
  // snart beregningsdatoen har en lovsats for sit år – også når méngrad mangler og projektionen derfor er blokeret.
  const alderVedSkade = React.useMemo(() => {
    if (fodselsdato === undefined || skadedato === undefined) return undefined;
    const f = parseISODate(coerceToISODateString(fodselsdato) ?? undefined);
    const s = parseISODate(coerceToISODateString(skadedato) ?? undefined);
    if (!f || !s) return undefined;
    return calculateUtcAgeInWholeYears(f, s);
  }, [fodselsdato, skadedato]);
  const beregningsdato = beregningsdatoRead.status === 'usable' ? beregningsdatoRead.value : undefined;
  const mengradWarning = resolveVarigeMenWarning(mengradForWarning);
  const menSats = React.useMemo(
    () => resolveMenSatsForBeregningsdato(coerceToISODateString(beregningsdato) ?? undefined, varigeMenPrGrad),
    [beregningsdato]
  );

  // Spejlet stamdata-værdi: navnet OG dets afledte former kommer fra feltets ene navneregel (§3.2a),
  // aldrig fra en lokal ternary. Tidspunktsformen lå her som netop sådan en, indtil referencen selv
  // kom til at bære den (BB-121); en erhvervssygdom omtales dermed ikke med et «skadestidspunkt»,
  // sagen ikke har (BB-072).
  const datoReference = resolveStamdataDatoReference(skadestype);
  const skadedatoLabel = datoReference.label;
  const alderVedSkadeLabel = `Alder på ${datoReference.tidspunkt}`;

  // "Indsæt dags dato" må ikke kunne producere en værdi, feltet selv afviser (BB-068): er dags dato uden for
  // beregningsdatoens øvre grænse (satsdatasættets sidste dækkede år), er knappen inaktiv med årsagen i tooltippen.
  const beregningsdatoMax = dateRanges_varigemen.beregningsdato.max;
  const todayIso = React.useMemo(() => getTodayLocalISO(), []);
  const insertTodayDisabledReason = todayIso > beregningsdatoMax
    ? `Der kan kun foretages beregninger frem til ${formatIsoDateLong(beregningsdatoMax)}`
    : undefined;

  /**
   * Naviger til Stamdata OG markér det felt, der mangler.
   *
   * Bruges både af «Mangler (angiv i Stamdata)»-linkene og af blokerings-feedbacken nedenfor. Markeringen
   * er den DELTE `blinkFieldAttention` via `scrollToFieldAddress` – samme adfærd som fejl- og
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

  const readPort = useInputReadPort();

  // Fokusér det første blokerende felt efter en blokeret download. Læser en FRISK evaluering
  // (`readPort.getEvaluation()`) taget EFTER preflightens settle, ikke render-tidens closure-værdier –
  // closure'en er frosset fra renderet før klikket, og på klik-tidspunktet er beregningen typisk stadig
  // gyldig i det renderede snapshot, selvom preflighten netop har afsluttet et felt som rødt (BB-069).
  // Prioritet: Fødselsdato → Skadedato → Méngrad → Beregningsdato.
  const focusFirstBlockingField = React.useCallback(() => {
    const freshReader = readPort.getEvaluation().reader;
    const freshFodselsdatoRead = freshReader.read(fodselsdatoRef);
    const freshSkadedatoRead = freshReader.read(skadedatoRef);
    const freshMengradRead = freshReader.read(mengradRef);
    const freshBeregningsdatoRead = freshReader.read(beregningsdatoRef);

    if (freshFodselsdatoRead.status !== 'usable') {
      goToFodselsdato();
      return;
    }
    if (freshSkadedatoRead.status !== 'usable') {
      goToSkadedato();
      return;
    }
    if (freshMengradRead.status !== 'usable' && mengradInputRef.current) {
      mengradInputRef.current.focus();
      mengradInputRef.current.blur();
      blinkFieldAttention(mengradInputRef.current);
      return;
    }
    if (freshBeregningsdatoRead.status !== 'usable' && beregningsdatoInputRef.current) {
      beregningsdatoInputRef.current.focus();
      beregningsdatoInputRef.current.blur();
      blinkFieldAttention(beregningsdatoInputRef.current);
    }
  }, [goToFodselsdato, goToSkadedato, readPort]);

  /**
   * Aktivering. Hele preflighten (settle, frisk capture, token-lighed, gate) ligger i definitionen;
   * det eneste sidespecifikke er blokerings-FEEDBACKEN – fokus på det første blokerende felt – som er
   * ren præsentation og bevidst ikke en del af definitionen (den er forskellig pr. side).
   *
   * Rystelsen er fjernet; fokusspringet er bevaret. Rystelsen fortalte kun, AT noget var galt
   * – det sagde knappens tooltip allerede mere præcist – mens fokusspringet fører brugeren hen til det
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

  // `formatSkadedato` er FJERNET (BB-126): dens «Mangler (angiv i Stamdata)»-gren var uopnåelig, fordi
  // kaldsstedet allerede gav `undefined` for en tom dato – og den duplikerede rækkekomponentens ordlyd
  // som en løs streng, hvilket var en invitation til at genindføre det mønster, komponenten afskaffede.

  return (
    <ContentBox className="content-box">
      <Typography className="section-header">Méngodtgørelse</Typography>

      <Typography className="row--subheading">Stamdata</Typography>

      {/* De to spejlede stamdata-rækker deler nu komponent med Forsørgertabs (BB-126): den ugyldige gren
          bærer samme link til Stamdata som den tomme, i stedet for en tekst uden vej tilbage. */}
      <MirroredStamdataRow
        label="Fødselsdato"
        value={fodselsdato ? formatIsoDateLong(coerceToISODateString(fodselsdato) ?? undefined) : undefined}
        errorMessage={fodselsdatoError}
        onNavigate={goToFodselsdato}
      />

      <MirroredStamdataRow
        label={skadedatoLabel}
        value={skadedato ? formatIsoDateLong(coerceToISODateString(skadedato) ?? undefined) : undefined}
        errorMessage={skadedatoError}
        onNavigate={goToSkadedato}
        color="text.disabled"
      />

      {/* Alderen er AFLEDT af de to rækker ovenfor og er derfor ikke en spejlet stamdata-række – men den
          skal have samme vej tilbage (BB-126). Linket peger på det felt, der faktisk står i vejen: er
          fødselsdatoen problemet, fører det dertil, ellers til skadedatoen. */}
      <MirroredStamdataRow
        label={alderVedSkadeLabel}
        value={alderVedSkade === undefined ? undefined : `${alderVedSkade} år`}
        errorMessage={fodselsdatoError ?? skadedatoError}
        onNavigate={fodselsdatoError !== undefined || fodselsdato === undefined ? goToFodselsdato : goToSkadedato}
        color="text.disabled"
      />

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
            disabled={insertTodayDisabledReason !== undefined}
            disabledReason={insertTodayDisabledReason}
          />
        </Box>
      </Box>

      <Box className="row--label-right-hover">
        <Typography className="row--text">
          {menSats !== undefined
            ? `Sats pr. méngrad i beregningsår ${menSats.aar}`
            : 'Sats pr. méngrad i beregningsåret'}
        </Typography>
        <Box className="row--label-right-hover__content" style={{ justifyContent: 'flex-end' }}>
          {menSats !== undefined ? (
            <Typography className="row--text">
              {formatKr(menSats.sats)}
            </Typography>
          ) : beregningsdatoError ? (
            <Tooltip title={ACTION_BLOCKED_INVALID_INPUT_MESSAGE} arrow>
              <Typography className="row--text" color="text.disabled">
                {ACTION_BLOCKED_INVALID_INPUT_MESSAGE}
              </Typography>
            </Tooltip>
          ) : (
            <Tooltip title={ACTION_BLOCKED_MISSING_INPUT_MESSAGE} arrow>
              <Typography className="row--text" color="text.disabled">
                {ACTION_BLOCKED_MISSING_INPUT_MESSAGE}
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
            {`Grundbeløb: ${projectionData.mengrad} % mén á ${formatKr(beregningsResultat.satsPerMengrad)}`}
          </Typography>
          <Box className="row--label-right-hover__content" style={{ justifyContent: 'flex-end' }}>
            <Typography className="row--text">
              {formatKr(beregningsResultat.grundbeloebUdenReduktion)}
            </Typography>
          </Box>
        </Box>
      )}

      {beregningsResultat && (
        <Box className="row--label-right-hover">
          {/* BB-073's regel læses nu fra den delte helper (BB-129/130). Den lokale ternary vagtede på
              RÅværdien, mens helperen vagter på det, brugeren faktisk ser – forskellen betyder noget,
              hvis beløbet en dag ikke længere er en hel krone. */}
          <Typography className="row--text">
            {`Aldersreduktion, ${alderVedSkade} år = ${formatDeductionPercent(
              beregningsResultat.aldersreduktionPct,
              `${beregningsResultat.aldersreduktionPct} %`
            )}`}
          </Typography>
          <Box className="row--label-right-hover__content" style={{ justifyContent: 'flex-end' }}>
            <Typography className="row--text">
              {formatDeductionKr(beregningsResultat.aldersreduktionBeloeb)}
            </Typography>
          </Box>
        </Box>
      )}

      <Box className="row--label-right-hover">
        <Typography className="row--text">Beregnet méngodtgørelse</Typography>
        <Box className="row--label-right-hover__content" style={{ justifyContent: 'flex-end' }}>
          {!download.canDownload ? (
            // Download-ikonet vises altid sammen med sin tekstlinje – her nedtonet/inaktivt, fordi beregningen
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
                {formatKr(beregningsResultat.beregnetGodtgoerelse)}
              </Typography>
              <DocumentDownloadButton
                onClick={() => void handlePdfDownload()}
                // BB-069: uden dette flytter museklikkets mousedown fokus til knappen og blurrer en åben,
                // ugyldig draft (fx méngrad) FØRST – draften committes synkront, knappen bliver disabled,
                // og click-eventet når aldrig `onClick`. preventDefault bevarer fokus på draft-feltet, så
                // klikket altid rammer preflighten, som selv settler og afgør udfaldet mod frisk state.
                onMouseDown={(e) => e.preventDefault()}
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
