/// <reference types="vitest/globals" />

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { jsPDF } from 'jspdf';

/**
 * Selv-test for det globale fs-værn i src/test/setup.ts.
 *
 * Værnet skal gøre det umuligt at skrive PDF/Word til disk under test. Disse
 * tests beviser, at værnet faktisk fanger en reel overtrædelse (ikke en
 * vacuous-pass): de forsøger ægte skrivninger og hævder, at PDF/docx blokeres,
 * mens andre filtyper går uændret igennem.
 *
 * Den mest kritiske test er `doc.save()`-stien: det er præcis den kode jsPDF's
 * Node-build kører, og som tidligere lagde rigtige PDF'er i projektroden.
 */
describe('Værn: ingen dokument-artefakter på disk under test', () => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'mineo-artefakt-guard-'));

  afterAll(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it('blokerer writeFileSync for .pdf', () => {
    const target = path.join(tmpDir, 'maa-ikke-skrives.pdf');
    expect(() => fs.writeFileSync(target, 'data')).toThrow(/forbudt under test/i);
    expect(fs.existsSync(target)).toBe(false);
  });

  it('blokerer writeFileSync for .docx (case-insensitivt)', () => {
    const target = path.join(tmpDir, 'maa-ikke-skrives.DOCX');
    expect(() => fs.writeFileSync(target, 'data')).toThrow(/forbudt under test/i);
    expect(fs.existsSync(target)).toBe(false);
  });

  it('blokerer den asynkrone writeFile-callback-sti (jsPDF promise-stien)', async () => {
    const target = path.join(tmpDir, 'async.pdf');
    await new Promise<void>((resolve, reject) => {
      fs.writeFile(target, 'data', (err) => {
        if (err) {
          resolve();
          return;
        }
        reject(new Error('writeFile skulle have rapporteret en fejl for .pdf'));
      });
    });
    expect(fs.existsSync(target)).toBe(false);
  });

  it('lader ikke-dokument-filer (fx .txt) gå uændret igennem', () => {
    const target = path.join(tmpDir, 'tilladt.txt');
    expect(() => fs.writeFileSync(target, 'ok')).not.toThrow();
    expect(fs.readFileSync(target, 'utf8')).toBe('ok');
  });

  it('fanger den faktiske rodårsag: jsPDF doc.save() skriver ikke til disk', () => {
    const doc = new jsPDF();
    doc.text('test', 10, 10);
    const target = path.join(tmpDir, 'rodaarsag.pdf');

    // jsPDF's Node-build implementerer save() som fs.writeFileSync(filnavn, ...).
    // Værnet skal gøre dette til en hård fejl i stedet for en disk-skrivning.
    expect(() => doc.save(target)).toThrow(/forbudt under test/i);
    expect(fs.existsSync(target)).toBe(false);
  });
});
