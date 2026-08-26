import {
  FILE_FORMAT_VERSION,
  SUPPORTED_FILE_FORMAT_VERSIONS,
} from '../../config/version';
import {
  PERSISTED_DATA_VERSION,
  PERSISTED_DATA_VERSION_HISTORY,
} from '../../config/persistenceVersion';

/**
 * Minimumhistorik fra de versioner, der allerede har kunnet skrive Mineo-data.
 * Listen er bevidst testdata og må ikke forkortes: et grønt versionsbump må ikke
 * kunne fjerne et gammelt format fra den aktive load-kontrakt.
 */
const RELEASED_PERSISTED_DATA_VERSIONS = [
  'legacy-unversioned',
  '1.0.0', '1.0.1', '1.0.2', '1.0.3', '1.0.4', '1.0.5', '1.0.6', '1.0.7', '1.0.8',
  '1.0', '1.1', '1.2', '1.3', '1.4', '1.6', '1.8', '1.9', '2.0',
  '3.0', '3.1', '3.2', '3.3', '3.4', '3.5', '3.6', '3.7', '3.8', '3.9', '3.10', '3.11', '3.12',
] as const;

describe('persistenceCompatibility', () => {
  it('holder den aktuelle persisted-data-version i den historiske load-kontrakt', () => {
    expect(Array.from(PERSISTED_DATA_VERSION_HISTORY)).toContain(PERSISTED_DATA_VERSION);
    expect(new Set(PERSISTED_DATA_VERSION_HISTORY).size).toBe(PERSISTED_DATA_VERSION_HISTORY.length);
    expect(Array.from(PERSISTED_DATA_VERSION_HISTORY)).toEqual(
      expect.arrayContaining(Array.from(RELEASED_PERSISTED_DATA_VERSIONS))
    );
  });

  it('holder den aktuelle filformat-version blandt de understøttede container-versioner', () => {
    expect(Array.from(SUPPORTED_FILE_FORMAT_VERSIONS)).toContain(FILE_FORMAT_VERSION);
    expect(new Set(SUPPORTED_FILE_FORMAT_VERSIONS).size).toBe(SUPPORTED_FILE_FORMAT_VERSIONS.length);
    expect(Array.from(SUPPORTED_FILE_FORMAT_VERSIONS)).toEqual(expect.arrayContaining(['1.0.0']));
  });
});
