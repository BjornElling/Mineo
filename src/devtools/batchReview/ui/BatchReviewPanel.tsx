/**
 * BatchReviewPanel — UI-komponent til styring af batch-review.
 *
 * Tilbyder:
 * - Valg af output-track: PDF-dokument / Fejl og advarsler
 * - Valg af profil: Basis / Udvidet / Alle
 * - Start-knap
 * - Progress-visning under kørsel
 * - Stop-knap (kun synlig under kørsel)
 * - Status-indikator ved afslutning eller fejl
 */

import React from 'react';
import { Box, Button, MenuItem, Typography } from '@mui/material';
import StyledDropdown from '../../../components/inputs/StyledDropdown';
import { runEoPdfBatchReview } from '../orchestrators/eoPdfBatchOrchestrator';
import { runEoIssuesBatchReview } from '../orchestrators/eoIssuesBatchOrchestrator';
import type { BatchProfile } from '../types';

type OutputTrack = 'pdf' | 'issues';

type RunState =
  | { kind: 'idle' }
  | { kind: 'running'; completed: number; total: number; currentId: string; abort: () => void }
  | { kind: 'done'; completed: number; total: number }
  | { kind: 'error'; message: string };

const PROFILE_OPTIONS: { value: BatchProfile; label: string }[] = [
  { value: 'basis', label: 'Basis' },
  { value: 'udvidet', label: 'Udvidet' },
  { value: 'alle', label: 'Alle' },
];

const TRACK_OPTIONS: { value: OutputTrack; label: string }[] = [
  { value: 'pdf', label: 'PDF-dokument' },
  { value: 'issues', label: 'Fejl og advarsler' },
];

const BatchReviewPanel = React.memo(() => {
  const [track, setTrack] = React.useState<OutputTrack>('pdf');
  const [profile, setProfile] = React.useState<BatchProfile>('basis');
  const [runState, setRunState] = React.useState<RunState>({ kind: 'idle' });

  const handleStart = React.useCallback(() => {
    const orchestrator = track === 'pdf' ? runEoPdfBatchReview : runEoIssuesBatchReview;

    const abort = orchestrator(profile, {
      onProgress: (completed, total, currentId) => {
        setRunState((prev) => {
          if (prev.kind !== 'running') return prev;
          return { ...prev, completed, total, currentId };
        });
      },
      onDone: () => {
        setRunState((prev) => {
          const completed = prev.kind === 'running' ? prev.completed : 0;
          const total = prev.kind === 'running' ? prev.total : 0;
          return { kind: 'done', completed, total };
        });
      },
      onError: (message) => {
        setRunState({ kind: 'error', message });
      },
    });

    setRunState({ kind: 'running', completed: 0, total: 0, currentId: '', abort });
  }, [track, profile]);

  const handleStop = React.useCallback(() => {
    if (runState.kind === 'running') {
      runState.abort();
      setRunState({ kind: 'idle' });
    }
  }, [runState]);

  const handleReset = React.useCallback(() => {
    setRunState({ kind: 'idle' });
  }, []);

  const isRunning = runState.kind === 'running';
  const isDone = runState.kind === 'done';
  const isError = runState.kind === 'error';

  return (
    <Box>
      {/* Track-valg */}
      <Box className="row--label-offset">
        <Typography className="row--text" minWidth="200px">
          Output-track
        </Typography>
        <Box className="row--label-offset__content">
          <StyledDropdown
            value={track}
            onChange={(e) => setTrack(e.target.value as OutputTrack)}
            width={220}
            disabled={isRunning}
          >
            {TRACK_OPTIONS.map((opt) => (
              <MenuItem key={opt.value} value={opt.value}>
                {opt.label}
              </MenuItem>
            ))}
          </StyledDropdown>
        </Box>
      </Box>

      {/* Profil-valg */}
      <Box className="row--label-offset">
        <Typography className="row--text" minWidth="200px">
          Profil
        </Typography>
        <Box className="row--label-offset__content">
          <StyledDropdown
            value={profile}
            onChange={(e) => setProfile(e.target.value as BatchProfile)}
            width={220}
            disabled={isRunning}
          >
            {PROFILE_OPTIONS.map((opt) => (
              <MenuItem key={opt.value} value={opt.value}>
                {opt.label}
              </MenuItem>
            ))}
          </StyledDropdown>
        </Box>
      </Box>

      {/* Knapper */}
      <Box className="row--label-offset" sx={{ marginTop: 2 }}>
        <Typography className="row--text" minWidth="200px" />
        <Box className="row--label-offset__content" sx={{ display: 'flex', gap: 1 }}>
          {!isRunning && !isDone && !isError && (
            <Button variant="contained" onClick={handleStart}>
              Start
            </Button>
          )}
          {isRunning && (
            <Button variant="outlined" color="error" onClick={handleStop}>
              Stop
            </Button>
          )}
          {(isDone || isError) && (
            <Button variant="outlined" onClick={handleReset}>
              Nulstil
            </Button>
          )}
        </Box>
      </Box>

      {/* Progress */}
      {isRunning && (
        <Box className="row--label-offset" sx={{ marginTop: 1 }}>
          <Typography className="row--text" minWidth="200px">
            Status
          </Typography>
          <Box className="row--label-offset__content">
            <Typography variant="body2">
              {runState.completed} / {runState.total > 0 ? runState.total : '?'} scenarier behandlet
              {runState.currentId ? ` (behandler: ${runState.currentId})` : ''}
            </Typography>
          </Box>
        </Box>
      )}

      {/* Afslutning */}
      {isDone && (
        <Box className="row--label-offset" sx={{ marginTop: 1 }}>
          <Typography className="row--text" minWidth="200px">
            Afsluttet
          </Typography>
          <Box className="row--label-offset__content">
            <Typography variant="body2">
              {runState.completed} scenarier behandlet. PDF er downloadet.
            </Typography>
          </Box>
        </Box>
      )}

      {/* Fejl */}
      {isError && (
        <Box className="row--label-offset" sx={{ marginTop: 1 }}>
          <Typography className="row--text" minWidth="200px" color="error">
            Fejl
          </Typography>
          <Box className="row--label-offset__content">
            <Typography variant="body2" color="error">
              {runState.message}
            </Typography>
          </Box>
        </Box>
      )}
    </Box>
  );
});

BatchReviewPanel.displayName = 'BatchReviewPanel';

export default BatchReviewPanel;
