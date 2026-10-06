import { spawnSync } from "node:child_process";
import {
  readFileSync,
  writeFileSync,
  existsSync,
  unlinkSync,
  readdirSync,
} from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

const root = fileURLToPath(new URL("../", import.meta.url));
process.chdir(root);
const manifest = JSON.parse(
  readFileSync("tests/validation-owners.json", "utf8"),
);
const scanned = readdirSync("src", { recursive: true })
  .map((p) => `src/${p.replaceAll("\\", "/")}`)
  .filter((p) => /\.(ts|tsx)$/.test(p));
const classified = [...manifest.owners, ...manifest.exclusions].map(
  (item) => item.source,
);
const unclassified = scanned.filter((p) => !classified.includes(p));
if (
  unclassified.length ||
  new Set(classified).size !== classified.length ||
  classified.some((p) => !scanned.includes(p))
) {
  throw new Error(
    `Source manifest requires review; unclassified: ${unclassified.join(", ")}`,
  );
}
if (existsSync("tests/results.json")) unlinkSync("tests/results.json");
const run = spawnSync(
  process.execPath,
  ["node_modules/vitest/vitest.mjs", "run", ...process.argv.slice(2)],
  { stdio: "inherit" },
);
if (!existsSync("tests/results.json")) process.exit(run.status || 1);
const results = JSON.parse(readFileSync("tests/results.json", "utf8"));
const sources = new Map();
for (const suite of results.testResults) {
  for (const test of suite.assertionResults) {
    const match = test.fullName.match(/^\[(unit|integration)\] (src\/\S+) /);
    if (!match) throw new Error(`Missing owner/type: ${test.fullName}`);
    const [, type, source] = match;
    const owner = sources.get(source) ?? {
      source,
      actualCaseCount: 0,
      unit: 0,
      integration: 0,
      suites: [],
    };
    let entry = owner.suites.find(
      (s) =>
        s.path === path.relative(root, suite.name).replaceAll("\\", "/") &&
        s.type === type,
    );
    if (!entry) {
      entry = {
        path: path.relative(root, suite.name).replaceAll("\\", "/"),
        type,
        actualCaseCount: 0,
        cases: [],
      };
      owner.suites.push(entry);
    }
    if (test.status === "passed" || test.status === "failed") {
      entry.actualCaseCount++;
      owner.actualCaseCount++;
      owner[type]++;
    }
    entry.cases.push({ name: test.title, status: test.status });
    sources.set(source, owner);
  }
}
const inventory = {
  command: "npm test",
  fullRun: !process.argv.slice(2).length,
  integrationScope:
    "local jsdom component -> real service -> real response parser -> fake fetch; no live backend/E2E",
  runner: "Vitest",
  scannedSourceCount: scanned.length,
  ownerCount: manifest.owners.length,
  passed: results.numPassedTests,
  failed: results.numFailedTests,
  skipped: results.numPendingTests,
  actualCaseCount: results.numPassedTests + results.numFailedTests,
  sources: [...sources.values()].sort((a, b) =>
    a.source.localeCompare(b.source),
  ),
  exclusions: manifest.exclusions,
};
writeFileSync(
  "tests/validation-inventory.json",
  JSON.stringify(inventory, null, 2) + "\n",
);
const marker = "<!-- executed-inventory -->";
if (inventory.fullRun && existsSync("TESTING.md")) {
  const doc = readFileSync("TESTING.md", "utf8");
  const table = `${marker}\n\nLast full run: ${inventory.actualCaseCount} executed cases; ${inventory.passed} passed, ${inventory.failed} failed, ${inventory.skipped} skipped.\n\n| Source | Suites | Unit | Local integration | Executed |\n| --- | --- | ---: | ---: | ---: |\n${inventory.sources.map((s) => `| \`${s.source}\` | ${[...new Set(s.suites.map((x) => `\`${x.path}\``))].join(", ")} | ${s.unit} | ${s.integration} | ${s.actualCaseCount} |`).join("\n")}\n\n${marker}`;
  const start = doc.indexOf(marker),
    end = doc.indexOf(marker, start + marker.length);
  if (start >= 0 && end >= 0)
    writeFileSync(
      "TESTING.md",
      doc.slice(0, start) + table + doc.slice(end + marker.length),
    );
}
const tooSmall = inventory.sources.filter(
  (s) => s.actualCaseCount < manifest.minimumExecutedCasesPerOwner,
);
const missing = manifest.owners.filter((o) => !sources.has(o.source));
const unlisted = inventory.sources.filter(
  (s) => !manifest.owners.some((o) => o.source === s.source),
);
// A focused run may be used for debugging; the full command enforces every owner.
if (
  inventory.fullRun &&
  (missing.length ||
    unlisted.length ||
    tooSmall.length ||
    inventory.failed ||
    inventory.skipped)
) {
  console.error(
    "Inventory acceptance failed:",
    tooSmall.map((s) => s.source),
    "missing:",
    missing,
    "unlisted:",
    unlisted,
    "owners:",
    inventory.sources.length,
  );
  process.exit(1);
}
process.exit(run.status || 0);
