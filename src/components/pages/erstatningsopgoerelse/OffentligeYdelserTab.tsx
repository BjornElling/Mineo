import React from 'react';
import { Box, Typography } from '@mui/material';
import { z } from 'zod';
import OffentligeYdelserTable from '../../tables/OffentligeYdelserTable';
import ContentBox from '../../layout/ContentBox';
import LabeledControlRow from '../../layout/LabeledControlRow';
import { PageMessageRow } from '../../layout/PageMessageBox';
import { pageMessage } from '../../layout/pageMessage';
import type { ErstatningsopgoerelseValues } from '../../../schemas/formSchemas';
import { deriveOffentligeYdelserRow } from '../../../domain/erstatningsopgoerelse/helpers/offentligeYdelserDerived';
import { erOffentligeYdelserReguleringRelevant } from '../../../domain/erstatningsopgoerelse/helpers/eoInputRelevance';
import { formatAsAmount, formatKr } from '../../../utils/formatUtils';
import TransientDateInput from '../../inputs/transient/TransientDateInput';
import MappedToggleField from '../../../inputCore/react/fields/MappedToggleField';
import type { ToggleCommitDecision } from '../../../inputCore/react/fields/ToggleField';
import type { EditorLocation } from '../../../inputCore/editor/fieldEditorState';
import { buildFieldHistoryOrigin } from '../../../inputCore/editor/fieldEditorEngine';
import MultilineTextField from '../../../inputCore/react/fields/MultilineTextField';
import InfoTooltipIcon from '../../common/InfoTooltipIcon';
import InlineActionButton from '../../inputs/InlineActionButton';
import { resolveActionGate } from '../../inputs/actionGate';
import {
  buildSygedagpengeRowsForRange,
  SygedagpengeCoverageError,
} from '../../../domain/erstatningsopgoerelse/helpers/sygedagpengeInsertRows';
import { dateRanges_offentligeYdelser } from '../../../config/dateRanges';
import { derivedDateBounds } from '../../../utils/dateRangeErrorMessages';
import { isISODateString, type ISODateString } from '../../../types/branded';
import ConfirmationDialog from '../../ui/ConfirmationDialog';
import { UI_STORAGE_KEYS } from '../../../config/storageManifest';
import {
  readOptionalSessionStorageValue,
  removeOptionalSessionStorageValue,
  writeOptionalSessionStorageValue,
} from '../../../utils/safeSessionStorage';
import { reportSystemIssue } from '../../../utils/systemIssueReporter';
import { asError } from '../../../utils/typeGuards';
import { useInputEditPort } from '../../../inputCore/react/inputRuntimeContext';
import { APP_ROUTES } from '../../../config/pageNavigation';
import { EO_TAB_KEYS } from '../../../config/eoTabKeys';
import {
  eoBilagSelectionMidlertidigEetField,
  eoMidlertidigtEetFraEetSidenField,
  eoOffentligeYdelserKommentarerField,
  eoOffentligeYdelserRowsCollection,
  eoRegulerOffentligeYdelserField,
} from '../../../inputCore/catalog/erstatningsopgoerelseDescriptors';
import type { CollectionRef } from '../../../inputCore/fieldAddress';
import {
  deleteRow,
  inputTransaction,
  inputTransactionStep,
  insertRow,
  setImmediateField,
  structuralInputTransaction,
} from '../../../inputCore/inputReducer';
import { buildRowHistoryOrigin, type CollectionRowOrigin } from '../../../inputCore/react/useCollectionRows';

const OFFENTLIGE_YDELSER_COLLECTION = eoOffentligeYdelserRowsCollection.template as CollectionRef;

/**
 * Rækkelokationen for offentlige ydelser. Sygedagpenge-indsættelsen og midlertidigt-EET-togglen udsteder
 * strukturelle rækketransaktioner direkte gennem `edit.dispatch`, så de skal bygge origin på SAMME måde
 * som `useCollectionRows` gør for tabellens egne rækkehandlinger.
 */
