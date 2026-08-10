-- 004_seed_model.sql
-- GENERATED from dmm-model.js by server/src/scripts/gen-model-migration.ts — do not edit by hand.
-- Seeds model version v2.1 and its capabilities. Idempotent (ON CONFLICT DO NOTHING)
-- and append-only: a model revision adds a NEW version and NEW capability rows; existing
-- rows are never edited, so past assessments keep resolving against their exact wording.

INSERT INTO model_versions (version, notes)
VALUES ('v2.1', 'Imported from dmm-model.js')
ON CONFLICT (version) DO NOTHING;

-- Layer 0: Citizens
INSERT INTO capabilities (model_version_id, layer_index, layer_name, layer_covers, order_in_layer, name, measure, includes)
SELECT mv.id, 0, 'Citizens', 'Digital services reaching consumers and households directly', 0, 'Feedback & Satisfaction', 'Whether the State has the digital capability to systematically collect, analyze, and act upon citizen feedback regarding rural drinking water services.', ARRAY['Feedback capture', 'Sentiment analysis', 'Closure of loop']::text[]
FROM model_versions mv WHERE mv.version = 'v2.1'
ON CONFLICT (model_version_id, layer_index, order_in_layer) DO NOTHING;

INSERT INTO capabilities (model_version_id, layer_index, layer_name, layer_covers, order_in_layer, name, measure, includes)
SELECT mv.id, 0, 'Citizens', 'Digital services reaching consumers and households directly', 1, 'Consumer Registry & Profile', 'Whether the State has a digital registry of FHTC / consumers with a unique identifier, and whether this database is authoritative, complete, up-to-date, interoperable and actively used.', ARRAY['Unique consumer ID', 'Household mapping', 'Interoperability', 'Active use']::text[]
FROM model_versions mv WHERE mv.version = 'v2.1'
ON CONFLICT (model_version_id, layer_index, order_in_layer) DO NOTHING;

INSERT INTO capabilities (model_version_id, layer_index, layer_name, layer_covers, order_in_layer, name, measure, includes)
SELECT mv.id, 0, 'Citizens', 'Digital services reaching consumers and households directly', 2, 'Connection Lifecycle Management', 'Whether the State effectively manages the entire lifecycle of a Functional Household Tap Connection (FHTC): from application through installation, modification, transfer, suspension and disconnection.', ARRAY['Application', 'Installation', 'Transfer', 'Suspension', 'Disconnection']::text[]
FROM model_versions mv WHERE mv.version = 'v2.1'
ON CONFLICT (model_version_id, layer_index, order_in_layer) DO NOTHING;

INSERT INTO capabilities (model_version_id, layer_index, layer_name, layer_covers, order_in_layer, name, measure, includes)
SELECT mv.id, 0, 'Citizens', 'Digital services reaching consumers and households directly', 3, 'Digital Billing & Payments', 'Whether the state has the capability to digitally view bills, receive payment reminders, make online payments through multiple channels, access payment history and receive digital receipts.', ARRAY['Bill view', 'Reminders', 'Online payment', 'Payment history', 'Digital receipts']::text[]
FROM model_versions mv WHERE mv.version = 'v2.1'
ON CONFLICT (model_version_id, layer_index, order_in_layer) DO NOTHING;

INSERT INTO capabilities (model_version_id, layer_index, layer_name, layer_covers, order_in_layer, name, measure, includes)
SELECT mv.id, 0, 'Citizens', 'Digital services reaching consumers and households directly', 4, 'Notifications & Alerts', 'Whether the system has the capability to notify citizens before they need to ask — planned supply interruptions, water quality advisories, bill due reminders, complaint status updates or restoration notices.', ARRAY['Supply interruptions', 'Quality advisories', 'Bill reminders', 'Complaint status']::text[]
FROM model_versions mv WHERE mv.version = 'v2.1'
ON CONFLICT (model_version_id, layer_index, order_in_layer) DO NOTHING;

