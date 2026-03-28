import { isSystemIssueLogData, type SystemIssueEnvelope } from './systemIssueReporter';

export type DevtoolsIssueLevel = 'warn' | 'error';
export type DevtoolsIssueSource = 'console' | 'window' | 'unhandledrejection';

export type DevtoolsTimelineKind = 'user' | 'navigation' | 'lifecycle' | 'test' | 'system';

export type DevtoolsTimelineEvent = {
  id: number;
  timestamp: string;
  relativeMs: number;
  readonly correlationId: string;
  kind: DevtoolsTimelineKind;
  message: string;
  data?: Record<string, string | number | boolean | null>;
};

export type DevtoolsProviderState = {
  mounted: boolean;
  lastChanged: string;
};

export type DevtoolsRuntimeSnapshot = {
  route: string | null;
  visibility: DocumentVisibilityState | 'unknown';
  providers: Record<string, DevtoolsProviderState>;
  testScenario: { label: string; triggeredAt: string } | null;
};

export type DevtoolsIssueContext = {
  route: string | null;
  activeElement: string | null;
  lastInteractionId: number | null;
  lastInteractionAt: string | null;
  lastInteractionAgeMs: number | null;
  breadcrumbs: DevtoolsTimelineEvent[];
  runtime: DevtoolsRuntimeSnapshot;
  providerUnavailable: string[];
};

export type DevtoolsIssue = {
  id: number;
  correlationId: string;
  category: 'provider-unavailable' | 'runtime';
  level: DevtoolsIssueLevel;
  source: DevtoolsIssueSource;
  timestamp: string;
  message: string;
  args: string[];
  stack?: string;
  context?: DevtoolsIssueContext;
  systemIssue?: SystemIssueEnvelope;
};

export type DevtoolsIssueSnapshot = {
  issues: DevtoolsIssue[];
  counts: { warn: number; error: number };
  lastIssue: DevtoolsIssue | null;
  timeline: DevtoolsTimelineEvent[];
  runtime: DevtoolsRuntimeSnapshot;
};

type DevtoolsIssueListener = (snapshot: DevtoolsIssueSnapshot, issue: DevtoolsIssue) => void;

type DevtoolsIssuePayload = Omit<
  DevtoolsIssue,
  'id' | 'timestamp' | 'correlationId' | 'context' | 'category'
>;

const MAX_ISSUES = 60;
const MAX_TIMELINE_EVENTS = 140;
const DEDUPE_WINDOW_MS = 2000;
const TIMELINE_DEDUPE_WINDOW_MS = 300;
const MAX_BREADCRUMBS = 12;
const EXTENSION_NOISE_MESSAGE = 'Could not establish connection. Receiving end does not exist.';
const EXTENSION_MARKERS = ['chrome-extension://', 'moz-extension://'];
const USER_KEY_WHITELIST = new Set(['Enter', 'Escape', 'Tab', 'Backspace', 'Delete']);

const listeners = new Set<DevtoolsIssueListener>();
let issues: DevtoolsIssue[] = [];
let timeline: DevtoolsTimelineEvent[] = [];
let nextId = 1;
let nextTimelineId = 1;
let nextCorrelationId = 1;
let started = false;
let startCount = 0;
let lastEntryKey = '';
let lastEntryTime = 0;
let lastTimelineKey = '';
let lastTimelineTime = 0;
let monitorStartedAt = 0;
let lastInteractionId: number | null = null;
let lastInteractionAt: number | null = null;
let currentRoute: string | null = null;
let providers: Record<string, DevtoolsProviderState> = {};
let testScenario: { label: string; triggeredAt: string } | null = null;
let activeCorrelationId: string | null = null;

let originalConsoleWarn: typeof console.warn | null = null;
let originalConsoleError: typeof console.error | null = null;
let removeWindowErrorListener: (() => void) | null = null;
let removeUnhandledListener: (() => void) | null = null;
let removeUserClickListener: (() => void) | null = null;
let removeUserKeyListener: (() => void) | null = null;
let removeVisibilityListener: (() => void) | null = null;

