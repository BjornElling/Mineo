import fs from 'node:fs';
import path from 'node:path';

type CoverageEntry = Readonly<{
  contractPath: string;
  requiredTestPaths: readonly string[];
}>;

const COVERAGE_MATRIX: readonly CoverageEntry[] = [
  {
    contractPath: 'src/contracts/contract-topology.json',
    requiredTestPaths: [
      'src/__tests__/quality/contractCoverageMatrix.test.ts',
    ],
  },
  {
    contractPath: 'src/contracts/calculation-data-contract.md',
    requiredTestPaths: [
      'src/__tests__/data/calculationDataCatalog.test.ts',
      'src/__tests__/data/kapitaliseringsbekendtgoerelser.test.ts',
      // Den transitive regel `data/calculation-catalog-not-eager-from-entrypoint` (kontraktens §2.8).
      // Stod i kontraktens eget §4, men manglede her.
      'src/__tests__/quality/architecture/architectureRules.test.ts',
    ],
  },
  {
    contractPath: 'src/contracts/form-contract.md',
    requiredTestPaths: [
      // Effect-write-grænsen håndhæves af AST-reglen `input/derived-writes-materialize-in-reduction`
      // i arkitektur-harnesset — ikke af et tekstbaseret værn her, som bliver grønt af tomhed, så
      // snart de navne, det leder efter, forsvinder fra kildegrafen.
      'src/__tests__/quality/architecture/architectureRules.test.ts',
      // Feltkontrakten dækkes af editor-/surface-kontrakttestene, ikke af implementeringstests pr.
      // felthook.
      'src/__tests__/inputCore/editor/fieldEditor.test.ts',
      'src/__tests__/inputCore/react/useFormFieldSurface.test.tsx',
    ],
  },
  {
    contractPath: 'src/contracts/critical-action-contract.md',
    requiredTestPaths: [
      // Greenfield-runtime ejer den kritiske handlingsbarriere (`CriticalActionCoordinator` i inputCore).
      'src/__tests__/inputCore/runtime/criticalActionCoordinator.test.ts',
      'src/__tests__/components/layout/MainLayout.navigationCommitGuard.test.tsx',
      'src/__tests__/components/layout/MainLayout.undoRedoEditorGuard.test.tsx',
      'src/__tests__/hooks/useFileSaveLoad.test.tsx',
    ],
  },
  {
    contractPath: 'src/contracts/domain-boundary-contract.md',
    requiredTestPaths: [
      'src/__tests__/quality/domainBoundaryIsolation.test.ts',
      'src/__tests__/quality/eetDomainIsolation.test.ts',
      'src/__tests__/domain/forsoergertab/forsoergertabSnapshot.test.ts',
      'src/__tests__/domain/erhvervsevnetab/eetSnapshot.test.ts',
    ],
  },
  {
    contractPath: 'src/contracts/snapshot-contract.md',
    requiredTestPaths: [
      'src/__tests__/domain/forsoergertab/forsoergertabSnapshot.test.ts',
      'src/__tests__/domain/erhvervsevnetab/eetSnapshot.test.ts',
      'src/__tests__/domain/erstatningsopgoerelse/eoSnapshot.test.ts',
    ],
  },
  {
    contractPath: 'src/contracts/persistence-contract.md',
    requiredTestPaths: [
      // Import-/adgangs-grænserne (persistence-store, FormPersistenceContext, sessionStorage)
      // håndhæves nu af det AST-baserede arkitektur-harness.
      // Import-/adgangs-grænserne + committed-section-mirror håndhæves nu af harnesset.
      'src/__tests__/quality/architecture/architectureRules.test.ts',
      'src/__tests__/inputCore/runtime/dispatchInput.test.ts',
      // Browser-sessionmigration er et ikke-mål (§2.6); `.eo`-save/load/apply-grænsen dækkes af
      // caseportene.
      'src/__tests__/persistence/caseFileOperations.test.ts',
      'src/__tests__/persistence/caseResetOperations.test.ts',
      'src/__tests__/utils/persistenceLoadApply.test.ts',
      'src/__tests__/utils/safeSessionStorage.test.ts',
      'src/__tests__/utils/fileSave.test.ts',
      'src/__tests__/utils/fileLoad.normalLoad.test.ts',
      'src/__tests__/utils/fileRoundTrip.fullState.test.ts',
    ],
  },
  {
    contractPath: 'src/contracts/schema-evolution.md',
    requiredTestPaths: [
      'src/__tests__/quality/schemaEvolutionDomainTable.test.ts',
      'src/__tests__/config/persistenceVersionDrift.test.ts',
      'src/__tests__/config/persistenceRegistry.test.ts',
      'src/__tests__/utils/persistenceLoadSanitization.test.ts',
      'src/__tests__/utils/persistenceMigrations.test.ts',
      'src/__tests__/utils/fileLoad.normalLoad.test.ts',
      'src/__tests__/utils/fileRoundTrip.fullState.test.ts',
    ],
  },
  {
    contractPath: 'src/contracts/page-component-contract.md',
    requiredTestPaths: [
      'src/__tests__/quality/domainBoundaryIsolation.test.ts',
      'src/__tests__/quality/architecture/architectureRules.test.ts',
    ],
  },
  {
    contractPath: 'src/contracts/keyboard-navigation.md',
    requiredTestPaths: [
      'src/__tests__/components/layout/Container.test.tsx',
      'src/__tests__/components/layout/Container.checklistGaps.test.tsx',
      'src/__tests__/components/tables/tableKeyboardNavigation.arrowWrap.test.tsx',
      'src/__tests__/components/tables/tableKeyboardNavigation.lockedSkip.test.tsx',
      // Kontraktkrydset "LUKKET popup-kontrol + tabellens capture-handler + Enter", kørt mod
      // BEGGE surfaces (form + celle), så popup-semantikken ikke kan divergere mellem dem igen.
      'src/__tests__/components/tables/popupWidgetKeyboardContract.integration.test.tsx',
    ],
  },
  {
    contractPath: 'src/contracts/document-format-contract.md',
    requiredTestPaths: [
      'src/__tests__/settings/appSettingsSchema.test.ts',
      'src/__tests__/document/documentFileName.test.ts',
      'src/__tests__/docx/docxWriter.test.ts',
      // Formatvalget sker i miljøet EFTER gaten, og outputnavne må ikke bære et formatsuffiks.
      // Begge dele måles her.
      'src/__tests__/document/documentCatalogCompleteness.test.ts',
      // Formatet vælger writer, ikke DÆKNING — verificeret generisk over alle 18
      // hovedapp-outputs, så ingen gate kan blive formatafhængig.
      'src/__tests__/document/documentGateFormatInvariance.test.ts',
    ],
  },
  {
    contractPath: 'src/contracts/document-output-contract.md',
    requiredTestPaths: [
      // Download-committed-state-grænsen håndhæves nu af det AST-baserede harness.
      'src/__tests__/quality/architecture/architectureRules.test.ts',
      // Ét kanonisk katalog med præcis én definition pr. output (§A2a).
      'src/__tests__/document/documentCatalogCompleteness.test.ts',
      // Den udtømmende matrix, delt i livscyklus-cases (definitionsuafhængige) og gate-cases
      // (per-definition, med `invalid` og `bounds` som SEPARATE klasser jf. §A2a).
      'src/__tests__/document/documentLifecycleMatrix.test.ts',
      'src/__tests__/document/documentGateMatrix.test.ts',
      // Hele livscyklussen end-to-end gennem den rigtige side og den ægte runtime.
      'src/__tests__/components/pages/Satser.downloadGate.integration.test.tsx',
      'src/__tests__/quality/architecture/architectureRules.test.ts',
      'src/__tests__/utils/pdf/pdfTableRenderer.layout.test.ts',
      'src/__tests__/utils/pdf/pdfWriter.test.ts',
      // Word-kanalens paritet mod det fælles writer-API (Afsnit B + §5):
      'src/__tests__/docx/docxWriter.test.ts',
      // Datoformat-værnet (§A8): rå ISO-dato må aldrig nå et dokument:
      'src/__tests__/quality/documentDateFormatGuard.test.ts',
    ],
  },
  {
    contractPath: 'src/contracts/periodisering-contract.md',
    requiredTestPaths: [
      'src/__tests__/domain/erstatningsopgoerelse/periodiseringsMotor.test.ts',
      'src/__tests__/domain/erstatningsopgoerelse/isoRangeAlgebra.test.ts',
      'src/__tests__/utils/periodeBeregning.test.ts',
    ],
  },
  {
    contractPath: 'src/contracts/eo-snapshot-contract.md',
    requiredTestPaths: [
      'src/__tests__/domain/erstatningsopgoerelse/eoSnapshot.test.ts',
      'src/__tests__/domain/erstatningsopgoerelse/erstatningsopgoerelseReaderProjection.test.ts',
      'src/__tests__/domain/erstatningsopgoerelse/eoSnapshotPdfProjection.test.ts',
      'src/__tests__/domain/erstatningsopgoerelse/eoSnapshotToInspektionView.test.ts',
    ],
  },
  {
    contractPath: 'src/contracts/eet-snapshot-contract.md',
    requiredTestPaths: [
      'src/__tests__/domain/erhvervsevnetab/eetSnapshot.test.ts',
      'src/__tests__/domain/erhvervsevnetab/erhvervsevnetabReaderProjection.test.ts',
    ],
  },
  {
    contractPath: 'src/contracts/forsoergertab-snapshot-contract.md',
    requiredTestPaths: [
      'src/__tests__/domain/forsoergertab/forsoergertabSnapshot.test.ts',
      'src/__tests__/domain/forsoergertab/forsoergertabReaderProjection.test.ts',
      'src/__tests__/components/pages/Forsoergertab.integration.test.tsx',
    ],
  },
  {
    contractPath: 'src/contracts/aarsloen-contract.md',
    requiredTestPaths: [
      'src/__tests__/domain/aarsloen/aarsloenCalculations.test.ts',
      'src/__tests__/domain/aarsloen/aarsloenProjection.test.ts',
      'src/__tests__/domain/aarsloen/aarsloenValidationPolicies.test.ts',
      // Årsløns- og SH-dage-gaten ejes af domænelaget, ikke af et React-hook.
      'src/__tests__/domain/aarsloen/aarsloenDownloadGate.test.ts',
    ],
  },
  {
    contractPath: 'src/contracts/renteberegning-contract.md',
    requiredTestPaths: [
      'src/__tests__/domain/renteberegning/renteberegningEngine.test.ts',
      'src/__tests__/domain/renteberegning/procesrenteCalculator.test.ts',
      'src/__tests__/domain/renteberegning/renteberegningReaderProjection.test.ts',
      'src/__tests__/components/pages/Renteberegning.integration.test.tsx',
    ],
  },
  {
    contractPath: 'src/contracts/varigemen-contract.md',
    requiredTestPaths: [
      'src/__tests__/domain/varigemen/varigeMenEngine.test.ts',
      'src/__tests__/components/pages/varigemen/MenberegningTab.integration.test.tsx',
    ],
  },
  {
    contractPath: 'src/contracts/satser-contract.md',
    requiredTestPaths: [
      'src/__tests__/domain/calculations/satserCalculations.test.ts',
      'src/__tests__/domain/satser/satserProjection.test.ts',
      'src/__tests__/inputCore/runtime/dispatchInput.test.ts',
    ],
  },
  {
    contractPath: 'src/contracts/amount-contract.md',
    requiredTestPaths: [
      'src/__tests__/domain/money/money.test.ts',
      'src/__tests__/quality/architecture/architectureRules.test.ts',
      'src/__tests__/utils/amountInputUtils.test.ts',
      'src/__tests__/schemas/amountExpressionSchema.test.ts',
      'src/__tests__/components/pages/Renteberegning.integration.test.tsx',
    ],
  },
  {
    contractPath: 'src/contracts/undo-redo-contract.md',
    requiredTestPaths: [
      // Greenfield-cutover: den legacy runner/`useUndoRedo` er slettet. Undo/redo-commanden dækkes af
      // `dispatchInput` + history-kernen; det stille no-op ved åben editor af coordinatoren; shellens genvej
      // + lokationsbaseret fokusrestore af `MainLayout.undoRedoEditorGuard` og `historyRestoreTarget`.
      'src/__tests__/inputCore/runtime/dispatchInput.test.ts',
      'src/__tests__/inputCore/inputHistory.test.ts',
      'src/__tests__/inputCore/runtime/criticalActionCoordinator.test.ts',
      'src/__tests__/inputCore/react/historyRestoreTarget.test.tsx',
      'src/__tests__/components/layout/MainLayout.undoRedoEditorGuard.test.tsx',
    ],
  },
  {
    contractPath: 'src/contracts/date-contract.md',
    requiredTestPaths: [
      'src/__tests__/quality/architecture/architectureRules.test.ts',
      'src/__tests__/utils/utcDayMath.test.ts',
    ],
  },
  {
    contractPath: 'src/contracts/error-contract.md',
    requiredTestPaths: [
      'src/__tests__/quality/errorContractIsolation.test.ts',
      // §1.6-issue-modellen (feltfejl/consumerfejl/warning, rød-felt-maskering, strukturel
      // save-sondring) dækkes af kernen, ikke af en implementeringstest pr. fejl-hook.
      'src/__tests__/inputCore/inputCore.test.ts',
    ],
  },
  {
    contractPath: 'src/contracts/app-settings.md',
    requiredTestPaths: [
      'src/__tests__/quality/appSettingsContractIsolation.test.ts',
      'src/__tests__/settings/appSettingsStorage.test.ts',
    ],
  },
  {
    contractPath: 'src/contracts/mineo-field-pattern.md',
    requiredTestPaths: [
      'src/__tests__/inputCore/react/fieldShells.test.tsx',
      'src/__tests__/inputCore/react/useFormFieldSurface.test.tsx',
    ],
  },
  {
    contractPath: 'src/contracts/input-field-behavior-contract.md',
    requiredTestPaths: [
      'src/__tests__/inputCore/editor/fieldEditor.test.ts',
      'src/__tests__/inputCore/react/useFormFieldSurface.test.tsx',
      'src/__tests__/inputCore/runtime/dispatchInput.test.ts',
      'src/__tests__/schemas/amountExpressionSchema.test.ts',
      'src/__tests__/domain/erstatningsopgoerelse/eoSnapshot.test.ts',
      'src/__tests__/domain/erstatningsopgoerelse/periodiseringsMotor.test.ts',
      'src/__tests__/components/tables/tableKeyboardNavigation.arrowWrap.test.tsx',
    ],
  },
  {
    contractPath: 'src/contracts/auth-gate-contract.md',
    requiredTestPaths: [
      'src/__tests__/auth/auth.test.ts',
      // Gaten forbliver lukket ved afvist/fejlende login og mounter først appen efter gyldigt flag.
      // Stod i kontraktens eget §4, men manglede her — de to lister var uenige.
      'src/__tests__/auth/LoginPage.test.tsx',
      'src/__tests__/auth/AuthGate.test.tsx',
      'src/__tests__/quality/authGateContractIsolation.test.ts',
    ],
  },
  {
    contractPath: 'src/contracts/app-shell-contract.md',
    requiredTestPaths: [
      'src/__tests__/quality/minprocesrenteStandaloneIsolation.test.ts',
      'src/__tests__/apps/shared/bootstrapClientApp.test.tsx',
      'src/__tests__/apps/shared/vitePreloadRecovery.test.ts',
      'src/__tests__/apps/mineo/serviceWorkerBootstrap.test.ts',
      'src/__tests__/apps/mineo/serviceWorkerProtocol.test.ts',
      'src/__tests__/components/system/LazyChunkRecoveryNotice.test.tsx',
      'src/__tests__/components/system/UnsupportedDevicePage.test.tsx',
      'src/__tests__/settings/indexThemeBootstrap.test.ts',
      'src/__tests__/utils/uiScale.test.ts',
      'src/__tests__/quality/contentBoxWidthSingleSource.test.ts',
      'src/__tests__/components/layout/SideTabRail.test.tsx',
      'e2e/minimum-viewport-shell.spec.ts',
      'e2e/content-scale.spec.ts',
      // De tre nedenfor stod i kontraktens eget §4, men manglede her — de to autoritative lister
      // over samme forhold var uenige, og ingen kontrol kunne se det.
      'src/__tests__/quality/pwaHeaders.test.ts',
      'src/__tests__/quality/architecture/rules/responsiveStylingRules.ts',
      'src/__tests__/quality/architecture/rules/documentRules.ts',
      'src/__tests__/main.pwaLaunchQueue.test.ts',
      'src/__tests__/utils/pwaLaunchQueue.test.ts',
      'src/__tests__/schemas/pwaFileOpenRequestSchema.test.ts',
      'scripts/verify-build-artifacts.mjs',
    ],
  },
  {
    contractPath: 'src/contracts/indskudte-loentillaeg-contract.md',
    requiredTestPaths: [
      'src/__tests__/data/indskudteLoentillaeg.test.ts',
      'src/__tests__/domain/erstatningsopgoerelse/eoSharedUtils.test.ts',
    ],
  },
];