INSERT INTO capabilities (model_version_id, layer_index, layer_name, layer_covers, order_in_layer, name, measure, includes)
SELECT mv.id, 0, 'Citizens', 'Digital services reaching consumers and households directly', 5, 'Citizen Engagement & Participation', 'Whether the State provides digital mechanisms that enable citizens and communities to actively participate in governance, monitoring, planning and decision-making.', ARRAY['Participation', 'Community monitoring', 'Planning inputs']::text[]
FROM model_versions mv WHERE mv.version = 'v2.1'
ON CONFLICT (model_version_id, layer_index, order_in_layer) DO NOTHING;

-- Layer 1: Frontline Workers
INSERT INTO capabilities (model_version_id, layer_index, layer_name, layer_covers, order_in_layer, name, measure, includes)
SELECT mv.id, 1, 'Frontline Workers', 'Digital tools used by field staff for monitoring and reporting', 0, 'Water Quantity & Regularity Monitoring', 'Whether the system has the capability to enable frontline workers to accurately measure, digitally report and validate daily water supply data in a timely manner using standardized processes and digital tools.', ARRAY['Daily reporting', 'Validation', 'Integration', 'Governance']::text[]
FROM model_versions mv WHERE mv.version = 'v2.1'
ON CONFLICT (model_version_id, layer_index, order_in_layer) DO NOTHING;

INSERT INTO capabilities (model_version_id, layer_index, layer_name, layer_covers, order_in_layer, name, measure, includes)
SELECT mv.id, 1, 'Frontline Workers', 'Digital tools used by field staff for monitoring and reporting', 1, 'Water Quality Monitoring & FTK', 'Whether the system has the capability to enable frontline workers to conduct Field Test Kit (FTK) tests, digitally report water quality observations, identify potential quality issues and support routine village-level surveillance.', ARRAY['FTK testing', 'Digital reporting', 'Issue identification']::text[]
FROM model_versions mv WHERE mv.version = 'v2.1'
ON CONFLICT (model_version_id, layer_index, order_in_layer) DO NOTHING;

INSERT INTO capabilities (model_version_id, layer_index, layer_name, layer_covers, order_in_layer, name, measure, includes)
SELECT mv.id, 1, 'Frontline Workers', 'Digital tools used by field staff for monitoring and reporting', 2, 'Asset Maintenance & Financial Management', 'Whether the system has the capability to enable frontline workers to digitally record asset maintenance, O&M expenditure, collections and village-level financial management.', ARRAY['Maintenance logs', 'O&M expenditure', 'Collections']::text[]
FROM model_versions mv WHERE mv.version = 'v2.1'
ON CONFLICT (model_version_id, layer_index, order_in_layer) DO NOTHING;

INSERT INTO capabilities (model_version_id, layer_index, layer_name, layer_covers, order_in_layer, name, measure, includes)
SELECT mv.id, 1, 'Frontline Workers', 'Digital tools used by field staff for monitoring and reporting', 3, 'Community Engagement', 'Whether the system has the capability to enable frontline workers to digitally plan, conduct, record and monitor community mobilization and IEC activities that promote safe water practices and sustainable operation.', ARRAY['IEC planning', 'Activity records', 'Monitoring']::text[]
FROM model_versions mv WHERE mv.version = 'v2.1'
ON CONFLICT (model_version_id, layer_index, order_in_layer) DO NOTHING;

INSERT INTO capabilities (model_version_id, layer_index, layer_name, layer_covers, order_in_layer, name, measure, includes)
SELECT mv.id, 1, 'Frontline Workers', 'Digital tools used by field staff for monitoring and reporting', 4, 'Field Data Management', 'Whether the system has the capability to enable frontline workers to digitally collect, validate, update and report operational field data, inspections, surveys, asset information and compliance records.', ARRAY['Field collection', 'Inspections', 'Surveys', 'Compliance records']::text[]
FROM model_versions mv WHERE mv.version = 'v2.1'
ON CONFLICT (model_version_id, layer_index, order_in_layer) DO NOTHING;

INSERT INTO capabilities (model_version_id, layer_index, layer_name, layer_covers, order_in_layer, name, measure, includes)
SELECT mv.id, 1, 'Frontline Workers', 'Digital tools used by field staff for monitoring and reporting', 5, 'Digital Work Assistance', 'Whether the State has the capability to digitally empower frontline workers through mobile applications, role-based dashboards, contextual digital assistants, training, knowledge resources and alerts.', ARRAY['Mobile apps', 'Role dashboards', 'Training', 'Alerts']::text[]
FROM model_versions mv WHERE mv.version = 'v2.1'
ON CONFLICT (model_version_id, layer_index, order_in_layer) DO NOTHING;

