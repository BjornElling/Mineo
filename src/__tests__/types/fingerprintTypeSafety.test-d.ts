import type { AmountFingerprint, DateFingerprint, ParserSpec } from '../../components/inputs/shared/parserSpec';

declare const amountFingerprint: AmountFingerprint;
declare const dateFingerprint: DateFingerprint;

const _sameTypeAssignment: AmountFingerprint = amountFingerprint;

// @ts-expect-error DateFingerprint må ikke kunne assignes til AmountFingerprint
const _crossTypeAssignment: AmountFingerprint = dateFingerprint;

declare const amountParserSpec: ParserSpec<number, string, AmountFingerprint>;
declare const dateParserSpec: ParserSpec<string, string, DateFingerprint>;

const _amountEmptyFingerprint: AmountFingerprint = amountParserSpec.empty.fingerprint;
const _dateEmptyFingerprint: DateFingerprint = dateParserSpec.empty.fingerprint;

// @ts-expect-error ParserSpec med DateFingerprint må ikke kunne assignes til AmountFingerprint-parser
const _crossTypeParserSpec: ParserSpec<number, string, AmountFingerprint> = dateParserSpec;

void _sameTypeAssignment;
void _amountEmptyFingerprint;
void _dateEmptyFingerprint;
