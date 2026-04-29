import React from 'react';
import { Box, Typography } from '@mui/material';
import { z } from 'zod';
import OffentligeYdelserTable from '../../tables/OffentligeYdelserTable';
import ContentBox from '../../layout/ContentBox';
import type { ErstatningsopgoerelseValues, OffentligeYdelserRow } from '../../../schemas/formSchemas';
import { deriveOffentligeYdelserRow } from '../../../domain/erstatningsopgoerelse/helpers/offentligeYdelserDerived';
import { formatCurrency } from '../../../utils/formatUtils';
import StyledDateField from '../../inputs/StyledDateField';
import StyledToggleSwitch from '../../inputs/StyledToggleSwitch';
import InlineActionButton from '../../inputs/InlineActionButton';
import { buildSygedagpengeRowsForRange } from '../../../domain/erstatningsopgoerelse/helpers/sygedagpengeInsertRows';
import { insertOffentligeYdelserRowsBeforeTrailingEmpty } from '../../../domain/erstatningsopgoerelse/helpers/offentligeYdelserRowInsertion';
import { dateRanges_offentligeYdelser } from '../../../config/dateRanges';
import { isISODateString, type ISODateString } from '../../../types/branded';
import { getReportableFieldErrorMessage, type ReportableFieldError } from '../../../types/fieldErrors';
import ConfirmationDialog from '../../ui/ConfirmationDialog';
import { UI_STORAGE_KEYS } from '../../../config/storageManifest';
import {
  readOptionalSessionStorageValue,
  removeOptionalSessionStorageValue,
  writeOptionalSessionStorageValue,
} from '../../../utils/safeSessionStorage';
import { type SetValuesUpdater } from '../../../hooks/usePersistedForm';
import type { CommitEvent } from '../../../types/fieldEvents';

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
  rows: OffentligeYdelserRow[];
  onRowsChange: (rows: OffentligeYdelserRow[]) => void;
  midlertidigtEetFraEetSiden: ErstatningsopgoerelseValues['midlertidigtEetFraEetSiden'];
  setEOValues: SetValuesUpdater<ErstatningsopgoerelseValues>;
}>;

/**
 * Offentlige ydelser-fanen - modtagne ydelser
 */