-- Layer 2: Agencies
INSERT INTO capabilities (model_version_id, layer_index, layer_name, layer_covers, order_in_layer, name, measure, includes)
SELECT mv.id, 2, 'Agencies', 'Digital management of implementing and operating agencies', 0, 'Project Delivery & Quality Assurance', 'Whether the State has the capability to digitally plan, execute, monitor and validate rural water infrastructure projects, ensuring timely completion, adherence to quality standards and compliance with contractual and technical requirements.', ARRAY['Planning', 'Execution', 'Quality checks', 'Compliance']::text[]
FROM model_versions mv WHERE mv.version = 'v2.1'
ON CONFLICT (model_version_id, layer_index, order_in_layer) DO NOTHING;

INSERT INTO capabilities (model_version_id, layer_index, layer_name, layer_covers, order_in_layer, name, measure, includes)
SELECT mv.id, 2, 'Agencies', 'Digital management of implementing and operating agencies', 1, 'Asset Lifecycle Management', 'Whether the State has the capability to digitally manage water supply assets throughout their lifecycle, including commissioning, tagging, handover, maintenance history, condition monitoring and lifecycle updates.', ARRAY['Commissioning', 'Tagging', 'Handover', 'Maintenance history', 'Condition monitoring']::text[]
FROM model_versions mv WHERE mv.version = 'v2.1'
ON CONFLICT (model_version_id, layer_index, order_in_layer) DO NOTHING;

INSERT INTO capabilities (model_version_id, layer_index, layer_name, layer_covers, order_in_layer, name, measure, includes)
SELECT mv.id, 2, 'Agencies', 'Digital management of implementing and operating agencies', 2, 'Water Service Delivery', 'Whether the State has the capability to digitally operate and manage rural water supply schemes by monitoring water production, bulk water flow, supply schedules, service continuity and operational performance.', ARRAY['Production', 'Bulk flow', 'Supply schedules', 'Service continuity']::text[]
FROM model_versions mv WHERE mv.version = 'v2.1'
ON CONFLICT (model_version_id, layer_index, order_in_layer) DO NOTHING;

INSERT INTO capabilities (model_version_id, layer_index, layer_name, layer_covers, order_in_layer, name, measure, includes)
SELECT mv.id, 2, 'Agencies', 'Digital management of implementing and operating agencies', 3, 'Water Quality Management', 'Whether the State has the capability to digitally manage water quality surveillance through laboratory testing, compliance monitoring, reporting and timely corrective actions to ensure safe and compliant drinking water.', ARRAY['Lab testing', 'Compliance monitoring', 'Reporting', 'Corrective action']::text[]
FROM model_versions mv WHERE mv.version = 'v2.1'
ON CONFLICT (model_version_id, layer_index, order_in_layer) DO NOTHING;

INSERT INTO capabilities (model_version_id, layer_index, layer_name, layer_covers, order_in_layer, name, measure, includes)
SELECT mv.id, 2, 'Agencies', 'Digital management of implementing and operating agencies', 4, 'Operations & Resource Management', 'Whether the State has the capability to digitally plan, allocate and monitor operational resources, including workforce, equipment, materials, consumables and finances, to support efficient O&M of water supply schemes.', ARRAY['Workforce', 'Equipment', 'Materials', 'Finances']::text[]
FROM model_versions mv WHERE mv.version = 'v2.1'
ON CONFLICT (model_version_id, layer_index, order_in_layer) DO NOTHING;

INSERT INTO capabilities (model_version_id, layer_index, layer_name, layer_covers, order_in_layer, name, measure, includes)
SELECT mv.id, 2, 'Agencies', 'Digital management of implementing and operating agencies', 5, 'Contract Performance & Compliance', 'Whether the State has the capability to digitally monitor contractual obligations, service levels, inspections, audits, performance indicators and statutory compliance to ensure effective and accountable service delivery.', ARRAY['Obligations', 'Service levels', 'Inspections', 'Audits', 'Statutory compliance']::text[]
FROM model_versions mv WHERE mv.version = 'v2.1'
ON CONFLICT (model_version_id, layer_index, order_in_layer) DO NOTHING;

