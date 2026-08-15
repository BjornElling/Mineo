import { resolveChoiceAllowEmpty } from '../../../../inputCore/react/fields/choiceEmptinessPolicy';
import {
  createChoiceFieldCodec,
  createRequiredChoiceFieldCodec,
} from '../../../../inputCore/fieldCodecs';
import type { FieldRef } from '../../../../inputCore/fieldDescriptor';

// VÆRN: «denne dropdown må ikke være tom» udledes af feltets codec, ikke af en håndskrevet prop.
//
// Reglen stod som `allowEmpty={false}` på 23 kaldssteder, mens descriptoren allerede VIDSTE det:
// et `requiredChoice`-codec oversætter tom tekst til en gyldig default og har derfor ingen tom tilstand.
// Intet bandt de to sammen, så en glemt prop lod brugeren rydde et påkrævet felt med Delete — og fejlen
// viste sig først som et kast et helt andet sted, når værdien faktisk blev `undefined`.

const refWithCodec = (codec: unknown, id: string): FieldRef<string> =>
  ({ descriptor: { id, codec } } as unknown as FieldRef<string>);

const requiredRef = refWithCodec(createRequiredChoiceFieldCodec(['dage', 'uger'], 'dage'), 'test.enhed');
const optionalRef = refWithCodec(createChoiceFieldCodec(['a', 'b']), 'test.valgfrit');

describe('resolveChoiceAllowEmpty', () => {
  it('et requiredChoice-felt kan ikke tilbyde et tomt valg — heller ikke uden prop', () => {
    expect(resolveChoiceAllowEmpty(requiredRef, undefined, 'ChoiceField')).toBe(false);
    expect(resolveChoiceAllowEmpty(requiredRef, false, 'ChoiceField')).toBe(false);
  });

  it('et forsøg på at LØSNE et requiredChoice-felt afvises', () => {
    expect(() => resolveChoiceAllowEmpty(requiredRef, true, 'ChoiceField'))
      .toThrow(/requiredChoice-codec/);
  });

  it('et valgfrit felt kan ryddes som udgangspunkt', () => {
    expect(resolveChoiceAllowEmpty(optionalRef, undefined, 'ChoiceField')).toBe(true);
  });

  it('et valgfrit felt kan SKÆRPES af en domæneregel på kaldsstedet', () => {
    // Skærpelsen er stadig lovlig: et valgfrit codec kan have et domænekrav om, at et valg er påkrævet.
    expect(resolveChoiceAllowEmpty(optionalRef, false, 'ChoiceField')).toBe(false);
  });
});