const safeStringify = (value: unknown): string => {
  const seen = new WeakSet<object>();
  const replacer = (_key: string, val: unknown) => {
    if (typeof val === 'bigint') return val.toString();
    if (val instanceof Error) {
      return { name: val.name, message: val.message, stack: val.stack };
    }
    if (typeof val === 'symbol') return String(val);
    if (typeof val === 'object' && val !== null) {
      if (seen.has(val as object)) return '[Circular]';
      seen.add(val as object);
    }
    return val;
  };

  try {
    const json = JSON.stringify(value, replacer, 2);
    return json ?? String(value);
  } catch {
    return String(value);
  }
};

const truncate = (value: string, max: number): string => {
  if (value.length <= max) return value;
  return `${value.slice(0, max)}…`;
};

const formatConsoleArg = (arg: unknown): string => {
  if (typeof arg === 'string') return arg;
  if (typeof arg === 'number' || typeof arg === 'boolean') return String(arg);
  if (arg === null || arg === undefined) return String(arg);
  if (arg instanceof Error) {
    const header = `${arg.name}: ${arg.message}`;
    return arg.stack ? `${header}\n${arg.stack}` : header;
  }
  return safeStringify(arg);
};

const formatConsoleArgs = (args: unknown[]): string[] => {
  return args.map((arg) => truncate(formatConsoleArg(arg), 1200));
};

const extractSystemIssueFromArgs = (args: unknown[]): SystemIssueEnvelope | undefined => {
  for (const arg of args) {
    if (isSystemIssueLogData(arg)) {
      return arg.systemIssue;
    }
  }
  return undefined;
};

const toRelativeMs = (timestampMs: number): number => {
  if (monitorStartedAt === 0) return 0;
  return Math.max(0, timestampMs - monitorStartedAt);
};

const describeElement = (element: Element | null): string | null => {
  if (!element) return null;
  if (element === document.body) return 'body';

  const tag = element.tagName.toLowerCase();
  const id = element.id ? `#${element.id}` : '';
  const role = element.getAttribute('role');
  const type = element.getAttribute('type');
  const dataId = element.getAttribute('data-testid') || element.getAttribute('data-mineo-id');
  const label =
    element.getAttribute('aria-label') ||
    element.getAttribute('title') ||
    element.getAttribute('placeholder') ||
    element.getAttribute('name') ||
    '';
  const text = element.textContent ? element.textContent.trim().replace(/\s+/g, ' ') : '';

  const labelValue = label ? truncate(label, 80) : '';
  const textValue = labelValue ? '' : truncate(text, 80);

  const parts = [
    tag + id,
    role ? `[role=${role}]` : '',
    type ? `[type=${type}]` : '',
    dataId ? `[data-id=${dataId}]` : '',
  ].filter(Boolean);

  const labelSuffix = labelValue || textValue ? ` "${labelValue || textValue}"` : '';
  return `${parts.join('')}${labelSuffix}`.trim();
};

const getInteractiveTarget = (target: EventTarget | null): Element | null => {
  if (!(target instanceof Element)) return null;
  return (
    target.closest('button, [role="button"], a, input, select, textarea, [data-mineo-action]') || target
  );
};

const shouldDedupeTimeline = (key: string): boolean => {
  const now = Date.now();
  if (key === lastTimelineKey && now - lastTimelineTime < TIMELINE_DEDUPE_WINDOW_MS) {
    return true;
  }
  lastTimelineKey = key;
  lastTimelineTime = now;
  return false;
};

const recordTimelineEvent = (
  payload: Omit<DevtoolsTimelineEvent, 'id' | 'timestamp' | 'relativeMs' | 'correlationId'>,
  options?: { dedupeKey?: string; markInteraction?: boolean }
): void => {
  const now = Date.now();
  const timestamp = new Date(now).toISOString();
  const dedupeKey = options?.dedupeKey ?? `${payload.kind}:${payload.message}`;
  if (shouldDedupeTimeline(dedupeKey)) return;

  if (options?.markInteraction) {
    activeCorrelationId = `DVT-C${nextCorrelationId++}`;
  }
  const correlationId = activeCorrelationId ?? 'DVT-C0';

  const entry: DevtoolsTimelineEvent = {
    id: nextTimelineId++,
    timestamp,
    relativeMs: toRelativeMs(now),
    correlationId,
    kind: payload.kind,
    message: payload.message,
    data: payload.data,
  };

  timeline.push(entry);
  if (timeline.length > MAX_TIMELINE_EVENTS) {
    timeline = timeline.slice(-MAX_TIMELINE_EVENTS);
  }

  if (options?.markInteraction) {
    lastInteractionId = entry.id;
    lastInteractionAt = now;
  }
};

