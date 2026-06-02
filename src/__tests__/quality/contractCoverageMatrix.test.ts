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
    contractPath: 'src/contracts/form-contract.md',
    requiredTestPaths: [
      'src/__tests__/quality/formContractIsolation.test.ts',
      'src/__tests__/hooks/useDraftField.test.tsx',
      'src/__tests__/components/inputs/tableCommitContract.test.tsx',
      'src/__tests__/rowDrafts/useRowDrafts.test.tsx',
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
      'src/__tests__/quality/persistenceAccessIsolation.test.ts',
      'src/__tests__/quality/persistenceCommittedMirrorIsolation.test.ts',
      'src/__tests__/quality/sessionStorageBoundaryIsolation.test.ts',
      'src/__tests__/utils/persistenceLoadApply.test.ts',
      'src/__tests__/utils/persistenceSnapshotStorage.test.ts',
      'src/__tests__/utils/safeSessionStorage.test.ts',
    ],
  },
  {
    contractPath: 'src/contracts/schema-evolution.md',
    requiredTestPaths: [
      'src/__tests__/config/persistenceVersionDrift.test.ts',
      'src/__tests__/config/persistenceRegistry.test.ts',
      'src/__tests__/utils/persistenceLoadSanitization.test.ts',
    ],
  },
  {
    contractPath: 'src/contracts/page-component-contract.md',
    requiredTestPaths: [
      'src/__tests__/quality/domainBoundaryIsolation.test.ts',
      'src/__tests__/quality/persistenceAccessIsolation.test.ts',
    ],
  },
  {
    contractPath: 'src/contracts/keyboard-navigation.md',
    requiredTestPaths: [
      'src/__tests__/components/layout/Container.test.tsx',
      'src/__tests__/components/tables/tableKeyboardNavigation.looseNavigation.test.tsx',
    ],
  },
  {
    contractPath: 'src/contracts/pdf-contract.md',
    requiredTestPaths: [
      'src/__tests__/quality/pdfDownloadCommittedStateGuard.test.ts',
      'src/__tests__/utils/pdf/pdfService.downloadFunctions.test.ts',
    ],
  },
  {
    contractPath: 'src/contracts/pdf-layout-contract.md',
    requiredTestPaths: [
      'src/__tests__/quality/pdfPseudoTableGuard.test.ts',
      'src/__tests__/utils/pdf/pdfTableRenderer.layout.test.ts',
      'src/__tests__/utils/pdf/pdfWriter.test.ts',
    ],
  },
  {
    contractPath: 'src/contracts/periodisering-contract.md',
    requiredTestPaths: [
      'src/__tests__/domain/erstatningsopgoerelse/periodiseringsMotor.test.ts',
      'src/__tests__/domain/erstatningsopgoerelse/periodMerging.test.ts',
      'src/__tests__/utils/periodeBeregning.test.ts',
    ],
  },
  {
    contractPath: 'src/contracts/eo-snapshot-contract.md',
    requiredTestPaths: [
      'src/__tests__/domain/erstatningsopgoerelse/eoSnapshot.test.ts',
      'src/__tests__/domain/erstatningsopgoerelse/eoSnapshotPdfProjection.test.ts',
      'src/__tests__/domain/erstatningsopgoerelse/eoSnapshotToDebugView.test.ts',
    ],
  },
  {
    contractPath: 'src/contracts/eet-snapshot-contract.md',
    requiredTestPaths: [
      'src/__tests__/domain/erhvervsevnetab/eetSnapshot.test.ts',
    ],
  },
  {
    contractPath: 'src/contracts/forsoergertab-snapshot-contract.md',
    requiredTestPaths: [
      'src/__tests__/domain/forsoergertab/forsoergertabSnapshot.test.ts',
    ],
  },
  {
    contractPath: 'src/contracts/aarsloen-contract.md',
    requiredTestPaths: [
      'src/__tests__/domain/aarsloen/aarsloenCalculations.test.ts',
      'src/__tests__/domain/aarsloen/aarsloenValidationPolicies.test.ts',
      'src/__tests__/hooks/useAarsloenPdfGates.test.tsx',
    ],
  },
  {
    contractPath: 'src/contracts/renteberegning-contract.md',
    requiredTestPaths: [
      'src/__tests__/domain/renteberegning/renteberegningEngine.test.ts',
      'src/__tests__/domain/renteberegning/procesrenteCalculator.test.ts',
      'src/__tests__/components/pages/Renteberegning.pdfDownload.test.tsx',
    ],
  },
  {
    contractPath: 'src/contracts/varigemen-contract.md',
    requiredTestPaths: [
      'src/__tests__/domain/varigemen/varigeMenEngine.test.ts',
      'src/__tests__/components/pages/varigemen/MenberegningTab.pdfStamdataConsistency.test.tsx',
    ],
  },
  {
    contractPath: 'src/contracts/satser-contract.md',
    requiredTestPaths: [
      'src/__tests__/domain/calculations/satserCalculations.test.ts',
      'src/__tests__/stores/formPersistenceStore.satser.test.ts',
    ],
  },
  {
    contractPath: 'src/contracts/amount-contract.md',
    requiredTestPaths: [
      'src/__tests__/utils/amountInputUtils.test.ts',
      'src/__tests__/schemas/amountExpressionSchema.test.ts',
      'src/__tests__/components/tables/BeregnetRenteTable.amountfield.test.tsx',
    ],
  },
  {
    contractPath: 'src/contracts/undo-redo-contract.md',
    requiredTestPaths: [
      'src/__tests__/stores/undoRedoStore.test.ts',
      'src/__tests__/components/layout/MainLayout.undoRedoEditorGuard.test.tsx',
    ],
  },
  {
    contractPath: 'docs/testing/keyboard-navigation-test-checklist.md',
    requiredTestPaths: [
      'src/__tests__/components/layout/Container.test.tsx',
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
    contractPath: 'src/contracts/error-debug-contract.md',
    requiredTestPaths: [
      'src/__tests__/quality/errorDebugContractIsolation.test.ts',
      'src/__tests__/hooks/useFormFieldErrors.test.tsx',
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
      'src/__tests__/hooks/useDraftField.test.tsx',
      'src/__tests__/components/inputs/StyledAmountField.expression.test.tsx',
    ],
  },
  {
    contractPath: 'src/contracts/auth-gate-contract.md',
    requiredTestPaths: [
      'src/__tests__/auth/auth.test.ts',
      'src/__tests__/quality/authGateContractIsolation.test.ts',
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
    const classifiedBaseContracts = new Set([
      ...topology.crossCuttingContracts,
      ...topology.domainContracts,
      ...Object.keys(topology.subordinateContracts),
    ]);

    for (const contractPath of topologyContracts) {
      expect(matrixContracts.has(contractPath), `Mangler dækningsmatrix-entry for ${contractPath}`).toBe(true);
    }

    for (const [contractPath, parentContracts] of Object.entries(topology.subordinateContracts)) {
      expect(classifiedBaseContracts.has(contractPath), `Underordnet kontrakt er ikke selv klassificeret: ${contractPath}`).toBe(true);
      for (const parentContract of parentContracts) {
        expect(classifiedBaseContracts.has(parentContract), `Underordnet reference er ikke klassificeret: ${parentContract}`).toBe(true);
      }
    }

    const nonTopologyMatrixEntries = new Set([
      'src/contracts/contract-topology.json',
      'docs/testing/keyboard-navigation-test-checklist.md',
    ]);
    for (const contractPath of matrixContracts) {
      if (nonTopologyMatrixEntries.has(contractPath)) continue;
      expect(topologyContracts.has(contractPath), `Mangler topologi-klassifikation for ${contractPath}`).toBe(true);
    }
  });
});
