import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "../api";
import { useAuth } from "../auth";
import { AssessorNav } from "../components/AssessorNav";
import { CentreNav } from "../components/CentreNav";
import { SCALE, SCORE_COLORS, BANDS, MAX_SCORE, fmtDate, type PublicModel } from "../model";

// Screen 10 — "About the model". Public (no sign-in required). All model content is loaded
// from /api/model, so it always reflects the current published version; nothing about the
// model's shape (layer count, capability count, per-layer max) is hardcoded. The rating
// scale and maturity bands are presentation constants.
export function About() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [model, setModel] = useState<PublicModel | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api.model().then(setModel).catch((e) => setError(String(e.message ?? e)));
  }, []);

  const counts = model?.layers.map((l) => l.capabilities.length) ?? [];
  const uniform = counts.length > 0 && counts.every((c) => c === counts[0]);
  const perLayer = uniform ? counts[0]! : null;
  const perLayerMax = perLayer !== null ? perLayer * MAX_SCORE : null;

  return (
    <div className="page">
      {/* The page is public, but a signed-in visitor keeps their own navigation — a Centre
          user must not be handed the assessor's Results/History tabs, which their role cannot
          open. Signed out, neither bar applies. */}
      {user?.role === "centre" ? (
        <CentreNav active="about" />
      ) : user ? (
        <AssessorNav label="about" />
      ) : (
        <header className="topbar no-print">
          <div className="topbar-title">Digital maturity <span className="muted">/ about</span></div>
          <div className="topbar-right">
            <button className="primary-btn" onClick={() => navigate("/signin")}>Start the assessment</button>
          </div>
        </header>
      )}

      <main className="about">
        {error && <p className="error">{error}</p>}
        {!model && !error && <p className="muted">Loading…</p>}

        {model && (
          <>
            <section className="about-intro">
              <span className="eyebrow accent">About the model</span>
              <h1>Digital Maturity Model</h1>
              <p className="lede">
                Self-assess digital maturity across {model.totalCapabilities} capability areas
                in {model.layers.length} layers. Each capability is rated 0–{MAX_SCORE}
                {perLayerMax !== null ? `; a layer scores 0–${perLayerMax}` : ""}; the overall
                score converts to a percentage and a maturity index.
              </p>
            </section>

            <section className="about-section">
              <h2 className="section-h">The {model.layers.length} layers</h2>
              <p className="muted">
                Each layer holds {perLayer !== null ? `${perLayer} ` : ""}capability areas —{" "}
                {model.totalCapabilities} in total.
              </p>
              <div className="about-layers">
                {model.layers.map((l) => (
                  <div className="about-layer" key={l.index}>
                    <div className="about-layer-head">
                      <div className="about-layer-name">
                        <span className="mono">{l.index + 1}</span> {l.name}
                      </div>
                      <div className="about-layer-covers muted">{l.covers}</div>
                    </div>
                    <div className="pills">
                      {l.capabilities.map((c) => (
                        <span className="pill-sm" key={c}>{c}</span>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </section>

            <section className="about-section">
              <h2 className="section-h">Rating scale</h2>
              <div className="about-scale">
                {SCALE.map((lvl) => (
                  <div className="scale-level" key={lvl.n}>
                    <span className="swatch big" style={{ background: SCORE_COLORS[lvl.n]!.bg, color: SCORE_COLORS[lvl.n]!.fg }}>
                      {lvl.n}
                    </span>
                    <div>
                      <div className="scale-label">{lvl.short}</div>
                      <div className="muted small">{lvl.d}</div>
                    </div>
                  </div>
                ))}
              </div>
              <p className="muted small">
                Rate each capability against its own list of included functions. Levels 3 and 4
                depend on routine use by the intended users, not on deployment alone — a system
                rolled out statewide but used in three districts is a pilot.
              </p>
            </section>

            <section className="about-section">
              <h2 className="section-h">Maturity index</h2>
              <div className="about-bands">
                {BANDS.map((b, i) => {
                  const lo = i === 0 ? 0 : BANDS[i - 1]!.max + 1;
                  return (
                    <div className="band-item" key={b.name}>
                      <span className="swatch small" style={{ background: SCORE_COLORS[i]!.bg, color: SCORE_COLORS[i]!.fg }} />
                      <span className="band-range mono">{lo}–{b.max}%</span>
                      <span className="band-name">{b.name}</span>
                    </div>
                  );
                })}
              </div>
              <p className="muted small">Applied at layer and overall level, as a percentage of that version's maximum.</p>
            </section>

            <section className="about-section">
              <h2 className="section-h">Version history</h2>
              <div className="about-versions">
                {model.versions.map((v) => (
                  <div className="version-row" key={v.version}>
                    <span className="version-tag mono">{v.version}</span>
                    <span className="muted">{fmtDate(v.published_at)}</span>
                    <span>{v.notes}</span>
                  </div>
                ))}
              </div>
              <p className="muted small">
                Each saved assessment records the version it was taken against. Comparisons only
                compare capabilities present in both.
              </p>
            </section>
          </>
        )}
      </main>
    </div>
  );
}
