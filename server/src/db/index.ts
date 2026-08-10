import type { PoolClient } from "pg";
import { withRlsTx, type RlsContext, type Role } from "./rls.js";

/** Thrown when a write targets an assessment past its 7-day lock. */
export class AssessmentLockedError extends Error {
  constructor(public readonly lockedAt: string) {
    super(`This assessment locked on ${lockedAt} and can no longer be edited.`);
    this.name = "AssessmentLockedError";
  }
}

/** Thrown when a submit is attempted with capabilities still unanswered. */
export class IncompleteAssessmentError extends Error {
  constructor(public readonly answered: number, public readonly total: number) {
    super(`Assessment is incomplete: ${answered} of ${total} answered.`);
    this.name = "IncompleteAssessmentError";
  }
}

/**
 * API-level lock guard (the RLS policies are the independent backstop). Reads the
 * assessment in the caller's RLS context, so a foreign/invisible assessment reads as
 * "not found". Throws AssessmentLockedError once now() >= locked_at.
 */
async function assertEditable(c: PoolClient, assessmentId: string): Promise<void> {
  const { rows } = await c.query<{ locked_at: string | null; locked: boolean }>(
    `SELECT locked_at, (locked_at IS NOT NULL AND now() >= locked_at) AS locked
     FROM assessments WHERE id = $1`,
    [assessmentId],
  );
  const row = rows[0];
  if (!row) throw new Error("Assessment not found.");
  if (row.locked) throw new AssessmentLockedError(row.locked_at!);
}

// ─────────────────────────────────────────────────────────────────────────────
// The ONLY module that writes SQL. Route handlers call these scoped functions and
// never build queries themselves, so the data-isolation rules are reviewable in one
// place. Everything state-scoped runs through withRlsTx; the RLS policies (not this
// code) are the real guarantee.
// ─────────────────────────────────────────────────────────────────────────────

export interface DbUser {
  id: string;
  email: string;
  name: string;
  designation: string | null;
  role: Role;
  state_id: string | null;
  active: boolean;
  created_at: string;
}

export interface AuthUserRow extends DbUser {
  password_hash: string;
}

const USER_COLS =
  "id, email, name, designation, role, state_id, active, created_at";

// ── Auth (pre-context; via SECURITY DEFINER function) ────────────────────────

/** Look up a user by email for credential verification. Runs with no app.* context. */
export async function authLookupByEmail(email: string): Promise<AuthUserRow | null> {
  return withRlsTx(null, async (c) => {
    const { rows } = await c.query<AuthUserRow>(
      "SELECT * FROM auth_lookup_by_email($1)",
      [email],
    );
    return rows[0] ?? null;
  });
}

// ── Sessions (via SECURITY DEFINER functions) ────────────────────────────────

export async function sessionCreate(
  userId: string,
  ttlHours: number,
): Promise<{ id: string; expires_at: string }> {
  return withRlsTx(null, async (c) => {
    const { rows } = await c.query<{ id: string; expires_at: string }>(
      "SELECT id, expires_at FROM session_create($1, $2)",
      [userId, ttlHours],
    );
    if (!rows[0]) throw new Error("session_create returned no row");
    return rows[0];
  });
}

export interface ResolvedSession {
  session_id: string;
  user_id: string;
  role: Role;
  state_id: string | null;
  name: string;
  email: string;
  designation: string | null;
  expires_at: string;
}

export async function sessionResolve(
  sessionId: string,
): Promise<ResolvedSession | null> {
  return withRlsTx(null, async (c) => {
    const { rows } = await c.query<ResolvedSession>(
      "SELECT * FROM session_resolve($1)",
      [sessionId],
    );
    return rows[0] ?? null;
  });
}

export async function sessionDestroy(sessionId: string): Promise<void> {
  await withRlsTx(null, async (c) => {
    await c.query("SELECT session_destroy($1)", [sessionId]);
  });
}

// ── Users (RLS-scoped by the caller's context) ───────────────────────────────

export async function getUserById(
  ctx: RlsContext,
  id: string,
): Promise<DbUser | null> {
  return withRlsTx(ctx, async (c) => {
    const { rows } = await c.query<DbUser>(
      `SELECT ${USER_COLS} FROM users WHERE id = $1`,
      [id],
    );
    return rows[0] ?? null;
  });
}

