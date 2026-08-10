// NJJM Centre — seed data for the MVP prototype.
(function () {
if (window.NJJM_CENTRE) return;

const STATE_ROWS = [
  ["Andhra Pradesh", "K. Raghavendra", "Joint Director (IT)", "raghavendra@apswsm.gov.in", "12 Jul 2026", 118],
  ["Assam", "P. Deka", "State IT Officer", "p.deka@assamjjm.gov.in", "04 Jul 2026", 71],
  ["Bihar", "S. Kumar", "OSD (Digital)", "s.kumar@phedbihar.gov.in", "28 Jun 2026", 64],
  ["Chhattisgarh", "M. Sahu", "Deputy Director (MIS)", "m.sahu@cgphed.gov.in", "09 Jul 2026", 82],
  ["Gujarat", "H. Patel", "State IT Officer", "h.patel@wasmo.org", "02 Jul 2026", 141],
  ["Haryana", "R. Yadav", "Nodal Officer (IT)", "r.yadav@phedharyana.gov.in", "15 Jul 2026", 96],
  ["Himachal Pradesh", "A. Thakur", "State IT Officer", "a.thakur@hpjjm.gov.in", "21 Jun 2026", 77],
  ["Jharkhand", "N. Oraon", "Deputy Director (IT)", "n.oraon@dwsdjharkhand.gov.in", "18 Jul 2026", 58],
  ["Karnataka", "R. Meenakshi", "State IT Officer", "meenakshi@rdpr.kar.gov.in", "04 Aug 2026", 96],
  ["Kerala", "V. Nair", "Systems Manager", "v.nair@kwa.kerala.gov.in", "11 Jul 2026", 134],
  ["Madhya Pradesh", "D. Verma", "State IT Officer", "d.verma@mpphed.gov.in", "07 Jul 2026", 89],
  ["Maharashtra", "S. Kulkarni", "Joint Director (IT)", "s.kulkarni@mahajjm.gov.in", "01 Jul 2026", 127],
  ["Odisha", "B. Mohanty", "State IT Officer", "b.mohanty@rwssodisha.gov.in", "25 Jun 2026", 84],
  ["Punjab", "G. Singh", "Nodal Officer (MIS)", "g.singh@pbdwss.gov.in", "14 Jul 2026", 103],
  ["Rajasthan", "L. Meena", "Additional Director (IT)", "l.meena@phedrajasthan.gov.in", "30 Jun 2026", 74],
  ["Tamil Nadu", "T. Selvam", "State IT Officer", "t.selvam@twadboard.gov.in", "08 Jul 2026", 149],
  ["Telangana", "K. Reddy", "Deputy Director (IT)", "k.reddy@tsjjm.gov.in", "16 Jul 2026", 112],
  ["Uttar Pradesh", "A. Srivastava", "State IT Officer", "a.srivastava@upjjm.gov.in", "10 Jul 2026", 68],
  ["Uttarakhand", "P. Bisht", "Nodal Officer (IT)", "p.bisht@ukjalnigam.gov.in", "22 Jun 2026", 61],
  ["West Bengal", "S. Ghosh", "State IT Officer", "s.ghosh@wbphed.gov.in", "05 Jul 2026", 91],
  ["Goa", "F. D'Souza", "State IT Officer", "f.dsouza@goapwd.gov.in", null, null],
  ["Manipur", "L. Singh", "Nodal Officer (IT)", "l.singh@manipurphed.gov.in", null, null],
  ["Meghalaya", "W. Lyngdoh", "State IT Officer", "w.lyngdoh@megphed.gov.in", null, null],
  ["Puducherry", "R. Anand", "Systems Officer", "r.anand@py.gov.in", null, null]
];

// Capability baselines: the national picture NJJM should be able to SEE.
// index = layer*6 + capability. Value = typical national level for that capability.
const BASELINE = [
  // Citizens
  1.6, 3.1, 2.2, 2.9, 2.4, 1.5,
  // Frontline Workers
  2.1, 2.6, 1.4, 1.8, 0.8, 1.9,
  // Agencies
  2.4, 2.0, 2.3, 2.5, 1.5, 1.7,
  // Department
  2.7, 3.0, 1.6, 2.4, 2.2, 1.8,
  // State Functionaries — weakest layer nationally
  0.9, 0.6, 1.0, 1.3, 1.5, 0.8,
  // Shared Digital Services
  2.6, 2.8, 2.1, 1.2, 0.9, 2.0,
  // Technology Foundation
  2.2, 0.7, 1.6, 2.5, 1.0, 2.3,
  // Infrastructure Foundation
  2.6, 2.4, 1.7, 2.0, 1.9, 1.8
];

// A state sits above or below the national baseline by a consistent amount
// (its "strength"), with small per-capability variation — so weak capabilities
// stay weak nationally and strong states stay strong.
function scoresFor(seedTotal, key) {
  if (seedTotal == null) return null;
  let h = 2166136261;
  for (let i = 0; i < key.length; i++) { h ^= key.charCodeAt(i); h = Math.imul(h, 16777619); }
  const rnd = () => { h = Math.imul(h ^ (h >>> 13), 2246822507); return (Math.abs(h) % 1000) / 1000; };
  const baseTotal = BASELINE.reduce((a, b) => a + b, 0);
  const strength = (seedTotal - baseTotal) / 48;
  const out = BASELINE.map((b) => {
    const v = b + strength + (rnd() - 0.5) * 1.4;
    return Math.max(0, Math.min(4, Math.round(v)));
  });
  let total = out.reduce((a, b) => a + b, 0);
  let guard = 0;
  while (total !== seedTotal && guard++ < 4000) {
    const i = Math.floor(rnd() * 48);
    if (total < seedTotal && out[i] < 4 && out[i] < BASELINE[i] + strength + 1.6) { out[i]++; total++; }
    else if (total > seedTotal && out[i] > 0 && out[i] > BASELINE[i] + strength - 1.6) { out[i]--; total--; }
  }
  return out;
}

const STATES = STATE_ROWS.map((r, i) => ({
  id: "st" + i,
  name: r[0],
  assessor: r[1],
  designation: r[2],
  email: r[3],
  submitted: r[4],
  total: r[5],
  active: true,
  scores: scoresFor(r[5], r[0])
}));

const REQUESTS = [
  { id: "rq1", state: "Jharkhand", capability: "Field Data Management", layer: "Frontline Workers", score: 1,
    date: "19 Jul 2026", status: "New", note: "We have no digital field data capture beyond a WhatsApp group. Looking for what other states use.", reply: "" },
  { id: "rq2", state: "Bihar", capability: "Interoperability & Open Integration", layer: "Technology Foundation", score: 0,
    date: "29 Jun 2026", status: "In progress", note: "Our MIS cannot exchange data with the central IMIS. Need guidance on the API standards.", reply: "Shared the IMIS integration spec on 02 Jul. Technical call being scheduled with NIC." },
  { id: "rq3", state: "Uttar Pradesh", capability: "Water Quality Governance", layer: "Department", score: 1,
    date: "11 Jul 2026", status: "In progress", note: "LIMS procurement stalled. Would like to see a reference implementation before re-tendering.", reply: "Connected with Tamil Nadu's TWAD team on 14 Jul." },
  { id: "rq4", state: "Uttarakhand", capability: "Network & Connectivity", layer: "Infrastructure Foundation", score: 1,
    date: "23 Jun 2026", status: "Closed", note: "Hill districts have no reliable connectivity for field staff.", reply: "Offline-first sync guidance shared; BharatNet escalation raised with DoT on 27 Jun." },
  { id: "rq5", state: "Odisha", capability: "Personalized Dashboards & Reports", layer: "Shared Digital Services", score: 1,
    date: "26 Jun 2026", status: "New", note: "Block officers have no role-based view. Asking for a reference dashboard spec.", reply: "" },
  { id: "rq6", state: "Rajasthan", capability: "Integrated Planning & Programme Governance", layer: "State Functionaries", score: 0,
    date: "01 Jul 2026", status: "Closed", note: "No shared planning system across departments.", reply: "Model MoU and Gujarat's approach shared on 05 Jul." }
];

window.NJJM_CENTRE = { STATES, REQUESTS };
})();
