import { InputCatalog } from '../../input/fieldCatalog';
import * as aarsloen from '../../input/catalog/aarsloenInputBindings';
import * as erhvervsevnetab from '../../input/catalog/erhvervsevnetabInputBindings';
import * as erstatningsopgoerelse from '../../input/catalog/erstatningsopgoerelseInputBindings';
import * as erstatningsopgoerelseLoen from '../../input/catalog/erstatningsopgoerelseLoenInputBindings';
import * as faellesAarsloen from '../../input/catalog/faellesAarsloenInputBindings';
import * as forsoergertab from '../../input/catalog/forsoergertabInputBindings';
import {
  defineInputManifest,
  registerInputManifests,
  type InputManifest,
} from '../../input/catalog/inputManifest';
import { productionInputManifests } from '../../input/catalog/productionInputCatalog';
import * as renteberegning from '../../input/catalog/renteberegningInputBindings';
import * as satser from '../../input/catalog/satserInputBindings';
import * as stamdata from '../../input/catalog/stamdataInputBindings';
import * as varigeMen from '../../input/catalog/varigeMenInputBindings';

const manifestModules: ReadonlyArray<Readonly<{
  manifest: InputManifest;
  module: object;
}>> = [
  { manifest: stamdata.stamdataInputManifest, module: stamdata },
  { manifest: satser.satserInputManifest, module: satser },
  { manifest: aarsloen.aarsloenInputManifest, module: aarsloen },
  { manifest: faellesAarsloen.faellesAarsloenInputManifest, module: faellesAarsloen },
  { manifest: renteberegning.renteberegningInputManifest, module: renteberegning },
  { manifest: varigeMen.varigeMenInputManifest, module: varigeMen },
  { manifest: forsoergertab.forsoergertabInputManifest, module: forsoergertab },
  { manifest: erhvervsevnetab.erhvervsevnetabInputManifest, module: erhvervsevnetab },
  { manifest: erstatningsopgoerelse.erstatningsopgoerelseInputManifest, module: erstatningsopgoerelse },
  { manifest: erstatningsopgoerelseLoen.erstatningsopgoerelseLoenInputManifest, module: erstatningsopgoerelseLoen },
];

describe('InputManifest', () => {
  it('holder produktionskataloget komplet i forhold til bindingsmodulernes eksporterede bindings', () => {
    expect(productionInputManifests).toEqual(manifestModules.map(({ manifest }) => manifest));

    for (const { manifest, module } of manifestModules) {
      const registered = new Set([...manifest.fields, ...manifest.collections]);
      const namedBindings = Object.entries(module)
        .filter(([name]) => name.endsWith('Binding'))
        .map(([, binding]) => binding);

      expect(registered.size).toBe(manifest.fields.length + manifest.collections.length);
      for (const binding of namedBindings) expect(registered.has(binding)).toBe(true);
    }

    expect(erstatningsopgoerelseLoen.erstatningsopgoerelseLoenInputManifest.fields)
      .toEqual(erstatningsopgoerelseLoen.eoLoenFieldBindings);
    expect(erstatningsopgoerelseLoen.erstatningsopgoerelseLoenInputManifest.collections)
      .toEqual(erstatningsopgoerelseLoen.eoLoenCollectionBindings);
  });

  it('afviser både dublerede manifest-id’er og dublerede bindings', () => {
    const duplicateId = defineInputManifest({
      id: satser.satserInputManifest.id,
      fields: [],
      collections: [],
    });
    expect(() => registerInputManifests(new InputCatalog(), [satser.satserInputManifest, duplicateId]))
      .toThrow('manifest-id er allerede registreret');

    const duplicateBinding = defineInputManifest({
      id: 'satser-kopi',
      fields: [satser.satserAargangBinding],
      collections: [],
    });
    expect(() => registerInputManifests(new InputCatalog(), [satser.satserInputManifest, duplicateBinding]))
      .toThrow('feltadressen er allerede registreret');
  });
});
