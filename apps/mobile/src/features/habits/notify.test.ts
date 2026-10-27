import { reminderIdentifier, type PlannedReminder } from "./reminderPlan";

const mock = {
  granted: false,
  canAskAgain: true,
  grantOnRequest: true,
  cancelled: [] as string[],
  scheduled: [] as { identifier?: string; trigger: unknown }[],
  requests: 0,
};

jest.mock("expo-notifications", () => ({
  SchedulableTriggerInputTypes: { DAILY: "daily", DATE: "date" },
  getPermissionsAsync: async () => ({ granted: mock.granted, canAskAgain: mock.canAskAgain }),
  requestPermissionsAsync: async () => {
    mock.requests += 1;
    return { granted: mock.grantOnRequest };
  },
  cancelScheduledNotificationAsync: async (id: string) => {
    mock.cancelled.push(id);
  },
  scheduleNotificationAsync: async (request: { identifier?: string; trigger: unknown }) => {
    mock.scheduled.push(request);
    return request.identifier;
  },
  cancelAllScheduledNotificationsAsync: async () => {},
}));

// Imported after the mock so the module under test receives it.
import { syncChildReminders } from "./notify";

const text = () => ({ title: "t", body: "b" });
const daily: PlannedReminder = {
  identifier: reminderIdentifier("c1", "outdoor"),
  kind: "outdoor",
  trigger: { type: "daily", hour: 16, minute: 0 },
};

beforeEach(() => {
  Object.assign(mock, { granted: false, canAskAgain: true, grantOnRequest: true, requests: 0 });
  mock.cancelled = [];
  mock.scheduled = [];
});

test("saving replaces the child's reminders and asks for permission once", async () => {
  await expect(syncChildReminders("c1", [daily], text)).resolves.toBe("scheduled");
  expect(mock.cancelled).toHaveLength(3);
  expect(mock.requests).toBe(1);
  expect(mock.scheduled).toEqual([
    {
      identifier: daily.identifier,
      content: { title: "t", body: "b" },
      trigger: { type: "daily", hour: 16, minute: 0 },
    },
  ]);
});

test("turning everything off clears reminders without asking for permission", async () => {
  await expect(syncChildReminders("c1", [], text)).resolves.toBe("cleared");
  expect(mock.cancelled).toHaveLength(3);
  expect(mock.requests).toBe(0);
});

test("denied permission schedules nothing", async () => {
  mock.grantOnRequest = false;
  await expect(syncChildReminders("c1", [daily], text)).resolves.toBe("denied");
  mock.canAskAgain = false;
  await expect(syncChildReminders("c1", [daily], text)).resolves.toBe("denied");
  expect(mock.requests).toBe(1);
  expect(mock.scheduled).toHaveLength(0);
});
