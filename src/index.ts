import { Store, MutationPayload } from "vuex";
import merge from "deepmerge";
interface Storage {
  getItem: (key: string) => any;
  setItem: (key: string, value: any) => void;
  removeItem: (key: string) => void;
}

interface Options<State> {
  key?: string;
  paths?: string[];
  reducer?: (state: State, paths: string[]) => object;
  subscriber?: (
    store: Store<State>
    ) => (handler: (mutation: any, state: State) => void) => void;
  storage?: Storage;
  getState?: (key: string, storage: Storage) => any;
  setState?: (key: string, state: any, storage: Storage) => void;
  filter?: (mutation: MutationPayload) => boolean;
  arrayMerger?: (state: any[], saved: any[]) => any;
  rehydrated?: (store: Store<State>) => void;
  fetchBeforeUse?: boolean;
  overwrite?: boolean;
  assertStorage?: (storage: Storage) => void | Error;
}


export function get(object, path, def) {
  return (object = (path.split ? path.split('.') : path).reduce(function (obj, p) {
    return obj && obj[p]
  }, object)) === undefined ? def : object;
};

export function set  (object, path, val, obj) {
  return ((path = path.split ? path.split('.') : path.slice(0)).slice(0, -1).reduce(function (obj, p) {
    return (!/^(__proto__|constructor|prototype)$/.test(p))? obj[p] = obj[p] || {} : {};
  }, obj = object)[path.pop()] = val), object;
};

export default function <State>(
  options?: Options<State>
): (store: Store<State>) => void {
  options = options || {};

  const storage = options.storage || (window && window.localStorage);
  const key = options.key || "vuex";

  function getState(key, storage) {
    const value = storage.getItem(key);

    try {
      return (typeof value === "string")
        ? JSON.parse(value) : (typeof value === "object")
        ? value : undefined;
    } catch (err) {}

    return undefined;
  }

  function filter() {
    return true;
  }

  function setState(key, state, storage) {
    return storage.setItem(key, JSON.stringify(state));
  }

  function reducer(state, paths) {
    return Array.isArray(paths)
      ? paths.reduce(function (substate, path) {
          return set(substate, path, get(state, path));
        }, {})
      : state;
  }

  function subscriber(store) {
    return function (handler) {
      return store.subscribe(handler);
    };
  }

  const assertStorage =
    options.assertStorage ||
    (() => {
      storage.setItem("@@", 1);
      storage.removeItem("@@");
    });

  assertStorage(storage);

  const fetchSavedState = () => (options.getState || getState)(key, storage);

  let savedState;

  if (options.fetchBeforeUse) {
    savedState = fetchSavedState();
  }

  return function (store: Store<State>) {
    if (!options.fetchBeforeUse) {
      savedState = fetchSavedState();
    }

    if (typeof savedState === "object" && savedState !== null) {
      store.replaceState(
        options.overwrite
          ? savedState
          : merge(store.state, savedState, {
              arrayMerge:
                options.arrayMerger ||
                function (store, saved) {
                  return saved;
                },
              clone: false,
            })
      );
      (options.rehydrated || function () {})(store);
    }

    (options.subscriber || subscriber)(store)(function (mutation, state) {
      if ((options.filter || filter)(mutation)) {
        (options.setState || setState)(
          key,
          (options.reducer || reducer)(state, options.paths),
          storage
        );
      }
    });
  };
}
