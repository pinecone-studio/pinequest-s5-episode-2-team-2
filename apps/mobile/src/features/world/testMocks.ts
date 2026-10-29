// Shared jest mocks for the world games: a light React Native whose animations finish at once.

export function reactNativeMock() {
  const done = (callback?: (result: { finished: boolean }) => void) =>
    callback?.({ finished: true });
  const animation = () => ({ start: done, stop: () => undefined });
  class Value {
    value: number;
    constructor(value = 0) {
      this.value = value;
    }
    setValue(value: number) {
      this.value = value;
    }
    interpolate() {
      return 0;
    }
  }
  class ValueXY {
    x = new Value();
    y = new Value();
    setValue() {}
    extractOffset() {}
    flattenOffset() {}
    getTranslateTransform() {
      return [];
    }
  }
  return {
    AccessibilityInfo: {
      isReduceMotionEnabled: async () => true,
      addEventListener: () => ({ remove: () => undefined }),
    },
    Animated: {
      Value,
      ValueXY,
      View: "AnimatedView",
      Text: "AnimatedText",
      Image: "AnimatedImage",
      timing: animation,
      spring: animation,
      sequence: animation,
      delay: animation,
      loop: animation,
      event: () => () => undefined,
    },
    Easing: { inOut: () => undefined, out: () => undefined, quad: undefined, sin: undefined },
    PanResponder: { create: () => ({ panHandlers: {} }) },
    Image: "Image",
    Linking: { openURL: async () => true },
    Modal: "Modal",
    Pressable: "Pressable",
    ScrollView: "ScrollView",
    StyleSheet: { create: (styles: unknown) => styles },
    View: "View",
    useWindowDimensions: () => ({ width: 390, height: 844 }),
  };
}

export function uiMock() {
  return { Button: "Button", Screen: "Screen", Text: "Text" };
}

export const mascotsMock = () => ({
  mascotSources: {
    idle_happy: 1,
    wave: 2,
    thinking: 3,
    camera: 4,
    search: 5,
    celebrate: 6,
    guide: 7,
  },
});
