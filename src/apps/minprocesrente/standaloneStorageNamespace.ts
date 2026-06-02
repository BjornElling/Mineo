import { setStorageNamespace } from '../../config/storageManifest';

// Side-effect-only modul. Importeres FØRST i `minprocesrenteMain.tsx` — før App-importen —
// så MinProcesrentes storage-namespace er sat, før noget transitivt importeret modul kan nå
// at røre sessionStorage på module-load-tid.
//
// Hvorfor et eget modul: ES-`import`-statements hoistes og eksekveres før et moduls top-level
// statements. Et `setStorageNamespace(...)`-kald skrevet direkte i `minprocesrenteMain.tsx`
// ville derfor køre EFTER alle dens imports (inkl. App-træet) er evalueret. Ved at lægge kaldet
// i en bivirknings-import, der står før App-importen, garanterer import-rækkefølgen, at
// namespacet er sat først — uafhængigt af om et delt modul en dag begynder at læse storage ved
// load. Det er multi-app-isolationens hård-garanti (jf. app-shell-contract.md).
setStorageNamespace('minprocesrente');
