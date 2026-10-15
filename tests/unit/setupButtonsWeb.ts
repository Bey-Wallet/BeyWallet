// Tamagui reads matchMedia during module initialization, before the test's hooks run.
Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
window.matchMedia = jest.fn().mockImplementation((media: string) => ({
  media,
  matches: false,
  onchange: null,
  addListener: jest.fn(),
  removeListener: jest.fn(),
  addEventListener: jest.fn(),
  removeEventListener: jest.fn(),
  dispatchEvent: jest.fn(),
}));
