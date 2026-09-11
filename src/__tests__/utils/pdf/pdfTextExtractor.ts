import { inflateSync } from 'node:zlib';

const PDF_STREAM = new TextEncoder().encode('stream');
const PDF_ENDSTREAM = new TextEncoder().encode('endstream');
const PDF_FLATE_FILTER = /\/Filter\s*\/FlateDecode/;

const startsWith = (bytes: Uint8Array, needle: Uint8Array, offset: number): boolean => {
  if (offset < 0 || offset + needle.length > bytes.length) return false;
  return needle.every((byte, index) => bytes[offset + index] === byte);
};

const findBytes = (bytes: Uint8Array, needle: Uint8Array, from: number): number => {
  for (let offset = from; offset <= bytes.length - needle.length; offset += 1) {
    if (startsWith(bytes, needle, offset)) return offset;
  }
  return -1;
};

const decodePdfBytes = (bytes: readonly number[]): string => new TextDecoder('windows-1252').decode(new Uint8Array(bytes));

const skipWhiteSpace = (text: string, offset: number): number => {
  let nextOffset = offset;
  while (nextOffset < text.length && /\s/.test(text[nextOffset] ?? '')) nextOffset += 1;
  return nextOffset;
};

const parseLiteralString = (text: string, start: number): Readonly<{ value: string; nextOffset: number }> => {
  const bytes: number[] = [];
  let depth = 1;
  let offset = start + 1;

  while (offset < text.length) {
    const character = text[offset];
    if (character === '(') {
      depth += 1;
      bytes.push(character.charCodeAt(0));
      offset += 1;
      continue;
    }
    if (character === ')') {
      depth -= 1;
      if (depth === 0) {
        return { value: decodePdfBytes(bytes), nextOffset: offset + 1 };
      }
      bytes.push(character.charCodeAt(0));
      offset += 1;
      continue;
    }
    if (character !== '\\') {
      bytes.push(character.charCodeAt(0));
      offset += 1;
      continue;
    }

    offset += 1;
    const escaped = text[offset];
    if (escaped === undefined) break;
    const simpleEscape: Readonly<Record<string, number>> = {
      b: 8,
      f: 12,
      n: 10,
      r: 13,
      t: 9,
      '(': 40,
      ')': 41,
      '\\': 92,
    };
    const escapedByte = simpleEscape[escaped];
    if (escapedByte !== undefined) {
      bytes.push(escapedByte);
      offset += 1;
      continue;
    }
    if (escaped === '\n' || escaped === '\r') {
      if (escaped === '\r' && text[offset + 1] === '\n') offset += 1;
      offset += 1;
      continue;
    }
    if (/[0-7]/.test(escaped)) {
      let octal = escaped;
      offset += 1;
      while (octal.length < 3 && /[0-7]/.test(text[offset] ?? '')) {
        octal += text[offset];
        offset += 1;
      }
      bytes.push(Number.parseInt(octal, 8));
      continue;
    }
    bytes.push(escaped.charCodeAt(0));
    offset += 1;
  }

  throw new Error('PDF-teksten indeholder en uafsluttet literal string');
};

const parseHexString = (text: string, start: number): Readonly<{ value: string; nextOffset: number }> => {
  const end = text.indexOf('>', start + 1);
  if (end < 0) throw new Error('PDF-teksten indeholder en uafsluttet hex string');
  const digits = text.slice(start + 1, end).replace(/\s/g, '');
  const bytes: number[] = [];
  for (let offset = 0; offset < digits.length; offset += 2) {
    const pair = digits.slice(offset, offset + 2).padEnd(2, '0');
    bytes.push(Number.parseInt(pair, 16));
  }
  return { value: decodePdfBytes(bytes), nextOffset: end + 1 };
};

