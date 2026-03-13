import * as React from 'react';
import { Alert, AlertTitle, Box } from '@mui/material';
import ContentBox from '../../layout/ContentBox';
import { useEOLoenindkomstInputErrors } from '../../../hooks/useEOLoenindkomstInputErrors';
import { useAppSettings } from '../../../contexts/useAppSettings';
import { eoSnapshotToDebugView } from '../../../domain/erstatningsopgoerelse/eoSnapshotToDebugView';
import type { DebugRowModel } from '../../../domain/debug/eoDebugTypes';
import type { EoSnapshot } from '../../../domain/erstatningsopgoerelse/eoSnapshot';
import EODebugRegulationSections from './EODebugRegulationSections';
import EODebugRowsSection from './EODebugRowsSection';
import EODebugEmploymentSections from './EODebugEmploymentSections';
import type { RegulationDebugSection } from '../../../domain/debug/eoDebugRegulationViewModel';
import { isLoenindkomstAnsaettelsesforholdEffectivelyEmpty } from '../../../domain/debug/eoDebugIndkomstModel';

type EODebugProps = Readonly<{
  eoSnapshot?: EoSnapshot | null;
}>;

const getLoenindkomstAnsaettelsesforholdId = (rowId: string): string | null => {
  const match = /^loenindkomst\.([^.]+)\./.exec(rowId);
  return match?.[1] ?? null;
};

const isLoenindkomstRegulationRow = (row: DebugRowModel): boolean => row.id.includes('.regulering.');

const buildLoenindkomstSections = (rows: readonly DebugRowModel[]) => {
  const grouped = new Map<string, DebugRowModel[]>();
  const order: string[] = [];

  rows.forEach((row) => {
    const ansaettelsesforholdId = getLoenindkomstAnsaettelsesforholdId(row.id);
    if (!ansaettelsesforholdId) return;
    if (!grouped.has(ansaettelsesforholdId)) {
      grouped.set(ansaettelsesforholdId, []);
      order.push(ansaettelsesforholdId);
    }
    grouped.get(ansaettelsesforholdId)?.push(row);
  });

  return order.map((ansaettelsesforholdId, index) => {
    const sectionRows = grouped.get(ansaettelsesforholdId) ?? [];
    const arbejdsstedNavn = sectionRows.find((row) => row.label === 'Navn på arbejdssted')?.displayValue.trim() ?? '';
    const hasNamedArbejdssted = arbejdsstedNavn !== '' && arbejdsstedNavn !== '-';
    const title = hasNamedArbejdssted
      ? arbejdsstedNavn
      : `Arbejdssted ${index + 1}`;
    const visibleRows = hasNamedArbejdssted
      ? sectionRows.filter((row) => row.label !== 'Navn på arbejdssted')
      : sectionRows;
    const loenRows = visibleRows.filter((row) => !isLoenindkomstRegulationRow(row));
    const regulationRows = visibleRows.filter(isLoenindkomstRegulationRow);

    return {
      id: ansaettelsesforholdId,
      title,
      loenRows,
      regulationRows,
    };
  });
};

const getRegulationEmploymentId = (section: RegulationDebugSection): string | null => {
  const match = /^regulation\.(.+)$/.exec(section.id);
  return match?.[1] ?? null;
};

