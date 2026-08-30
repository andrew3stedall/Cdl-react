if (typeof window !== 'undefined') {
  window.scrollTo = () => undefined;
}

if (typeof window !== 'undefined' && !window.matchMedia) {
  Object.defineProperty(window, 'matchMedia', {
    configurable: true,
    value: (query: string): MediaQueryList => ({
      matches: false,
      media: query,
      onchange: null,
      addListener: () => undefined,
      removeListener: () => undefined,
      addEventListener: () => undefined,
      removeEventListener: () => undefined,
      dispatchEvent: () => false,
    }),
  });
}

if (typeof window !== 'undefined' && !window.ResizeObserver) {
  class TestResizeObserver {
    disconnect(): void {
      return undefined;
    }

    observe(): void {
      return undefined;
    }

    unobserve(): void {
      return undefined;
    }
  }

  window.ResizeObserver = TestResizeObserver;
}

if (typeof window !== 'undefined' && !window.IntersectionObserver) {
  class TestIntersectionObserver {
    readonly root = null;
    readonly rootMargin = '';
    readonly thresholds: number[] = [];

    disconnect(): void {
      return undefined;
    }

    observe(): void {
      return undefined;
    }

    takeRecords(): IntersectionObserverEntry[] {
      return [];
    }

    unobserve(): void {
      return undefined;
    }
  }

  window.IntersectionObserver = TestIntersectionObserver as unknown as typeof IntersectionObserver;
}
