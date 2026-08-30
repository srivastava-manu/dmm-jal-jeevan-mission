# Model versions — what is public, and how it gets there

The About page (`/about`, reachable without signing in) ends with a **Version history**. This
document is the single rule for what appears there. It applies to every environment and to
anyone — human or agent — working on this repo.

## Why a version list exists at all

A state's maturity score is compared across rounds. If the model changed underneath two
rounds, a moving score is not the state improving or slipping — it is the ruler changing. The
version list exists so an external reader can tell those two apart. That is its only job.

## The rule

> **A version is public when it changed what a score MEANS.**

Concretely, publish it if any of these is true:

1. A capability was **added, retired or renamed.** Cross-version compare already treats these
   as not comparable and excludes them from counts — the model has declared them material.
2. A measure was **reworded so the same practice now earns a different rating.** No diff can
   detect this for you; it is a judgement call by whoever made the change.
3. **A state's score would have come out differently** under the old wording.

If none of those hold — a regeneration from `dmm-model.js`, a typo, reordering, a formatting
change — the version is **not** public. A changelog listing everything is a changelog nobody
reads.

## The mechanism

`model_versions` carries two description columns:

| Column | Audience | Effect |
| --- | --- | --- |
| `notes` | Maintainers | Internal provenance. **Never** sent to the client. |
| `public_notes` | State officials, citizens | The text shown on About. **NULL hides the version entirely.** |

NULL is the deliberate default, and it collapses both hard questions into one act: *if you can
write a sentence a state official would understand, the version is public; if you can't, it
isn't.* You decide at the moment you publish, when you actually know what changed.

Two behaviours worth knowing:

- **Hidden versions still exist.** Assessments reference them by foreign key and cross-version
  compare reads their capabilities. This governs presentation only, never retention.
- **The version in force is always listed**, even with no note written yet (it falls back to
  "The model currently in use."). A history that omits the live model is worse than a bland
  row.

Enforced by `server/src/test/public-version-history.test.ts`, which also asserts that the
internal `notes` column never reaches the public payload.

## How to publish a new version

1. Edit `dmm-model.js` and **bump `MODEL_VERSION`.** Never edit an existing version's rows —
   the model is append-only so past assessments keep resolving against their exact wording.
2. `npm run db:gen:model` — regenerates the seed migration from the model file.
3. Decide, using the rule above, whether this version is public.
4. Add a **new** numbered migration that sets `published_at` and, if public, `public_notes`:

   ```sql
   UPDATE model_versions
      SET published_at = TIMESTAMPTZ '2026-11-01 00:00:00+00',
          public_notes = 'Two capabilities in the Data layer were split, so scores from '
                         'earlier rounds are not directly comparable for those areas.'
    WHERE version = 'v2.2';
   ```

   **Set `published_at` explicitly, at UTC midnight.** Left to its `DEFAULT now()` it records
   when each database happened to be migrated — the same version then shows a different date
   in every environment, presented publicly as a publication date. The client formats dates
   with UTC getters so every reader sees the same day; an IST midnight renders as the day
   before.

5. `npm run db:migrate`, then check `/about`.

### Writing the note

Write the **effect on the reader**, not a description of the edit.

- Good — *"Two capabilities in the Data layer were split, so scores from earlier rounds are
  not directly comparable for those areas."*
- Bad — *"Imported from dmm-model.js"* (a maintainer's note, meaningless to a state official)
- Bad — *"Measure text revised after stakeholder review."* (says something changed while
  withholding what, and asserts a review the reader cannot verify)

Never describe a release that did not happen. `seed-compare-demo.ts` inserts a **fabricated**
v2.0 so the compare screen has something to compare against; it forces `public_notes` to NULL
precisely so it can never appear on a public page.

## Keeping environments and agents in sync

Three environments touch this database — local, Replit dev, Replit production — and more than
one agent edits this repo. The rules below are what keep them from diverging. **They are not
style preferences; breaking them corrupts data or publishes false statements.**

1. **Model content enters ONLY through a checked-in migration.** Never through `psql`, the
   Replit database pane, or a console query. A row created by hand exists in one environment
   and nowhere else, and no reviewer can see it.
2. **Never edit a migration that has been applied anywhere but your own machine.** Migrations
   are recorded in `schema_migrations` by filename; an edited file will not re-run, so the
   environments silently disagree about their own schema. Fix forward with a new number.
3. **Take the next free migration number after `git pull`, not before.** Two agents working in
   parallel will both reach for `009_`. If you find a collision, renumber *yours* and re-run.
4. **`public_notes` is written by a person who decided to publish**, using the rule above. It
   is not backfilled in bulk, not copied from `notes`, and not generated from a commit message.
5. **Anything another agent must know goes in this repo**, not in one agent's memory —
   `replit.md` for Replit's agent, this file for the shared rules. A rule that lives only in a
   chat transcript is a rule the other agent will break.

The sequence for moving work between local and Replit is always `git pull --no-edit`, then
`npm install --include=dev && npm run build`, then `npm run db:migrate` if any migration
arrived.