-- Layer 3: Department
INSERT INTO capabilities (model_version_id, layer_index, layer_name, layer_covers, order_in_layer, name, measure, includes)
SELECT mv.id, 3, 'Department', 'Digital systems for planning, finance, and governance at department level', 0, 'Infrastructure Planning & Asset Governance', 'Whether the State has the capability to digitally plan, design, govern and manage rural water infrastructure throughout its lifecycle, including DPR preparation, asset inventory, commissioning and lifecycle management.', ARRAY['Asset Management', 'Inventory', 'BOQ', 'DPR', 'Asset Registry']::text[]
FROM model_versions mv WHERE mv.version = 'v2.1'
ON CONFLICT (model_version_id, layer_index, order_in_layer) DO NOTHING;

INSERT INTO capabilities (model_version_id, layer_index, layer_name, layer_covers, order_in_layer, name, measure, includes)
SELECT mv.id, 3, 'Department', 'Digital systems for planning, finance, and governance at department level', 1, 'Vendor & Financial Management', 'Whether the State has the capability to digitally manage procurement, contracts, work orders, invoices, payments and financial transactions, ensuring financial accountability and integration with government financial systems.', ARRAY['Vendor Management', 'Contracts', 'Work Orders', 'Invoices', 'Payments', 'IFMS']::text[]
FROM model_versions mv WHERE mv.version = 'v2.1'
ON CONFLICT (model_version_id, layer_index, order_in_layer) DO NOTHING;

INSERT INTO capabilities (model_version_id, layer_index, layer_name, layer_covers, order_in_layer, name, measure, includes)
SELECT mv.id, 3, 'Department', 'Digital systems for planning, finance, and governance at department level', 2, 'Water Resource & Sustainability Management', 'Whether the State has the capability to digitally assess, monitor and manage water sources, hydrogeology and source sustainability to ensure long-term availability and resilience.', ARRAY['Source Sustainability', 'Source Geology', 'Water Audits']::text[]
FROM model_versions mv WHERE mv.version = 'v2.1'
ON CONFLICT (model_version_id, layer_index, order_in_layer) DO NOTHING;

INSERT INTO capabilities (model_version_id, layer_index, layer_name, layer_covers, order_in_layer, name, measure, includes)
SELECT mv.id, 3, 'Department', 'Digital systems for planning, finance, and governance at department level', 3, 'Water Service Intelligence', 'Whether the State has the capability to digitally monitor, analyse and optimise rural water service delivery using operational data, dashboards, analytics, predictive insights and decision-support tools.', ARRAY['BI', 'MIS', 'Dashboards', 'Predictive Maintenance', 'Scheme Risk Forecasting']::text[]
FROM model_versions mv WHERE mv.version = 'v2.1'
ON CONFLICT (model_version_id, layer_index, order_in_layer) DO NOTHING;

INSERT INTO capabilities (model_version_id, layer_index, layer_name, layer_covers, order_in_layer, name, measure, includes)
SELECT mv.id, 3, 'Department', 'Digital systems for planning, finance, and governance at department level', 4, 'Water Quality Governance', 'Whether the State has the capability to digitally monitor, analyse and govern drinking water quality through laboratory management, surveillance, compliance monitoring and timely corrective actions.', ARRAY['LIMS', 'Water Quality surveillance']::text[]
FROM model_versions mv WHERE mv.version = 'v2.1'
ON CONFLICT (model_version_id, layer_index, order_in_layer) DO NOTHING;

INSERT INTO capabilities (model_version_id, layer_index, layer_name, layer_covers, order_in_layer, name, measure, includes)
SELECT mv.id, 3, 'Department', 'Digital systems for planning, finance, and governance at department level', 5, 'Engineering & Network Intelligence', 'Whether the State has the capability to digitally model, monitor and optimise water supply infrastructure using engineering tools, spatial intelligence, network modelling and operational telemetry.', ARRAY['GIS', 'Geo-tagging', 'Hydraulic Modeling', 'IoT', 'SCADA']::text[]
FROM model_versions mv WHERE mv.version = 'v2.1'
ON CONFLICT (model_version_id, layer_index, order_in_layer) DO NOTHING;

