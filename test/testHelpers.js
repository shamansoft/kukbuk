// Test helpers for unit tests

/**
 * Helper for creating and resolving promises in tests
 * @returns {Object} Object with resolve and reject functions
 */
export const createPromise = () => {
  let resolve, reject;
  const promise = new Promise((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
};

/**
 * Mock fetch API
 * @returns {jest.Mock} A jest mock function for fetch
 */
export const mockFetch = () => {
  return jest.fn();
};

/**
 * Set up mock Chrome storage API
 * @param {Object} initialData - Initial storage data
 * @returns {Object} Mock storage object
 */
export const setupMockStorage = (initialData = {}) => {
  const storage = { ...initialData };

  return {
    get: jest.fn((keys) => {
      return new Promise((resolve) => {
        if (typeof keys === "string") {
          resolve({ [keys]: storage[keys] });
        } else if (Array.isArray(keys)) {
          const result = {};
          keys.forEach((key) => {
            result[key] = storage[key];
          });
          resolve(result);
        } else if (typeof keys === "object") {
          const result = {};
          Object.keys(keys).forEach((key) => {
            result[key] = storage[key] !== undefined ? storage[key] : keys[key];
          });
          resolve(result);
        } else {
          resolve(storage);
        }
      });
    }),

    set: jest.fn((items) => {
      return new Promise((resolve) => {
        Object.assign(storage, items);
        resolve();
      });
    }),

    remove: jest.fn((keys) => {
      return new Promise((resolve) => {
        if (typeof keys === "string") {
          delete storage[keys];
        } else if (Array.isArray(keys)) {
          keys.forEach((key) => delete storage[key]);
        }
        resolve();
      });
    }),

    clear: jest.fn(() => {
      return new Promise((resolve) => {
        Object.keys(storage).forEach((key) => delete storage[key]);
        resolve();
      });
    }),

    // Expose storage for tests
    _store: storage,
  };
};

/**
 * Mock console methods for testing
 * @returns {jest.SpyInstance} Console log spy
 */
export const mockConsole = () => {
  const logSpy = jest.spyOn(console, "log").mockImplementation(() => {});
  jest.spyOn(console, "error").mockImplementation(() => {});
  jest.spyOn(console, "warn").mockImplementation(() => {});

  return logSpy;
};