const assertFileExists = (relativePath: string): void => {
  const absolutePath = path.resolve(process.cwd(), relativePath);
  expect(fs.existsSync(absolutePath), `Mangler fil: ${relativePath}`).toBe(true);
};

const getContractTopology = (): {
  version: number;
  crossCuttingContracts: string[];
  domainContracts: string[];
  subordinateContracts: Record<string, string[]>;
  contractAuthoring: { templatePath: string; procedurePath: string };
  informativeArchitectureDocs: string[];
} => JSON.parse(fs.readFileSync(path.resolve(process.cwd(), 'src/contracts/contract-topology.json'), 'utf8'));

describe('contract linkage matrix', () => {
  it('har mindst én koblet test-suite pr. normativ kontraktfil', () => {
    // NOTE: Dette er en ren linkage-guard (kontrakt <-> testsuite-eksistens).
    // Den må ikke læses som et mål for semantisk dækningsgrad af kontraktkravene.
    for (const entry of COVERAGE_MATRIX) {
      assertFileExists(entry.contractPath);
      for (const testPath of entry.requiredTestPaths) {
        assertFileExists(testPath);
      }
    }
  });

  it('har en maskinlæsbar kontrakttopologi med eksisterende kontraktfiler', () => {
    const topology = getContractTopology();

    expect(topology.version).toBe(1);
    for (const contractPath of [
      ...topology.crossCuttingContracts,
      ...topology.domainContracts,
      ...Object.keys(topology.subordinateContracts),
      ...Object.values(topology.subordinateContracts).flat(),
      topology.contractAuthoring.templatePath,
      topology.contractAuthoring.procedurePath,
      ...topology.informativeArchitectureDocs,
    ]) {
      assertFileExists(contractPath);
    }
  });

  it('registrerer alle kontrakt-markdownfiler i topologien', () => {
    const topology = getContractTopology();
    const registeredContractFiles = new Set([
      ...topology.crossCuttingContracts,
      ...topology.domainContracts,
      ...Object.keys(topology.subordinateContracts),
      topology.contractAuthoring.templatePath,
    ]);
    const contractMarkdownFiles = fs
      .readdirSync(path.resolve(process.cwd(), 'src/contracts'))
      .filter((fileName) => fileName.endsWith('.md'))
      .map((fileName) => `src/contracts/${fileName}`);

    for (const contractPath of contractMarkdownFiles) {
      expect(registeredContractFiles.has(contractPath), `Mangler topologi-registrering for ${contractPath}`).toBe(true);
    }
  });

  it('kræver et gyldigt "Senest verificeret mod kode"-felt i hver kontraktfil', () => {
    // Skabelonen er undtaget: den bruger en YYYY-MM-DD-placeholder, ikke en reel dato.
    const EXEMPT_FILES = new Set(['contract-template.md']);
    const contractsDir = path.resolve(process.cwd(), 'src/contracts');
    const contractMarkdownFiles = fs
      .readdirSync(contractsDir)
      .filter((fileName) => fileName.endsWith('.md') && !EXEMPT_FILES.has(fileName));

    expect(contractMarkdownFiles.length).toBeGreaterThan(0);

    const datePattern = /\*\*Senest verificeret mod kode:\*\*\s*(\d{4}-\d{2}-\d{2})/;
    for (const fileName of contractMarkdownFiles) {
      const content = fs.readFileSync(path.join(contractsDir, fileName), 'utf8');
      const match = content.match(datePattern);
      expect(
        match,
        `Kontrakt mangler et gyldigt "**Senest verificeret mod kode:** YYYY-MM-DD"-felt: src/contracts/${fileName}`
      ).not.toBeNull();
    }
  });

  it('holder kontrakttopologi og dækningsmatrix synkroniseret begge veje', () => {
    const topology = getContractTopology();

    const matrixContracts = new Set(COVERAGE_MATRIX.map((entry) => entry.contractPath));
    const topologyContracts = new Set([
      ...topology.crossCuttingContracts,
      ...topology.domainContracts,
      ...Object.keys(topology.subordinateContracts),
    ]);

    for (const contractPath of topologyContracts) {
      expect(matrixContracts.has(contractPath), `Mangler dækningsmatrix-entry for ${contractPath}`).toBe(true);
    }

    for (const [contractPath, parentContracts] of Object.entries(topology.subordinateContracts)) {
      expect(topologyContracts.has(contractPath), `Underordnet kontrakt er ikke selv klassificeret: ${contractPath}`).toBe(true);
      for (const parentContract of parentContracts) {
        expect(topologyContracts.has(parentContract), `Underordnet reference er ikke klassificeret: ${parentContract}`).toBe(true);
      }
    }

    const nonTopologyMatrixEntries = new Set([
      'src/contracts/contract-topology.json',
    ]);
    for (const contractPath of matrixContracts) {
      if (nonTopologyMatrixEntries.has(contractPath)) continue;
      expect(topologyContracts.has(contractPath), `Mangler topologi-klassifikation for ${contractPath}`).toBe(true);
    }
  });

  /**
   * FIL-completeness er ikke HIERARKI-completeness.
   *
   * Testen ovenfor kontrollerer, at hver underordnelses-reference er en klassificeret kontraktfil.
   * Den kan ikke se den modsatte fejl — at en tværgående kontrakt MANGLER i listen. Det er en reel
   * fejlform: `page-component-contract.md` er ifølge både AGENTS.md's kontrakthierarki og sin egen
   * prioritetslinje underordnet SAMTLIGE tværgående kontrakter, men topologien udelod
   * `snapshot-contract.md` og `auth-gate-contract.md`. To autoritative beskrivelser gav dermed
   * forskellig kontraktprioritet, og den maskinlæsbare — den, en læser og et værktøj slår op i — var
   * den ufuldstændige.
   *
   * Invarianten er derfor LIGHED og ikke inklusion: listen skal være hele det tværgående sæt, hverken
   * mere eller mindre. Listen bevares som eksplicit data frem for at blive udledt i JSON'en (hvad et
   * JSON-dokument ikke kan), så den fortsat er læsbar og reviewbar — men en glemt tilføjelse er nu en
   * rød test frem for en tavs uenighed.
   */
  it('page-component-kontrakten er underordnet PRÆCIS alle tværgående kontrakter', () => {
    const topology = getContractTopology();
    const PAGE_CONTRACT = 'src/contracts/page-component-contract.md';

    const declared = topology.subordinateContracts[PAGE_CONTRACT];
    expect(declared, `${PAGE_CONTRACT} mangler en underordnelsesliste`).toBeDefined();

    // Sorteret sammenligning: rækkefølgen i JSON'en er læsbarhed, ikke semantik.
    expect(
      [...(declared ?? [])].sort(),
      'underordnelseslisten er ikke identisk med det tværgående sæt (AGENTS.md § Kontrakthierarki)'
    ).toEqual([...topology.crossCuttingContracts].sort());
  });

  /**
   * To autoritative lister over samme forhold skal stemme overens.
   *
   * Fem kontrakter har et eget `Testkobling`-afsnit, som navngiver deres testsuiter — samtidig med at
   * `COVERAGE_MATRIX` her gør præcis det samme. Ingen kontrol sammenholdt dem, og de var faktisk
   * uenige: `app-shell-contract.md` §4 navngav tre suiter (`pwaHeaders.test.ts`,
   * `responsiveStylingRules.ts`, `verify-build-artifacts.mjs`), som matrixen ikke kendte;
   * `auth-gate-contract.md` og `calculation-data-contract.md` hver én. Alle filerne fandtes — så
   * uenigheden var ikke en død reference, men det værre tilfælde: to lister, en læser kunne slå op i og
   * få forskellige svar. Det er samme fejlklasse, som når topologien og AGENTS.md giver
   * forskellig kontraktprioritet.
   *
   * Retningen er INKLUSION, ikke lighed: matrixen er registret og skal kende hver suite, kontrakten
   * påberåber sig. Omvendt må matrixen gerne føre suiter, kontrakten ikke opremser — kontraktens
   * afsnit er prosa for en læser, matrixen er den maskinelt håndhævede liste.
   */
  it('hver testsuite, en kontrakt selv navngiver i sit Testkobling-afsnit, står også i matrixen', () => {
    const TEST_PATH_PATTERN = /`(src\/__tests__\/[A-Za-z0-9_./-]+\.(?:ts|tsx)|scripts\/[A-Za-z0-9_./-]+\.mjs)`/g;
    const contractsDir = path.resolve(process.cwd(), 'src/contracts');
    const matrixByContract = new Map(
      COVERAGE_MATRIX.map((entry) => [entry.contractPath, new Set(entry.requiredTestPaths)])
    );

    const problems: string[] = [];
    const contractsWithSection: string[] = [];
    let declaredTotal = 0;

    for (const fileName of fs.readdirSync(contractsDir).filter((name) => name.endsWith('.md'))) {
      if (fileName === 'contract-template.md') continue;
      const contractPath = `src/contracts/${fileName}`;
      const lines = fs.readFileSync(path.join(contractsDir, fileName), 'utf8').split(/\r?\n/);

      // Afsnittet løber fra sin egen overskrift til næste `##`-overskrift.
      // Ankret i begge ender: uden `$` matchede mønsteret også en OMDØBT overskrift
      // (`## 4. Testkobling-omdoebt`), så mutationstesten «fjern afsnittet» overlevede — parseren
      // troede stadig, den så et Testkobling-afsnit.
      //
      // Nummeret må bære et afsnitsbogstav (`## C2. Testkobling`): en kontrakt, der er delt i
      // navngivne afsnit, nummererer inden for sit afsnit. Uden det led så parseren ikke
      // dokument-output-kontraktens afsnit C, og den kontrakts suiter ville tavst holde op med at
      // blive afstemt mod matrixen.
      const start = lines.findIndex((line) => /^##\s+[A-Z]?\d+\.\s+Testkobling\s*$/i.test(line));
      if (start < 0) continue;
      contractsWithSection.push(contractPath);
      const rest = lines.slice(start + 1);
      const end = rest.findIndex((line) => /^##\s/.test(line));
      const body = (end < 0 ? rest : rest.slice(0, end)).join('\n');

      const declared = new Set([...body.matchAll(TEST_PATH_PATTERN)].map((match) => match[1]!));
      declaredTotal += declared.size;
      const inMatrix = matrixByContract.get(contractPath) ?? new Set<string>();
      for (const testPath of declared) {
        if (inMatrix.has(testPath)) continue;
        problems.push(
          `${contractPath} navngiver "${testPath}" i sit Testkobling-afsnit, men suiten står ikke i `
            + 'COVERAGE_MATRIX. To autoritative lister over samme forhold må ikke være uenige: tilføj den '
            + 'til matrixen, eller fjern den fra kontrakten.'
        );
      }
    }

    /**
     * Værn mod grøn-af-tomhed — og det skal være en EKSAKT liste, ikke et gulv.
     *
     * Første udgave brugte `toBeGreaterThanOrEqual(5)`. Mutationstesten viste, at den var ubrugelig:
     * omdøbes tre af afsnitsoverskrifterne, faldt antallet fra 6 til … 5, og testen forblev grøn,
     * mens parseren reelt var holdt op med at måle halvdelen af sit mål. Et gulv, der tilfældigvis er
     * lig virkeligheden, kan per konstruktion ikke se et tab. Den eksakte liste kan.
     *
     * Får en kontrakt med rette et nyt Testkobling-afsnit, er den røde test her netop stedet, hvor
     * beslutningen registreres — ikke en fejl at slå fra.
     */
    expect(
      contractsWithSection.sort(),
      'sættet af kontrakter med et Testkobling-afsnit har ændret sig — er et afsnit fjernet/omdøbt, '
        + 'eller er parseren holdt op med at genkende det?'
    ).toEqual([
      'src/contracts/app-shell-contract.md',
      'src/contracts/auth-gate-contract.md',
      'src/contracts/calculation-data-contract.md',
      'src/contracts/document-output-contract.md',
      'src/contracts/indskudte-loentillaeg-contract.md',
    ]);
    // Og afsnittene skal faktisk indeholde stier: en tom liste ville gøre sammenligningen vakuøs.
    expect(declaredTotal, 'ingen teststier blev udtrukket af afsnittene — mønsteret matcher intet').toBeGreaterThanOrEqual(20);
    expect(problems, problems.join('\n')).toEqual([]);
  });

  it('ingen anden kontrakt end page-component-kontrakten erklærer en underordnelsesliste', () => {
    // Gulvet gør en ny nøgle synlig: hierarkiet i AGENTS.md har præcis én underordnet kontrakt, og en
    // ny relation er en arkitekturbeslutning, der skal begrundes — ikke noget der kan glide ind.
    expect(Object.keys(getContractTopology().subordinateContracts))
      .toEqual(['src/contracts/page-component-contract.md']);
  });
});
