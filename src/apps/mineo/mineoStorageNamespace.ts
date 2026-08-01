import { setStorageNamespace } from '../../config/storageManifest';

// Entryens første bivirknings-import låser Mineos namespace, før App-grafen evalueres.
setStorageNamespace('mineo');
