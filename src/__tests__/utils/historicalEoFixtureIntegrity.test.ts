import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const FIXTURE_DIRECTORY = resolve(process.cwd(), 'src/__tests__/fixtures/persistence');

/**
 * Hashene låser auditmaterialet til de committede bytes – de etablerer ikke i sig selv
 * releaseproveniens. En ændring af en fixture skal derfor være et bevidst testmaterialevalg.
 */
const HISTORICAL_FIXTURES = [
  {
    filename: 'legacy-unversioned-cross-section.eo',
    sha256: 'd3df292bdc17772afa7319565b93e94e1b6182acdd6d0b7e93bfcc8f3b1c6dd6',
  },
  {
    filename: '1.0.4-eo-aliases.eo',
    sha256: 'b81bcc89283486cf3efe51a32616a3eda16194146f06856ad82c63d8b2511fa0',
  },
  {
    filename: '3.10-derived-store-bededag.eo',
    sha256: '459db56cedfe119073eac6887952d0f5d4c7e19e95074a87c9d3b990c8d57506',
  },
  {
    filename: '3.12-predecessor.eo',
    sha256: '5c49907845bcd8587b6360a5852a61f64f4fbd1568363ff1fc3946343b89e562',
  },
  {
    filename: '3.13-current.eo',
    sha256: '8fe14b95469d4bf0bc90f8dd88fe7a1129153a67cc59f2bac92f7dbdf79a33a5',
  },
] as const;

describe('historiske .eo-fixtures – byteintegritet', () => {
  for (const fixture of HISTORICAL_FIXTURES) {
    it(`bevarer de committede bytes for ${fixture.filename}`, () => {
      const bytes = readFileSync(resolve(FIXTURE_DIRECTORY, fixture.filename));
      const actualSha256 = createHash('sha256').update(bytes).digest('hex');

      expect(actualSha256).toBe(fixture.sha256);
    });
  }
});
