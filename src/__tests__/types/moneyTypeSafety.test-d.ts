import type { MoneyOre } from '../../domain/money/money';

declare const left: MoneyOre;
declare const right: MoneyOre;

const _readableAsNumber: number = left;

// @ts-expect-error Et råt tal er ikke et valideret ørebeløb.
const _rawNumber: MoneyOre = 100;

// @ts-expect-error Rå addition mister enhedsbeviset; brug addMoneyOre.
const _rawAddition: MoneyOre = left + right;

// @ts-expect-error Rå subtraktion mister enhedsbeviset; brug subtractMoneyOre.
const _rawSubtraction: MoneyOre = left - right;

// @ts-expect-error Rå skalering mister enhedsbeviset; brug scaleMoneyOre.
const _rawScale: MoneyOre = left * 0.5;

void _readableAsNumber;
void _rawNumber;
void _rawAddition;
void _rawSubtraction;
void _rawScale;
