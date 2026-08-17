import {
  deriveMachineProfile,
  parsePositiveNumberEnv,
  REFERENCE_PROBE_MS,
  type MachineCapacity,
} from '../../../e2e/support/machineProfile';

/**
 * Maskinprofilen bestemmer parallelitet og timeout-lofter for hele E2E-suiten. Reglen der skal
 * bevises er asymmetrien: profilen må kun dæmpe en svagere maskine, aldrig ændre den maskine og
 * den CI-runner, hvor suiten i forvejen er grøn.
 */

const REFERENCE_MACHINE: MachineCapacity = {
  // AMD Ryzen 7 7700X, 16 logiske kerner, 32 GiB — maskinen konstanten er kalibreret mod.
  logicalCpus: 16,
  totalMemoryGiB: 31.1,
  slownessFactor: 1,
};

describe('deriveMachineProfile', () => {
  it('lader referencemaskinen beholde Playwrights egen parallelitet og uændrede lofter', () => {
    const profile = deriveMachineProfile(REFERENCE_MACHINE);

    expect(profile.workers).toBe(8);
    expect(profile.playwrightDefaultWorkers).toBe(8);
    expect(profile.timeoutScale).toBe(1);
    expect(profile.reduced).toBe(false);
  });

  it('behandler en hurtigere maskine end referencen som referencen, ikke som hurtigere', () => {
    const profile = deriveMachineProfile({ ...REFERENCE_MACHINE, slownessFactor: 0.5 });

    expect(profile.workers).toBe(8);
    expect(profile.timeoutScale).toBe(1);
    expect(profile.reduced).toBe(false);
  });

  it('ignorerer måleudsving inden for tolerancen, så en travl hurtig maskine ikke dæmpes', () => {
    const profile = deriveMachineProfile({ ...REFERENCE_MACHINE, slownessFactor: 1.2 });

    expect(profile.workers).toBe(8);
    expect(profile.timeoutScale).toBe(1);
  });

  it('binder parallelitet til hukommelsen — årsagen til crashede browser-targets', () => {
    // 16 GiB: 4 GiB reserveret til OS, Node og devserveren, 2,5 GiB pr. browser-worker.
    const profile = deriveMachineProfile({
      logicalCpus: 16,
      totalMemoryGiB: 16,
      slownessFactor: 1,
    });

    expect(profile.playwrightDefaultWorkers).toBe(8);
    expect(profile.workers).toBe(4);
    expect(profile.reduced).toBe(true);
  });

  it('holder mindst én worker selv på en maskine uden hukommelse at give', () => {
    const profile = deriveMachineProfile({
      logicalCpus: 2,
      totalMemoryGiB: 4,
      slownessFactor: 3,
    });

    expect(profile.workers).toBe(1);
  });

  it('hæver timeout-lofterne i takt med den målte langsomhed', () => {
    const profile = deriveMachineProfile({ ...REFERENCE_MACHINE, slownessFactor: 2 });

    expect(profile.timeoutScale).toBe(2);
    expect(profile.reduced).toBe(true);
  });

  it('sætter loft over hvor langsom en maskine kan måles til, så én vildfaren måling ikke løber løbsk', () => {
    const profile = deriveMachineProfile({ ...REFERENCE_MACHINE, slownessFactor: 25 });

    expect(profile.timeoutScale).toBe(3);
  });

  it('dæmper langsomme kerner mildere end lav hukommelse, så kørslen ikke straffes dobbelt', () => {
    const slowButRoomy = deriveMachineProfile({ ...REFERENCE_MACHINE, slownessFactor: 2 });

    // Kvadratrods-dæmpning: 8 / √2 ≈ 5,66 → 6. Lineær dæmpning ville give 4.
    expect(slowButRoomy.workers).toBe(6);
  });

  it('rammer Playwrights egen «50 %»-standard for kerneantallet, så en stærk maskine er upåvirket', () => {
    // Playwrights standard er `workers: '50%'`, som den selv opgør som
    // `Math.max(1, Math.floor(os.cpus().length * 0.5))`. Afveg profilen her, ville den ændre
    // parallelitet på maskiner, der aldrig har haft et problem.
    const playwrightDefault = (cpus: number): number => Math.max(1, Math.floor(cpus * 0.5));

    for (const logicalCpus of [1, 2, 3, 4, 6, 8, 12, 16, 24, 32]) {
      const profile = deriveMachineProfile({
        logicalCpus,
        // Rigelig hukommelse, så kun kernetallet er i spil.
        totalMemoryGiB: 256,
        slownessFactor: 1,
      });

      expect(profile.playwrightDefaultWorkers).toBe(playwrightDefault(logicalCpus));
      expect(profile.workers).toBe(playwrightDefault(logicalCpus));
    }
  });

  it('lader eksplicitte overrides vinde over målingen', () => {
    const profile = deriveMachineProfile(
      { logicalCpus: 16, totalMemoryGiB: 8, slownessFactor: 3 },
      { workers: 4, timeoutScale: 1.5 },
    );

    expect(profile.workers).toBe(4);
    expect(profile.timeoutScale).toBe(1.5);
  });

  it('afviser overrides der ville gøre kørslen mere skrøbelig end standarden', () => {
    const profile = deriveMachineProfile(REFERENCE_MACHINE, { workers: 0.4, timeoutScale: 0.25 });

    expect(profile.workers).toBe(1);
    expect(profile.timeoutScale).toBe(1);
  });
});

describe('parsePositiveNumberEnv', () => {
  it('læser en gyldig positiv værdi', () => {
    expect(parsePositiveNumberEnv('4')).toBe(4);
    expect(parsePositiveNumberEnv(' 1.5 ')).toBe(1.5);
  });

  it('falder tilbage til den målte profil ved manglende eller meningsløs værdi', () => {
    expect(parsePositiveNumberEnv(undefined)).toBeUndefined();
    expect(parsePositiveNumberEnv('')).toBeUndefined();
    expect(parsePositiveNumberEnv('   ')).toBeUndefined();
    expect(parsePositiveNumberEnv('mange')).toBeUndefined();
    expect(parsePositiveNumberEnv('0')).toBeUndefined();
    expect(parsePositiveNumberEnv('-2')).toBeUndefined();
    expect(parsePositiveNumberEnv('Infinity')).toBeUndefined();
  });
});

describe('REFERENCE_PROBE_MS', () => {
  it('er et positivt tal, så en måling kan divideres med det', () => {
    expect(REFERENCE_PROBE_MS).toBeGreaterThan(0);
  });
});
