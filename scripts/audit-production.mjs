import { execFileSync } from "node:child_process";

function pnpmList() {
  const pnpmCli = process.env.npm_execpath;
  if (pnpmCli) {
    return execFileSync(process.execPath, [pnpmCli, "list", "--prod", "-r", "--depth", "Infinity", "--json"], {
      encoding: "utf8"
    });
  }

  const command = process.platform === "win32" ? "corepack.cmd" : "corepack";
  return execFileSync(command, ["pnpm", "list", "--prod", "-r", "--depth", "Infinity", "--json"], {
    encoding: "utf8"
  });
}

const versions = new Map();

function visit(node) {
  for (const group of ["dependencies", "optionalDependencies"]) {
    for (const [name, dependency] of Object.entries(node?.[group] ?? {})) {
      if (dependency?.version && !name.startsWith("@tenantease/")) {
        const packageVersions = versions.get(name) ?? new Set();
        packageVersions.add(dependency.version);
        versions.set(name, packageVersions);
      }
      visit(dependency);
    }
  }
}

for (const workspace of JSON.parse(pnpmList())) visit(workspace);

const payload = Object.fromEntries(
  [...versions.entries()]
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([name, packageVersions]) => [name, [...packageVersions]])
);

const response = await fetch("https://registry.npmjs.org/-/npm/v1/security/advisories/bulk", {
  method: "POST",
  headers: { "content-type": "application/json" },
  body: JSON.stringify(payload)
});

if (!response.ok) {
  throw new Error(`npm bulk advisory request failed: ${response.status} ${response.statusText}`);
}

const result = await response.json();
const advisories = Object.entries(result).flatMap(([name, entries]) =>
  entries.map((entry) => ({ name, ...entry }))
);
const blocking = advisories.filter(({ severity }) => severity === "high" || severity === "critical");

console.log(`Production packages audited: ${Object.keys(payload).length}`);
console.log(`Advisories: ${advisories.length}; high/critical: ${blocking.length}`);

for (const advisory of blocking) {
  console.error(`[${advisory.severity}] ${advisory.name}: ${advisory.title} (${advisory.url})`);
}

if (blocking.length > 0) process.exitCode = 1;
