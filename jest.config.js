export default {
  transform: {
    "^.+\\.js$": "babel-jest",
  },
  // If you have ESM dependencies in node_modules, add them here:
  // transformIgnorePatterns: ["/node_modules/(?!(your-esm-packages)/)"],
  testEnvironment: "node",
};
