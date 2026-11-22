import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

// BB-436: en låst sats (fx Store Bededagstillæg 0,45 % eller en SH/SO-sats fastsat af overenskomsten) indgår i
// beregningen og skal kunne læses. I mørkt tema var den låste tekst 0,16 hvid – ca. 1,7:1 mod feltets baggrund.
// Testen læser tokenerne fra `layout.css` og hævder, at den låste tekst i begge temaer når mindst 3:1 (WCAG's
// grænse for ikke-tekst og stor tekst) – og at den låste baggrund stadig adskiller sig fra den almindelige.

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..', '..');
const layoutCss = readFileSync(resolve(repoRoot, 'src/styles/layout.css'), 'utf8');

const readBlock = (selector: string): Map<string, string> => {
  const start = layoutCss.indexOf(`${selector} {`);
  if (start < 0) throw new Error(`Blokken ${selector} findes ikke i layout.css`);
  const body = layoutCss.slice(start, layoutCss.indexOf('}', start));
  const tokens = new Map<string, string>();
  for (const match of body.matchAll(/(--[\w-]+)\s*:\s*([^;]+);/g)) {
    const [, name, value] = match;
    if (name !== undefined && value !== undefined) tokens.set(name, value.trim());
  }
  return tokens;
};

const light = readBlock(':root');
const dark = new Map([...light, ...readBlock(":root[data-mineo-theme='dark']")]);

type Rgba = Readonly<{ r: number; g: number; b: number; a: number }>;

const resolveToken = (tokens: Map<string, string>, name: string): string => {
  const value = tokens.get(name);
  if (value === undefined) throw new Error(`Tokenet ${name} mangler`);
  const reference = /^var\((--[\w-]+)\)$/.exec(value);
  return reference?.[1] === undefined ? value : resolveToken(tokens, reference[1]);
};

const parseColor = (value: string): Rgba => {
  const hex = /^#([0-9a-f]{6})$/i.exec(value)?.[1];
  if (hex !== undefined) {
    return { r: parseInt(hex.slice(0, 2), 16), g: parseInt(hex.slice(2, 4), 16), b: parseInt(hex.slice(4, 6), 16), a: 1 };
  }
  const rgba = /^rgba\((\d+),\s*(\d+),\s*(\d+),\s*([\d.]+)\)$/.exec(value);
  if (rgba === null) throw new Error(`Ukendt farveformat: ${value}`);
  return { r: Number(rgba[1]), g: Number(rgba[2]), b: Number(rgba[3]), a: Number(rgba[4]) };
};

const over = (top: Rgba, bottom: Rgba): Rgba => ({
  r: top.r * top.a + bottom.r * (1 - top.a),
  g: top.g * top.a + bottom.g * (1 - top.a),
  b: top.b * top.a + bottom.b * (1 - top.a),
  a: 1,
});

const luminance = ({ r, g, b }: Rgba): number => {
  const channel = (c: number): number => {
    const s = c / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b);
};

const contrast = (a: Rgba, b: Rgba): number => {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x) as [number, number];
  return (hi + 0.05) / (lo + 0.05);
};

/** Den låste tekst over den låste baggrund, som igen ligger over sidens felt-/kortbaggrund. */
const lockedTextContrast = (tokens: Map<string, string>, pageBackground: Rgba): number => {
  const background = over(parseColor(resolveToken(tokens, '--color-input-disabled-locked-bg')), pageBackground);
  const text = over(parseColor(resolveToken(tokens, '--color-input-disabled-locked-text')), background);
  return contrast(text, background);
};

describe('layout.css – låst felttekst', () => {
  it('er læselig i mørkt tema (BB-436)', () => {
    const pageBackground = parseColor(resolveToken(dark, '--color-background-white'));
    expect(lockedTextContrast(dark, pageBackground)).toBeGreaterThanOrEqual(3);
  });

  it('er læselig i lyst tema', () => {
    expect(lockedTextContrast(light, { r: 255, g: 255, b: 255, a: 1 })).toBeGreaterThanOrEqual(3);
  });

  it('bevarer den låste markering: egen baggrund i begge temaer', () => {
    expect(resolveToken(dark, '--color-input-disabled-locked-bg')).not.toBe(resolveToken(dark, '--color-input-disabled-bg'));
    expect(resolveToken(light, '--color-input-disabled-locked-bg')).not.toBe(resolveToken(light, '--color-input-disabled-bg'));
  });
});
