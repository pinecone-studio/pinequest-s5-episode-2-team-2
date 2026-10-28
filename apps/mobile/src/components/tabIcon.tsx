import Ionicons from "@expo/vector-icons/Ionicons";
import type { ColorValue } from "react-native";

type IconName = keyof typeof Ionicons.glyphMap;
export type TabIconName = "home" | "eye" | "time" | "person";

/** Tab bar icon (#163): filled for the selected tab, outline otherwise. */
export function tabIcon(name: TabIconName) {
  return function TabIcon({
    color,
    focused,
    size,
  }: {
    color: ColorValue;
    focused: boolean;
    size: number;
  }) {
    const glyph = (focused ? name : `${name}-outline`) as IconName;
    // Ionicons types color as string; navigation passes a ColorValue that is a string here.
    return <Ionicons name={glyph} color={color as string} size={size} />;
  };
}
