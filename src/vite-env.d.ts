// eslint-disable-next-line @typescript-eslint/triple-slash-reference -- Vite 8 exposes client types at this file; path reference keeps older VS Code TS servers from resolving the removed compilerOptions type library entry.
/// <reference path="../node_modules/vite/client.d.ts" />

interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>;
  readonly userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>;
}

/** Kun Chromium-browsere implementerer denne — derfor optional på Navigator. */
interface RelatedApplication {
  id?: string;
  platform: string;
  url?: string;
  version?: string;
}

interface Navigator {
  getInstalledRelatedApps?: () => Promise<RelatedApplication[]>;
}
