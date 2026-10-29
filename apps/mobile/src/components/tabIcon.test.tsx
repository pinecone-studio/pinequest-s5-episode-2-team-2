import Ionicons from "@expo/vector-icons/Ionicons";
import { act } from "react";
import { create, type ReactTestRenderer } from "react-test-renderer";
import { tabIcon, type TabIconName } from "./tabIcon";

jest.mock("@expo/vector-icons/Ionicons", () => {
  const glyphMap: Record<string, number> = {};
  for (const n of ["home", "eye", "leaf", "person"]) glyphMap[n] = glyphMap[`${n}-outline`] = 1;
  return Object.assign(() => null, { glyphMap });
});

let renderer: ReactTestRenderer;
afterEach(() => act(() => renderer?.unmount()));

test.each<TabIconName>(["home", "eye", "leaf", "person"])(
  "%s is filled when focused, outline otherwise, and exists in Ionicons",
  (name) => {
    const Icon = tabIcon(name);
    act(() => {
      renderer = create(<Icon color="#2F6FED" focused size={24} />);
    });
    expect(renderer.root.findByType(Ionicons).props).toMatchObject({
      name,
      color: "#2F6FED",
      size: 24,
    });
    act(() => renderer.update(<Icon color="#5B6B8C" focused={false} size={24} />));
    expect(renderer.root.findByType(Ionicons).props.name).toBe(`${name}-outline`);
  },
);