const buildRuntimeSnapshot = (): DevtoolsRuntimeSnapshot => {
  return {
    route: currentRoute ?? window.location.pathname,
    visibility: typeof document !== 'undefined' ? document.visibilityState : 'unknown',
    providers: { ...providers },
    testScenario,
  };
};

const buildSnapshot = (): DevtoolsIssueSnapshot => {
  const counts = issues.reduce(
    (acc, issue) => {
      acc[issue.level] += 1;
      return acc;
    },
    { warn: 0, error: 0 }
  );
  return {
    issues: [...issues],
    counts,
    lastIssue: issues[0] ?? null,
    timeline: [...timeline],
    runtime: buildRuntimeSnapshot(),
  };
};

const notifyListeners = (issue: DevtoolsIssue): void => {
  const snapshot = buildSnapshot();
  listeners.forEach((listener) => {
    try {
      listener(snapshot, issue);
    } catch {
      // Listener errors must never break capture.
    }
  });
};

const shouldDedupe = (key: string): boolean => {
  const now = Date.now();
  if (key === lastEntryKey && now - lastEntryTime < DEDUPE_WINDOW_MS) {
    return true;
  }
  lastEntryKey = key;
  lastEntryTime = now;
  return false;
};

const containsExtensionMarker = (value?: string): boolean => {
  if (!value) return false;
  return EXTENSION_MARKERS.some((marker) => value.includes(marker));
};

const shouldIgnoreIssue = (payload: DevtoolsIssuePayload): boolean => {
  const trimmedMessage = payload.message.trim();
  const mentionsNoise =
    trimmedMessage === EXTENSION_NOISE_MESSAGE || trimmedMessage.includes(EXTENSION_NOISE_MESSAGE);
  if (!mentionsNoise) return false;

  const stackEmpty = !payload.stack || payload.stack.trim() === '';
  const hasExtensionMarker =
    containsExtensionMarker(payload.stack) || containsExtensionMarker(payload.message);

  if (payload.source === 'unhandledrejection') {
    return stackEmpty || hasExtensionMarker;
  }

  if (payload.source === 'window') {
    return hasExtensionMarker;
  }

  return false;
};

const captureIssue = (payload: DevtoolsIssuePayload): void => {
  if (shouldIgnoreIssue(payload)) return;
  const stackLine = payload.stack ? payload.stack.split('\n')[0] ?? '' : '';
  const correlationKey = activeCorrelationId ? `:${activeCorrelationId}` : '';
  const messageKey = `${payload.level}:${payload.source}:${payload.message}:${stackLine}${correlationKey}`;
  if (shouldDedupe(messageKey)) return;

  const now = Date.now();
  const activeElement = describeElement(document.activeElement);
  const lastInteractionAtIso = lastInteractionAt ? new Date(lastInteractionAt).toISOString() : null;
  const lastInteractionAgeMs =
    lastInteractionAt !== null ? Math.max(0, now - lastInteractionAt) : null;
  const providerUnavailable = Object.entries(providers)
    .filter(([, state]) => !state.mounted)
    .map(([name]) => name);
  const category: DevtoolsIssue['category'] =
    providerUnavailable.length > 0 ? 'provider-unavailable' : 'runtime';

  const context: DevtoolsIssueContext = {
    route: currentRoute ?? window.location.pathname,
    activeElement,
    lastInteractionId,
    lastInteractionAt: lastInteractionAtIso,
    lastInteractionAgeMs,
    breadcrumbs: timeline.slice(-MAX_BREADCRUMBS),
    runtime: buildRuntimeSnapshot(),
    providerUnavailable,
  };

  const issue: DevtoolsIssue = {
    id: nextId++,
    timestamp: new Date().toISOString(),
    correlationId: activeCorrelationId ?? 'DVT-C0',
    category,
    level: payload.level,
    source: payload.source,
    message: payload.message,
    args: payload.args,
    stack: payload.stack,
    context,
    systemIssue: payload.systemIssue,
  };

  issues = [issue, ...issues];
  if (issues.length > MAX_ISSUES) {
    issues = issues.slice(0, MAX_ISSUES);
  }

  notifyListeners(issue);
};

