type RequestHandler = ((event: Event) => void) | null;

class FakeRequest<T> {
  result!: T;
  error: DOMException | null = null;
  onsuccess: RequestHandler = null;
  onerror: RequestHandler = null;
  onupgradeneeded: RequestHandler = null;
}

class FakeObjectStoreNames {
  constructor(private readonly getNames: () => string[]) {}

  contains(name: string): boolean {
    return this.getNames().includes(name);
  }
}

class FakeTransaction {
  oncomplete: ((event: Event) => void) | null = null;
  onabort: ((event: Event) => void) | null = null;
  onerror: ((event: Event) => void) | null = null;
  error: DOMException | null = null;
  private pendingRequests = 0;
  private aborted = false;

  constructor(private readonly database: FakeDatabase, private readonly storeName: string) {}

  objectStore(name: string): FakeObjectStore {
    if (name !== this.storeName) {
      throw new Error(`Unknown object store: ${name}`);
    }

    return new FakeObjectStore(this.database, this, name);
  }

  trackRequest<T>(executor: () => T): FakeRequest<T> {
    const request = new FakeRequest<T>();
    this.pendingRequests += 1;

    queueMicrotask(() => {
      if (this.aborted) {
        return;
      }

      try {
        request.result = executor();
        request.onsuccess?.(new Event('success'));
      } catch (error) {
        this.error = new DOMException(
          error instanceof Error ? error.message : 'IndexedDB request failed.',
          'OperationError'
        );
        request.error = this.error;
        request.onerror?.(new Event('error'));
        this.onerror?.(new Event('error'));
      } finally {
        this.pendingRequests -= 1;
        if (!this.aborted && this.pendingRequests === 0) {
          queueMicrotask(() => this.oncomplete?.(new Event('complete')));
        }
      }
    });

    return request;
  }

  abort(): void {
    this.aborted = true;
    this.error = new DOMException('Transaction aborted', 'AbortError');
    this.onabort?.(new Event('abort'));
  }
}

class FakeObjectStore {
  constructor(
    private readonly database: FakeDatabase,
    private readonly transaction: FakeTransaction,
    private readonly storeName: string
  ) {}

  getAll(): FakeRequest<unknown[]> {
    return this.transaction.trackRequest(() => {
      const store = this.database.getStore(this.storeName);
      return Array.from(store.values());
    });
  }

  put(value: unknown): FakeRequest<IDBValidKey> {
    return this.transaction.trackRequest(() => {
      const keyedValue = value as { id: string };
      this.database.getStore(this.storeName).set(keyedValue.id, value);
      return keyedValue.id;
    });
  }

  delete(key: IDBValidKey): FakeRequest<undefined> {
    return this.transaction.trackRequest(() => {
      this.database.getStore(this.storeName).delete(String(key));
      return undefined;
    });
  }
}

class FakeDatabase {
  readonly objectStoreNames: FakeObjectStoreNames;
  private readonly stores = new Map<string, Map<string, unknown>>();

  constructor(readonly name: string, public version: number) {
    this.objectStoreNames = new FakeObjectStoreNames(() => Array.from(this.stores.keys()));
  }

  createObjectStore(name: string): FakeObjectStore {
    if (!this.stores.has(name)) {
      this.stores.set(name, new Map());
    }

    return new FakeObjectStore(this, new FakeTransaction(this, name), name);
  }

  transaction(storeName: string, _mode: IDBTransactionMode): FakeTransaction {
    if (!this.stores.has(storeName)) {
      throw new Error(`Unknown object store: ${storeName}`);
    }

    return new FakeTransaction(this, storeName);
  }

  getStore(name: string): Map<string, unknown> {
    const store = this.stores.get(name);
    if (!store) {
      throw new Error(`Unknown object store: ${name}`);
    }

    return store;
  }

  close(): void {}
}

class FakeIndexedDbFactory {
  private readonly databases = new Map<string, FakeDatabase>();

  open(name: string, version?: number): FakeRequest<FakeDatabase> {
    const request = new FakeRequest<FakeDatabase>();

    queueMicrotask(() => {
      const existing = this.databases.get(name);
      const targetVersion = version ?? existing?.version ?? 1;
      let database = existing;
      const needsUpgrade = !database || targetVersion > database.version;

      if (!database) {
        database = new FakeDatabase(name, targetVersion);
        this.databases.set(name, database);
      } else if (targetVersion > database.version) {
        database.version = targetVersion;
      }

      request.result = database;

      if (needsUpgrade) {
        request.onupgradeneeded?.(new Event('upgradeneeded'));
      }

      request.onsuccess?.(new Event('success'));
    });

    return request;
  }

  reset(): void {
    this.databases.clear();
  }
}

const fakeIndexedDbFactory = new FakeIndexedDbFactory();

export function installFakeIndexedDb(): void {
  Object.defineProperty(globalThis, 'indexedDB', {
    configurable: true,
    writable: true,
    value: fakeIndexedDbFactory,
  });
}

export function resetFakeIndexedDb(): void {
  fakeIndexedDbFactory.reset();
}