const EODebug = ({ eoSnapshot = null }: EODebugProps) => {
  const manuelReguleringInputErrors = useEOLoenindkomstInputErrors();
  const { settings } = useAppSettings();

  const view = React.useMemo(() => eoSnapshotToDebugView({
    snapshot: eoSnapshot,
    appSettings: settings,
    loenindkomstManuelReguleringInputErrors: manuelReguleringInputErrors,
  }), [eoSnapshot, manuelReguleringInputErrors, settings]);

  if (view.kind === 'blocked') {
    return (
      <ContentBox className="content-box">
        <Alert severity={view.severity} sx={{ borderRadius: '10px' }}>
          <AlertTitle sx={{ fontWeight: 500 }}>{view.title}</AlertTitle>
          {view.message}
        </Alert>
      </ContentBox>
    );
  }

  const { erstatningsopgoerelseValues, rowsBySection } = view;
  const viserMidlertidigtEet = erstatningsopgoerelseValues.midlertidigtEetAfgorelse === 'Ja';
  const viserEndeligtEet = erstatningsopgoerelseValues.endeligtEetAfgorelse === 'Ja';
  const aesRows = rowsBySection.get('aes') ?? [];
  const visibleEmploymentIds = new Set(
    (erstatningsopgoerelseValues.loenindkomstAnsaettelsesforhold ?? [])
      .filter((af) => !isLoenindkomstAnsaettelsesforholdEffectivelyEmpty(af, settings))
      .map((af) => af.id)
  );
  const loenindkomstRows = (rowsBySection.get('loenindkomst') ?? []).filter((row) => {
    const ansaettelsesforholdId = getLoenindkomstAnsaettelsesforholdId(row.id);
    return ansaettelsesforholdId === null || visibleEmploymentIds.has(ansaettelsesforholdId);
  });
  const loenindkomstSections = buildLoenindkomstSections(loenindkomstRows);
  const regulationSectionsByEmploymentId = new Map<string, RegulationDebugSection>();
  view.regulationSections.forEach((section) => {
    const employmentId = getRegulationEmploymentId(section);
    if (!employmentId) return;
    regulationSectionsByEmploymentId.set(employmentId, section);
  });
  const employmentSections = loenindkomstSections.map((section) => ({
    id: section.id,
    title: section.title,
    loenRows: section.loenRows,
    regulationRows: section.regulationRows,
    regulationSection: regulationSectionsByEmploymentId.get(section.id),
  }));
  const orphanRegulationSections = view.regulationSections.filter((section) => {
    const employmentId = getRegulationEmploymentId(section);
    return !employmentId || !loenindkomstSections.some((loenSection) => loenSection.id === employmentId);
  });
  const filtreredeAesRows = aesRows.filter((row) => {
    if (!viserMidlertidigtEet && row.group === 'aes.midlertidigtEet' && row.id !== 'aes.midlertidigtEetAfgorelse') return false;
    if (!viserEndeligtEet && row.group === 'aes.endeligtEet' && row.id !== 'aes.endeligtEetAfgorelse') return false;
    return true;
  });

  return (
    <Box>
      <EODebugRowsSection title="Stamdata" rows={rowsBySection.get('stamdata') ?? []} />
      <EODebugRowsSection title="Erstatningsopgørelse" rows={rowsBySection.get('erstatningsopgoerelse') ?? []} />
      <EODebugRowsSection title="Forlig" rows={rowsBySection.get('forlig') ?? []} />
      <EODebugRowsSection title="AES" rows={filtreredeAesRows} />
      <EODebugRowsSection title="Svie og smerte" rows={rowsBySection.get('sviesmerte') ?? []} />
      <EODebugRowsSection title="Tabt arbejdsfortjeneste" rows={rowsBySection.get('taf') ?? []} />
      <EODebugRowsSection title="TAF beregningsgrundlag" rows={rowsBySection.get('taf-beregningsgrundlag') ?? []} />
      {employmentSections.length > 0
        ? <EODebugEmploymentSections sections={employmentSections} />
        : <EODebugRowsSection title="Lønindkomst" rows={loenindkomstRows} />}
      <EODebugRowsSection title="Offentlige ydelser" rows={rowsBySection.get('offentlige-ydelser') ?? []} />

      {orphanRegulationSections.length > 0 && <EODebugRegulationSections sections={orphanRegulationSections} />}

      <EODebugRowsSection title="Øvrige erstatningskrav" rows={rowsBySection.get('oevrige-krav') ?? []} />
      <EODebugRowsSection title="Eventuelle særlige kommentarer" rows={rowsBySection.get('saerlige-kommentarer') ?? []} />
    </Box>
  );
};

export default EODebug;