const OFFENTLIGE_YDELSER_ROW_ORIGIN: CollectionRowOrigin = {
  locationId: 'erstatningsopgoerelse.offentligeYdelserRows',
  route: APP_ROUTES.erstatningsopgoerelse,
  tabKey: EO_TAB_KEYS.OFFENTLIGE_YDELSER,
};

/** Midlertidigt-EET-togglens felt-ref + editorlokation (§3.2); feltet bor på Offentlige ydelser-fanen. */
const midlertidigtEetFieldRef = eoMidlertidigtEetFraEetSidenField.bind();
const MIDLERTIDIGT_EET_LOCATION: EditorLocation = {
  locationId: 'erstatningsopgoerelse.midlertidigtEetFraEetSiden',
  route: APP_ROUTES.erstatningsopgoerelse,
  tabKey: EO_TAB_KEYS.OFFENTLIGE_YDELSER,
};

/**
 * Reguleringstogglens editorlokation (§3.2). Feltet blev flyttet hertil fra EO oplysninger-fanen
 *; `locationId` er uændret, fordi det navngiver FELTETS editorlokation og ikke fanen – men
 * `tabKey` peger nu på Offentlige ydelser, så fokusnavigationen lander det rigtige sted.
 */
const REGULER_OFFENTLIGE_YDELSER_LOCATION: EditorLocation = {
  locationId: 'erstatningsopgoerelse.regulerOffentligeYdelser',
  route: APP_ROUTES.erstatningsopgoerelse,
  tabKey: EO_TAB_KEYS.OFFENTLIGE_YDELSER,
};

const offentligeYdelserHelpersSessionSchema = z.object({
  sygedagpengeFraDato: z.preprocess(
    (value) => (value === null || value === '' ? undefined : value),
    z.string().refine((value) => isISODateString(value), 'Skal være gyldig ISO dato').optional()
  ),
  sygedagpengeTilDato: z.preprocess(
    (value) => (value === null || value === '' ? undefined : value),
    z.string().refine((value) => isISODateString(value), 'Skal være gyldig ISO dato').optional()
  ),
}).strict();

type OffentligeYdelserHelpersSessionState = z.infer<typeof offentligeYdelserHelpersSessionSchema>;

type Props = Readonly<{
  values: ErstatningsopgoerelseValues;
}>;

/**
 * Offentlige ydelser-fanen - modtagne ydelser
 */