/**
 * Intentionally unscoped `SELECT ... FROM users` (no WHERE). It returns only the rows
 * the caller's RLS context is permitted to see — used by the isolation test to prove
 * that a buggy/hostile query still cannot cross state boundaries.
 */
export async function listVisibleUsers(ctx: RlsContext): Promise<DbUser[]> {
  return withRlsTx(ctx, async (c) => {
    const { rows } = await c.query<DbUser>(`SELECT ${USER_COLS} FROM users`);
    return rows;
  });
}

// ── States (public reference data) ───────────────────────────────────────────

export interface DbState {
  id: string;
  name: string;
  is_ut: boolean;
}

export async function listStates(): Promise<DbState[]> {
  return withRlsTx(null, async (c) => {
    const { rows } = await c.query<DbState>(
      "SELECT id, name, is_ut FROM states ORDER BY name",
    );
    return rows;
  });
}

// ── National dashboard (Centre) ──────────────────────────────────────────────
// Every query here runs in the Centre's RLS context, so the "submitted only" rule is
// enforced by the database, not by these WHERE clauses. Non-submitting states are simply
// absent from the joins — never counted as zero.

export interface CurrentModelVersion {
  id: string;
  version: string;
}

export async function getCurrentModelVersion(
  ctx: RlsContext,
): Promise<CurrentModelVersion | null> {
  return withRlsTx(ctx, async (c) => {
    const { rows } = await c.query<CurrentModelVersion>(
      "SELECT id, version FROM model_versions ORDER BY published_at DESC LIMIT 1",
    );
    return rows[0] ?? null;
  });
}

export interface NationalCapabilityMean {
  capability_id: string;
  layer_index: number;
  order_in_layer: number;
  layer_name: string;
  name: string;
  mean: number | null; // null if no submitted state has this capability
  contributing: number; // number of states contributing to the mean
}

/**
 * Mean score per capability across the LATEST submitted assessment per state. Multiple
 * submitted rounds for one state must not double-count it, so we take one row per state.
 * RLS has already limited `assessments`/`scores` to submitted ones for the Centre.
 */
export async function getNationalCapabilityMeans(
  ctx: RlsContext,
  modelVersionId: string,
): Promise<NationalCapabilityMean[]> {
  return withRlsTx(ctx, async (c) => {
    const { rows } = await c.query<NationalCapabilityMean>(
      `WITH latest AS (
         SELECT DISTINCT ON (a.state_id) a.id
         FROM assessments a
         WHERE a.status = 'submitted'
         ORDER BY a.state_id, a.submitted_at DESC, a.id
       )
       SELECT
         c.id                              AS capability_id,
         c.layer_index,
         c.order_in_layer,
         c.layer_name,
         c.name,
         round(avg(s.value)::numeric, 2)   AS mean,
         count(s.value)::int               AS contributing
       FROM capabilities c
       LEFT JOIN scores s
         ON s.capability_id = c.id
        AND s.assessment_id IN (SELECT id FROM latest)
       WHERE c.model_version_id = $1
       GROUP BY c.id, c.layer_index, c.order_in_layer, c.layer_name, c.name
       ORDER BY c.layer_index, c.order_in_layer`,
      [modelVersionId],
    );
    // pg returns numeric as string; normalise to number | null.
    return rows.map((r) => ({
      ...r,
      mean: r.mean === null ? null : Number(r.mean),
    }));
  });
}

export async function countSubmittedStates(ctx: RlsContext): Promise<number> {
  return withRlsTx(ctx, async (c) => {
    const { rows } = await c.query<{ n: number }>(
      "SELECT count(DISTINCT state_id)::int AS n FROM assessments WHERE status = 'submitted'",
    );
    return rows[0]?.n ?? 0;
  });
}

export async function countActiveAssessorStates(ctx: RlsContext): Promise<number> {
  return withRlsTx(ctx, async (c) => {
    const { rows } = await c.query<{ n: number }>(
      "SELECT count(*)::int AS n FROM users WHERE role = 'state_assessor' AND active",
    );
    return rows[0]?.n ?? 0;
  });
}

