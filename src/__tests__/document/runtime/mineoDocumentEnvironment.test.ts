/**
 * R6-F01 — kildesnapshottets to halvdele skal optages på SAMME tidspunkt.
 *
 * Fejlen var, at `createMineoDocumentEnvironment(runtime, settings)` lukkede over et `SourceSettings`-objekt,
 * som React-hooken havde fanget ved render, mens `captureEvaluationSource()` blev læst friskt efter settle.
 * Et click-preflight kunne derfor parre et NYERE settingsrevision-token med et ÆLDRE format-, brevhoved- eller
 * EO-regelobjekt. Tokenet var aktuelt, så ingen af de senere friskhedschecks kunne fange kombinationen — og
 * dokumentet kunne gates eller renderes efter en forældet indstilling.
 *
 * Testen måler netop det vindue: settings ændres MELLEM miljøets konstruktion og `captureSource()`. Den
 * fanger ikke en typefejl — den fanger, hvilken VÆRDI capturen leverer.
 */
import { createMineoDocumentEnvironment } from '../../../document/runtime/mineoDocumentEnvironment';
import type { DocumentInputAccess } from '../../../inputCore/react/inputRuntimeContext';
import { CriticalActionCoordinator } from '../../../inputCore/runtime/criticalActionCoordinator';
import { ActiveEditorRegistry } from '../../../inputCore/runtime/activeEditorRegistry';
import { __createSlimInputTestStore } from '../../../inputCore/runtime/slimInputStore';
import { createInputEvaluation, type InputEvaluation } from '../../../inputCore/inputReader';
import {
  createEvaluationSourceToken,
  createInputRevision,
  createSettingsRevision,
} from '../../../inputCore/evaluationSource';
import { createEmptySettledInput } from '../../../inputCore';
import { getProductionInputCatalog } from '../../../inputCore/catalog/productionCatalog';
import { DEFAULT_APP_SETTINGS } from '../../../settings/appSettingsSchema';
import { projectSourceSettings, type SourceSettings } from '../../../settings/sourceSettings';

const catalog = getProductionInputCatalog();

/** Token med de brandede revisioner; inputrevisionen holdes fast, så testen kun varierer settings. */
const tokenAt = (settingsRevision: number) =>
  createEvaluationSourceToken(createInputRevision(1), createSettingsRevision(settingsRevision));

/** Bygger en evaluering, hvis token bærer den angivne settingsrevision. */
const evaluationWithSettingsRevision = (settingsRevision: number): InputEvaluation => createInputEvaluation({
  input: createEmptySettledInput(),
  catalog,
  sourceToken: tokenAt(settingsRevision),
});

const pdfSettings = (): SourceSettings =>
  projectSourceSettings({ ...DEFAULT_APP_SETTINGS, documentDownloadFormat: 'pdf' });

const wordSettings = (): SourceSettings =>
  projectSourceSettings({ ...DEFAULT_APP_SETTINGS, documentDownloadFormat: 'word' });