const OffentligeYdelserTab = React.memo(({ values }: Props) => {
  const edit = useInputEditPort();
  const rows = values.offentligeYdelserRows;
  const sygedagpengeFraInputRef = React.useRef<HTMLInputElement | null>(null);
  const shouldFocusSygedagpengeFraRef = React.useRef(false);
  const suppressSygedagpengeFieldCommitRef = React.useRef(false);
  // Sættes når mount-effekten har læst sessionStorage ind i de to hjælpe-datoer. Spærrer write-effekten
  // mod at skrive den netop indlæste værdi tilbage i samme runde (undgår hydration round-trip-skrivning).
  const helpersHydratedRef = React.useRef(false);
  const [sygedagpengeFraDato, setSygedagpengeFraDato] = React.useState<ISODateString | undefined>(undefined);
  const [sygedagpengeTilDato, setSygedagpengeTilDato] = React.useState<ISODateString | undefined>(undefined);
  const [sygedagpengeFraError, setSygedagpengeFraError] = React.useState<string | undefined>(undefined);
  const [sygedagpengeTilError, setSygedagpengeTilError] = React.useState<string | undefined>(undefined);
  const [sygedagpengeInsertError, setSygedagpengeInsertError] = React.useState<string | null>(null);
  const [midlertidigtEetToggleError, setMidlertidigtEetToggleError] = React.useState<string | null>(null);
  const [midlertidigtEetConfirmDialogOpen, setMidlertidigtEetConfirmDialogOpen] = React.useState(false);

  const readHelpersSessionState = React.useCallback((): OffentligeYdelserHelpersSessionState => {
    try {
      const raw = readOptionalSessionStorageValue(UI_STORAGE_KEYS.eoOffentligeYdelserHelpers);
      if (!raw) return {};
      const parsedJson: unknown = JSON.parse(raw);
      const parsed = offentligeYdelserHelpersSessionSchema.safeParse(parsedJson);
      return parsed.success ? parsed.data : {};
    } catch {
      return {};
    }
  }, []);

  const writeHelpersSessionState = React.useCallback((nextState: OffentligeYdelserHelpersSessionState): void => {
    if (!nextState.sygedagpengeFraDato && !nextState.sygedagpengeTilDato) {
      removeOptionalSessionStorageValue(UI_STORAGE_KEYS.eoOffentligeYdelserHelpers);
      return;
    }
    writeOptionalSessionStorageValue(UI_STORAGE_KEYS.eoOffentligeYdelserHelpers, JSON.stringify(nextState));
  }, []);

  React.useEffect(() => {
    const persistedState = readHelpersSessionState();
    setSygedagpengeFraDato((persistedState.sygedagpengeFraDato as ISODateString | undefined) ?? undefined);
    setSygedagpengeTilDato((persistedState.sygedagpengeTilDato as ISODateString | undefined) ?? undefined);
    helpersHydratedRef.current = true;
  }, [readHelpersSessionState]);

  React.useEffect(() => {
    // Spring den initiale hydration round-trip over: skriv først tilbage efter mount-effekten har læst
    // den persisterede værdi ind, så vi ikke skriver den netop indlæste værdi tilbage uændret.
    if (!helpersHydratedRef.current) return;
    writeHelpersSessionState({
      sygedagpengeFraDato,
      sygedagpengeTilDato,
    });
  }, [sygedagpengeFraDato, sygedagpengeTilDato, writeHelpersSessionState]);

  React.useEffect(() => {
    if (!shouldFocusSygedagpengeFraRef.current) return;
    if (sygedagpengeFraDato !== undefined || sygedagpengeTilDato !== undefined) return;
    shouldFocusSygedagpengeFraRef.current = false;
    requestAnimationFrame(() => {
      sygedagpengeFraInputRef.current?.focus();
    });
  }, [sygedagpengeFraDato, sygedagpengeTilDato]);

  const formatAntalDage = React.useCallback((value: number): string => {
    return formatAsAmount(value, 0);
  }, []);

  const derivedByRowId = React.useMemo(() => {
    const map = new Map<string, { periodiseringLabel: string; antalDageDisplay: string; ydelsePerDagDisplay: string }>();
    for (const row of rows) {
      const derived = deriveOffentligeYdelserRow(row);
      map.set(row.id, {
        periodiseringLabel: derived.periodiseringLabel,
        antalDageDisplay: derived.antalDage !== null ? formatAntalDage(derived.antalDage) : '',
        ydelsePerDagDisplay: derived.ydelsePerDag !== null ? formatKr(derived.ydelsePerDag, 2) : '',
      });
    }
    return map;
  }, [formatAntalDage, rows]);

  const handleSygedagpengeInsert = React.useCallback(() => {
    if (!sygedagpengeFraDato || !sygedagpengeTilDato) return;

    const generatedRows = (() => {
      try {
        return buildSygedagpengeRowsForRange(sygedagpengeFraDato, sygedagpengeTilDato);
      } catch (error) {
        if (error instanceof SygedagpengeCoverageError) {
          // Manglende satsdækning er en forventet brugerfejl: vis beskeden direkte,
          // indfør ingen rækker, og rapportér det IKKE som en intern systemfejl.
          setSygedagpengeInsertError(error.message);
          return null;
        }
        const normalizedError = asError(error);
        reportSystemIssue({
          code: 'offentlige_ydelser:sygedagpenge_insert_failed',
          area: 'calculation',
          context: 'OffentligeYdelserTab.handleSygedagpengeInsert',
          userMessage: 'Sygedagpenge-rækker kunne ikke indsættes',
          developerMessage: normalizedError.message,
          error: normalizedError,
        });
        setSygedagpengeInsertError('Sygedagpenge-rækker kunne ikke indsættes på grund af en intern beregningsfejl.');
        return null;
      }
    })();
    if (generatedRows === null) return;
    if (generatedRows.length === 0) {
      // Defensivt: en fuldt dækket periode bør altid give mindst én række. Hvis ikke,
      // har brugeren valgt et interval uden sygedagpenge-arbejdsdage (fx kun weekend) –
      // sig det tydeligt frem for at fejle tavst.
      setSygedagpengeInsertError(
        'Den valgte periode indeholder ingen sygedagpenge-dage, så der blev ikke indsat nogen rækker.'
      );
      return;
    }

    setSygedagpengeInsertError(null);
    suppressSygedagpengeFieldCommitRef.current = true;
    const insertIndex = rows.findIndex((row) => row.fraDato === undefined
      && row.tilDato === undefined
      && row.ydelse === undefined
      && row.tillaeg === undefined
      && row.ydelsestype === undefined);
    const baseIndex = insertIndex < 0 ? rows.length : insertIndex;
    edit.dispatch(
      structuralInputTransaction(generatedRows.map((row, index) => inputTransactionStep(insertRow(
        OFFENTLIGE_YDELSER_COLLECTION,
        row,
        baseIndex + index
      )))),
      buildRowHistoryOrigin(OFFENTLIGE_YDELSER_COLLECTION, OFFENTLIGE_YDELSER_ROW_ORIGIN)
    );
    shouldFocusSygedagpengeFraRef.current = true;
    setSygedagpengeFraDato(undefined);
    setSygedagpengeTilDato(undefined);
    setSygedagpengeFraError(undefined);
    setSygedagpengeTilError(undefined);
    // Tæt koblet til det transiente datofelts commit-timing: suppression skal overleve
    // det blur/commit, som klik på "Indsæt" udløser i samme frame, men må ikke blive hængende længere.
    requestAnimationFrame(() => {
      suppressSygedagpengeFieldCommitRef.current = false;
    });
  }, [rows, edit, sygedagpengeFraDato, sygedagpengeTilDato]);

  const handleSygedagpengeFraError = React.useCallback((error: string | undefined) => {
    if (suppressSygedagpengeFieldCommitRef.current) return;
    const nextMessage = error;
    setSygedagpengeFraError((prev) => (prev === nextMessage ? prev : nextMessage));
  }, []);

  const handleSygedagpengeTilError = React.useCallback((error: string | undefined) => {
    if (suppressSygedagpengeFieldCommitRef.current) return;
    const nextMessage = error;
    setSygedagpengeTilError((prev) => (prev === nextMessage ? prev : nextMessage));
  }, []);

  /**
   * «Indsæt»-knappens gate. Årsagen klassificeres frem for at blive skrevet i hånden, så knappen
   * bruger programmets universelle tekster for grå knapper (§11.1) – samme to klasser og samme
   * ordlyd som de deaktiverede downloadknapper.
   *
   * Rækkefølgen betyder ikke noget her; `resolveActionGate` ejer forrangen (ugyldigt slår manglende).
   */
  const sygedagpengeInsertGate = React.useMemo(() => resolveActionGate([
    ...(sygedagpengeFraError || sygedagpengeTilError
      ? [{ kind: 'invalid-input' } as const]
      : []),
    ...(!sygedagpengeFraDato || !sygedagpengeTilDato
      ? [{ kind: 'missing-input' } as const]
      : []),
  ]), [sygedagpengeFraDato, sygedagpengeFraError, sygedagpengeTilDato, sygedagpengeTilError]);

  const isMidlertidigtEetFraEetSiden = values.midlertidigtEetFraEetSiden === 'Ja';

  /**
   * Atomisk commit af togglen + sideopgaver.
   * Når togglen aktiveres, ryddes manuelle midlertidigt_eet-rækker væk fra tabellen og
   * bilag-checkboxen `midlertidigEet` tændes. Når togglen deaktiveres, slukkes
   * bilag-checkboxen igen. Alle ændringer sker i én inputtransaktion for at undgå
   * inkonsistente mellemtilstande i snapshot-revisionen.
   */
  const commitMidlertidigtEetToggle = React.useCallback((nextChecked: boolean): boolean => {
    try {
      const rowDeletes = nextChecked
        ? rows.filter((row) => row.ydelsestype?.trim() === 'midlertidigt_eet')
          .map((row) => inputTransactionStep(deleteRow(OFFENTLIGE_YDELSER_COLLECTION, row.id)))
        : [];
      const fieldSteps = [
        inputTransactionStep(setImmediateField(eoMidlertidigtEetFraEetSidenField.bind(), nextChecked ? 'Ja' : 'Nej')),
        inputTransactionStep(setImmediateField(eoBilagSelectionMidlertidigEetField.bind(), nextChecked)),
      ];
      // Togglen er kun STRUKTUREL, når den faktisk sletter rækker (dvs. ved tilslå). Slår den fra, er det en
      // ren felttransaktion, og en rækkeorigin ville foregøgle en rækkehandling, der ikke fandt sted (§3.7).
      if (rowDeletes.length > 0) {
        edit.dispatch(
          structuralInputTransaction([...rowDeletes, ...fieldSteps]),
          buildRowHistoryOrigin(OFFENTLIGE_YDELSER_COLLECTION, OFFENTLIGE_YDELSER_ROW_ORIGIN)
        );
      } else {
        // Den simple ændring skal bære origin, så undo kan navigere og refokusere
        // togglen. Den er et FELT-commit – transaktionen rører kun felter – og bærer derfor togglens egen
        // feltorigin, præcis som feltadapterens normale `commitImmediate`-vej gør (§3.7).
        edit.dispatch(
          inputTransaction(fieldSteps),
          buildFieldHistoryOrigin(MIDLERTIDIGT_EET_LOCATION, midlertidigtEetFieldRef)
        );
      }
      setMidlertidigtEetToggleError(null);
      return true;
    } catch (error) {
      const normalizedError = asError(error);
      reportSystemIssue({
        code: 'offentlige_ydelser:midlertidigt_eet_toggle_failed',
        area: 'persistence',
        context: 'OffentligeYdelserTab.commitMidlertidigtEetToggle',
        userMessage: 'Midlertidigt EET-valget kunne ikke gemmes',
        developerMessage: normalizedError.message,
        error: normalizedError,
      });
      setMidlertidigtEetToggleError('Midlertidigt EET-valget kunne ikke gemmes på grund af en intern fejl.');
      return false;
    }
  }, [rows, edit]);

  /**
   * Togglens afslutning som feltadapterens {@link ToggleCommitOverride}.
   *
   * Udfaldet er ALTID `'handled'` eller `'reject'`, aldrig `'commit'`: hver gren rører mere end det ene felt –
   * bilag-checkboxen følger altid med, og en tilslåning kan desuden slette manuelle rækker. Adapteren må derfor
   * ikke skrive oveni; den ejer identiteten, visningen og undo/redo-fokusmålet, mens transaktionen er vores.
   */
  const decideMidlertidigtEetToggle = React.useCallback((next: 'Ja' | 'Nej'): ToggleCommitDecision => {
    const nextChecked = next === 'Ja';
    // Uændret valg: intet at skrive, men heller ingen afvisning at vise.
    if (nextChecked === isMidlertidigtEetFraEetSiden) return 'handled';
    if (!nextChecked) {
      return commitMidlertidigtEetToggle(false) ? 'handled' : 'reject';
    }
    const hasExistingMidlertidigtEetRows = rows.some((row) => row.ydelsestype?.trim() === 'midlertidigt_eet');
    if (!hasExistingMidlertidigtEetRows) {
      return commitMidlertidigtEetToggle(true) ? 'handled' : 'reject';
    }
    // Bekræftelsen skal først indhentes; dialogens Ja-knap afslutter transaktionen.
    setMidlertidigtEetConfirmDialogOpen(true);
    return 'handled';
  }, [commitMidlertidigtEetToggle, isMidlertidigtEetFraEetSiden, rows]);

  const handleMidlertidigtEetConfirm = React.useCallback((): boolean => {
    const didCommit = commitMidlertidigtEetToggle(true);
    if (didCommit) {
      setMidlertidigtEetConfirmDialogOpen(false);
    }
    return didCommit;
  }, [commitMidlertidigtEetToggle]);

  return (
    <>
      <ContentBox className="content-box">
        <Typography className="section-header">Offentlige ydelser</Typography>
        <Typography className="row--text" sx={{ mb: 2 }}>
          Ydelser fra offentlige myndigheder, herunder midlertidigt erhvervsevnetab.
        </Typography>

          <OffentligeYdelserTable
            committedRows={rows}
            derivedByRowId={derivedByRowId}
            saveOrderPath="erstatningsopgoerelse.offentligeYdelserRows"
            disableMidlertidigtEetOption={isMidlertidigtEetFraEetSiden}
          />
      </ContentBox>

      <ContentBox className="content-box">
        <Typography className="section-header">Tilføj særligt</Typography>

        <Box className="row--label-right-hover">
          <Typography className="row--text">Indsæt maksimal sygedagpengesats for perioden</Typography>
          <Box className="row--label-right-hover__content" sx={{ gap: 1.5, flexWrap: 'wrap' }}>
            <TransientDateInput
              inputRef={sygedagpengeFraInputRef}
              aria-label="Fra-dato"
              value={sygedagpengeFraDato}
              onCommit={(next) => {
                if (suppressSygedagpengeFieldCommitRef.current) return;
                setSygedagpengeFraDato(next);
              }}
              onReject={handleSygedagpengeFraError}
              errorMessage={sygedagpengeFraError}
              width={130}
              minDate={dateRanges_offentligeYdelser.fraDato.min}
              maxDate={sygedagpengeTilDato ?? dateRanges_offentligeYdelser.fraDato.fallbackMax}
              specialRangeErrors={{ fraTilRole: 'fra' }}
              // Max kommer fra til-datoen; parret kan derfor gøre intervallet umuligt.
              bounds={derivedDateBounds('Fra-dato og til-dato i sygedagpenge-indsættelsen')}
            />
            <Typography className="row--text">-</Typography>
            <TransientDateInput
              aria-label="Til-dato"
              value={sygedagpengeTilDato}
              onCommit={(next) => {
                if (suppressSygedagpengeFieldCommitRef.current) return;
                setSygedagpengeTilDato(next);
              }}
              onReject={handleSygedagpengeTilError}
              errorMessage={sygedagpengeTilError}
              width={130}
              minDate={sygedagpengeFraDato ?? dateRanges_offentligeYdelser.tilDato.fallbackMin}
              maxDate={dateRanges_offentligeYdelser.tilDato.max}
              specialRangeErrors={{ fraTilRole: 'til' }}
              // Min kommer fra fra-datoen; samme udledning fra den anden side.
              bounds={derivedDateBounds('Fra-dato og til-dato i sygedagpenge-indsættelsen')}
            />
            <InlineActionButton
              onClick={handleSygedagpengeInsert}
              disabled={sygedagpengeInsertGate.disabled}
              disabledReason={sygedagpengeInsertGate.disabledReason}
            >
              Indsæt
            </InlineActionButton>
          </Box>
        </Box>
        <PageMessageRow message={pageMessage(sygedagpengeInsertError)} rightCellHasContentClass />

        <Box className="row--label-right-hover">
          <Typography className="row--text">Midlertidigt EET indsættes fra Erhvervsevnetab-siden</Typography>
          <Box className="row--label-right-hover__content">
            <MappedToggleField
              field={midlertidigtEetFieldRef}
              location={MIDLERTIDIGT_EET_LOCATION}
              checkedValue="Ja"
              uncheckedValue="Nej"
              name="midlertidigtEetFraEetSiden"
              ariaLabel="Midlertidigt EET indsættes fra Erhvervsevnetab-siden"
              commit={decideMidlertidigtEetToggle}
            />
          </Box>
        </Box>
        <PageMessageRow message={pageMessage(midlertidigtEetToggleError)} rightCellHasContentClass />

        {/*
          Reguleringen af offentlige ydelser hører til ydelserne selv og stod tidligere på EO
          oplysninger-fanen. Feltet er uændret; kun editorlokationen er flyttet hertil, så
          fokusnavigationen fører brugeren til den fane, feltet faktisk redigeres på (§3.2).

          Synligheden er PRÆCIS den samme betingelse som før flytningen – nu udtrykt gennem det delte
          relevans-prædikat, så synlighed og beregningsrelevans har ét sandt sted.
        */}
        {erOffentligeYdelserReguleringRelevant(values) ? (
          <LabeledControlRow
            label={(
              <>
                Offentlige ydelser i beregningsperioden reguleres
                <InfoTooltipIcon title="Offentlige ydelser fremskrives efter statslig praksis med tilpasningsprocenten + 2 % per 1. januar" />
              </>
            )}
          >
            {({ labelledBy, controlId }) => (
              <MappedToggleField
                field={eoRegulerOffentligeYdelserField.bind()}
                location={REGULER_OFFENTLIGE_YDELSER_LOCATION}
                checkedValue="Ja"
                uncheckedValue="Nej"
                name="regulerOffentligeYdelser"
                id={controlId}
                labelledBy={labelledBy}
              />
            )}
          </LabeledControlRow>
        ) : null}
      </ContentBox>

      <ContentBox className="content-box">
        <Typography className="section-header">Kommentarer</Typography>
        <MultilineTextField
          field={eoOffentligeYdelserKommentarerField.bind()}
          // route + tabKey er eksplicit navigation-metadata (§3.7); feltet bor på Offentlige ydelser-fanen.
          location={{ locationId: 'erstatningsopgoerelse.offentligeYdelserKommentarer', route: APP_ROUTES.erstatningsopgoerelse, tabKey: EO_TAB_KEYS.OFFENTLIGE_YDELSER }}
          name="offentligeYdelserKommentarer"
          width={800}
          rows={4}
          placeholder="Indtast eventuelle kommentarer her..."
        />
      </ContentBox>

      <ConfirmationDialog
        open={midlertidigtEetConfirmDialogOpen}
        title="Slet manuelle indtastninger af Midlertidigt EET"
        message={(
          <>
            Når midlertidigt EET indsættes fra Erhvervsevnetab-siden, kan der ikke samtidig stå manuelle rækker med ydelsestypen &quot;Midlertidigt EET&quot; i tabellen ovenfor. Disse rækker vil blive slettet.
            <br />
            <br />
            Bekræft venligst.
          </>
        )}
        confirmText="Ja, slet og aktivér"
        cancelText="Annuller"
        onConfirm={handleMidlertidigtEetConfirm}
        onCancel={() => setMidlertidigtEetConfirmDialogOpen(false)}
      />
    </>
  );
});

OffentligeYdelserTab.displayName = 'OffentligeYdelserTab';

export default OffentligeYdelserTab;
