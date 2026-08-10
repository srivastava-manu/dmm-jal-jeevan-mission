// "Worth a second look" — internal-consistency heuristics. Purely advisory: they never
// block submission. A capability rated high whose foundational dependency is rated very
// low is worth a second look (e.g. advanced service intelligence resting on weak data
// infrastructure). The rules are illustrative and easy to extend; they match capabilities
// by name so they survive model edits that don't rename these capabilities.

interface ConsistencyRule {
  high: string; // capability expected to depend on `needs`
  needs: string; // foundational capability it depends on
}

const CONSISTENCY_RULES: ConsistencyRule[] = [
  { high: "Water Service Intelligence", needs: "Data Infrastructure" },
  { high: "Interoperability & Open Integration", needs: "Network & Connectivity" },
  { high: "Intelligent Automation & Decision Support", needs: "Data Management & Governance" },
];

const HIGH_THRESHOLD = 3; // rated functional or better
const LOW_THRESHOLD = 1; // but the dependency is barely present

/** Returns advisory flag sentences like "X is 4 but Y is 1." */
export function computeConsistencyFlags(valuesByName: Record<string, number>): string[] {
  const flags: string[] = [];
  for (const rule of CONSISTENCY_RULES) {
    const hi = valuesByName[rule.high];
    const lo = valuesByName[rule.needs];
    if (hi === undefined || lo === undefined) continue;
    if (hi >= HIGH_THRESHOLD && lo <= LOW_THRESHOLD) {
      flags.push(`${rule.high} is ${hi} but ${rule.needs} is ${lo}.`);
    }
  }
  return flags;
}
