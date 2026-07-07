import type {
  KildeReguleringsInterval,
  ReguleringForm,
  ResolvedStrategi,
} from '../reguleringForm';

// "Ingen" = nul-*regulering*, ikke nul-*beløb*. Motorens orkestrator kortslutter dette:
// alle-ingen giver `{strategi:'ingen', konsolideret:null}` før dispatch, og zero-delta-
// segmenterne bygges direkte fra tafRanges (konsolideret er null). Derfor når formens
// konsolider/byggSegmenter aldrig kaldsstedet via basis — de er defensive invarianter.
const konsolider = (): ResolvedStrategi => ({
  strategi: 'ingen',
  label: 'Ingen',
  konsolideret: null,
});

const byggSegmenter = (): never => {
  throw new Error('Loenudvikling: byggSegmenter må ikke kaldes for "Ingen" (zero-delta bygges i orkestratoren)');
};

const coverageInterval = (): KildeReguleringsInterval | undefined => undefined;

export const ingenForm: ReguleringForm = {
  id: 'Ingen',
  strategi: 'ingen',
  konsolider,
  byggSegmenter,
  coverageInterval,
};
