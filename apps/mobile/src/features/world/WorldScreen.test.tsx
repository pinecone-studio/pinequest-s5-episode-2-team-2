import { act } from "react";
import { create, type ReactTestRenderer } from "react-test-renderer";
import { eyeRestCopy } from "../eyeRest/content";
import { gardenCopy, worldCopy } from "./copy";
import WorldScreen, { WORLD_CARDS } from "./WorldScreen";

jest.mock("react-native", () => jest.requireActual("./testMocks").reactNativeMock());
jest.mock("../../components/ui", () => jest.requireActual("./testMocks").uiMock());
jest.mock("../../components/mascots", () => jest.requireActual("./testMocks").mascotsMock());
jest.mock("../../components/Mascot", () => ({ Mascot: "Mascot" }));
jest.mock("../../components/useReduceMotion", () => ({ useReduceMotion: () => true }));
jest.mock("expo-audio", () => ({ useAudioPlayer: () => ({ play: jest.fn(), seekTo: jest.fn() }) }));
jest.mock("../../../assets/sounds/correct.wav", () => 1, { virtual: true });
jest.mock("react-native-safe-area-context", () => ({ SafeAreaView: "SafeAreaView" }));
jest.mock("expo-linear-gradient", () => ({ LinearGradient: "LinearGradient" }));
jest.mock("@expo/vector-icons/Ionicons", () => "Ionicons");
const mockDb = {};
jest.mock("expo-sqlite", () => ({ useSQLiteContext: () => mockDb }));
let mockChildId: string | null = "c1";
jest.mock("../children/useActiveChildId", () => ({ useActiveChildId: () => mockChildId }));
let mockToday: string[] = [];
const mockAdd = jest.fn(async () => true);
jest.mock("../../storage/play", () => ({
  addStar: (...args: unknown[]) => mockAdd(...(args as [])),
  starSummary: async () => ({ total: 4, today: mockToday }),
}));
// Each game is tested on its own; here they are stand-ins that expose their props.
jest.mock("./RescueGame", () => ({ RescueGame: "RescueGame" }));
jest.mock("./SpaceGame", () => ({ SpaceGame: "SpaceGame" }));
jest.mock("./PhotoGame", () => ({ PhotoGame: "PhotoGame" }));
jest.mock("./ClinicGame", () => ({ ClinicGame: "ClinicGame" }));
jest.mock("./GardenGame", () => ({ GardenGame: "GardenGame" }));
jest.mock("./StyleStudio", () => ({ StyleStudio: "StyleStudio" }));

let renderer: ReactTestRenderer;
const text = () => JSON.stringify(renderer.toJSON());
const card = (title: string) =>
  renderer.root.find(
    (n) => String(n.type) === "Pressable" && String(n.props.accessibilityLabel).startsWith(title),
  );

beforeEach(async () => {
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
  mockChildId = "c1";
  mockToday = [];
  mockAdd.mockClear();
  await act(async () => {
    renderer = create(<WorldScreen />);
  });
});
afterEach(async () => {
  await act(async () => renderer.unmount());
});

test("shows Нүдхэний ертөнц with today's stars, two sections and all seven games", () => {
  expect(text()).toContain(worldCopy.title);
  expect(text()).toContain(worldCopy.todayStars);
  expect(text()).toContain(worldCopy.playSection);
  expect(text()).toContain(worldCopy.restSection);
  expect(WORLD_CARDS).toHaveLength(7);
  expect(WORLD_CARDS.filter((c) => c.section === "rest").map((c) => c.key)).toEqual([
    "garden",
    "eyeMoves",
  ]);
  for (const game of WORLD_CARDS) {
    expect(text()).toContain(game.title);
    expect(text()).toContain(game.ages);
    if (game.source) expect(text()).toContain(game.source.label);
  }
  // Honest notes for parents stay on the tab.
  expect(text()).toContain(worldCopy.gamesNote);
  expect(text()).toContain(eyeRestCopy.notice);
});

test("a game earns the day's star once, then says it was already earned", async () => {
  await act(async () => card(WORLD_CARDS[0]!.title).props.onPress());
  const game = renderer.root.find((n) => String(n.type) === "RescueGame");
  expect(await game.props.onComplete()).toBe(worldCopy.starEarned);
  expect(mockAdd).toHaveBeenCalledWith(mockDb, "c1", "rescue");
  mockAdd.mockImplementationOnce(async () => false);
  expect(await game.props.onComplete()).toBe(worldCopy.starAlready);
  await act(async () => game.props.onExit());
  expect(text()).toContain(worldCopy.title);
});

test("without a child profile games still play but nothing is saved", async () => {
  await act(async () => renderer.unmount());
  mockChildId = null;
  await act(async () => {
    renderer = create(<WorldScreen />);
  });
  expect(text()).toContain(worldCopy.noChild);
  await act(async () => card(WORLD_CARDS[1]!.title).props.onPress());
  const game = renderer.root.find((n) => String(n.type) === "SpaceGame");
  expect(await game.props.onComplete()).toBe(worldCopy.noChild);
  expect(mockAdd).not.toHaveBeenCalled();
});

test("the garden sits under Амрах and gets the child's id", async () => {
  await act(async () => card(gardenCopy.title).props.onPress());
  expect(renderer.root.find((n) => String(n.type) === "GardenGame").props.childId).toBe("c1");
});
