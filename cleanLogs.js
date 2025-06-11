import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

// Directory containing log files
const __dirname = fileURLToPath(new URL(".", import.meta.url));
const LOGS_DIR = path.join(__dirname, "logs");

// Get days argument from command line
const daysArg = process.argv[2];
const keepDays = daysArg ? parseInt(daysArg, 10) : null;

// Helper to parse timestamp string to Date
function parseTimestamp(ts) {
  return new Date(ts.replace(" ", "T") + "+08:00");
}

// Get cutoff date if days are specified
let cutoffDate = null;
if (keepDays && !isNaN(keepDays)) {
  cutoffDate = new Date(Date.now() - keepDays * 24 * 60 * 60 * 1000);
}

// Get all log files recursively
const getAllFiles = (dirPath, files = []) => {
  const entries = fs.readdirSync(dirPath, { withFileTypes: true });

  for (const entry of entries) {
    const fullPath = path.join(dirPath, entry.name);
    if (entry.isDirectory()) {
      getAllFiles(fullPath, files);
    } else if (entry.isFile()) {
      files.push(fullPath);
    }
  }
  return files;
};

const logFiles = getAllFiles(LOGS_DIR);

logFiles.forEach((filePath) => {
  // Get relative path for cleaner logging
  const relativePath = path.relative(LOGS_DIR, filePath);

  // Read all lines
  const lines = fs.readFileSync(filePath, "utf8").split("\n").filter(Boolean);
  let filteredLines = [];

  if (cutoffDate) {
    filteredLines = lines.filter((line) => {
      try {
        const entry = JSON.parse(line);
        if (!entry.timestamp) return false;
        const entryDate = parseTimestamp(entry.timestamp);
        return entryDate >= cutoffDate;
      } catch (e) {
        return false;
      }
    });
  }

  // Write back filtered results or wipe file
  fs.writeFileSync(
    filePath,
    cutoffDate
      ? filteredLines.join("\n") + (filteredLines.length ? "\n" : "")
      : "",
    "utf8"
  );

  console.log(
    cutoffDate
      ? `Cleaned ${relativePath}: kept ${filteredLines.length} entries from last ${keepDays} day(s)`
      : `Wiped all entries in ${relativePath}`
  );
});