const parseTextOperators = (stream: Uint8Array): string[] => {
  // Bevar byteværdierne 1:1 under parsingen; først efter operatoren er fundet,
  // oversættes PDF'ens WinAnsi-byte til Unicode i decodePdfBytes.
  const text = new TextDecoder('latin1').decode(stream);
  const values: string[] = [];
  let offset = 0;

  while (offset < text.length) {
    if (text[offset] === '(' || text[offset] === '<') {
      const parsed = text[offset] === '('
        ? parseLiteralString(text, offset)
        : parseHexString(text, offset);
      const operatorOffset = skipWhiteSpace(text, parsed.nextOffset);
      if (text.startsWith('Tj', operatorOffset) && !/[A-Za-z0-9]/.test(text[operatorOffset + 2] ?? '')) {
        values.push(parsed.value);
      }
      offset = parsed.nextOffset;
      continue;
    }

    if (text[offset] === '[') {
      const parts: string[] = [];
      let arrayOffset = offset + 1;
      while (arrayOffset < text.length && text[arrayOffset] !== ']') {
        if (text[arrayOffset] === '(' || text[arrayOffset] === '<') {
          const parsed = text[arrayOffset] === '('
            ? parseLiteralString(text, arrayOffset)
            : parseHexString(text, arrayOffset);
          parts.push(parsed.value);
          arrayOffset = parsed.nextOffset;
        } else {
          arrayOffset += 1;
        }
      }
      const operatorOffset = skipWhiteSpace(text, arrayOffset + 1);
      if (text.startsWith('TJ', operatorOffset) && !/[A-Za-z0-9]/.test(text[operatorOffset + 2] ?? '')) {
        values.push(parts.join(''));
      }
      offset = arrayOffset + 1;
      continue;
    }

    offset += 1;
  }

  return values;
};

const trimStreamEnd = (bytes: Uint8Array): Uint8Array => {
  let end = bytes.length;
  while (end > 0 && (bytes[end - 1] === 10 || bytes[end - 1] === 13)) end -= 1;
  return bytes.slice(0, end);
};

const decodeStream = (pdf: Uint8Array, streamOffset: number, endStreamOffset: number): Uint8Array => {
  let contentOffset = streamOffset + PDF_STREAM.length;
  if (pdf[contentOffset] === 13 && pdf[contentOffset + 1] === 10) contentOffset += 2;
  else if (pdf[contentOffset] === 10 || pdf[contentOffset] === 13) contentOffset += 1;
  const encoded = trimStreamEnd(pdf.slice(contentOffset, endStreamOffset));

  const dictionaryStart = (() => {
    const searchStart = Math.max(0, streamOffset - 4096);
    let candidate = -1;
    for (let offset = searchStart; offset < streamOffset - 1; offset += 1) {
      if (pdf[offset] === 60 && pdf[offset + 1] === 60) candidate = offset;
    }
    return candidate;
  })();
  const dictionary = dictionaryStart >= 0
    ? new TextDecoder('latin1').decode(pdf.slice(dictionaryStart, streamOffset))
    : '';
  if (!PDF_FLATE_FILTER.test(dictionary)) return encoded;
  return new Uint8Array(inflateSync(encoded));
};

/**
 * Udtrækker tekst fra jsPDFs egne content streams til testbrug.
 * Dette er med vilje ikke en generel PDF-parser: testen beviser Mineos tekstkanal
 * og accepterer kun de literal/hex text operators, som jsPDF-writeren producerer.
 */
export const extractPdfText = async (artifact: Blob): Promise<string> => {
  const pdf = new Uint8Array(await artifact.arrayBuffer());
  const header = new TextDecoder('latin1').decode(pdf.slice(0, 8));
  if (!header.startsWith('%PDF-')) throw new Error('PDF-artefaktet mangler en PDF-header');

  const streams: string[] = [];
  let searchOffset = 0;
  while (true) {
    const streamOffset = findBytes(pdf, PDF_STREAM, searchOffset);
    if (streamOffset < 0) break;
    const endStreamOffset = findBytes(pdf, PDF_ENDSTREAM, streamOffset + PDF_STREAM.length);
    if (endStreamOffset < 0) throw new Error('PDF-artefaktet mangler endstream');
    streams.push(...parseTextOperators(decodeStream(pdf, streamOffset, endStreamOffset)));
    searchOffset = endStreamOffset + PDF_ENDSTREAM.length;
  }
  return streams.join(' ');
};