const captureConsole = (level: DevtoolsIssueLevel, args: unknown[]): void => {
  const systemIssue = extractSystemIssueFromArgs(args);
  const formattedArgs = formatConsoleArgs(args);
  const message =
    systemIssue && typeof args[0] === 'string'
      ? args[0]
      : formattedArgs.join(' ');

  let stack: string | undefined;
  for (const arg of args) {
    if (arg instanceof Error && arg.stack) {
      stack = arg.stack;
      break;
    }
  }

  if (import.meta.env.DEV && !testScenario && currentRoute?.includes('/test')) {
    const debugStack = stack ?? new Error().stack;
    console.debug(
      '[DevtoolsMonitor] console issue without active testScenario – consider markDevtoolsTestScenario()',
      { level, message, stack: debugStack }
    );
  }

  captureIssue({
    level,
    source: 'console',
    message,
    args: formattedArgs,
    stack,
    systemIssue,
  });
};

const resetDevtoolsMonitorState = (): void => {
  issues = [];
  timeline = [];
  nextId = 1;
  nextTimelineId = 1;
  nextCorrelationId = 1;
  lastEntryKey = '';
  lastEntryTime = 0;
  lastTimelineKey = '';
  lastTimelineTime = 0;
  monitorStartedAt = 0;
  lastInteractionId = null;
  lastInteractionAt = null;
  currentRoute = null;
  providers = {};
  testScenario = null;
  activeCorrelationId = null;
};

const captureWindowError = (event: ErrorEvent): void => {
  const message = event.message || 'Ukendt window error';
  const location = event.filename ? `${event.filename}:${event.lineno}:${event.colno ?? ''}` : '';
  const fullMessage = location ? `${message}\n${location}` : message;
  const stack = event.error?.stack;

  captureIssue({
    level: 'error',
    source: 'window',
    message: fullMessage,
    args: [fullMessage],
    stack,
  });
};

const captureUnhandledRejection = (event: PromiseRejectionEvent): void => {
  const reason = event.reason;
  const formatted = formatConsoleArg(reason);
  const stack = reason instanceof Error ? reason.stack : undefined;
  const message = `Unhandled Promise rejection\n${formatted}`;

  captureIssue({
    level: 'error',
    source: 'unhandledrejection',
    message,
    args: [formatted],
    stack,
  });
};

