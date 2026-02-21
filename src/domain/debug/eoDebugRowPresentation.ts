import type { DebugRowModel } from './eoDebugTypes';

export type DebugRowPresentation = Readonly<{
  message?: string;
  summaryDisplay: 'default' | 'messageOnly';
}>;

const ERROR_PREFIX = 'Fejl';
const WARNING_PREFIX = 'Advarsel';
const MESSAGE_ONLY_IDS = new Set<string>([
  'taf.ophoerSkyldes',
  'sviesmerte.ophoerSkyldes',
  'sviesmerte.satserAar',
  'taf.beregningsgrundlag.indkomst',
]);

const extractStructuredMessage = (status: DebugRowModel['status'], displayValue: string): string | undefined => {
  const trimmed = displayValue.trim();
  if (trimmed === '' || trimmed === '-') return undefined;
  if (status === 'ok') return undefined;

  const prefix = status === 'error' ? ERROR_PREFIX : WARNING_PREFIX;
  const pattern = new RegExp(`^${prefix} \\((.*)\\)$`, 's');
  const match = trimmed.match(pattern);
  if (match && typeof match[1] === 'string') return match[1].trim();
  return trimmed;
};

const resolveSummaryDisplay = (row: DebugRowModel): 'default' | 'messageOnly' => {
  if (row.summaryDisplay) return row.summaryDisplay;
  return MESSAGE_ONLY_IDS.has(row.id) ? 'messageOnly' : 'default';
};

export const resolveDebugRowPresentation = (row: DebugRowModel): DebugRowPresentation => {
  const message = row.message ?? extractStructuredMessage(row.status, row.displayValue);
  return {
    message,
    summaryDisplay: resolveSummaryDisplay(row),
  };
};
