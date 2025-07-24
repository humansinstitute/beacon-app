export default {
  transform: {
    "^.+\\.js$": "babel-jest",
  },
  moduleNameMapper: {
    "^(\\.{1,2}/.*)\\.js$": "$1",
  },
  // If you have ESM dependencies in node_modules, add them here:
  transformIgnorePatterns: ["/node_modules/(?!(uuid)/)"],
  testEnvironment: "node",
};
