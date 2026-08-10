import { AssessorNav } from "../components/AssessorNav";

// Placeholder — the real "About the model" content (README screen 10) will be added next.
export function About() {
  return (
    <div className="page">
      <AssessorNav label="about" />
      <main className="centered">
        <div className="card landing">
          <span className="eyebrow accent">About the model</span>
          <h1>Digital Maturity Model</h1>
          <p className="muted">This page will describe the model. Content coming next.</p>
        </div>
      </main>
    </div>
  );
}
