import fs from 'node:fs';
import path from 'node:path';

type CoverageEntry = Readonly<{
  contractPath: string;
  requiredTestPaths: readonly string[];
}>;

const COVERAGE_MATRIX: readonly CoverageEntry[] = [
  {
    contractPath: 'src/contracts/form-contract.md',
    requiredTestPaths: [
      'src/__tests__/hooks/useDraftField.test.tsx',
      'src/__tests__/components/inputs/tableCommitContract.test.tsx',
      'src/__tests__/rowDrafts/useRowDrafts.test.tsx',
    ],
  },
  {
    contractPath: 'src/contracts/domain-boundary-contract.md',
    requiredTestPaths: [
      'src/__tests__/quality/eetDomainIsolation.test.ts',
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
    contractPath: 'src/contracts/keyboard-navigation-test-checklist.md',
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
];

const assertFileExists = (relativePath: string): void => {
  const absolutePath = path.resolve(process.cwd(), relativePath);
  expect(fs.existsSync(absolutePath), `Mangler fil: ${relativePath}`).toBe(true);
};

describe('contract coverage matrix', () => {
  it('har mindst én koblet test-suite pr. normativ kontraktfil', () => {
    // NOTE: This is a structural guard only (contract <-> test linkage).
    // It does not prove semantic requirement-level coverage.
    for (const entry of COVERAGE_MATRIX) {
      assertFileExists(entry.contractPath);
      for (const testPath of entry.requiredTestPaths) {
        assertFileExists(testPath);
      }
    }
  });
});
