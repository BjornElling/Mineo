import { execFileSync, spawnSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

const script = resolve('scripts/check-line-endings.mjs');
const attributes = readFileSync('.gitattributes');
let directory: string;
const git = (...args: string[]) => execFileSync('git', args, { cwd: directory });
const write = (file: string, content: string | Buffer) => writeFileSync(join(directory, file), content);
const check = (...args: string[]) => spawnSync(process.execPath, [script, ...args], {
  cwd: directory,
  encoding: 'utf8',
});

describe('LF-kontrol af disk og Git-index', () => {
  beforeEach(() => {
    directory = mkdtempSync(join(tmpdir(), 'mineo-lf-'));
    git('init', '--quiet');
    git('config', 'core.autocrlf', 'true');
    // Den levende Git-regel skal også forhindre CRLF ved checkout på Windows.
    write('.gitattributes', attributes);
    git('add', '.gitattributes');
  });
  afterEach(() => rmSync(directory, { recursive: true, force: true }));

  it('bevarer LF ved checkout trods core.autocrlf=true', () => {
    write('tekst med æ.txt', 'første\nanden\n');
    git('add', '.');
    git('checkout-index', '--force', '--all');
    expect(readFileSync(join(directory, 'tekst med æ.txt'), 'utf8')).toBe('første\nanden\n');
    expect(check().status).toBe(0);
  });

  it('fanger nye filer uden filendelse og retter kun CRLF', () => {
    write('ny fil', 'første\r\nanden\n');
    const result = check();
    expect(result.status).toBe(1);
    expect(result.stderr).toContain('Disk: ny fil');
    expect(check('--fix').status).toBe(0);
    expect(readFileSync(join(directory, 'ny fil'), 'utf8')).toBe('første\nanden\n');
  });

  it('fanger et forkert staged indhold selv med en korrekt fil på disken', () => {
    write('delvis.txt', 'forkert\r\n');
    const hash = git('hash-object', '-w', '--no-filters', 'delvis.txt').toString().trim();
    git('update-index', '--add', '--cacheinfo', `100644,${hash},delvis.txt`);
    write('delvis.txt', 'korrekt\n');
    const result = check('--fix');
    expect(result.status).toBe(1);
    expect(result.stderr).toContain('Index (stage 0): delvis.txt');
    expect(git('show', ':delvis.txt').toString()).toBe('forkert\r\n');
    git('add', 'delvis.txt');
    expect(check().status).toBe(0);
  });

  it('bevarer binære bytes og ignorerede nye filer', () => {
    const binary = Buffer.from([0, 13, 10, 255]);
    write('billede', binary);
    const controls = Buffer.from([1, 2, 3, 4, 5, 13, 10]);
    write('ukendt.dat', controls);
    write('dokument.pdf', 'ASCII-indhold\r\n');
    write('.gitignore', 'ignoreret\n');
    write('ignoreret', 'tekst\r\n');
    git('add', '.');
    expect(check('--fix').status).toBe(0);
    expect(readFileSync(join(directory, 'billede'))).toEqual(binary);
    expect(readFileSync(join(directory, 'ukendt.dat'))).toEqual(controls);
    expect(readFileSync(join(directory, 'dokument.pdf'), 'utf8')).toBe('ASCII-indhold\r\n');
    expect(readFileSync(join(directory, 'ignoreret'), 'utf8')).toBe('tekst\r\n');
  });

  it('bruger staged attributter til staged indhold', () => {
    write('delvis.txt', 'forkert\r\n');
    const hash = git('hash-object', '-w', '--no-filters', 'delvis.txt').toString().trim();
    git('update-index', '--add', '--cacheinfo', `100644,${hash},delvis.txt`);
    write('.gitattributes', `${attributes.toString()}\ndelvis.txt -text\n`);
    const result = check();
    expect(result.status).toBe(1);
    expect(result.stderr).toContain('Index (stage 0): delvis.txt');
    expect(result.stderr).not.toContain('Disk: delvis.txt');
  });

  it('afviser enkeltstående CR uden at ændre det automatisk', () => {
    write('gammel.txt', 'første\randen');
    expect(check('--fix').status).toBe(1);
    expect(readFileSync(join(directory, 'gammel.txt'), 'utf8')).toBe('første\randen');
  });

  it('tillader slettede filer og tomme tekstfiler', () => {
    write('slettes.txt', 'tekst\n');
    write('tom', '');
    git('add', '.');
    rmSync(join(directory, 'slettes.txt'));
    expect(check().status).toBe(0);
    git('add', '-u');
    expect(check().status).toBe(0);
  });
});