-- Layer 4: State Functionaries
INSERT INTO capabilities (model_version_id, layer_index, layer_name, layer_covers, order_in_layer, name, measure, includes)
SELECT mv.id, 4, 'State Functionaries', 'Cross-department coordination and strategic decision-making', 0, 'Interdepartmental Coordination & Collaboration', 'Whether the State has the capability to digitally coordinate, collaborate and exchange information across departments to enable seamless execution of programmes and coordinated governance of rural drinking water services.', ARRAY['Data exchange', 'Workflow', 'Coordination']::text[]
FROM model_versions mv WHERE mv.version = 'v2.1'
ON CONFLICT (model_version_id, layer_index, order_in_layer) DO NOTHING;

INSERT INTO capabilities (model_version_id, layer_index, layer_name, layer_covers, order_in_layer, name, measure, includes)
SELECT mv.id, 4, 'State Functionaries', 'Cross-department coordination and strategic decision-making', 1, 'Integrated Planning & Programme Governance', 'Whether the State has the capability to digitally support joint planning, approvals, programme monitoring and governance across multiple departments.', ARRAY['Joint planning', 'Approvals', 'Programme governance']::text[]
FROM model_versions mv WHERE mv.version = 'v2.1'
ON CONFLICT (model_version_id, layer_index, order_in_layer) DO NOTHING;

INSERT INTO capabilities (model_version_id, layer_index, layer_name, layer_covers, order_in_layer, name, measure, includes)
SELECT mv.id, 4, 'State Functionaries', 'Cross-department coordination and strategic decision-making', 2, 'Cross-Sector Policy & Regulatory Alignment', 'Whether the State has the capability to digitally support alignment of policies, regulations, standards and institutional responsibilities across sectors.', ARRAY['Policy alignment', 'Regulatory coordination']::text[]
FROM model_versions mv WHERE mv.version = 'v2.1'
ON CONFLICT (model_version_id, layer_index, order_in_layer) DO NOTHING;

INSERT INTO capabilities (model_version_id, layer_index, layer_name, layer_covers, order_in_layer, name, measure, includes)
SELECT mv.id, 4, 'State Functionaries', 'Cross-department coordination and strategic decision-making', 3, 'Strategic Intelligence & Decision Support', 'Whether the State has the capability to provide integrated analytics, dashboards and cross-sector insights that enable evidence-based planning, monitoring and strategic decision-making.', ARRAY['Analytics', 'Dashboards', 'Performance monitoring']::text[]
FROM model_versions mv WHERE mv.version = 'v2.1'
ON CONFLICT (model_version_id, layer_index, order_in_layer) DO NOTHING;

INSERT INTO capabilities (model_version_id, layer_index, layer_name, layer_covers, order_in_layer, name, measure, includes)
SELECT mv.id, 4, 'State Functionaries', 'Cross-department coordination and strategic decision-making', 4, 'Public Feedback & Stakeholder Engagement', 'Whether the State has the capability to digitally consolidate citizen feedback, grievances and stakeholder inputs across departments to improve service delivery, transparency and policy effectiveness.', ARRAY['Grievances', 'Feedback', 'Citizen inputs']::text[]
FROM model_versions mv WHERE mv.version = 'v2.1'
ON CONFLICT (model_version_id, layer_index, order_in_layer) DO NOTHING;

INSERT INTO capabilities (model_version_id, layer_index, layer_name, layer_covers, order_in_layer, name, measure, includes)
SELECT mv.id, 4, 'State Functionaries', 'Cross-department coordination and strategic decision-making', 5, 'Emergency Preparedness & Resilience Management', 'Whether the State has the capability to digitally coordinate preparedness, emergency response, disaster management and recovery across departments to ensure continuity of drinking water services.', ARRAY['Disaster management', 'Emergency response', 'Drought', 'Floods', 'Contamination events']::text[]
FROM model_versions mv WHERE mv.version = 'v2.1'
ON CONFLICT (model_version_id, layer_index, order_in_layer) DO NOTHING;

