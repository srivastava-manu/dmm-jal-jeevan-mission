#!/usr/bin/env bash
# Fails if anything secret looks like it is about to be committed. Run before pushing:
#   npm run check:secrets
# Deliberately simple and dependency-free so it works in any environment (including Replit).
set -uo pipefail
cd "$(dirname "$0")/.."

fail=0
note() { echo "  ✗ $1"; fail=1; }

echo "Checking for committed secrets…"

# 1. .env must never be tracked, now or in history.
if git ls-files --error-unmatch .env >/dev/null 2>&1; then
  note ".env is TRACKED by git — remove it: git rm --cached .env"
fi
if [ -n "$(git log --all --pretty=format: --name-only -- .env 2>/dev/null | tr -d '[:space:]')" ]; then
  note ".env appears in git HISTORY — rotate those credentials, then purge the history"
fi

# 2. A real-looking password inside a connection string in tracked files.
#    Placeholders (CHANGE_ME, <...>, USER:PASS) are fine.
if git grep -nIE 'postgres(ql)?://[^ "]+:[^ "@]+@' -- . ':!*.md' ':!.env.example' 2>/dev/null \
   | grep -vE 'CHANGE_ME|<[^>]+>|:@|password@' | grep -q .; then
  echo "  ✗ a database URL with an embedded password is committed:"
  git grep -nIE 'postgres(ql)?://[^ "]+:[^ "@]+@' -- . ':!*.md' ':!.env.example' 2>/dev/null \
    | grep -vE 'CHANGE_ME|<[^>]+>|:@|password@' | sed 's/^/      /'
  fail=1
fi

# 3. .env.example must carry placeholders only.
if grep -qE '^(SEED_[A-Z_]+|APP_DATABASE_URL)=(?!CHANGE_ME)' .env.example 2>/dev/null; then
  note ".env.example contains a non-placeholder value"
fi

# 4. .gitignore must still cover .env.
grep -qE '^\.env$' .gitignore || note ".gitignore no longer ignores .env"

if [ "$fail" -eq 0 ]; then
  echo "  ✓ no secrets found in tracked files or history"
  exit 0
fi
echo
echo "Fix the above before pushing. See SECRETS.md."
exit 1
