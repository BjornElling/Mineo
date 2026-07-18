// Værn mod regression i grid-tabellernes row-id-fundament.
//
// Tabellerne er beregningskædens indgang. To alvorlige row-id-fejl er observeret historisk:
//   1. RNG (createRowId/crypto/Math.random/Date.now) brugt til at danne en TOM rækkes id inde i en
//      setState-updater. StrictMode dobbelt-invokerer updateren → de to kørsler giver divergerende
//      id'er → id-følsomt persist-fingerprint divergerer → ryddet celle gemmes aldrig (datatab).
//      (project_table_row_id_persist_desync — fikset med deterministisk createEmptyRowId.)
//   2. resync-reconcile flyttede/aliaserede et id ind så det duplikerede et senere incoming-id →
//      to rækker med samme id → React duplicate-key + datakorruption.
//      (project_reconcile_rowid_dup — fikset med uniqueness-guard i selve funktionen.)
//
// Denne guard håndhæver de STRUKTURELLE forudsætninger for at begge fixes forbliver virksomme,
// så en NY grid-tabel (eller en refaktor af en eksisterende) ikke kan genindføre fejlklasserne
// ubemærket:
//   A. Enhver tabel der bruger normalizeGridRows SKAL danne sine tomme rækker via createEmptyRowId
//      (deterministisk), og må ikke bruge en RNG-id-kilde i sin createEmptyRow.
//   B. Uniqueness-guarden i reconcileGridRowIdentityForRestore skal være intakt (verificeret adfærdsmæssigt
//      i gridModelNormalize.test.ts / gridModelReconcile.test.ts — her kun en eksistens-vagt på
//      kildemønstret, så en refaktor der fjerner guarden bliver bemærket).
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import {
  normalizeGridRows,
  reconcileGridRowIdentityForRestore,
} from '../../components/tables/gridCore/gridModel';
import { createEmptyRowId } from '../../utils/rowId';

const TABLES_DIR = join(process.cwd(), 'src', 'components', 'tables');

