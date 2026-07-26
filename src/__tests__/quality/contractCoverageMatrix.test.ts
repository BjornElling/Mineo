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
    ],
  },
  {
    contractPath: 'src/contracts/form-contract.md',
    requiredTestPaths: [
      'src/__tests__/quality/formContractIsolation.test.ts',
      // Greenfield-cutover: `useDraftField`/`Table*Input`/`useRowDrafts`-implementeringstestene er slettet
      // sammen med den legacy feltvej. Feltkontrakten dækkes nu af editor-/surface-kontrakttestene.
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
      // Greenfield-cutover (WI-002): den legacy `legacyGridTransactionBridge`/`inputSessionMigration` er slettet
      // (browser-sessionmigration er et ikke-mål, §2.6). `.eo`-save/load/apply-grænsen dækkes nu af caseportene.
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
    ],
  },
  {
    contractPath: 'src/contracts/document-format-contract.md',
    requiredTestPaths: [
      'src/__tests__/settings/appSettingsSchema.test.ts',
      'src/__tests__/document/documentFileName.test.ts',
      'src/__tests__/docx/docxWriter.test.ts',
      // Fase 5: formatvalget sker i miljøet EFTER gaten, og outputnavne må ikke bære et
      // formatsuffiks (den gamle `/PDF/g`-substitution er væk). Begge dele måles her.
      'src/__tests__/document/documentCatalogCompleteness.test.ts',
    ],
  },
  {
    contractPath: 'src/contracts/document-output-contract.md',
    requiredTestPaths: [
      // Download-committed-state-grænsen håndhæves nu af det AST-baserede harness.
      'src/__tests__/quality/architecture/architectureRules.test.ts',
      // Fase 5: ét kanonisk katalog med præcis én definition pr. output (§A2a).
      'src/__tests__/document/documentCatalogCompleteness.test.ts',
      // Den udtømmende matrix, delt i livscyklus-cases (definitionsuafhængige) og gate-cases
      // (per-definition, med `invalid` og `bounds` som SEPARATE klasser jf. §A2a).
      'src/__tests__/document/documentLifecycleMatrix.test.ts',
      'src/__tests__/document/documentGateMatrix.test.ts',
      // Hele livscyklussen end-to-end gennem den rigtige side og den ægte runtime.
      'src/__tests__/components/pages/Satser.downloadGate.integration.test.tsx',
      'src/__tests__/quality/pdfPseudoTableGuard.test.ts',
      'src/__tests__/utils/pdf/pdfTableRenderer.layout.test.ts',
      'src/__tests__/utils/pdf/pdfWriter.test.ts',
      // Word-kanalens paritet mod det fælles writer-API (Afsnit B + §5):
      'src/__tests__/docx/docxWriter.test.ts',
      // Datoformat-værnet (A7a): rå ISO-dato må aldrig nå et dokument:
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
      // Fase 5: årsløns- og SH-dage-gaten flyttede fra `useAarsloenDocumentGates` til domænelaget.
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
      'src/__tests__/quality/dateContractGuard.test.ts',
      'src/__tests__/utils/utcDayMath.test.ts',
    ],
  },
  {
    contractPath: 'src/contracts/error-contract.md',
    requiredTestPaths: [
      'src/__tests__/quality/errorContractIsolation.test.ts',
      // Greenfield-cutover (WI-002): den legacy `useFormFieldErrors`-implementeringstest er slettet. §1.6-issue-
      // modellen (feltfejl/consumerfejl/warning, rød-felt-maskering, strukturel save-sondring) dækkes af kernen.
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
    contractPath: 'src/contracts/auth-gate-contract.md',
    requiredTestPaths: [
      'src/__tests__/auth/auth.test.ts',
      'src/__tests__/quality/authGateContractIsolation.test.ts',
    ],
  },
  {
    contractPath: 'src/contracts/app-shell-contract.md',
    requiredTestPaths: [
      'src/__tests__/quality/minprocesrenteStandaloneIsolation.test.ts',
      'src/__tests__/apps/shared/bootstrapClientApp.test.tsx',
      'src/__tests__/apps/mineo/serviceWorkerBootstrap.test.ts',
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
});
