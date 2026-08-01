import {
  assertForhoejetPensionsalderEventsIntegritet,
  forhoejetPensionsalderEvents,
  type ForhoejetPensionsalderEvent,
} from '../../data/kapitalisering/forhoejetPensionsalderEvents';
import { toISODateString } from '../../types/branded';

const event = (
  forhoejelsesdato: string,
  opslagsdatoGammel: string,
  opslagsdatoNy: string,
): ForhoejetPensionsalderEvent => ({
  forhoejelsesdato: toISODateString(forhoejelsesdato),
  opslagsdatoGammel: toISODateString(opslagsdatoGammel),
  opslagsdatoNy: toISODateString(opslagsdatoNy),
  gammelAlderLabel: '67 år',
  nyAlderLabel: '68 år',
});

describe('forhoejetPensionsalderEvents', () => {
  it('accepterer den autoritative eventserie', () => {
    expect(() => assertForhoejetPensionsalderEventsIntegritet(forhoejetPensionsalderEvents)).not.toThrow();
  });

  it('fail-closer ved tom, usorteret eller duplikeret eventserie', () => {
    const first = event('2020-12-31', '2020-12-30', '2020-12-31');
    const earlier = event('2015-12-29', '2015-12-28', '2015-12-29');
    expect(() => assertForhoejetPensionsalderEventsIntegritet([])).toThrow('eventlisten er tom');
    expect(() => assertForhoejetPensionsalderEventsIntegritet([first, earlier])).toThrow('sorteret stigende');
    expect(() => assertForhoejetPensionsalderEventsIntegritet([first, first])).toThrow('unikke');
  });

  it('fail-closer ved omvendte opslagsdatoer og tomme labels', () => {
    expect(() => assertForhoejetPensionsalderEventsIntegritet([
      event('2020-12-31', '2020-12-31', '2020-12-30'),
    ])).toThrow('gammel opslagsdato');

    expect(() => assertForhoejetPensionsalderEventsIntegritet([{
      ...event('2020-12-31', '2020-12-30', '2020-12-31'),
      nyAlderLabel: ' ',
    }])).toThrow('alderslabels');
  });
});