-- Layer 5: Shared Digital Services
INSERT INTO capabilities (model_version_id, layer_index, layer_name, layer_covers, order_in_layer, name, measure, includes)
SELECT mv.id, 5, 'Shared Digital Services', 'Services shared across all stakeholder groups', 0, 'Stakeholder Identity & Lifecycle Management', 'Whether the State has the capability to digitally onboard, authenticate, authorize and manage the lifecycle, profiles and access of all stakeholders across the water service ecosystem.', ARRAY['User management', 'Onboarding', 'Identity', 'Roles', 'Access']::text[]
FROM model_versions mv WHERE mv.version = 'v2.1'
ON CONFLICT (model_version_id, layer_index, order_in_layer) DO NOTHING;

INSERT INTO capabilities (model_version_id, layer_index, layer_name, layer_covers, order_in_layer, name, measure, includes)
SELECT mv.id, 5, 'Shared Digital Services', 'Services shared across all stakeholder groups', 1, 'Grievance & Service Request Management', 'Whether the State has the capability to digitally receive, assign, track, escalate and resolve grievances and service requests across stakeholders with timely response, transparency and accountability.', ARRAY['Intake', 'Assignment', 'Escalation', 'Resolution', 'SLA tracking']::text[]
FROM model_versions mv WHERE mv.version = 'v2.1'
ON CONFLICT (model_version_id, layer_index, order_in_layer) DO NOTHING;

INSERT INTO capabilities (model_version_id, layer_index, layer_name, layer_covers, order_in_layer, name, measure, includes)
SELECT mv.id, 5, 'Shared Digital Services', 'Services shared across all stakeholder groups', 2, 'Capacity Building & Knowledge Management', 'Whether the State has the capability to digitally deliver training, certifications, knowledge resources, SOPs and continuous learning opportunities to strengthen stakeholder competencies.', ARRAY['LMS', 'Training', 'Certification', 'Knowledge', 'Digital learning']::text[]
FROM model_versions mv WHERE mv.version = 'v2.1'
ON CONFLICT (model_version_id, layer_index, order_in_layer) DO NOTHING;

INSERT INTO capabilities (model_version_id, layer_index, layer_name, layer_covers, order_in_layer, name, measure, includes)
SELECT mv.id, 5, 'Shared Digital Services', 'Services shared across all stakeholder groups', 3, 'Personalized Dashboards & Reports', 'Whether the State has the capability to provide stakeholders with role-based dashboards, reports, alerts and insights that support operational monitoring, performance management and informed decision-making.', ARRAY['Role-based dashboards', 'Personalized KPIs', 'Drill-down', 'Self-service reporting', 'Automated distribution']::text[]
FROM model_versions mv WHERE mv.version = 'v2.1'
ON CONFLICT (model_version_id, layer_index, order_in_layer) DO NOTHING;

INSERT INTO capabilities (model_version_id, layer_index, layer_name, layer_covers, order_in_layer, name, measure, includes)
SELECT mv.id, 5, 'Shared Digital Services', 'Services shared across all stakeholder groups', 4, 'Intelligent Assistance & Decision Support', 'Whether the State has the capability to provide contextual assistance, conversational interfaces, recommendations and guided workflows that help stakeholders perform tasks more effectively.', ARRAY['Context-aware guidance', 'Decision support', 'Recommendations', 'Conversational assistance']::text[]
FROM model_versions mv WHERE mv.version = 'v2.1'
ON CONFLICT (model_version_id, layer_index, order_in_layer) DO NOTHING;

INSERT INTO capabilities (model_version_id, layer_index, layer_name, layer_covers, order_in_layer, name, measure, includes)
SELECT mv.id, 5, 'Shared Digital Services', 'Services shared across all stakeholder groups', 5, 'Omnichannel Digital Experience', 'Whether the State has the capability to enable stakeholders to access digital services through multiple channels such as mobile applications, web portals, WhatsApp, SMS, IVRS and future digital interfaces.', ARRAY['WhatsApp', 'Mobile', 'Portal', 'IVRS', 'SMS', 'Email']::text[]
FROM model_versions mv WHERE mv.version = 'v2.1'
ON CONFLICT (model_version_id, layer_index, order_in_layer) DO NOTHING;

