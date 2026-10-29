import { fonts, theme } from "../theme";

// Pushed screens get a back button (#163). Each screen shows its own title, so the bar has none.
export const stackHeader = {
  title: "",
  headerBackTitle: "Буцах",
  headerBackTitleStyle: { fontFamily: fonts.bold },
  headerTintColor: theme.colors.primary,
  headerStyle: { backgroundColor: theme.colors.background },
  headerShadowVisible: false,
};