// ── State assessment flow (state_assessor) ───────────────────────────────────
// Everything here runs in the assessor's RLS context, scoped to their own state. Counts
// (total, answered, score) are derived from the capability/score rows, never hardcoded.
// "answered" = count(value) = number of non-null scores, so 0 counts as answered.

export interface Capability {
  id: string;
  layer_index: number;
  layer_name: string;
  layer_covers: string;
  order_in_layer: number;
  name: string;
  measure: string;
  includes: string[];
}

export interface AssessmentSummary {
  id: string;
  status: "draft" | "submitted";
  created_at: string;
  submitted_at: string | null;
  assessor_name: string | null;
  model_version: string;
  total: number;
  answered: number;
  score_so_far: number;
}

export interface EvidenceRow {
  system_id: string | null;
  districts_live: number | null;
  go_live: string | null;
}

export interface ScoreRow {
  score_id: string;
  capability_id: string;
  value: number | null;
  note: string | null;
  evidence: EvidenceRow | null;
}

export interface SystemRow {
  id: string;
  name: string;
  districts_live: number | null;
  go_live: string | null;
}

export interface AssessmentDetail {
  assessment: {
    id: string;
    status: "draft" | "submitted";
    created_at: string;
    submitted_at: string | null;
    model_version_id: string;
    model_version: string;
  };
  capabilities: Capability[];
  scores: ScoreRow[];
  previous: { assessment_id: string; submitted_at: string; values: Record<string, number> } | null;
}

const CAP_COLS =
  "id, layer_index, layer_name, layer_covers, order_in_layer, name, measure, includes";

export async function listCapabilities(
  ctx: RlsContext,
  modelVersionId: string,
): Promise<Capability[]> {
  return withRlsTx(ctx, async (c) => {
    const { rows } = await c.query<Capability>(
      `SELECT ${CAP_COLS} FROM capabilities WHERE model_version_id = $1
       ORDER BY layer_index, order_in_layer`,
      [modelVersionId],
    );
    return rows;
  });
}

export async function listAssessments(ctx: RlsContext): Promise<AssessmentSummary[]> {
  return withRlsTx(ctx, async (c) => {
    const { rows } = await c.query<AssessmentSummary>(
      `SELECT a.id, a.status, a.created_at, a.submitted_at, a.assessor_name,
              mv.version AS model_version,
              (SELECT count(*)::int FROM capabilities cap
                 WHERE cap.model_version_id = a.model_version_id) AS total,
              (SELECT count(sc.value)::int FROM scores sc
                 WHERE sc.assessment_id = a.id) AS answered,
              (SELECT coalesce(sum(sc.value), 0)::int FROM scores sc
                 WHERE sc.assessment_id = a.id) AS score_so_far
       FROM assessments a
       JOIN model_versions mv ON mv.id = a.model_version_id
       ORDER BY (a.status = 'draft') DESC, coalesce(a.submitted_at, a.created_at) DESC`,
    );
    return rows;
  });
}

/**
 * Start a new draft. Any existing draft for the state is replaced. When mode = 'prefill',
 * real `scores` rows are written by copying the latest submitted assessment's values (and
 * its evidence is carried forward) — the new assessment stands on its own rows, it does not
 * merely display the old ones.
 */