const OffentligeYdelserTab = React.memo(({ rows, onRowsChange, midlertidigtEetFraEetSiden, setEOValues }: Props) => {
  const sygedagpengeFraInputRef = React.useRef<HTMLInputElement | null>(null);
  const shouldFocusSygedagpengeFraRef = React.useRef(false);
  const suppressSygedagpengeFieldCommitRef = React.useRef(false);
  const [sygedagpengeFraDato, setSygedagpengeFraDato] = React.useState<ISODateString | undefined>(undefined);
  const [sygedagpengeTilDato, setSygedagpengeTilDato] = React.useState<ISODateString | undefined>(undefined);
  const [sygedagpengeFraError, setSygedagpengeFraError] = React.useState<string | undefined>(undefined);
  const [sygedagpengeTilError, setSygedagpengeTilError] = React.useState<string | undefined>(undefined);
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
  }, [readHelpersSessionState]);

  React.useEffect(() => {
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
    return new Intl.NumberFormat('da-DK', { maximumFractionDigits: 0 }).format(value);
  }, []);

  const derivedByRowId = React.useMemo(() => {
    const map = new Map<string, { periodiseringLabel: string; antalDageDisplay: string; ydelsePerDagDisplay: string }>();
    for (const row of rows) {
      const derived = deriveOffentligeYdelserRow(row);
      map.set(row.id, {
        periodiseringLabel: derived.periodiseringLabel,
        antalDageDisplay: derived.antalDage !== null ? formatAntalDage(derived.antalDage) : '',
        ydelsePerDagDisplay: derived.ydelsePerDag !== null ? formatCurrency(derived.ydelsePerDag) : '',
      });
    }
    return map;
  }, [formatAntalDage, rows]);

  const handleSygedagpengeInsert = React.useCallback(() => {
    if (!sygedagpengeFraDato || !sygedagpengeTilDato) return;

    const generatedRows = buildSygedagpengeRowsForRange(sygedagpengeFraDato, sygedagpengeTilDato);
    if (generatedRows.length === 0) return;

    suppressSygedagpengeFieldCommitRef.current = true;
    onRowsChange(insertOffentligeYdelserRowsBeforeTrailingEmpty(rows, generatedRows));
    shouldFocusSygedagpengeFraRef.current = true;
    setSygedagpengeFraDato(undefined);
    setSygedagpengeTilDato(undefined);
    setSygedagpengeFraError(undefined);
    setSygedagpengeTilError(undefined);
    // Tæt koblet til StyledDateField/TableDateField commit-timing: suppression skal overleve
    // det blur/commit, som klik på "Indsæt" udløser i samme frame, men må ikke blive hængende længere.
    requestAnimationFrame(() => {
      suppressSygedagpengeFieldCommitRef.current = false;
    });
  }, [onRowsChange, rows, sygedagpengeFraDato, sygedagpengeTilDato]);

  const handleSygedagpengeFraError = React.useCallback((error: ReportableFieldError | undefined) => {
    if (suppressSygedagpengeFieldCommitRef.current) return;
    const nextMessage = getReportableFieldErrorMessage(error);
    setSygedagpengeFraError((prev) => (prev === nextMessage ? prev : nextMessage));
  }, []);

  const handleSygedagpengeTilError = React.useCallback((error: ReportableFieldError | undefined) => {
    if (suppressSygedagpengeFieldCommitRef.current) return;
    const nextMessage = getReportableFieldErrorMessage(error);
    setSygedagpengeTilError((prev) => (prev === nextMessage ? prev : nextMessage));
  }, []);

  const canInsertSygedagpenge =
    Boolean(sygedagpengeFraDato)
    && Boolean(sygedagpengeTilDato)
    && !sygedagpengeFraError
    && !sygedagpengeTilError;

  const isMidlertidigtEetFraEetSiden = midlertidigtEetFraEetSiden === 'Ja';

  /**
   * Atomisk commit af togglen + sideopgaver.
   * Når togglen aktiveres, ryddes manuelle midlertidigt_eet-rækker væk fra tabellen og
   * bilag-checkboxen `midlertidigEet` tændes. Når togglen deaktiveres, slukkes
   * bilag-checkboxen igen. Alle ændringer sker i én setEOValues-opdatering for at undgå
   * inkonsistente mellemtilstande i snapshot-revisionen.
   */
  const commitMidlertidigtEetToggle = React.useCallback((nextChecked: boolean) => {
    setEOValues((prev) => {
      if (nextChecked) {
        const filteredRows = (prev.offentligeYdelserRows ?? []).filter(
          (row) => row.ydelsestype?.trim() !== 'midlertidigt_eet'
        );
        return {
          ...prev,
          midlertidigtEetFraEetSiden: 'Ja',
          offentligeYdelserRows: filteredRows,
          eoBilagSelection: {
            ...prev.eoBilagSelection,
            midlertidigEet: true,
          },
        };
      }
      return {
        ...prev,
        midlertidigtEetFraEetSiden: 'Nej',
        eoBilagSelection: {
          ...prev.eoBilagSelection,
          midlertidigEet: false,
        },
      };
    });
  }, [setEOValues]);

  const handleMidlertidigtEetToggleCommit = React.useCallback((event: CommitEvent<boolean>) => {
    const nextChecked = event.target.value;
    if (nextChecked === isMidlertidigtEetFraEetSiden) return;
    if (!nextChecked) {
      commitMidlertidigtEetToggle(false);
      return;
    }
    const hasExistingMidlertidigtEetRows = rows.some((row) => row.ydelsestype?.trim() === 'midlertidigt_eet');
    if (!hasExistingMidlertidigtEetRows) {
      commitMidlertidigtEetToggle(true);
      return;
    }
    setMidlertidigtEetConfirmDialogOpen(true);
  }, [commitMidlertidigtEetToggle, isMidlertidigtEetFraEetSiden, rows]);

  const handleMidlertidigtEetConfirm = React.useCallback(() => {
    commitMidlertidigtEetToggle(true);
    setMidlertidigtEetConfirmDialogOpen(false);
  }, [commitMidlertidigtEetToggle]);

  return (
    <>
      <ContentBox className="content-box">
        <Typography className="section-header">Offentlige ydelser</Typography>
        <Typography className="row--text" sx={{ mb: 2 }}>
          Ydelser fra offentlige myndigheder, herunder midlertidigt erhvervsevnetab.
        </Typography>

        <OffentligeYdelserTable
          tableData={rows}
          derivedByRowId={derivedByRowId}
          onTableDataChange={onRowsChange}
          saveOrderPath="erstatningsopgoerelse.offentligeYdelserRows"
          disableMidlertidigtEetOption={isMidlertidigtEetFraEetSiden}
        />
      </ContentBox>

      <ContentBox className="content-box">
        <Typography className="section-header">Tilføj særligt</Typography>

        <Box className="row--label-right-hover">
          <Typography className="row--text">Indsæt maksimal sygedagpengesats for perioden</Typography>
          <Box className="row--label-right-hover__content" sx={{ gap: 1.5, flexWrap: 'wrap' }}>
            <StyledDateField
              inputRef={sygedagpengeFraInputRef}
              value={sygedagpengeFraDato}
              onCommit={(e) => {
                if (suppressSygedagpengeFieldCommitRef.current) return;
                setSygedagpengeFraDato(e.target.value);
              }}
              onFieldError={handleSygedagpengeFraError}
              width={130}
              minDate={dateRanges_offentligeYdelser.fraDato.min}
              maxDate={sygedagpengeTilDato ?? dateRanges_offentligeYdelser.fraDato.fallbackMax}
              specialRangeErrors={{ fraTilRole: 'fra' }}
            />
            <Typography className="row--text">-</Typography>
            <StyledDateField
              value={sygedagpengeTilDato}
              onCommit={(e) => {
                if (suppressSygedagpengeFieldCommitRef.current) return;
                setSygedagpengeTilDato(e.target.value);
              }}
              onFieldError={handleSygedagpengeTilError}
              width={130}
              minDate={sygedagpengeFraDato ?? dateRanges_offentligeYdelser.tilDato.fallbackMin}
              maxDate={dateRanges_offentligeYdelser.tilDato.max}
              specialRangeErrors={{ fraTilRole: 'til' }}
            />
            <InlineActionButton onClick={handleSygedagpengeInsert} disabled={!canInsertSygedagpenge}>
              Indsæt
            </InlineActionButton>
          </Box>
        </Box>

        <Box className="row--label-right-hover">
          <Typography className="row--text">Midlertidigt EET indsættes fra Erhvervsevnetab-siden</Typography>
          <Box className="row--label-right-hover__content">
            <StyledToggleSwitch
              checked={isMidlertidigtEetFraEetSiden}
              onCommit={handleMidlertidigtEetToggleCommit}
              ariaLabel="Midlertidigt EET indsættes fra Erhvervsevnetab-siden"
            />
          </Box>
        </Box>
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
