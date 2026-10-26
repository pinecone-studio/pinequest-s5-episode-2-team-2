/** @type {import('jest').Config} */
module.exports = {
  preset: "ts-jest",
  testEnvironment: "node",
  globals: { __DEV__: false },
  roots: ["<rootDir>/src"],
  // Hoisted test tools must use the mobile workspace's React instance.
  moduleNameMapper: { "^react$": require.resolve("react") },
};
