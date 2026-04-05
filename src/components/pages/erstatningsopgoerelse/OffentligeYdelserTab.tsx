import React from 'react';
import { Box, Typography } from '@mui/material';
import { z } from 'zod';
import OffentligeYdelserTable from '../../tables/OffentligeYdelserTable';
import ContentBox from '../../layout/ContentBox';
import type { ErhvervsevnetabComposedValues, OffentligeYdelserRow } from '../../../schemas/formSchemas';
import { deriveOffentligeYdelserRow } from '../../../domain/erstatningsopgoerelse/helpers/offentligeYdelserDerived';
import { formatCurrency } from '../../../utils/formatUtils';
import StyledDateField from '../../inputs/StyledDateField';
import InlineActionButton from '../../inputs/InlineActionButton';
import { buildSygedagpengeRowsForRange } from '../../../domain/erstatningsopgoerelse/helpers/sygedagpengeInsertRows';
import { buildMidlertidigtEetRowsFromEet } from '../../../domain/erstatningsopgoerelse/helpers/midlertidigtEetInsertRows';
import { insertOffentligeYdelserRowsBeforeTrailingEmpty } from '../../../domain/erstatningsopgoerelse/helpers/offentligeYdelserRowInsertion';
import { dateRanges_offentligeYdelser } from '../../../config/dateRanges';
import { isISODateString, type ISODateString } from '../../../types/branded';
import { getReportableFieldErrorMessage, type ReportableFieldError } from '../../../types/fieldErrors';
import ConfirmationDialog from '../../ui/ConfirmationDialog';
import { UI_STORAGE_KEYS } from '../../../config/storageManifest';

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
  midlertidigtEetInsertSource: Readonly<{
    eetValues: ErhvervsevnetabComposedValues;
    skadedato: ISODateString | undefined;
  }>;
}>;

/**
 * Offentlige ydelser-fanen - modtagne ydelser
 */
const OffentligeYdelserTab = React.memo(({ rows, onRowsChange, midlertidigtEetInsertSource }: Props) => {
  const sygedagpengeFraInputRef = React.useRef<HTMLInputElement | null>(null);
  const shouldFocusSygedagpengeFraRef = React.useRef(false);
  const suppressSygedagpengeFieldCommitRef = React.useRef(false);
  const [sygedagpengeFraDato, setSygedagpengeFraDato] = React.useState<ISODateString | undefined>(undefined);
  const [sygedagpengeTilDato, setSygedagpengeTilDato] = React.useState<ISODateString | undefined>(undefined);
  const [sygedagpengeFraError, setSygedagpengeFraError] = React.useState<string | undefined>(undefined);
  const [sygedagpengeTilError, setSygedagpengeTilError] = React.useState<string | undefined>(undefined);
  const [midlertidigtEetPendingRows, setMidlertidigtEetPendingRows] = React.useState<OffentligeYdelserRow[]>([]);
  const [midlertidigtEetNoRowsDialogOpen, setMidlertidigtEetNoRowsDialogOpen] = React.useState(false);
  const [midlertidigtEetConfirmDialogOpen, setMidlertidigtEetConfirmDialogOpen] = React.useState(false);

  const readHelpersSessionState = React.useCallback((): OffentligeYdelserHelpersSessionState => {
    try {
      const raw = sessionStorage.getItem(UI_STORAGE_KEYS.eoOffentligeYdelserHelpers);
      if (!raw) return {};
      const parsedJson: unknown = JSON.parse(raw);
      const parsed = offentligeYdelserHelpersSessionSchema.safeParse(parsedJson);
      return parsed.success ? parsed.data : {};
    } catch {
      return {};
    }
  }, []);

  const writeHelpersSessionState = React.useCallback((nextState: OffentligeYdelserHelpersSessionState): void => {
    try {
      if (!nextState.sygedagpengeFraDato && !nextState.sygedagpengeTilDato) {
        sessionStorage.removeItem(UI_STORAGE_KEYS.eoOffentligeYdelserHelpers);
        return;
      }
      sessionStorage.setItem(UI_STORAGE_KEYS.eoOffentligeYdelserHelpers, JSON.stringify(nextState));
    } catch {
      // Fail-safe: hvis sessionStorage ikke er tilgængelig, behold kun in-memory state.
    }
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

  const applyMidlertidigtEetRows = React.useCallback((generatedRows: readonly OffentligeYdelserRow[]) => {
    const rowsUdenMidlertidigtEet = rows.filter((row) => row.ydelsestype?.trim() !== 'midlertidigt_eet');
    onRowsChange(insertOffentligeYdelserRowsBeforeTrailingEmpty(rowsUdenMidlertidigtEet, generatedRows));
  }, [onRowsChange, rows]);

  const handleMidlertidigtEetInsertConfirm = React.useCallback(() => {
    applyMidlertidigtEetRows(midlertidigtEetPendingRows);
    setMidlertidigtEetPendingRows([]);
    setMidlertidigtEetConfirmDialogOpen(false);
  }, [applyMidlertidigtEetRows, midlertidigtEetPendingRows]);

  const handleMidlertidigtEetInsert = React.useCallback(() => {
    const { eetValues, skadedato } = midlertidigtEetInsertSource;
    const generatedRows = buildMidlertidigtEetRowsFromEet({
      eetValues,
      skadedato,
    });

    if (generatedRows.length === 0) {
      setMidlertidigtEetNoRowsDialogOpen(true);
      return;
    }

    const hasExistingMidlertidigtEetRows = rows.some((row) => row.ydelsestype?.trim() === 'midlertidigt_eet');
    if (!hasExistingMidlertidigtEetRows) {
      applyMidlertidigtEetRows(generatedRows);
      return;
    }

    setMidlertidigtEetPendingRows([...generatedRows]);
    setMidlertidigtEetConfirmDialogOpen(true);
  }, [applyMidlertidigtEetRows, midlertidigtEetInsertSource, rows]);

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
          <Typography className="row--text">Indsæt midlertidigt EET fra Erhvervsevnetab-siden</Typography>
          <Box className="row--label-right-hover__content">
            <InlineActionButton onClick={handleMidlertidigtEetInsert}>
              Indsæt
            </InlineActionButton>
          </Box>
        </Box>
      </ContentBox>

      <ConfirmationDialog
        open={midlertidigtEetNoRowsDialogOpen}
        title="Ingen midlertidig EET"
        message="Der er ingen perioder med midlertidigt erhvervsevnetab at indsætte"
        confirmText="OK"
        hideCancelButton
        onConfirm={() => setMidlertidigtEetNoRowsDialogOpen(false)}
      />

      <ConfirmationDialog
        open={midlertidigtEetConfirmDialogOpen}
        title="Erstat midlertidigt EET"
        message={(
          <>
            Dette vil erstatte alle indtastninger af midlertidigt EET i tabellen.
            <br />
            <br />
            Bekræft venligst.
          </>
        )}
        confirmText="Ja, indsæt"
        cancelText="Annuller"
        onConfirm={handleMidlertidigtEetInsertConfirm}
        onCancel={() => {
          setMidlertidigtEetConfirmDialogOpen(false);
          setMidlertidigtEetPendingRows([]);
        }}
      />
    </>
  );
});

OffentligeYdelserTab.displayName = 'OffentligeYdelserTab';

export default OffentligeYdelserTab;
