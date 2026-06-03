# Akyrian M11 Studio

## Executive Summary

M11 Studio is a protocol engineering environment designed to transform clinical trial protocols from static documents into structured, computable, standards-aware digital assets.

Traditional protocol authoring tools treat protocols as Word documents. M11 Studio treats protocols as structured systems composed of interconnected clinical design objects including objectives, endpoints, assessments, visits, schedules of activities, study populations, interventions, statistical analyses, and regulatory metadata.

The platform is designed around the principles of the ICH M11 Clinical Electronic Structured Harmonised Protocol Template (CeSHarP), CDISC standards, and emerging AI-assisted protocol design workflows.

The long-term vision is to create the industry's first Protocol Engineering Environment: a platform where protocol design, validation, visualization, operational planning, data collection strategy, and downstream regulatory deliverables are represented through a single connected knowledge model.

## Product Vision

Protocols are not documents.

Protocols are machine-readable systems (like code, like JSON).

A protocol is a network of interconnected design decisions that influence every aspect of a clinical trial, including:

- Objectives
- Endpoints
- Assessments
- Visits
- Study Arms
- Populations
- Interventions
- Statistical Analyses
- Data Collection Requirements
- Regulatory Deliverables

The protocol document is only one view of this underlying design model.

M11 Studio aims to expose, manage, validate, and visualize those relationships.

## Mission

Enable protocol authors, clinical scientists, medical writers, biostatisticians, and clinical operations teams to design higher-quality protocols through structured authoring, standards-aware validation, AI-assisted workflows, and graph-based visualization.

## Target Users

### Primary Users

- Clinical Scientists
- Medical Writers
- Protocol Authors
- Clinical Development Teams
- Clinical Operations Teams
- Biostatisticians
- Translational Medicine Teams
- Regulatory Affairs Teams

### Secondary Users

- Regulators
- CRO Personnel
- Clinical Trial Managers
- Data Management Teams
- Clinical Programmers
- Medical Monitors

## Core Product Principles

### Standards First

The platform is driven by industry standards.

Examples include:

- ICH M11
- CDISC CORE
- CDISC Controlled Terminology
- CDASH
- SDTM
- M11 Clinical Electronic Structured Harmonized Protocol (CeSHarP), Guidance for Industry, Technical Specification Document

Standards should be treated as machine-readable assets that can be interpreted, validated, and operationalized.

### Structured Before Narrative

Structured protocol objects are the primary source of truth.

Narrative protocol text is a rendering of those structured objects.

Whenever possible:

- Define structured data first.
- Generate narrative from structure.
- Validate narrative against structure.

### One Clinical Design Model

All views must derive from a common underlying model.

Examples:

- Protocol Explorer
- Document View
- Schedule of Activities
- Validation Engine
- Dependency Graph
- AI Copilot
- User Configurable, User-Specific Views (Statistics, Clinical Operations, Data Management)

No view should maintain an independent representation of protocol intent.

### Graph Native Architecture

The protocol should be represented internally as a connected graph of clinical design objects.

Example:

Objective → Endpoint → Assessment → Visit → Schedule of Activities → Data Collection → Analysis

The graph is a first-class architectural construct.

### AI-Assisted, Human-Governed

AI should assist protocol development but never silently modify protocol content.

All AI-generated changes must be:

- Explainable
- Reviewable
- Auditable
- Approveable by users

Humans remain the final authority.

## Major Functional Domains

### Standards Repository

Maintains machine-readable representations of:

- ICH M11 Specification
- CDISC CORE
- Controlled Terminology
- CDASH
- SDTM

The repository serves as the foundation for validation and protocol generation.

### Protocol Authoring

Supports:

- De novo protocol creation
- Structured protocol editing
- Legacy protocol ingestion
- Protocol conversion to M11 format (from DOCX or PDF)
- Amendment authoring
- Version Control, Version Locking, Change Comparison

### Schedule of Activities Configuration

The Schedule of Activities (SoA) is treated as a structured protocol artifact.

The SoA is not a passive table.

The SoA is a configurable model that defines:

- Study Information
- Epochs
- Arms
- Visits (with visit windows)
- Activities
- Elements
- Assessment / Procedures
- Conditional procedures
- Early termination behavior
- Follow-up schedules and assessments
- Interactive matrix of Assessment/Procedures (rows) against Visits (columns)

### Validation Engine

Supports multiple validation layers:

**M11 Structural Validation**

Ensures required protocol sections and attributes are present.

**Terminology Validation**

Ensures alignment with CDISC CORE and controlled terminology.

**Internal Consistency Validation**

Identifies inconsistencies across protocol sections.

**Clinical Design Validation**

Evaluates relationships between objectives, endpoints, assessments, visits, and analyses.

**Operational Feasibility Validation**

Identifies protocol complexity, burden, and operational risks.

### Protocol Copilot

Provides AI-assisted protocol development.

Examples:

- Draft content
- Explain standards
- Suggest improvements
- Generate SoA entries
- Identify inconsistencies
- Recommend terminology
- Assist protocol conversion
- Assist protocol changes or amendments

All recommendations remain user-reviewable.

### Dependency Visualization

Provides 2D and 3D visualizations of protocol relationships.

The graph should support:

- Protocol exploration
- Impact analysis
- Traceability
- Design review
- Cross-functional communication

## Long-Term Vision

M11 Studio is intended to evolve beyond protocol authoring.

Future protocol objects may include:

- CDASH Forms
- eCRFs
- Source Data Definitions
- SDTM Domains
- Monitoring Activities
- Risk Indicators
- Regulatory Deliverables
- Site Operations
- Study Execution Workflows

Long term, M11 Studio should represent the complete lifecycle of a clinical trial as a connected knowledge graph.

Protocol Design → Study Conduct → Data Collection → Monitoring → Analysis → Submission

## Success Criteria

M11 Studio succeeds when:

- Protocol quality improves.
- Standards compliance improves.
- Protocol inconsistencies are reduced.
- Authoring time decreases.
- Protocol complexity becomes visible and manageable.
- Downstream study execution becomes more predictable.
- Clinical trial knowledge becomes structured, searchable, and computable.

## Guiding Question

For every architectural, design, or product decision ask:

"Does this move M11 Studio closer to becoming the protocol engineering environment for the clinical trial industry?"
