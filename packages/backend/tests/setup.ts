import { afterAll, beforeAll, vi } from "vitest";

// Mock environment variables for testing
process.env.NODE_ENV = "test";

// Mock mqtt module to prevent actual MQTT connections
vi.mock("mqtt", () => ({
  connect: vi.fn(() => ({
    on: vi.fn(),
    subscribe: vi.fn(),
    publish: vi.fn(),
    end: vi.fn(),
    removeAllListeners: vi.fn(),
  })),
}));

// Mock ws module to prevent actual WebSocket server creation
vi.mock("ws", () => ({
  WebSocketServer: vi.fn().mockImplementation(() => ({
    on: vi.fn(),
    clients: new Set(),
    close: vi.fn(),
  })),
  WebSocket: {
    CONNECTING: 0,
    OPEN: 1,
    CLOSING: 2,
    CLOSED: 3,
  },
}));

// Mock http/https modules to prevent actual server creation
vi.mock("http", () => ({
  createServer: vi.fn(() => ({
    listen: vi.fn((...args) => {
      // Handle different signatures: listen(port, callback) or listen(port, host, callback)
      const callback = args[args.length - 1];
      if (typeof callback === "function") {
        callback();
      }
    }),
    close: vi.fn((cb) => cb && cb()),
    on: vi.fn(),
  })),
}));

vi.mock("https", () => ({
  createServer: vi.fn(() => ({
    listen: vi.fn((...args) => {
      // Handle different signatures: listen(port, callback) or listen(port, host, callback)
      const callback = args[args.length - 1];
      if (typeof callback === "function") {
        callback();
      }
    }),
    close: vi.fn((cb) => cb && cb()),
    on: vi.fn(),
  })),
}));

// Suppress console output during tests
beforeAll(() => {
  vi.spyOn(console, "log").mockImplementation(() => {});
  vi.spyOn(console, "warn").mockImplementation(() => {});
  vi.spyOn(console, "error").mockImplementation(() => {});
});

afterAll(() => {
  vi.restoreAllMocks();
});