-- Layer 6: Technology Foundation
INSERT INTO capabilities (model_version_id, layer_index, layer_name, layer_covers, order_in_layer, name, measure, includes)
SELECT mv.id, 6, 'Technology Foundation', 'The software layer underlying every other layer', 0, 'Digital Platform & Architecture', 'Whether the State has the capability to build and operate scalable, modular, resilient and maintainable digital solutions using modern architectural principles, reusable components and cloud-ready technologies.', ARRAY['Unified platform', 'Modular architecture', 'Microservices', 'Cloud native', 'DevOps', 'Containerization']::text[]
FROM model_versions mv WHERE mv.version = 'v2.1'
ON CONFLICT (model_version_id, layer_index, order_in_layer) DO NOTHING;

INSERT INTO capabilities (model_version_id, layer_index, layer_name, layer_covers, order_in_layer, name, measure, includes)
SELECT mv.id, 6, 'Technology Foundation', 'The software layer underlying every other layer', 1, 'Interoperability & Open Integration', 'Whether the State has the capability to seamlessly exchange information and integrate with central, state and external systems through open standards, APIs, common data models and interoperable interfaces.', ARRAY['APIs', 'Centre systems', 'State systems', 'Standards', 'Registries', 'Eventing']::text[]
FROM model_versions mv WHERE mv.version = 'v2.1'
ON CONFLICT (model_version_id, layer_index, order_in_layer) DO NOTHING;

INSERT INTO capabilities (model_version_id, layer_index, layer_name, layer_covers, order_in_layer, name, measure, includes)
SELECT mv.id, 6, 'Technology Foundation', 'The software layer underlying every other layer', 2, 'Data Management & Governance', 'Whether the State has the capability to establish trusted, high-quality and well-governed data through standardized data models, master data management, metadata, data quality and data governance practices.', ARRAY['Master data management', 'Metadata', 'Data quality', 'Data governance', 'Data catalog', 'Lineage', 'Stewardship']::text[]
FROM model_versions mv WHERE mv.version = 'v2.1'
ON CONFLICT (model_version_id, layer_index, order_in_layer) DO NOTHING;

INSERT INTO capabilities (model_version_id, layer_index, layer_name, layer_covers, order_in_layer, name, measure, includes)
SELECT mv.id, 6, 'Technology Foundation', 'The software layer underlying every other layer', 3, 'Digital Identity & Access Management', 'Whether the State has the capability to securely manage digital identities, authentication, authorization and access control for users, applications and services while ensuring privacy and accountability.', ARRAY['IAM', 'SSO', 'RBAC', 'MFA']::text[]
FROM model_versions mv WHERE mv.version = 'v2.1'
ON CONFLICT (model_version_id, layer_index, order_in_layer) DO NOTHING;

INSERT INTO capabilities (model_version_id, layer_index, layer_name, layer_covers, order_in_layer, name, measure, includes)
SELECT mv.id, 6, 'Technology Foundation', 'The software layer underlying every other layer', 4, 'Intelligent Automation & Decision Support', 'Whether the State has the capability to leverage intelligent technologies to automate business processes, generate insights, support decision-making and improve operational efficiency.', ARRAY['AI', 'ML', 'OCR', 'Prediction', 'Recommendations', 'NLP']::text[]
FROM model_versions mv WHERE mv.version = 'v2.1'
ON CONFLICT (model_version_id, layer_index, order_in_layer) DO NOTHING;

INSERT INTO capabilities (model_version_id, layer_index, layer_name, layer_covers, order_in_layer, name, measure, includes)
SELECT mv.id, 6, 'Technology Foundation', 'The software layer underlying every other layer', 5, 'Security, Privacy & Compliance', 'Whether the State has the capability to protect digital systems and data through comprehensive security controls, privacy safeguards, risk management and compliance with applicable standards and regulations.', ARRAY['Security', 'Privacy', 'Compliance', 'Audit', 'Encryption', 'Monitoring']::text[]
FROM model_versions mv WHERE mv.version = 'v2.1'
ON CONFLICT (model_version_id, layer_index, order_in_layer) DO NOTHING;

