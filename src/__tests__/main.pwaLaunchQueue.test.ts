// @vitest-environment jsdom
const {
  bootstrapClientAppMock,
  hydratePendingPwaFileOpenRequestMock,
  pwaSetupCallOrder,
  setupPwaLaunchQueueConsumerMock,
} = vi.hoisted(() => ({
  bootstrapClientAppMock: vi.fn<(options: unknown) => Promise<void>>(),
  hydratePendingPwaFileOpenRequestMock: vi.fn(async () => undefined),
  pwaSetupCallOrder: [] as string[],
  setupPwaLaunchQueueConsumerMock: vi.fn(),
}));

vi.mock('../apps/mineo/mineoStorageNamespace', () => ({}));
vi.mock('../apps/shared/bootstrapClientApp', () => ({
  bootstrapClientApp: (options: unknown) => bootstrapClientAppMock(options),
}));
vi.mock('../apps/mineo/serviceWorkerBootstrap', () => ({
  ensureLatestVersionBeforeRender: vi.fn(),
}));
vi.mock('../utils/pwaInstallPrompt', () => ({
  setupPwaInstallPromptCapture: vi.fn(),
}));
vi.mock('../utils/pwaLaunchQueue', () => ({
  hydratePendingPwaFileOpenRequest: () => {
    pwaSetupCallOrder.push('hydrate');
    return hydratePendingPwaFileOpenRequestMock();
  },
  setupPwaLaunchQueueConsumer: () => {
    pwaSetupCallOrder.push('consumer');
    setupPwaLaunchQueueConsumerMock();
  },
}));
vi.mock('../inputCore/react', () => ({
  bootstrapProductionInputRuntime: vi.fn(),
}));
vi.mock('../components/errors/ErrorBoundary', () => ({ default: () => null }));

type BootstrapOptions = Readonly<{
  setupPwaFileOpenHandling?: () => Promise<void>;
}>;

describe('Mineos app-entry — PWA-filåbning', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    pwaSetupCallOrder.length = 0;
  });

  it('leverer launchQueue-registrering og genoptagelse til app-shellen før render', async () => {
    await import('../main');

    expect(bootstrapClientAppMock).toHaveBeenCalledOnce();
    const options = bootstrapClientAppMock.mock.calls[0]?.[0] as BootstrapOptions | undefined;
    expect(options?.setupPwaFileOpenHandling).toBeDefined();

    await options?.setupPwaFileOpenHandling?.();

    expect(setupPwaLaunchQueueConsumerMock).toHaveBeenCalledOnce();
    expect(hydratePendingPwaFileOpenRequestMock).toHaveBeenCalledOnce();
    expect(pwaSetupCallOrder).toEqual(['consumer', 'hydrate']);
  });
});
