import type { DeepReadonly } from '../../types/deepReadonly';
import type {
  AggregationLinePolicy,
  AggregationLineRounding,
  AggregationPolicy,
  AggregationSign,
  AggregationTotalRounding,
} from './erstatningsopgoerelseAggregationPolicy';
import { roundByMethod } from '../../utils/rounding';
export type AggregationComputedOutputs = DeepReadonly<Record<string, unknown>>;

export type AggregationInputSnapshot = DeepReadonly<{
  policy: AggregationPolicy;
  computedOutputs: AggregationComputedOutputs;
}>;

export type AggregationLineItem = Readonly<{
  id: string;
  value: number;
  source: 'computed';
  roundingApplied: boolean;
}>;

export type AggregationError = Readonly<{
  lineId: string;
  code:
    | 'missing_computed'
    | 'invalid_computed'
  message: string;
}>;

export type AggregationResult =
  | Readonly<{
      kind: 'ok';
      lineItems: ReadonlyArray<AggregationLineItem>;
      total: number;
      totalRoundingApplied: boolean;
    }>
  | Readonly<{
      kind: 'error';
      errors: ReadonlyArray<AggregationError>;
    }>;

const isFiniteNumber = (value: unknown): value is number => {
  return typeof value === 'number' && Number.isFinite(value);
};

const normalizePath = (path: string): string[] => {
  const normalized = path.replace(/\[(\d+)\]/g, '.$1');
  return normalized.split('.').filter((segment) => segment.length > 0);
};

const resolvePath = (root: unknown, path: string): unknown => {
  const segments = normalizePath(path);
  let current: unknown = root;
  for (const segment of segments) {
    if (current === null || current === undefined) {
      return undefined;
    }
    if (/^\d+$/.test(segment)) {
      if (!Array.isArray(current)) return undefined;
      const index = Number(segment);
      current = current[index];
      continue;
    }
    if (typeof current !== 'object' || Array.isArray(current)) return undefined;
    current = (current as Record<string, unknown>)[segment];
  }
  return current;
};

const resolveNumberAtPath = (root: unknown, path: string): number | undefined | 'invalid' => {
  const value = resolvePath(root, path);
  if (value === undefined) return undefined;
  return isFiniteNumber(value) ? value : 'invalid';
};

const applySign = (value: number, sign: AggregationSign): number => {
  if (sign === 'negative') return value * -1;
  return value;
};

const roundValue = (value: number, rounding: AggregationLineRounding | AggregationTotalRounding): number => {
  return roundByMethod(value, rounding.precision, rounding.method);
};

const resolveComputedValue = (
  line: AggregationLinePolicy,
  computedOutputs: AggregationComputedOutputs
): number | undefined | 'invalid' => {
  if (!line.computedSourceId) return undefined;
  const source = computedOutputs[line.computedSourceId];
  if (source === undefined) return undefined;
  if (line.computedValuePath) {
    return resolveNumberAtPath(source, line.computedValuePath);
  }
  return isFiniteNumber(source) ? source : 'invalid';
};

const resolveValueByStrategy = (
  line: AggregationLinePolicy,
  computedOutputs: AggregationComputedOutputs
): { value: number; source: 'computed' } | AggregationError => {
  const computedValue = resolveComputedValue(line, computedOutputs);

  if (computedValue === 'invalid') {
    return { lineId: line.id, code: 'invalid_computed', message: 'Computed value is not a finite number.' };
  }
  if (computedValue === undefined) {
    return { lineId: line.id, code: 'missing_computed', message: 'Computed value is required.' };
  }

  return { value: computedValue, source: 'computed' };
};

const applyLineRounding = (
  value: number,
  rounding: AggregationLineRounding,
  applyRounding: boolean
): { value: number; roundingApplied: boolean } => {
  if (!applyRounding || rounding.method === 'none') return { value, roundingApplied: false };
  return { value: roundValue(value, rounding), roundingApplied: true };
};

export const aggregateErstatningsopgoerelse = (input: AggregationInputSnapshot): AggregationResult => {
  const { policy, computedOutputs } = input;
  const errors: AggregationError[] = [];
  const lineItems: AggregationLineItem[] = [];

  const applyPerLine = policy.totalRounding.when === 'perLine' || policy.totalRounding.when === 'perLineThenTotal';
  for (const line of policy.lines) {
    const resolved = resolveValueByStrategy(line, computedOutputs);
    if ('code' in resolved) {
      errors.push(resolved);
      continue;
    }

    const signedValue = applySign(resolved.value, line.sign);
    const rounding = line.roundingOverride ?? policy.lineRounding;
    const rounded = applyLineRounding(signedValue, rounding, applyPerLine);
    lineItems.push({
      id: line.id,
      value: rounded.value,
      source: resolved.source,
      roundingApplied: rounded.roundingApplied,
    });
  }

  if (errors.length > 0) {
    return { kind: 'error', errors };
  }

  const sum = lineItems.reduce((total, line) => total + line.value, 0);
  const totalRoundingApplied =
    (policy.totalRounding.when === 'onlyTotal' || policy.totalRounding.when === 'perLineThenTotal') &&
    policy.totalRounding.method !== 'none';
  const total = totalRoundingApplied ? roundValue(sum, policy.totalRounding) : sum;

  return {
    kind: 'ok',
    lineItems,
    total,
    totalRoundingApplied,
  };
};
