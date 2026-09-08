---
name: Dependency advisory verification
description: How to verify dependency-remediation tasks when npm audit and the task scanner disagree.
---

For dependency-remediation work, require both a clean package-manager audit and confirmation that every task-listed vulnerable package version is absent from the complete lockfile dependency tree.

**Why:** The task scanner can name a vulnerable transitive version that the current `npm audit` advisory feed does not report. Optional tool dependencies can also retain that exact version after their obvious parent dependency has been upgraded.

**How to apply:** Search all lockfile package entries for the exact package-version pairs in the task, and inspect the full dependency tree including development and optional dependencies. Upgrade or override the owning direct tool dependency until those pairs are gone.