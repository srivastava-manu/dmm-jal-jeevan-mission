(function(){
if (window.DMM_MODEL) return;
// Digital Maturity Model — content. Plain script (no module exports) so it
// inlines into the standalone HTML and works from file:// locally.
// Versioned data, not markup: capability
// names, measure text and "includes" lists change without touching screens.
const MODEL_VERSION = "v2.1";

const SCALE = [
  { n: 0, short: "Does not exist", t: "Does not exist", d: "No digital system for this capability. Handled on paper, in spreadsheets, or not at all." },
  { n: 1, short: "Under development", t: "Under development", d: "A system has been sanctioned, procured or is in development. Nothing is in productive use yet." },
  { n: 2, short: "Pilot complete", t: "Pilot complete", d: "Live and working with real data in a limited setting — one or a few districts, or a small user group — for at least one full reporting cycle. Not yet rolled out further." },
  { n: 3, short: "Functional, limited scale", t: "Functional at limited scale", d: "In routine production use across part of the state by the intended users. Gaps remain — some districts still manual, or some workflow steps still offline." },
  { n: 4, short: "Fully functional, state scale", t: "Fully functional at state scale", d: "In routine use across effectively all districts by effectively all intended users. The data is authoritative, no parallel manual register is maintained, and the system is owned and monitored." }
];

const BANDS = [
  { max: 20, name: "Nascent" },
  { max: 40, name: "Emerging" },
  { max: 60, name: "Developing" },
  { max: 80, name: "Mature" },
  { max: 100, name: "Leading" }
];

const SCORE_COLORS = [
  { bg: "#DE9D9B", fg: "#5c2320" },
  { bg: "#ECB576", fg: "#5f3a10" },
  { bg: "#FBE6A2", fg: "#5f4c0a" },
  { bg: "#DCE9D5", fg: "#33502a" },
  { bg: "#58A65C", fg: "#ffffff" }
];

const C = (n, m, inc) => ({ n, m, inc: inc || [] });

const LAYERS = [
  {
    name: "Citizens", covers: "Digital services reaching consumers and households directly", short: "Citizens",
    caps: [
      C("Feedback & Satisfaction", "Whether the State has the digital capability to systematically collect, analyze, and act upon citizen feedback regarding rural drinking water services.", ["Feedback capture", "Sentiment analysis", "Closure of loop"]),
      C("Consumer Registry & Profile", "Whether the State has a digital registry of FHTC / consumers with a unique identifier, and whether this database is authoritative, complete, up-to-date, interoperable and actively used.", ["Unique consumer ID", "Household mapping", "Interoperability", "Active use"]),
      C("Connection Lifecycle Management", "Whether the State effectively manages the entire lifecycle of a Functional Household Tap Connection (FHTC): from application through installation, modification, transfer, suspension and disconnection.", ["Application", "Installation", "Transfer", "Suspension", "Disconnection"]),
      C("Digital Billing & Payments", "Whether the state has the capability to digitally view bills, receive payment reminders, make online payments through multiple channels, access payment history and receive digital receipts.", ["Bill view", "Reminders", "Online payment", "Payment history", "Digital receipts"]),
      C("Notifications & Alerts", "Whether the system has the capability to notify citizens before they need to ask — planned supply interruptions, water quality advisories, bill due reminders, complaint status updates or restoration notices.", ["Supply interruptions", "Quality advisories", "Bill reminders", "Complaint status"]),
      C("Citizen Engagement & Participation", "Whether the State provides digital mechanisms that enable citizens and communities to actively participate in governance, monitoring, planning and decision-making.", ["Participation", "Community monitoring", "Planning inputs"])
    ]
  },
  {
    name: "Frontline Workers", covers: "Digital tools used by field staff for monitoring and reporting", short: "Frontline",
    caps: [
      C("Water Quantity & Regularity Monitoring", "Whether the system has the capability to enable frontline workers to accurately measure, digitally report and validate daily water supply data in a timely manner using standardized processes and digital tools.", ["Daily reporting", "Validation", "Integration", "Governance"]),
      C("Water Quality Monitoring & FTK", "Whether the system has the capability to enable frontline workers to conduct Field Test Kit (FTK) tests, digitally report water quality observations, identify potential quality issues and support routine village-level surveillance.", ["FTK testing", "Digital reporting", "Issue identification"]),
      C("Asset Maintenance & Financial Management", "Whether the system has the capability to enable frontline workers to digitally record asset maintenance, O&M expenditure, collections and village-level financial management.", ["Maintenance logs", "O&M expenditure", "Collections"]),
      C("Community Engagement", "Whether the system has the capability to enable frontline workers to digitally plan, conduct, record and monitor community mobilization and IEC activities that promote safe water practices and sustainable operation.", ["IEC planning", "Activity records", "Monitoring"]),
      C("Field Data Management", "Whether the system has the capability to enable frontline workers to digitally collect, validate, update and report operational field data, inspections, surveys, asset information and compliance records.", ["Field collection", "Inspections", "Surveys", "Compliance records"]),
      C("Digital Work Assistance", "Whether the State has the capability to digitally empower frontline workers through mobile applications, role-based dashboards, contextual digital assistants, training, knowledge resources and alerts.", ["Mobile apps", "Role dashboards", "Training", "Alerts"])
    ]
  },
  {
    name: "Agencies", covers: "Digital management of implementing and operating agencies", short: "Agencies",
    caps: [
      C("Project Delivery & Quality Assurance", "Whether the State has the capability to digitally plan, execute, monitor and validate rural water infrastructure projects, ensuring timely completion, adherence to quality standards and compliance with contractual and technical requirements.", ["Planning", "Execution", "Quality checks", "Compliance"]),
      C("Asset Lifecycle Management", "Whether the State has the capability to digitally manage water supply assets throughout their lifecycle, including commissioning, tagging, handover, maintenance history, condition monitoring and lifecycle updates.", ["Commissioning", "Tagging", "Handover", "Maintenance history", "Condition monitoring"]),
      C("Water Service Delivery", "Whether the State has the capability to digitally operate and manage rural water supply schemes by monitoring water production, bulk water flow, supply schedules, service continuity and operational performance.", ["Production", "Bulk flow", "Supply schedules", "Service continuity"]),
      C("Water Quality Management", "Whether the State has the capability to digitally manage water quality surveillance through laboratory testing, compliance monitoring, reporting and timely corrective actions to ensure safe and compliant drinking water.", ["Lab testing", "Compliance monitoring", "Reporting", "Corrective action"]),
      C("Operations & Resource Management", "Whether the State has the capability to digitally plan, allocate and monitor operational resources, including workforce, equipment, materials, consumables and finances, to support efficient O&M of water supply schemes.", ["Workforce", "Equipment", "Materials", "Finances"]),
      C("Contract Performance & Compliance", "Whether the State has the capability to digitally monitor contractual obligations, service levels, inspections, audits, performance indicators and statutory compliance to ensure effective and accountable service delivery.", ["Obligations", "Service levels", "Inspections", "Audits", "Statutory compliance"])
    ]
  },
  {
    name: "Department", covers: "Digital systems for planning, finance, and governance at department level", short: "Department",
    caps: [
      C("Infrastructure Planning & Asset Governance", "Whether the State has the capability to digitally plan, design, govern and manage rural water infrastructure throughout its lifecycle, including DPR preparation, asset inventory, commissioning and lifecycle management.", ["Asset Management", "Inventory", "BOQ", "DPR", "Asset Registry"]),
      C("Vendor & Financial Management", "Whether the State has the capability to digitally manage procurement, contracts, work orders, invoices, payments and financial transactions, ensuring financial accountability and integration with government financial systems.", ["Vendor Management", "Contracts", "Work Orders", "Invoices", "Payments", "IFMS"]),
      C("Water Resource & Sustainability Management", "Whether the State has the capability to digitally assess, monitor and manage water sources, hydrogeology and source sustainability to ensure long-term availability and resilience.", ["Source Sustainability", "Source Geology", "Water Audits"]),
      C("Water Service Intelligence", "Whether the State has the capability to digitally monitor, analyse and optimise rural water service delivery using operational data, dashboards, analytics, predictive insights and decision-support tools.", ["BI", "MIS", "Dashboards", "Predictive Maintenance", "Scheme Risk Forecasting"]),
      C("Water Quality Governance", "Whether the State has the capability to digitally monitor, analyse and govern drinking water quality through laboratory management, surveillance, compliance monitoring and timely corrective actions.", ["LIMS", "Water Quality surveillance"]),
      C("Engineering & Network Intelligence", "Whether the State has the capability to digitally model, monitor and optimise water supply infrastructure using engineering tools, spatial intelligence, network modelling and operational telemetry.", ["GIS", "Geo-tagging", "Hydraulic Modeling", "IoT", "SCADA"])
    ]
  },
  {
    name: "State Functionaries", covers: "Cross-department coordination and strategic decision-making", short: "State fn.",
    caps: [
      C("Interdepartmental Coordination & Collaboration", "Whether the State has the capability to digitally coordinate, collaborate and exchange information across departments to enable seamless execution of programmes and coordinated governance of rural drinking water services.", ["Data exchange", "Workflow", "Coordination"]),
      C("Integrated Planning & Programme Governance", "Whether the State has the capability to digitally support joint planning, approvals, programme monitoring and governance across multiple departments.", ["Joint planning", "Approvals", "Programme governance"]),
      C("Cross-Sector Policy & Regulatory Alignment", "Whether the State has the capability to digitally support alignment of policies, regulations, standards and institutional responsibilities across sectors.", ["Policy alignment", "Regulatory coordination"]),
      C("Strategic Intelligence & Decision Support", "Whether the State has the capability to provide integrated analytics, dashboards and cross-sector insights that enable evidence-based planning, monitoring and strategic decision-making.", ["Analytics", "Dashboards", "Performance monitoring"]),
      C("Public Feedback & Stakeholder Engagement", "Whether the State has the capability to digitally consolidate citizen feedback, grievances and stakeholder inputs across departments to improve service delivery, transparency and policy effectiveness.", ["Grievances", "Feedback", "Citizen inputs"]),
      C("Emergency Preparedness & Resilience Management", "Whether the State has the capability to digitally coordinate preparedness, emergency response, disaster management and recovery across departments to ensure continuity of drinking water services.", ["Disaster management", "Emergency response", "Drought", "Floods", "Contamination events"])
    ]
  },
  {
    name: "Shared Digital Services", covers: "Services shared across all stakeholder groups", short: "Shared svc",
    caps: [
      C("Stakeholder Identity & Lifecycle Management", "Whether the State has the capability to digitally onboard, authenticate, authorize and manage the lifecycle, profiles and access of all stakeholders across the water service ecosystem.", ["User management", "Onboarding", "Identity", "Roles", "Access"]),
      C("Grievance & Service Request Management", "Whether the State has the capability to digitally receive, assign, track, escalate and resolve grievances and service requests across stakeholders with timely response, transparency and accountability.", ["Intake", "Assignment", "Escalation", "Resolution", "SLA tracking"]),
      C("Capacity Building & Knowledge Management", "Whether the State has the capability to digitally deliver training, certifications, knowledge resources, SOPs and continuous learning opportunities to strengthen stakeholder competencies.", ["LMS", "Training", "Certification", "Knowledge", "Digital learning"]),
      C("Personalized Dashboards & Reports", "Whether the State has the capability to provide stakeholders with role-based dashboards, reports, alerts and insights that support operational monitoring, performance management and informed decision-making.", ["Role-based dashboards", "Personalized KPIs", "Drill-down", "Self-service reporting", "Automated distribution"]),
      C("Intelligent Assistance & Decision Support", "Whether the State has the capability to provide contextual assistance, conversational interfaces, recommendations and guided workflows that help stakeholders perform tasks more effectively.", ["Context-aware guidance", "Decision support", "Recommendations", "Conversational assistance"]),
      C("Omnichannel Digital Experience", "Whether the State has the capability to enable stakeholders to access digital services through multiple channels such as mobile applications, web portals, WhatsApp, SMS, IVRS and future digital interfaces.", ["WhatsApp", "Mobile", "Portal", "IVRS", "SMS", "Email"])
    ]
  },
  {
    name: "Technology Foundation", covers: "The software layer underlying every other layer", short: "Tech fdn",
    caps: [
      C("Digital Platform & Architecture", "Whether the State has the capability to build and operate scalable, modular, resilient and maintainable digital solutions using modern architectural principles, reusable components and cloud-ready technologies.", ["Unified platform", "Modular architecture", "Microservices", "Cloud native", "DevOps", "Containerization"]),
      C("Interoperability & Open Integration", "Whether the State has the capability to seamlessly exchange information and integrate with central, state and external systems through open standards, APIs, common data models and interoperable interfaces.", ["APIs", "Centre systems", "State systems", "Standards", "Registries", "Eventing"]),
      C("Data Management & Governance", "Whether the State has the capability to establish trusted, high-quality and well-governed data through standardized data models, master data management, metadata, data quality and data governance practices.", ["Master data management", "Metadata", "Data quality", "Data governance", "Data catalog", "Lineage", "Stewardship"]),
      C("Digital Identity & Access Management", "Whether the State has the capability to securely manage digital identities, authentication, authorization and access control for users, applications and services while ensuring privacy and accountability.", ["IAM", "SSO", "RBAC", "MFA"]),
      C("Intelligent Automation & Decision Support", "Whether the State has the capability to leverage intelligent technologies to automate business processes, generate insights, support decision-making and improve operational efficiency.", ["AI", "ML", "OCR", "Prediction", "Recommendations", "NLP"]),
      C("Security, Privacy & Compliance", "Whether the State has the capability to protect digital systems and data through comprehensive security controls, privacy safeguards, risk management and compliance with applicable standards and regulations.", ["Security", "Privacy", "Compliance", "Audit", "Encryption", "Monitoring"])
    ]
  },
  {
    name: "Infrastructure Foundation", covers: "The compute and network layer underlying the technology foundation", short: "Infra fdn",
    caps: [
      C("Compute & Hosting Infrastructure", "Whether the State has the capability to provision, manage and optimize reliable compute and hosting infrastructure supporting secure, efficient and continuous operation of digital services.", ["Cloud", "On-premises", "Virtualization", "Containers", "Compute resources"]),
      C("Data Infrastructure", "Whether the State has the capability to provide reliable, scalable and high-performance storage, databases and data services that support secure data management, processing and retrieval.", ["Databases", "Object storage", "File storage", "Caching", "Data services"]),
      C("Network & Connectivity", "Whether the State has the capability to provide secure, reliable and high-performance network connectivity enabling seamless communication between users, applications, infrastructure and external systems.", ["Internet", "VPN", "MPLS", "SD-WAN", "Connectivity to remote areas"]),
      C("Infrastructure Resilience & Continuity", "Whether the State has the capability to ensure uninterrupted operation and rapid recovery of digital services through high availability, backup, disaster recovery and business continuity mechanisms.", ["HA", "Backup", "Disaster Recovery", "Failover", "Business Continuity"]),
      C("Infrastructure Monitoring & Operations", "Whether the State has the capability to continuously monitor infrastructure health, performance, availability and operational events, enabling proactive detection, incident response and optimization.", ["Monitoring", "Logging", "Alerting", "Observability", "Incident Management"]),
      C("Elasticity & Performance Management", "Whether the State has the capability to dynamically scale infrastructure resources and optimize system performance to meet changing workloads while maintaining reliability and cost efficiency.", ["Horizontal scaling", "Vertical scaling", "Auto scaling", "Load balancing", "Performance tuning"])
    ]
  }
];

const STATES = ["Andaman and Nicobar Islands","Andhra Pradesh","Arunachal Pradesh","Assam","Bihar","Chandigarh","Chhattisgarh","Dadra and Nagar Haveli and Daman and Diu","Delhi (National Capital Territory)","Goa","Gujarat","Haryana","Himachal Pradesh","Jammu and Kashmir","Jharkhand","Karnataka","Kerala","Ladakh","Lakshadweep","Madhya Pradesh","Maharashtra","Manipur","Meghalaya","Mizoram","Nagaland","Odisha","Puducherry","Punjab","Rajasthan","Sikkim","Tamil Nadu","Telangana","Tripura","Uttar Pradesh","Uttarakhand","West Bengal"];

const SEED_SYSTEMS = [
  { id: "s1", name: "State Water MIS", districts: 33, goLive: "2023-04" },
  { id: "s2", name: "FHTC Consumer Registry", districts: 33, goLive: "2024-01" },
  { id: "s3", name: "FTK Mobile App", districts: 21, goLive: "2024-08" },
  { id: "s4", name: "Vendor & Contract Portal", districts: 33, goLive: "2022-11" },
  { id: "s5", name: "SCADA / Telemetry Platform", districts: 12, goLive: "2025-02" },
  { id: "s6", name: "Grievance Portal (JJM)", districts: 33, goLive: "2023-09" },
  { id: "s7", name: "LIMS — State Water Labs", districts: 18, goLive: "2024-05" },
  { id: "s8", name: "GIS Asset Registry", districts: 26, goLive: "2023-12" }
];

// Two past rounds, so "progress over time" has something real to show.
const SEED_FEB = [
  2, 3, 1, 1, 3, 2,
  1, 2, 1, 2, 1, 2,
  3, 2, 2, 3, 1, 1,
  3, 3, 2, 4, 3, 2,
  1, 0, 2, 1, 2, 1,
  2, 2, 3, 1, 2, 2,
  2, 1, 2, 3, 1, 2,
  2, 2, 3, 3, 2, 2
];

const SEED_AUG = [
  1, 2, 0, 0, 2, 1,
  0, 1, 1, 1, 0, 1,
  2, 1, 1, 2, 0, 0,
  2, 2, 1, 3, 2, 1,
  0, 0, 1, 0, 1, 0,
  1, 2, 2, 0, 1, 1,
  1, 0, 1, 2, 0, 2,
  2, 1, 2, 2, 1, 1
];

window.DMM_MODEL = { MODEL_VERSION, SCALE, BANDS, SCORE_COLORS, LAYERS, STATES, SEED_SYSTEMS, SEED_FEB, SEED_AUG };
})();
