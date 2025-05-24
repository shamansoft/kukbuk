// Set up the Jest environment
global.chrome = {
  contextMenus: {
    removeAll: jest.fn(),
    create: jest.fn(),
    onClicked: {
      addListener: jest.fn(),
    },
  },
  runtime: {
    onMessage: {
      addListener: jest.fn(),
    },
    onInstalled: {
      addListener: jest.fn(),
    },
    openOptionsPage: jest.fn(),
    sendMessage: jest.fn((msg, callback) => {
      if (callback) callback({ success: true });
    }),
  },
};

// Mock console methods if needed
// Uncomment if you want to silence console logs during tests
// jest.spyOn(console, 'log').mockImplementation(() => {});
// jest.spyOn(console, 'error').mockImplementation(() => {});
