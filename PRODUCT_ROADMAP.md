# PRODUCT_ROADMAP.md

# Akyrian M11 Studio Product Roadmap

## Purpose

This document defines the strategic product roadmap for M11 Studio.

PROJECT_BRIEF.md defines the product vision.

ARCHITECTURE_VISION.md defines the system architecture.

PRODUCT_ROADMAP.md defines the sequence by which the platform should evolve.

This roadmap is intended to guide both human developers and AI development agents.

The roadmap is organized around capability maturity rather than isolated features.

---

# Product Evolution

## Stage 0 — Foundation

### Objective

Establish a stable architectural foundation centered on a structured Clinical Design Model.

### Success Criteria

* Single protocol source of truth
* Canonical protocol model
* Structured protocol artifact
* Shared data model across all views
* Stable application architecture

### Deliverables

* Protocol domain model
* Canonical protocol JSON artifact
* Domain selectors
* Shared graph model
* Migration away from prototype mock data
* Architectural documentation

### Status

**Complete** (2026-06-03). See [STAGE_0_CLOSURE_REPORT.md](./STAGE_0_CLOSURE_REPORT.md).

---

# Stage 1 — Protocol Engineering Environment

### Objective

Transform M11 Studio from a document editor into a protocol engineering platform.

### Success Criteria

Protocols become structured systems rather than text-centric documents.

### Major Capabilities

#### M11 Protocol Authoring

* Structured protocol editing
* Section management
* Protocol explorer
* Document viewport
* Amendment support
* Version comparison

#### Legacy Protocol Conversion

* DOCX ingestion
* PDF ingestion
* AI-assisted protocol interpretation
* Conversion to structured protocol model
* Mapping to M11 sections

#### Clinical Design Model

Introduction of structured objects:

* Objectives
* Endpoints
* Estimands
* Assessments
* Visits
* Arms
* Populations
* Interventions

### Target Outcome

Protocols become machine-readable assets.

---

# Stage 2 — Standards Intelligence Platform

### Objective

Create a standards-aware protocol development environment.

### Success Criteria

The platform understands industry standards and actively assists users.

### Major Capabilities

#### Standards Repository

Machine-readable representations of:

* ICH M11
* CDISC CORE
* Controlled Terminology
* CDASH
* SDTM

#### Standards Versioning

Support multiple versions of standards.

#### Terminology Services

* Preferred term recommendations
* Terminology consistency checks
* Controlled terminology validation

#### Standards-Aware Authoring

Real-time guidance while editing protocol content.

### Target Outcome

Protocols are continuously evaluated against current standards.

---

# Stage 3 — Schedule of Activities Configuration

### Objective

Promote the Schedule of Activities from a static table to a structured protocol component.

### Success Criteria

The SoA becomes a first-class protocol design artifact.

### Major Capabilities

#### SoA Configuration Tool

Manage:

* Study information
* Epochs
* Arms
* Visits
* Visit windows
* Assessments
* Procedures
* Activities
* Elements
* Follow-up schedules
* Early termination schedules

#### Interactive Matrix

Assessment / Procedure rows

against

Visit columns

#### Cell-Level Metadata

Support:

* Conditions
* Windows
* Requiredness
* Notes
* Mapping metadata

### Target Outcome

The SoA becomes a structured clinical design model.

---

# Stage 4 — Validation Platform

### Objective

Create a protocol linting system.

### Success Criteria

Protocol issues become detectable before study startup.

### Validation Layers

#### M11 Structural Validation

Required sections and attributes.

#### Terminology Validation

CDISC CORE and controlled terminology compliance.

#### Internal Consistency Validation

Cross-section consistency checks.

#### Clinical Design Validation

Object relationship validation.

#### Operational Feasibility Validation

Site burden and protocol complexity assessment.

### Future Possibilities

* Protocol scoring
* Complexity scoring
* Risk scoring
* Compliance scoring

### Target Outcome

Protocol quality becomes measurable.

---

# Stage 5 — Protocol Copilot

### Objective

Create an AI assistant that operates on structured protocol data.

### Success Criteria

The AI understands protocol structure rather than only protocol text.

### Example Actions

* Draft protocol sections
* Add assessments
* Create endpoints
* Generate SoA entries
* Explain standards
* Suggest amendments
* Recommend terminology
* Generate protocol summaries

### Rules

All AI actions must be:

* Explainable
* Reviewable
* Auditable
* User-approved

### Target Outcome

AI becomes a protocol engineering assistant.

---

# Stage 6 — Dependency Intelligence

### Objective

Provide visibility into protocol relationships and downstream impacts.

### Success Criteria

Protocol dependencies become navigable and explainable.

### Major Capabilities

#### 2D Dependency Graph

#### 3D Dependency Graph

#### Impact Analysis

Example:

Change Endpoint

→ Identify affected Assessments

→ Identify affected Visits

→ Identify affected SoA cells

→ Identify affected Statistical Analyses

#### Traceability

Support end-to-end navigation.

### Example Path

Objective

→ Endpoint

→ Assessment

→ Visit

→ SoA

→ CDASH

→ SDTM

### Target Outcome

Protocol architecture becomes visible.

---

# Stage 7 — Study Design Compiler

### Objective

Transform protocol design into downstream study assets.

### Success Criteria

Structured protocol components generate implementation artifacts.

### Potential Outputs

* CDASH specifications
* CRF definitions
* eCRF configuration
* SDTM mapping specifications
* Monitoring plans
* Risk-based monitoring inputs
* Site training materials

### Target Outcome

Protocols become executable specifications.

---

# Stage 8 — Clinical Trial Knowledge Graph

### Objective

Represent the entire clinical trial lifecycle through a connected knowledge graph.

### Scope

Protocol Design

↓

Study Startup

↓

Data Collection

↓

Monitoring

↓

Analysis

↓

Submission

### Future Objects

* Protocols
* Studies
* Sites
* CRFs
* Source Data Definitions
* Monitoring Activities
* SDTM Domains
* Regulatory Deliverables

### Target Outcome

Clinical trial knowledge becomes structured, searchable, and computable.

---

# Near-Term Development Priorities

Current Priority Order:

1. Complete protocol migration
2. Finalize architecture documentation
3. Establish Clinical Design Model
4. Build Standards Repository
5. Build SoA Configuration Tool
6. Build Validation Engine
7. Expand Protocol Copilot
8. Expand Dependency Intelligence

---

# Long-Term Vision

M11 Studio should evolve from:

Protocol Authoring Tool

to

Protocol Engineering Environment

to

Study Design Platform

to

Clinical Trial Knowledge Graph

Ultimately, protocols should become machine-readable, standards-aware, computable assets that drive the entire clinical trial lifecycle.

---

# Guiding Product Question

For every roadmap decision ask:

"Does this increase the platform's ability to represent, validate, visualize, and operationalize clinical trial design as structured knowledge?"
