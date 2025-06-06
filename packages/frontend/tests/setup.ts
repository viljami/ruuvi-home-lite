// Test setup for frontend components
import { beforeAll, beforeEach, afterEach, vi } from 'vitest'

// Mock Canvas API for chart testing
beforeAll(() => {
  // Mock HTMLCanvasElement
  Object.defineProperty(HTMLCanvasElement.prototype, 'getContext', {
    value: vi.fn(() => ({
      fillRect: vi.fn(),
      clearRect: vi.fn(),
      getImageData: vi.fn(() => ({ data: new Array(4) })),
      putImageData: vi.fn(),
      createImageData: vi.fn(() => ({ data: new Array(4) })),
      setTransform: vi.fn(),
      drawImage: vi.fn(),
      save: vi.fn(),
      fillText: vi.fn(),
      restore: vi.fn(),
      beginPath: vi.fn(),
      moveTo: vi.fn(),
      lineTo: vi.fn(),
      closePath: vi.fn(),
      stroke: vi.fn(),
      translate: vi.fn(),
      scale: vi.fn(),
      rotate: vi.fn(),
      arc: vi.fn(),
      fill: vi.fn(),
      measureText: vi.fn(() => ({ width: 0 })),
      transform: vi.fn(),
      rect: vi.fn(),
      clip: vi.fn(),
      strokeStyle: '#000000',
      fillStyle: '#000000',
      globalAlpha: 1,
      lineWidth: 1,
      lineCap: 'butt',
      lineJoin: 'miter',
      miterLimit: 10,
      font: '10px sans-serif',
      textAlign: 'start',
      textBaseline: 'alphabetic',
      shadowColor: 'rgba(0, 0, 0, 0)',
      shadowBlur: 0,
      shadowOffsetX: 0,
      shadowOffsetY: 0,
      setLineDash: vi.fn(),
      getLineDash: vi.fn(() => []),
      canvas: {
        width: 800,
        height: 600
      }
    }))
  })

  // Mock Canvas toDataURL for image output testing
  Object.defineProperty(HTMLCanvasElement.prototype, 'toDataURL', {
    value: vi.fn(() => 'data:image/png;base64,test-image-data')
  })

  // Mock Canvas width/height properties
  Object.defineProperty(HTMLCanvasElement.prototype, 'width', {
    value: 800,
    writable: true
  })
  Object.defineProperty(HTMLCanvasElement.prototype, 'height', {
    value: 600,
    writable: true
  })
})

// Mock WebSocket for WebSocketManager tests
beforeAll(() => {
  global.WebSocket = vi.fn().mockImplementation(() => ({
    send: vi.fn(),
    close: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    readyState: 1, // OPEN
    CONNECTING: 0,
    OPEN: 1,
    CLOSING: 2,
    CLOSED: 3
  })) as any
})

// Mock window.location
Object.defineProperty(window, 'location', {
  value: {
    protocol: 'http:',
    host: 'localhost:3000',
    hostname: 'localhost',
    port: '3000',
    href: 'http://localhost:3000'
  },
  writable: true
})

// Mock requestAnimationFrame
global.requestAnimationFrame = vi.fn((cb) => setTimeout(cb, 16))
global.cancelAnimationFrame = vi.fn()

// Clean up after each test
afterEach(() => {
  vi.clearAllMocks()
})