// RNG-id-kilder der ALDRIG må danne en tom rækkes id (bryder determinisme-kontrakten).
const RNG_ID_SOURCES = [/createRowId\s*\(/, /crypto\./, /Math\.random\s*\(/, /Date\.now\s*\(/];

const collectTsx = (dir: string): string[] => {
  const out: string[] = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) {
      out.push(...collectTsx(full));
    } else if (entry.endsWith('.tsx')) {
      out.push(full);
    }
  }
  return out;
};

// Udtræk kroppen af en `createEmptyRow`-callback (op til balanceret slut-brace). Returnerer
// alle fundne kroppe i filen (typisk én pr. grid-tabel).
const extractCreateEmptyRowBodies = (source: string): string[] => {
  const bodies: string[] = [];
  const re = /createEmptyRow\s*[:=]\s*[^=]*?=>\s*[({]/g;
  let match: RegExpExecArray | null;
  while ((match = re.exec(source)) !== null) {
    // Start ved den åbnende brace/paren efter pilen.
    let i = match.index + match[0].length - 1;
    const open = source[i];
    const close = open === '{' ? '}' : ')';
    let depth = 0;
    const start = i;
    for (; i < source.length; i += 1) {
      const ch = source[i];
      if (ch === open) depth += 1;
      else if (ch === close) {
        depth -= 1;
        if (depth === 0) break;
      }
    }
    bodies.push(source.slice(start, i + 1));
  }
  return bodies;
};

describe('grid row-id-kontrakt (struktur-guard)', () => {
  const tableFiles = collectTsx(TABLES_DIR);
  const gridTableFiles = tableFiles.filter((f) => /\bnormalizeGridRows\s*\(/.test(readFileSync(f, 'utf8')));

  it('ingen produktionstabel bruger længere den legacy normalizeGridRows-ejede værdikopi', () => {
    expect(gridTableFiles).toEqual([]);
  });

  it('hver grid-tabel danner tomme rækker via createEmptyRowId (deterministisk)', () => {
    const offenders: string[] = [];
    for (const file of gridTableFiles) {
      const source = readFileSync(file, 'utf8');
      const rel = file.replace(process.cwd(), '').replace(/\\/g, '/');
      const bodies = extractCreateEmptyRowBodies(source);
      if (bodies.length === 0) {
        offenders.push(`${rel}: ingen createEmptyRow-callback fundet (kan ikke verificere id-kilden)`);
        continue;
      }
      for (const body of bodies) {
        if (!/createEmptyRowId\s*\(/.test(body)) {
          offenders.push(`${rel}: createEmptyRow uden createEmptyRowId:\n  ${body.replace(/\s+/g, ' ').slice(0, 160)}`);
        }
        for (const rng of RNG_ID_SOURCES) {
          if (rng.test(body)) {
            offenders.push(`${rel}: createEmptyRow bruger RNG-id-kilde (${rng.source}) — bryder determinisme:\n  ${body.replace(/\s+/g, ' ').slice(0, 160)}`);
          }
        }
      }
    }
    expect(offenders, `Grid-tabeller med ikke-deterministisk tom-række-id:\n${offenders.join('\n')}`).toEqual([]);
  });

  it('reconcileGridRowIdentityForRestore har stadig sin uniqueness-guard (kildemønster)', () => {
    const source = readFileSync(
      join(process.cwd(), 'src', 'components', 'tables', 'gridCore', 'gridModel.ts'),
      'utf8'
    );
    // Guarden består i at springe en graft over når mål-id'et enten tilhører en anden
    // incoming-række (ville stjæle dens identitet) eller allerede er brugt som graft-mål.
    expect(/incomingIds\.has\(/.test(source)).toBe(true);
    expect(/usedTransferredIds\.has\(/.test(source)).toBe(true);
  });

  // Selv-test: bevis at mønstrene faktisk fanger overtrædelser OG accepterer ren kode (vacuous-pass-værn).
  describe('mønstrene er ikke inerte (selv-test mod syntetiske overtrædelser)', () => {
    it('createEmptyRowId-kravet fanger en RNG-baseret tom-række', () => {
      const violation = 'const createEmptyRow = (seed) => ({ ...init, id: createRowId("row") });';
      const bodies = extractCreateEmptyRowBodies(violation);
      expect(bodies.length).toBe(1);
      expect(/createEmptyRowId\s*\(/.test(bodies[0])).toBe(false);
      expect(RNG_ID_SOURCES.some((p) => p.test(bodies[0]))).toBe(true);
    });

    it('createEmptyRowId-kravet accepterer en deterministisk tom-række', () => {
      const ok = 'const createEmptyRow = (seed: number) => ({ ...init, id: createEmptyRowId("row", seed) });';
      const bodies = extractCreateEmptyRowBodies(ok);
      expect(bodies.length).toBe(1);
      expect(/createEmptyRowId\s*\(/.test(bodies[0])).toBe(true);
      expect(RNG_ID_SOURCES.some((p) => p.test(bodies[0]))).toBe(false);
    });

    it('extractCreateEmptyRowBodies klarer både paren- og brace-kroppe', () => {
      const arrowParen = 'createEmptyRow: (seed) => ({ id: createEmptyRowId("x", seed) })';
      const arrowBrace = 'createEmptyRow = (seed) => { return { id: createEmptyRowId("y", seed) }; }';
      expect(extractCreateEmptyRowBodies(arrowParen).length).toBe(1);
      expect(extractCreateEmptyRowBodies(arrowBrace).length).toBe(1);
      expect(extractCreateEmptyRowBodies(arrowBrace)[0]).toContain('createEmptyRowId("y", seed)');
    });
  });

  // Bind guarden til den faktiske runtime-adfærd, så den ikke kun er et tekstmønster:
  // de importerede funktioner skal stadig opretholde unikhed.
  it('runtime-bekræftelse: normalize + reconcile bevarer unikhed på det historiske fejl-scenarie', () => {
    type Row = { id: string; v?: string };
    const getRowId = (r: Row) => r.id;
    const isRowEmpty = (r: Row) => r.v === undefined;
    const withRowId = (r: Row, id: string): Row => ({ ...r, id });
    const createEmptyRow = (seed: number): Row => ({ id: createEmptyRowId('row', seed) });

    const current: Row[] = [{ id: 'a', v: 'x' }, { id: 'row_empty_3' }];
    const inserted: Row[] = [...current.slice(0, 1), { id: 'ny', v: 'y' }, current[1]];
    const normalized = normalizeGridRows({ rows: inserted, minRows: 2, getRowId, isRowEmpty, createEmptyRow });
    const reconciled = reconcileGridRowIdentityForRestore({ incoming: normalized, current, getRowId, isRowEmpty, withRowId });
    const idList = reconciled.rows.map(getRowId);
    expect(new Set(idList).size).toBe(idList.length);
  });
});
