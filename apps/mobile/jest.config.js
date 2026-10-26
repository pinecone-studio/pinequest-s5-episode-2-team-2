/** @type {import('jest').Config} */
module.exports = {
  preset: "ts-jest",
  testEnvironment: "node",
  roots: ["<rootDir>/src"],
  // Hoisted test tools must use the mobile workspace's React instance.
  moduleNameMapper: { "^react$": require.resolve("react") },
};
