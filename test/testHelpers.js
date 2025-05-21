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
    get: jest.fn((keys, callback) => {
      if (typeof keys === 'string') {
        callback({ [keys]: storage[keys] });
      } else if (Array.isArray(keys)) {
        const result = {};
        keys.forEach(key => {
          result[key] = storage[key];
        });
        callback(result);
      } else if (typeof keys === 'object') {
        const result = {};
        Object.keys(keys).forEach(key => {
          result[key] = storage[key] !== undefined ? storage[key] : keys[key];
        });
        callback(result);
      } else {
        callback(storage);
      }
    }),
    
    set: jest.fn((items, callback) => {
      Object.assign(storage, items);
      if (callback) callback();
    }),
    
    remove: jest.fn((keys, callback) => {
      if (typeof keys === 'string') {
        delete storage[keys];
      } else if (Array.isArray(keys)) {
        keys.forEach(key => delete storage[key]);
      }
      if (callback) callback();
    }),
    
    clear: jest.fn(callback => {
      Object.keys(storage).forEach(key => delete storage[key]);
      if (callback) callback();
    }),
    
    // Expose storage for tests
    _store: storage
  };
};

/**
 * Mock console methods for testing
 * @returns {jest.SpyInstance} Console log spy
 */
export const mockConsole = () => {
  const logSpy = jest.spyOn(console, 'log').mockImplementation(() => {});
  jest.spyOn(console, 'error').mockImplementation(() => {});
  jest.spyOn(console, 'warn').mockImplementation(() => {});
  
  return logSpy;
};