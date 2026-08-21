// @vitest-environment jsdom
//
// §1.3 settle-udløser: FANE-benet.
//
// §1.3 er normativ: "Blur, Enter, klik uden for feltet og almindelig side-/FANEnavigation afslutter editoren
// gennem samme settle-sti." Side-benet er dækket af `MainLayout.navigationCommitGuard.test.tsx`. Fane-benet var
// UDÆKKET, og hullet er ikke kosmetisk: et fane-skift UNMOUNTER fanens indhold
// (`VarigeMen.tsx`: `activeTab === SATSER ? <SatserTab/> : <MenberegningTab/>`), og `useFieldEditor`s
// unmount-effect AFMELDER kun editoren fra registret (`useFieldEditor.ts:235`) – den settler ikke. Settler
// draften ikke FØR unmount, forsvinder brugerens indtastning tavst.
//
// Testen måler gennem den ÆGTE side, den ægte `PageTabs` og den ægte produktions-runtime, og assertionen læses
// fra det AUTORITATIVE afsluttede input – ikke fra DOM'en.
//
// **HVILKEN settle-sti beviser testen? (Antagelsen er bevidst.)**
//
// `user.click` på fanen flytter fokus fra inputtet og udløser blur, FØR tabens `onChange` skifter state.
// Testen går derfor gennem BLUR-stien; det er verificeret ved mutation (gør `useFormFieldSurface.onBlur`
// til en no-op, og begge tests nedenfor bliver røde, mens fanen fortsat skifter). Det rejser spørgsmålet,
// om testen så blot gentager en allerede dækket sti frem for at bevise en selvstændig fane-grænse.
//
// Svaret er nej, og grunden er, at der IKKE findes en produktionssti, som skifter fane med en uafsluttet
// draft. Fane-skift kan kun ske på to måder:
//
//   (a) Brugerklik på `<Tab>` – MUI flytter fokus, så blur går forud. Det er stien her.
//   (b) Programmatisk `setActiveTabForPage(...)` – kun to callsites, og begge settler først:
//       `saveBlockedFocus` kaldes fra `useFileSaveLoad.ts` EFTER `criticalActions.prepare('save')`, og
//       `useEoBeregningViewModel` kaldes fra et klik på et issue-link, som selv blurrer feltet.
//
// §1.3 udpeger netop blur som settle-stien ("Blur, Enter, klik uden for feltet og almindelig
// side-/fanenavigation afslutter editoren gennem SAMME settle-sti"). En test, der undertrykte blur for at
// isolere et "rent" fane-skift, ville derfor måle en tilstand, produktionen ikke kan nå. Skulle et
// fremtidigt fane-skift omgå fokus (fx en tastaturgenvej eller en programmatisk rute uden coordinator),
// er DENNE antagelse den, der skal genbesøges – og så skal fane-navigationen have sin egen
// `prepare()`-guard på linje med side-navigationen.
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';

import VarigeMen from '../../../components/pages/VarigeMen';
import { AppSettingsProvider } from '../../../contexts/AppSettingsContext';
import { RoutePathnameProvider } from '../../../contexts/RoutePathnameProvider';
import { getProductionInputCatalog } from '../../../inputCore/catalog/productionCatalog';
import {
  ProductionInputRuntimeProvider,
  createProductionInputRuntimeBinding,
} from '../../../inputCore/react';
import { slimInputStore } from '../../../inputCore/runtime/slimInputStore';
import { hydrateSlimInputStoreForTest } from '../../../test/actSafeInputStore';

const catalog = getProductionInputCatalog();

const emptyInput = () => catalog.validateSettledInput({
  sections: {
    stamdata: null, satser: null, aarsloen: null, faellesAarsloen: null,
    renteberegning: null, varigemen: null, forsoergertab: null,
    erstatningsopgoerelse: null, erhvervsevnetab: null,
  },
  rejectedInputs: {},
});

const renderPage = () => render(
  <MemoryRouter initialEntries={['/varigemen']}>
    <AppSettingsProvider>
      <RoutePathnameProvider>
        <ProductionInputRuntimeProvider binding={createProductionInputRuntimeBinding()}>
          <VarigeMen />
        </ProductionInputRuntimeProvider>
      </RoutePathnameProvider>
    </AppSettingsProvider>
  </MemoryRouter>
);

/** Læser méngraden fra det AUTORITATIVE afsluttede input – ikke fra DOM'en. */
const settledMengrad = (): unknown =>
  (slimInputStore.getState().input.sections.varigemen as { mengrad?: unknown } | null)?.mengrad;

describe('VarigeMen – fanenavigation settler den åbne editor (§1.3)', () => {
  beforeEach(() => {
    sessionStorage.clear();
    hydrateSlimInputStoreForTest(slimInputStore, emptyInput());
  });

  afterEach(() => {
    hydrateSlimInputStoreForTest(slimInputStore, emptyInput());
  });

  it('afslutter en GYLDIG åben draft, når brugeren skifter fane', async () => {
    const user = userEvent.setup();
    renderPage();

    await user.click(screen.getByPlaceholderText('0'));
    await user.keyboard('15');

    // §1.2: den åbne draft har endnu ikke rørt afsluttet input.
    expect(settledMengrad()).toBeUndefined();

    await user.click(screen.getByRole('tab', { name: 'Satser' }));

    // Fanen er skiftet, OG draften blev afsluttet gennem settle-stien.
    await waitFor(() => {
      expect(settledMengrad()).toBe(15);
    });
    expect(screen.queryByPlaceholderText('0')).toBeNull();
  });

  it('fortsætter fane-skiftet ved et FEJLENDE settle og bevarer fejlen (§1.3/§1.6)', async () => {
    const user = userEvent.setup();
    renderPage();

    await user.click(screen.getByPlaceholderText('0'));
    // 121 er parseligt, men uden for méngradens 1..120 → canonical bounds-fejl (værdien BEVARES, §1.6).
    await user.keyboard('121');

    await user.click(screen.getByRole('tab', { name: 'Satser' }));

    // Navigationen gennemføres – et fejlende settle blokerer den IKKE.
    await waitFor(() => {
      expect(screen.queryByPlaceholderText('0')).toBeNull();
    });

    // Og settlet skete: den fejlende værdi er afsluttet, ikke tavst tabt.
    expect(settledMengrad()).toBe(121);

    // Fejlen vises igen, når brugeren vender tilbage til fanen (§1.3 sidste led).
    await user.click(screen.getByRole('tab', { name: 'Beregning' }));
    const back = await screen.findByPlaceholderText('0');
    expect(back).toHaveValue('121');
    await waitFor(() => {
      expect(back).toHaveAttribute('aria-invalid', 'true');
    });
  });
});
