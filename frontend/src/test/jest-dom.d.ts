import type { TestingLibraryMatchers } from '@testing-library/jest-dom/matchers';

// jest-dom 7.0.1 still augments vitest's pre-5 `Assertion<T>`; vitest 5 made it `Assertion<R, T>`, so the upstream merge fails.
declare module 'vitest' {
  interface Assertion<R extends void | Promise<void> = void, T = unknown>
    extends TestingLibraryMatchers<string, R> {}
  interface AsymmetricMatchersContaining extends TestingLibraryMatchers<string, void> {}
}