export const startDevtoolsMonitor = (): (() => void) => {
  startCount += 1;
  if (started) {
    return () => {
      startCount = Math.max(0, startCount - 1);
      if (startCount === 0) {
        started = false;
        if (originalConsoleWarn) console.warn = originalConsoleWarn;
        if (originalConsoleError) console.error = originalConsoleError;
        originalConsoleWarn = null;
        originalConsoleError = null;
        removeWindowErrorListener?.();
        removeUnhandledListener?.();
        removeWindowErrorListener = null;
        removeUnhandledListener = null;
      }
    };
  }
  started = true;
  if (monitorStartedAt === 0) {
    monitorStartedAt = Date.now();
  }

  originalConsoleWarn = console.warn;
  originalConsoleError = console.error;

  console.warn = (...args: unknown[]) => {
    originalConsoleWarn?.apply(console, args);
    captureConsole('warn', args);
  };

  console.error = (...args: unknown[]) => {
    originalConsoleError?.apply(console, args);
    captureConsole('error', args);
  };

  window.addEventListener('error', captureWindowError);
  window.addEventListener('unhandledrejection', captureUnhandledRejection);

  removeWindowErrorListener = () => {
    window.removeEventListener('error', captureWindowError);
  };
  removeUnhandledListener = () => {
    window.removeEventListener('unhandledrejection', captureUnhandledRejection);
  };

  const handleClick = (event: MouseEvent) => {
    const target = getInteractiveTarget(event.target);
    const descriptor = describeElement(target);
    const message = descriptor ? `Click: ${descriptor}` : 'Click';
    recordTimelineEvent(
      {
        kind: 'user',
        message,
        data: {
          button: event.button,
        },
      },
      { dedupeKey: `click:${descriptor ?? 'unknown'}`, markInteraction: true }
    );
  };

  const handleKeyDown = (event: KeyboardEvent) => {
    if (!USER_KEY_WHITELIST.has(event.key)) return;
    const target = getInteractiveTarget(event.target);
    const descriptor = describeElement(target);
    const message = descriptor ? `Key ${event.key}: ${descriptor}` : `Key ${event.key}`;
    recordTimelineEvent(
      {
        kind: 'user',
        message,
        data: {
          key: event.key,
        },
      },
      { dedupeKey: `key:${event.key}:${descriptor ?? 'unknown'}`, markInteraction: true }
    );
  };

  const handleVisibilityChange = () => {
    recordTimelineEvent({
      kind: 'system',
      message: `Visibility: ${document.visibilityState}`,
    });
  };

  document.addEventListener('click', handleClick, true);
  document.addEventListener('keydown', handleKeyDown, true);
  document.addEventListener('visibilitychange', handleVisibilityChange);

  removeUserClickListener = () => {
    document.removeEventListener('click', handleClick, true);
  };
  removeUserKeyListener = () => {
    document.removeEventListener('keydown', handleKeyDown, true);
  };
  removeVisibilityListener = () => {
    document.removeEventListener('visibilitychange', handleVisibilityChange);
  };

  recordTimelineEvent({ kind: 'lifecycle', message: 'Devtools monitor started' });

  return () => {
    startCount = Math.max(0, startCount - 1);
    if (startCount > 0) return;
    if (!started) return;
    started = false;
    if (originalConsoleWarn) console.warn = originalConsoleWarn;
    if (originalConsoleError) console.error = originalConsoleError;
    originalConsoleWarn = null;
    originalConsoleError = null;
    removeWindowErrorListener?.();
    removeUnhandledListener?.();
    removeWindowErrorListener = null;
    removeUnhandledListener = null;
    removeUserClickListener?.();
    removeUserKeyListener?.();
    removeVisibilityListener?.();
    removeUserClickListener = null;
    removeUserKeyListener = null;
    removeVisibilityListener = null;
    recordTimelineEvent({ kind: 'lifecycle', message: 'Devtools monitor stopped' });
  };
};

export const resetDevtoolsMonitor = (): void => {
  if (started) {
    if (originalConsoleWarn) console.warn = originalConsoleWarn;
    if (originalConsoleError) console.error = originalConsoleError;
    originalConsoleWarn = null;
    originalConsoleError = null;
    removeWindowErrorListener?.();
    removeUnhandledListener?.();
    removeUserClickListener?.();
    removeUserKeyListener?.();
    removeVisibilityListener?.();
    removeWindowErrorListener = null;
    removeUnhandledListener = null;
    removeUserClickListener = null;
    removeUserKeyListener = null;
    removeVisibilityListener = null;
  }
  started = false;
  startCount = 0;
  listeners.clear();
  resetDevtoolsMonitorState();
};

export const subscribeDevtoolsIssues = (listener: DevtoolsIssueListener): (() => void) => {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
};

export const getDevtoolsIssueSnapshot = (): DevtoolsIssueSnapshot => {
  return buildSnapshot();
};

export const setDevtoolsRoute = (route: string): void => {
  if (route === currentRoute) return;
  const previous = currentRoute;
  currentRoute = route;
  recordTimelineEvent({
    kind: 'navigation',
    message: previous ? `Route: ${previous} -> ${route}` : `Route: ${route}`,
    data: { from: previous, to: route },
  });
};

export const setDevtoolsProviderState = (name: string, mounted: boolean): void => {
  const now = new Date().toISOString();
  const existing = providers[name];
  if (existing && existing.mounted === mounted) return;
  providers = {
    ...providers,
    [name]: {
      mounted,
      lastChanged: now,
    },
  };
  recordTimelineEvent({
    kind: 'lifecycle',
    message: `Provider ${name}: ${mounted ? 'mounted' : 'unmounted'}`,
    data: { provider: name, mounted },
  });
};

export const markDevtoolsTestScenario = (label: string, details?: Record<string, string | number | boolean | null>): void => {
  const triggeredAt = new Date().toISOString();
  testScenario = { label, triggeredAt };
  recordTimelineEvent(
    {
      kind: 'test',
      message: `Test scenario: ${label}`,
      data: details,
    },
    { markInteraction: true, dedupeKey: `test:${label}` }
  );
};