export async function createAssessment(
  ctx: RlsContext,
  mode: "blank" | "prefill",
): Promise<{ id: string; prefilledFrom: string | null }> {
  return withRlsTx(ctx, async (c) => {
    // Replace any existing draft (one draft per state).
    await c.query("DELETE FROM assessments WHERE status = 'draft'");

    const mv = await c.query<{ id: string }>(
      "SELECT id FROM model_versions ORDER BY published_at DESC LIMIT 1",
    );
    const modelVersionId = mv.rows[0]?.id;
    if (!modelVersionId) throw new Error("No model version published.");

    const ins = await c.query<{ id: string }>(
      `INSERT INTO assessments (state_id, assessor_user_id, model_version_id, status)
       VALUES ($1, $2, $3, 'draft')
       RETURNING id`,
      [ctx.stateId, ctx.userId, modelVersionId],
    );
    const newId = ins.rows[0]!.id;

    let prefilledFrom: string | null = null;
    if (mode === "prefill") {
      const prev = await c.query<{ id: string; submitted_at: string }>(
        `SELECT id, submitted_at FROM assessments
         WHERE status = 'submitted' ORDER BY submitted_at DESC LIMIT 1`,
      );
      const prevId = prev.rows[0]?.id;
      if (prevId) {
        prefilledFrom = prev.rows[0]!.submitted_at;
        // Copy real score rows.
        await c.query(
          `INSERT INTO scores (assessment_id, capability_id, value, note)
           SELECT $1, capability_id, value, note FROM scores WHERE assessment_id = $2`,
          [newId, prevId],
        );
        // Carry evidence forward, mapping old score -> new score by capability.
        await c.query(
          `INSERT INTO score_evidence (score_id, system_id, districts_live, go_live)
           SELECT ns.id, e.system_id, e.districts_live, e.go_live
           FROM score_evidence e
           JOIN scores os ON os.id = e.score_id
           JOIN scores ns ON ns.assessment_id = $1 AND ns.capability_id = os.capability_id
           WHERE os.assessment_id = $2`,
          [newId, prevId],
        );
      }
    }
    return { id: newId, prefilledFrom };
  });
}

export async function deleteDraft(ctx: RlsContext, id: string): Promise<boolean> {
  return withRlsTx(ctx, async (c) => {
    // RLS restricts this to the assessor's own-state draft.
    const res = await c.query("DELETE FROM assessments WHERE id = $1 AND status = 'draft'", [id]);
    return (res.rowCount ?? 0) > 0;
  });
}

export async function getAssessmentDetail(
  ctx: RlsContext,
  id: string,
): Promise<AssessmentDetail | null> {
  return withRlsTx(ctx, async (c) => {
    const a = await c.query<{
      id: string;
      status: "draft" | "submitted";
      created_at: string;
      submitted_at: string | null;
      model_version_id: string;
      model_version: string;
    }>(
      `SELECT a.id, a.status, a.created_at, a.submitted_at, a.model_version_id,
              mv.version AS model_version
       FROM assessments a JOIN model_versions mv ON mv.id = a.model_version_id
       WHERE a.id = $1`,
      [id],
    );
    const assessment = a.rows[0];
    if (!assessment) return null; // not visible under RLS, or does not exist

    const caps = await c.query<Capability>(
      `SELECT ${CAP_COLS} FROM capabilities WHERE model_version_id = $1
       ORDER BY layer_index, order_in_layer`,
      [assessment.model_version_id],
    );

    const scoreRows = await c.query<{
      score_id: string;
      capability_id: string;
      value: number | null;
      note: string | null;
      system_id: string | null;
      districts_live: number | null;
      go_live: string | null;
    }>(
      `SELECT s.id AS score_id, s.capability_id, s.value, s.note,
              e.system_id, e.districts_live, e.go_live
       FROM scores s LEFT JOIN score_evidence e ON e.score_id = s.id
       WHERE s.assessment_id = $1`,
      [id],
    );
    const scores: ScoreRow[] = scoreRows.rows.map((r) => ({
      score_id: r.score_id,
      capability_id: r.capability_id,
      value: r.value,
      note: r.note,
      evidence:
        r.system_id || r.districts_live !== null || r.go_live
          ? { system_id: r.system_id, districts_live: r.districts_live, go_live: r.go_live }
          : null,
    }));

    // Previous submitted snapshot for this state (for "Was N on <date>").
    const prev = await c.query<{ id: string; submitted_at: string }>(
      `SELECT id, submitted_at FROM assessments
       WHERE status = 'submitted' AND id <> $1
       ORDER BY submitted_at DESC LIMIT 1`,
      [id],
    );
    let previous: AssessmentDetail["previous"] = null;
    if (prev.rows[0]) {
      const pv = await c.query<{ capability_id: string; value: number | null }>(
        "SELECT capability_id, value FROM scores WHERE assessment_id = $1",
        [prev.rows[0].id],
      );
      const values: Record<string, number> = {};
      for (const r of pv.rows) if (r.value !== null) values[r.capability_id] = r.value;
      previous = {
        assessment_id: prev.rows[0].id,
        submitted_at: prev.rows[0].submitted_at,
        values,
      };
    }

    return { assessment, capabilities: caps.rows, scores, previous };
  });
}

