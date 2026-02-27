import '@testing-library/jest-dom/vitest'

// Polyfill DOMMatrix for jsdom (required by pdfjs-dist at import time)
if (typeof DOMMatrix === 'undefined') {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  ;(global as any).DOMMatrix = class DOMMatrix {
    a = 1
    b = 0
    c = 0
    d = 1
    e = 0
    f = 0
    m11 = 1
    m12 = 0
    m13 = 0
    m14 = 0
    m21 = 0
    m22 = 1
    m23 = 0
    m24 = 0
    m31 = 0
    m32 = 0
    m33 = 1
    m34 = 0
    m41 = 0
    m42 = 0
    m43 = 0
    m44 = 1
    is2D = true
    isIdentity = true
    static fromMatrix() {
      return new DOMMatrix()
    }
    static fromFloat32Array() {
      return new DOMMatrix()
    }
    static fromFloat64Array() {
      return new DOMMatrix()
    }
    inverse() {
      return new DOMMatrix()
    }
    multiply() {
      return new DOMMatrix()
    }
    translate() {
      return new DOMMatrix()
    }
    scale() {
      return new DOMMatrix()
    }
    rotate() {
      return new DOMMatrix()
    }
    rotateAxisAngle() {
      return new DOMMatrix()
    }
    skewX() {
      return new DOMMatrix()
    }
    skewY() {
      return new DOMMatrix()
    }
    flipX() {
      return new DOMMatrix()
    }
    flipY() {
      return new DOMMatrix()
    }
    toFloat32Array() {
      return new Float32Array(16)
    }
    toFloat64Array() {
      return new Float64Array(16)
    }
    toJSON() {
      return {}
    }
  }
}

// Polyfill window.matchMedia for jsdom (used by theme detection)
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: (query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: () => {},
    removeListener: () => {},
    addEventListener: () => {},
    removeEventListener: () => {},
    dispatchEvent: () => false,
  }),
})