-- Layer 7: Infrastructure Foundation
INSERT INTO capabilities (model_version_id, layer_index, layer_name, layer_covers, order_in_layer, name, measure, includes)
SELECT mv.id, 7, 'Infrastructure Foundation', 'The compute and network layer underlying the technology foundation', 0, 'Compute & Hosting Infrastructure', 'Whether the State has the capability to provision, manage and optimize reliable compute and hosting infrastructure supporting secure, efficient and continuous operation of digital services.', ARRAY['Cloud', 'On-premises', 'Virtualization', 'Containers', 'Compute resources']::text[]
FROM model_versions mv WHERE mv.version = 'v2.1'
ON CONFLICT (model_version_id, layer_index, order_in_layer) DO NOTHING;

INSERT INTO capabilities (model_version_id, layer_index, layer_name, layer_covers, order_in_layer, name, measure, includes)
SELECT mv.id, 7, 'Infrastructure Foundation', 'The compute and network layer underlying the technology foundation', 1, 'Data Infrastructure', 'Whether the State has the capability to provide reliable, scalable and high-performance storage, databases and data services that support secure data management, processing and retrieval.', ARRAY['Databases', 'Object storage', 'File storage', 'Caching', 'Data services']::text[]
FROM model_versions mv WHERE mv.version = 'v2.1'
ON CONFLICT (model_version_id, layer_index, order_in_layer) DO NOTHING;

INSERT INTO capabilities (model_version_id, layer_index, layer_name, layer_covers, order_in_layer, name, measure, includes)
SELECT mv.id, 7, 'Infrastructure Foundation', 'The compute and network layer underlying the technology foundation', 2, 'Network & Connectivity', 'Whether the State has the capability to provide secure, reliable and high-performance network connectivity enabling seamless communication between users, applications, infrastructure and external systems.', ARRAY['Internet', 'VPN', 'MPLS', 'SD-WAN', 'Connectivity to remote areas']::text[]
FROM model_versions mv WHERE mv.version = 'v2.1'
ON CONFLICT (model_version_id, layer_index, order_in_layer) DO NOTHING;

INSERT INTO capabilities (model_version_id, layer_index, layer_name, layer_covers, order_in_layer, name, measure, includes)
SELECT mv.id, 7, 'Infrastructure Foundation', 'The compute and network layer underlying the technology foundation', 3, 'Infrastructure Resilience & Continuity', 'Whether the State has the capability to ensure uninterrupted operation and rapid recovery of digital services through high availability, backup, disaster recovery and business continuity mechanisms.', ARRAY['HA', 'Backup', 'Disaster Recovery', 'Failover', 'Business Continuity']::text[]
FROM model_versions mv WHERE mv.version = 'v2.1'
ON CONFLICT (model_version_id, layer_index, order_in_layer) DO NOTHING;

INSERT INTO capabilities (model_version_id, layer_index, layer_name, layer_covers, order_in_layer, name, measure, includes)
SELECT mv.id, 7, 'Infrastructure Foundation', 'The compute and network layer underlying the technology foundation', 4, 'Infrastructure Monitoring & Operations', 'Whether the State has the capability to continuously monitor infrastructure health, performance, availability and operational events, enabling proactive detection, incident response and optimization.', ARRAY['Monitoring', 'Logging', 'Alerting', 'Observability', 'Incident Management']::text[]
FROM model_versions mv WHERE mv.version = 'v2.1'
ON CONFLICT (model_version_id, layer_index, order_in_layer) DO NOTHING;

INSERT INTO capabilities (model_version_id, layer_index, layer_name, layer_covers, order_in_layer, name, measure, includes)
SELECT mv.id, 7, 'Infrastructure Foundation', 'The compute and network layer underlying the technology foundation', 5, 'Elasticity & Performance Management', 'Whether the State has the capability to dynamically scale infrastructure resources and optimize system performance to meet changing workloads while maintaining reliability and cost efficiency.', ARRAY['Horizontal scaling', 'Vertical scaling', 'Auto scaling', 'Load balancing', 'Performance tuning']::text[]
FROM model_versions mv WHERE mv.version = 'v2.1'
ON CONFLICT (model_version_id, layer_index, order_in_layer) DO NOTHING;
