import { act } from "react";
import { create, type ReactTestInstance, type ReactTestRenderer } from "react-test-renderer";
import { gardenCopy, styleCopy, worldCopy } from "./copy";
import { GardenGame } from "./GardenGame";
import { StyleStudio } from "./StyleStudio";

jest.mock("react-native", () => jest.requireActual("./testMocks").reactNativeMock());
jest.mock("../../components/ui", () => jest.requireActual("./testMocks").uiMock());
jest.mock("../../components/mascots", () => jest.requireActual("./testMocks").mascotsMock());
jest.mock("../../components/Mascot", () => ({ Mascot: "Mascot" }));
jest.mock("../../components/useReduceMotion", () => ({ useReduceMotion: () => true }));
jest.mock("expo-audio", () => ({ useAudioPlayer: () => ({ play: jest.fn(), seekTo: jest.fn() }) }));
jest.mock("../../../assets/sounds/correct.wav", () => 1, { virtual: true });
jest.mock("expo-linear-gradient", () => ({ LinearGradient: "LinearGradient" }));
jest.mock("react-native-safe-area-context", () => ({ SafeAreaView: "SafeAreaView" }));
jest.mock("@expo/vector-icons/Ionicons", () => "Ionicons");
const mockDb = {};
jest.mock("expo-sqlite", () => ({ useSQLiteContext: () => mockDb }));

let mockSaved: Record<string, unknown> = {};
let mockEarned = 0;
const mockSave = jest.fn(async (_db: unknown, _child: string, key: string, value: unknown) => {
  mockSaved[key] = value;
});
jest.mock("../../storage/playState", () => ({
  loadPlayState: async (_db: unknown, _child: string, key: string, fallback: unknown) =>
    mockSaved[key] ?? fallback,
  savePlayState: (...args: [unknown, string, string, unknown]) => mockSave(...args),
  countStars: async () => mockEarned,
}));

let renderer: ReactTestRenderer;
const text = () => JSON.stringify(renderer.toJSON());
const pressables = () => renderer.root.findAll((n) => String(n.type) === "Pressable");
const byLabel = (label: string) => pressables().find((n) => n.props.accessibilityLabel === label)!;
const button = (label: string) =>
  renderer.root.find((n) => String(n.type) === "Button" && n.props.label === label);
const press = (node: ReactTestInstance) => act(async () => node.props.onPress());
const modal = () => renderer.root.find((n) => String(n.type) === "Modal");

beforeEach(() => {
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
  jest.useFakeTimers({ now: new Date("2026-10-29T10:00:00Z") });
  mockSaved = {};
  mockEarned = 0;
  mockSave.mockClear();
});
afterEach(async () => {
  await act(async () => renderer.unmount());
  jest.useRealTimers();
});

describe("garden", () => {
  const award = jest.fn(async () => {
    mockEarned += 1;
    return true;
  });
  beforeEach(() => award.mockClear());
  const render = async (childId: string | null = "c1") => {
    await act(async () => {
      renderer = create(<GardenGame childId={childId} award={award} onExit={jest.fn()} />);
    });
  };

  test("a break dims the screen, can't be confirmed too early, then gives a seed to plant", async () => {
    await render();
    expect(text()).toContain(gardenCopy.noSeeds);
    await press(button(`🌿 ${gardenCopy.takeBreak}`));
    await press(byLabel(`${gardenCopy.breaks.rest} · 20 сек`));
    await press(button(gardenCopy.go));
    expect(modal().props.visible).toBe(false);
    await act(async () => jest.advanceTimersByTime(2600));
    expect(modal().props.visible).toBe(true);

    // Back too soon: the break is not counted yet.
    await press(byLabel(gardenCopy.awayHint));
    await press(button(gardenCopy.confirmYes));
    expect(text()).toContain(gardenCopy.tooSoon);
    expect(award).not.toHaveBeenCalled();

    await act(async () => jest.advanceTimersByTime(20_000));
    await press(button(gardenCopy.confirmYes));
    expect(award).toHaveBeenCalledWith("garden-rest");
    expect(text()).toContain(gardenCopy.seedEarned);
    expect(text()).toContain(gardenCopy.seeds(1));

    // Plant the seed: only unlocked plants can be chosen.
    await press(byLabel(gardenCopy.tapPlot));
    await press(byLabel(gardenCopy.locked(2)));
    expect(mockSave).not.toHaveBeenCalled();
    await press(byLabel(gardenCopy.plants.flower));
    expect(mockSave).toHaveBeenCalledWith(
      {},
      "c1",
      "garden",
      expect.objectContaining({ plots: expect.arrayContaining(["flower"]) }),
    );
    expect(text()).toContain(gardenCopy.seeds(0));
  });

  test("the same break twice in a day gives no second seed", async () => {
    award.mockImplementationOnce(async () => false);
    await render();
    await press(button(`🌿 ${gardenCopy.takeBreak}`));
    await press(byLabel(`${gardenCopy.breaks.rest} · 20 сек`));
    await press(button(gardenCopy.go));
    await act(async () => jest.advanceTimersByTime(25_000));
    await press(byLabel(gardenCopy.awayHint));
    await press(button(gardenCopy.confirmYes));
    expect(text()).toContain(gardenCopy.alreadyToday);
  });

  test("without a child profile nothing is saved", async () => {
    await render(null);
    expect(text()).toContain(gardenCopy.noChild);
  });
});

describe("style studio", () => {
  const render = async (stars: number) => {
    await act(async () => {
      renderer = create(<StyleStudio childId="c1" totalStars={stars} onExit={jest.fn()} />);
    });
  };

  test("free items equip and save; locked items wait for stars", async () => {
    await render(0);
    expect(text()).toContain(styleCopy.heading);
    await press(byLabel(styleCopy.locked(6)));
    await press(byLabel(styleCopy.items.starHat));
    await press(button(styleCopy.save));
    expect(mockSaved.style).toEqual({ hat: "starHat" });
    expect(text()).toContain(styleCopy.saved);
  });

  test("a saved outfit comes back, without items that are not unlocked", async () => {
    mockSaved.style = { hat: "crown", glasses: "round" };
    await render(0);
    await press(
      renderer.root.find(
        (n) =>
          n.props.accessibilityRole === "tab" &&
          n.findAll((t) => t.props.children === styleCopy.categories.glasses).length > 0,
      ),
    );
    const round = byLabel(styleCopy.items.round);
    expect(round.props.accessibilityState.selected).toBe(true);
    expect(text()).not.toContain('"👑"');
  });
});

test("world copy keeps the honest note about what the games are", () => {
  expect(worldCopy.gamesNote).toMatch(/шалгахгүй/);
});
