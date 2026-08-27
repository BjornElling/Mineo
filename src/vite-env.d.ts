// eslint-disable-next-line @typescript-eslint/triple-slash-reference -- Vite 8 eksponerer klienttyper her; stireferencen holder ældre VS Code-TS-servere fra at slå den fjernede compilerOptions-typebiblioteksindstilling op.
/// <reference path="../node_modules/vite/client.d.ts" />

interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>;
  readonly userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>;
}

/** Kun Chromium-browsere implementerer denne – derfor optional på Navigator. */
interface RelatedApplication {
  id?: string;
  platform: string;
  url?: string;
  version?: string;
}

interface Navigator {
  getInstalledRelatedApps?: () => Promise<RelatedApplication[]>;
}