/** Upsert a single capability's score. value may be null (unanswered); 0 is a real answer. */
export async function upsertScore(
  ctx: RlsContext,
  assessmentId: string,
  capabilityId: string,
  value: number | null,
  note: string | null,
): Promise<{ score_id: string; value: number | null }> {
  return withRlsTx(ctx, async (c) => {
    await assertEditable(c, assessmentId); // clear API error; RLS also enforces the lock
    const res = await c.query<{ id: string; value: number | null }>(
      `INSERT INTO scores (assessment_id, capability_id, value, note)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (assessment_id, capability_id)
         DO UPDATE SET value = EXCLUDED.value, note = EXCLUDED.note
       RETURNING id, value`,
      [assessmentId, capabilityId, value, note],
    );
    const row = res.rows[0]!;
    // Evidence only belongs to scores of 3 or 4; clear it if the score dropped below 3.
    if (value === null || value < 3) {
      await c.query(
        "UPDATE score_evidence SET system_id = NULL, districts_live = NULL, go_live = NULL WHERE score_id = $1",
        [row.id],
      );
    }
    return { score_id: row.id, value: row.value };
  });
}

/** Upsert evidence for a capability's score, resolving the score row server-side. */
export async function saveEvidence(
  ctx: RlsContext,
  assessmentId: string,
  capabilityId: string,
  ev: { system_id: string | null; districts_live: number | null; go_live: string | null },
): Promise<boolean> {
  return withRlsTx(ctx, async (c) => {
    await assertEditable(c, assessmentId);
    const res = await c.query(
      `INSERT INTO score_evidence (score_id, system_id, districts_live, go_live)
       SELECT s.id, $3, $4, $5 FROM scores s
       WHERE s.assessment_id = $1 AND s.capability_id = $2
       ON CONFLICT (score_id) DO UPDATE SET
         system_id = EXCLUDED.system_id,
         districts_live = EXCLUDED.districts_live,
         go_live = EXCLUDED.go_live`,
      [assessmentId, capabilityId, ev.system_id, ev.districts_live, ev.go_live],
    );
    return (res.rowCount ?? 0) > 0;
  });
}

export async function listSystems(ctx: RlsContext): Promise<SystemRow[]> {
  return withRlsTx(ctx, async (c) => {
    const { rows } = await c.query<SystemRow>(
      "SELECT id, name, districts_live, go_live FROM systems ORDER BY name",
    );
    return rows;
  });
}

export async function createSystem(
  ctx: RlsContext,
  input: { name: string; districts_live: number | null; go_live: string | null },
): Promise<SystemRow> {
  return withRlsTx(ctx, async (c) => {
    const { rows } = await c.query<SystemRow>(
      `INSERT INTO systems (state_id, name, districts_live, go_live)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (state_id, name) DO UPDATE SET
         districts_live = EXCLUDED.districts_live, go_live = EXCLUDED.go_live
       RETURNING id, name, districts_live, go_live`,
      [ctx.stateId, input.name, input.districts_live, input.go_live],
    );
    return rows[0]!;
  });
}

// ── Review & submit ──────────────────────────────────────────────────────────

export interface UnansweredCapability {
  capability_id: string;
  name: string;
  layer_index: number;
  layer_name: string;
}

export interface EvidenceGap {
  capability_id: string;
  name: string;
  layer_name: string;
  value: number;
}

export interface ReviewData {
  id: string;
  status: "draft" | "submitted";
  locked_at: string | null;
  total: number; // capability count for THIS assessment's model version
  answered: number; // count(value) — 0 counts, nulls/missing do not
  unanswered: UnansweredCapability[];
  evidenceGaps: EvidenceGap[];
  valuesByName: Record<string, number>; // answered capability -> value, for consistency checks
}

/**
 * The single authoritative source for the review screen. `answered` and `total` are
 * computed here by querying THIS assessment's rows against the capability count for its
 * model version — the front end must trust these, never recompute them. That is what
 * prevents "unanswered list empty but submit disabled" disagreements.
 */
