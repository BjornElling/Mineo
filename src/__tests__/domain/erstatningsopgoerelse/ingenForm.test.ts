import { ingenForm } from '../../../domain/erstatningsopgoerelse/engines/regulering/forms/ingenForm';

describe('ingenForm', () => {
  it('returnerer Ingen uden konsolideret strategi', () => {
    expect(ingenForm.konsolider(undefined as never)).toEqual({
      strategi: 'ingen',
      label: 'Ingen',
      konsolideret: null,
    });
  });

  it('afviser direkte resultatbygning, fordi Ingen bygges som zero-delta i orkestratoren', () => {
    expect(() => ingenForm.byggResultat(null as never)).toThrow(
      'Loenudvikling: byggResultat må ikke kaldes for "Ingen" (zero-delta bygges i orkestratoren)'
    );
  });

  it('har ingen kildedækning', () => {
    expect(ingenForm.coverageInterval(undefined as never)).toBeUndefined();
  });
});