describe('createMineoDocumentEnvironment — kildesnapshottets friskhed (R6-F01)', () => {
  it('læser settings på CAPTURE-tidspunktet, ikke ved konstruktionen', () => {
    // Den publicerede værdi ligger i en mutabel celle, præcis som `publishedSettings` i
    // produktions-runtimen: den sættes i samme layout-fase, som settingsrevisionen hæves.
    let published: SourceSettings = pdfSettings();
    let settingsRevision = 1;

    const runtime: DocumentInputAccess = Object.freeze({
      captureEvaluationSource: () => evaluationWithSettingsRevision(settingsRevision),
      readCurrentSourceToken: () => tokenAt(settingsRevision),
      criticalActions: new CriticalActionCoordinator(__createSlimInputTestStore(), new ActiveEditorRegistry()),
    });

    const environment = createMineoDocumentEnvironment(runtime, () => published);

    // Første capture ser den værdi, der gælder nu.
    expect(environment.captureSource().settings.documentDownloadFormat).toBe('pdf');

    // Brugeren skifter indstilling: settingsrevisionen hæves OG den publicerede værdi udskiftes — samme
    // layout-fase, som `useSettingsRevisionBridge` gør det.
    published = wordSettings();
    settingsRevision = 2;

    const captured = environment.captureSource();
    // Kernen i fundet: capturen skal levere det NYE settingsobjekt, ikke det, miljøet blev bygget med.
    expect(captured.settings.documentDownloadFormat).toBe('word');
    // …og den skal være PARRET med det nye token, så friskhedschecket måler én samlet kilde.
    expect(captured.evaluation.issues.sourceToken.settingsRevision).toBe(2);
  });

  it('resolveFormat læser det capturede snapshot, så formatvalget følger med', () => {
    let published: SourceSettings = pdfSettings();
    const runtime: DocumentInputAccess = Object.freeze({
      captureEvaluationSource: () => evaluationWithSettingsRevision(1),
      readCurrentSourceToken: () => tokenAt(1),
      criticalActions: new CriticalActionCoordinator(__createSlimInputTestStore(), new ActiveEditorRegistry()),
    });
    const environment = createMineoDocumentEnvironment(runtime, () => published);

    published = wordSettings();

    // Formatet afgøres af capturens settings — ikke af en værdi fra miljøets konstruktion.
    expect(environment.resolveFormat(environment.captureSource().settings)).toBe('word');
  });

  it('brevhoved-opslaget følger samme capturede snapshot', () => {
    let published: SourceSettings = projectSourceSettings({
      ...DEFAULT_APP_SETTINGS,
      brevhovedIndstillinger: { ...DEFAULT_APP_SETTINGS.brevhovedIndstillinger, erstatningsopgoerelse: false },
    });
    const runtime: DocumentInputAccess = Object.freeze({
      captureEvaluationSource: () => evaluationWithSettingsRevision(1),
      readCurrentSourceToken: () => tokenAt(1),
      criticalActions: new CriticalActionCoordinator(__createSlimInputTestStore(), new ActiveEditorRegistry()),
    });
    const environment = createMineoDocumentEnvironment(runtime, () => published);
    const policy = { kind: 'settings-key', key: 'erstatningsopgoerelse' } as const;

    expect(environment.resolveVisBrevhoved(environment.captureSource().settings, policy)).toBe(false);

    published = projectSourceSettings({
      ...DEFAULT_APP_SETTINGS,
      brevhovedIndstillinger: { ...DEFAULT_APP_SETTINGS.brevhovedIndstillinger, erstatningsopgoerelse: true },
    });

    expect(environment.resolveVisBrevhoved(environment.captureSource().settings, policy)).toBe(true);
  });

  it('EO-regeltogglen i det capturede snapshot er den aktuelle', () => {
    let published: SourceSettings = projectSourceSettings({
      ...DEFAULT_APP_SETTINGS,
      allowReguleringMedOverenskomstDerIkkeDaekkerHelePerioden: false,
    });
    const runtime: DocumentInputAccess = Object.freeze({
      captureEvaluationSource: () => evaluationWithSettingsRevision(1),
      readCurrentSourceToken: () => tokenAt(1),
      criticalActions: new CriticalActionCoordinator(__createSlimInputTestStore(), new ActiveEditorRegistry()),
    });
    const environment = createMineoDocumentEnvironment(runtime, () => published);

    expect(
      environment.captureSource().settings.allowReguleringMedOverenskomstDerIkkeDaekkerHelePerioden
    ).toBe(false);

    // En regelændring må ikke kunne overleves af et miljø, der blev bygget under den gamle regel.
    published = projectSourceSettings({
      ...DEFAULT_APP_SETTINGS,
      allowReguleringMedOverenskomstDerIkkeDaekkerHelePerioden: true,
    });

    expect(
      environment.captureSource().settings.allowReguleringMedOverenskomstDerIkkeDaekkerHelePerioden
    ).toBe(true);
  });

  it('optager evaluering og settings i samme kald, så de to halvdele ikke kan divergere', () => {
    const captureOrder: string[] = [];
    let published: SourceSettings = pdfSettings();
    const runtime: DocumentInputAccess = Object.freeze({
      captureEvaluationSource: () => {
        captureOrder.push('evaluation');
        return evaluationWithSettingsRevision(1);
      },
      readCurrentSourceToken: () => tokenAt(1),
      criticalActions: new CriticalActionCoordinator(__createSlimInputTestStore(), new ActiveEditorRegistry()),
    });
    const environment = createMineoDocumentEnvironment(runtime, () => {
      captureOrder.push('settings');
      return published;
    });

    environment.captureSource();

    // Begge halvdele læses ved HVERT capture — ingen af dem er en holdt værdi.
    expect(captureOrder).toEqual(['evaluation', 'settings']);

    published = wordSettings();
    environment.captureSource();
    expect(captureOrder).toEqual(['evaluation', 'settings', 'evaluation', 'settings']);
  });
});