export async function reviewAssessment(
  ctx: RlsContext,
  id: string,
): Promise<ReviewData | null> {
  return withRlsTx(ctx, async (c) => {
    const a = await c.query<{ status: "draft" | "submitted"; model_version_id: string; locked_at: string | null }>(
      "SELECT status, model_version_id, locked_at FROM assessments WHERE id = $1",
      [id],
    );
    if (!a.rows[0]) return null;
    const { status, model_version_id, locked_at } = a.rows[0];

    const total = (
      await c.query<{ n: number }>(
        "SELECT count(*)::int AS n FROM capabilities WHERE model_version_id = $1",
        [model_version_id],
      )
    ).rows[0]!.n;

    const answered = (
      await c.query<{ n: number }>(
        "SELECT count(value)::int AS n FROM scores WHERE assessment_id = $1",
        [id],
      )
    ).rows[0]!.n;

    const unanswered = (
      await c.query<UnansweredCapability>(
        `SELECT cap.id AS capability_id, cap.name, cap.layer_index, cap.layer_name
         FROM capabilities cap
         LEFT JOIN scores s ON s.capability_id = cap.id AND s.assessment_id = $2
         WHERE cap.model_version_id = $1 AND s.value IS NULL
         ORDER BY cap.layer_index, cap.order_in_layer`,
        [model_version_id, id],
      )
    ).rows;

    const evidenceGaps = (
      await c.query<EvidenceGap>(
        `SELECT cap.id AS capability_id, cap.name, cap.layer_name, s.value
         FROM scores s
         JOIN capabilities cap ON cap.id = s.capability_id
         LEFT JOIN score_evidence e ON e.score_id = s.id
         WHERE s.assessment_id = $1 AND s.value >= 3 AND e.system_id IS NULL
         ORDER BY cap.layer_index, cap.order_in_layer`,
        [id],
      )
    ).rows;

    const valueRows = (
      await c.query<{ name: string; value: number }>(
        `SELECT cap.name, s.value FROM scores s
         JOIN capabilities cap ON cap.id = s.capability_id
         WHERE s.assessment_id = $1 AND s.value IS NOT NULL`,
        [id],
      )
    ).rows;
    const valuesByName: Record<string, number> = {};
    for (const r of valueRows) valuesByName[r.name] = r.value;

    return { id, status, locked_at, total, answered, unanswered, evidenceGaps, valuesByName };
  });
}

/**
 * Submit a draft. Re-checks completeness server-side (independent of any client state),
 * stamps submitted_at / locked_at, and SNAPSHOTS the submitter's name + designation onto
 * the row so reassigning the state later never rewrites who submitted a past round.
 */
export async function submitAssessment(
  ctx: RlsContext,
  id: string,
  assessorName: string,
  assessorDesignation: string | null,
): Promise<{ submitted_at: string; locked_at: string }> {
  return withRlsTx(ctx, async (c) => {
    const a = await c.query<{ status: string; model_version_id: string }>(
      "SELECT status, model_version_id FROM assessments WHERE id = $1",
      [id],
    );
    if (!a.rows[0]) throw new Error("Assessment not found.");
    if (a.rows[0].status !== "draft") throw new Error("Assessment is already submitted.");

    const total = (
      await c.query<{ n: number }>(
        "SELECT count(*)::int AS n FROM capabilities WHERE model_version_id = $1",
        [a.rows[0].model_version_id],
      )
    ).rows[0]!.n;
    const answered = (
      await c.query<{ n: number }>(
        "SELECT count(value)::int AS n FROM scores WHERE assessment_id = $1",
        [id],
      )
    ).rows[0]!.n;
    if (answered !== total) throw new IncompleteAssessmentError(answered, total);

    const upd = await c.query<{ submitted_at: string; locked_at: string }>(
      `UPDATE assessments
       SET status = 'submitted',
           submitted_at = now(),
           locked_at = now() + interval '7 days',
           assessor_name = $2,
           assessor_designation = $3
       WHERE id = $1 AND status = 'draft'
       RETURNING submitted_at, locked_at`,
      [id, assessorName, assessorDesignation],
    );
    if (!upd.rows[0]) throw new Error("Could not submit (assessment not editable).");
    return upd.rows[0];
  });
}
