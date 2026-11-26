import { navigationItems, utilityItems } from '../../../components/layout/sideMenuItems';
import {
  APP_PAGE_DEFINITIONS,
  APP_SYSTEM_PAGE_DEFINITIONS,
  getRouteForMenuPageKey,
  type MenuPageKey,
} from '../../../config/pageNavigation';

/**
 * Sidemenuen som RUTE-INVENTAR.
 *
 * Guarden i `App.tsx` sammenholder kun loader-listen med route-kataloget. Bar menuen sit eget
 * inventar af bare strenge, ville en omdøbt route give en lydløst DØD menupost – ingen fejl,
 * ingen test.
 *
 * Nøgle-driften er lukket af TYPEN (`MenuPageKey`): et forkert id er en compile-fejl. Men typen har et loft – den kan ikke se, at en post MANGLER,
 * fordi en kortere liste stadig typechecker. Denne test dækker præcis det hul.
 */
describe('SideMenu – rute-inventar', () => {
  const menuKeys = [...navigationItems, ...utilityItems].map((item) => item.id);

  it('dækker hver navigerbar side præcis én gang', () => {
    // `/open` er PWA-filåbnings-landingen og hører bevidst IKKE i menuen.
    const expected: MenuPageKey[] = [
      ...(Object.keys(APP_PAGE_DEFINITIONS) as (keyof typeof APP_PAGE_DEFINITIONS)[]),
      ...(Object.keys(APP_SYSTEM_PAGE_DEFINITIONS).filter(
        (key) => key !== 'openEo'
      ) as Exclude<keyof typeof APP_SYSTEM_PAGE_DEFINITIONS, 'openEo'>[]),
    ];

    expect([...menuKeys].sort()).toEqual([...expected].sort());
  });

  it('viser ikke PWA-landingen /open', () => {
    const menuRoutes = menuKeys.map((key) => getRouteForMenuPageKey(key));
    expect(menuRoutes).not.toContain(APP_SYSTEM_PAGE_DEFINITIONS.openEo.route);
  });

  it('giver hver menupost en route der findes i kataloget', () => {
    const knownRoutes = new Set([
      ...Object.values(APP_PAGE_DEFINITIONS).map((definition) => definition.route),
      ...Object.values(APP_SYSTEM_PAGE_DEFINITIONS).map((definition) => definition.route),
    ]);

    for (const key of menuKeys) {
      expect(knownRoutes).toContain(getRouteForMenuPageKey(key));
    }
  });

  it('har en ikke-tom etiket på hver post', () => {
    for (const item of [...navigationItems, ...utilityItems]) {
      expect(item.label.trim()).not.toBe('');
    }
  });
});
