# ARCHITECTURE_VISION.md

# Akyrian M11 Studio Architecture Vision

## Purpose

This document defines the architectural direction for Akyrian M11 Studio.

PROJECT_BRIEF.md defines what the product is.

ARCHITECTURE_VISION.md defines how the product should be structured internally.

The core architectural principle is:

Standards Intelligence Layer
→ Clinical Design Model
→ Views / Renderers / Workflows

---

# Core Architecture

M11 Studio should not be built as a document editor with added features.

It should be built as a standards-aware clinical design system where protocol documents, schedules, graphs, validation reports, and downstream mappings are all renderings of a shared underlying model.

---

# Architectural Layers

## 1. Standards Intelligence Layer

The Standards Intelligence Layer manages machine-readable representations of industry standards.

Initial standards include:

* ICH M11 Technical Specification
* ICH M11 Template
* CDISC CORE
* CDISC Controlled Terminology
* CDASH
* SDTM

This layer should eventually support:

* Standards versioning
* Standards ingestion
* Standards comparison
* Controlled terminology validation
* Rule execution
* Standards-aware authoring suggestions

The Standards Intelligence Layer should be protocol-independent.

A protocol uses standards, but standards are not owned by a protocol.

---

## 2. Clinical Design Model

The Clinical Design Model is the primary source of truth for protocol intent.

It represents the protocol as structured, computable objects rather than prose.

Core object types include:

* Protocol
* Section
* Objective
* Endpoint
* Estimand
* Assessment
* Visit
* Epoch
* Study Arm
* Population
* Eligibility Criterion
* Intervention
* Schedule of Activities
* Statistical Analysis
* Controlled Term
* Validation Issue
* Protocol Relationship

The Clinical Design Model should be treated as the center of the application.

The narrative protocol document is one rendering of this model.

The Schedule of Activities is another rendering of this model.

The 2D and 3D dependency graphs are additional renderings of this model.

---

## 3. View and Workflow Layer

Views should not own protocol truth.

Views should display, edit, validate, or visualize the Clinical Design Model.

Examples:

* Protocol Explorer
* Structured Document View
* Schedule of Activities Configuration Tool
* Validation Panel
* Dependency Graph 2D
* Dependency Graph 3D
* Protocol Copilot
* Standards Settings
* Audit Trail
* Version Comparison

Each view may have local UI state, but domain state should live in the Clinical Design Model.

---

# Source of Truth

The current source of truth during prototype migration is:

src/app/domain/protocol/seed/PROTO-XYZ-301.json

The long-term source of truth should be a persistent protocol artifact or database-backed protocol model.

The protocol model should be exportable as JSON.

The JSON protocol artifact should be:

* Machine-readable
* Versioned
* Validatable
* Diffable
* Portable
* Auditable

---

# Design Philosophy

## Protocols Are Machine-Readable Systems

A protocol should be treated more like code than a Word document.

It should support:

* Structured objects
* References
* Dependencies
* Validation
* Version control
* Change comparison
* Traceability
* Compilation into downstream artifacts

---

## Structure Before Prose

Narrative text should not be the only source of protocol truth.

Whenever possible:

1. Define the structured object.
2. Link it to related objects.
3. Generate or validate narrative from the object.
4. Validate the object against standards.

---

## One Model, Many Views

All major UI surfaces should derive from the same model.

Do not create independent representations for:

* Document View
* SoA Grid
* Dependency Graph
* Validation Engine
* Copilot

If two views need the same concept, they should reference the same object ID.

---

## Relationships Are First-Class

Protocol relationships must be explicitly modeled.

Examples:

Objective → Endpoint
Endpoint → Estimand
Endpoint → Assessment
Assessment → Visit
Visit → Schedule of Activities Cell
Assessment → CDASH Form
Assessment → SDTM Domain
Endpoint → Statistical Analysis

Relationships should support:

* Impact analysis
* Trace path analysis
* Validation
* Visualization
* Downstream mapping

---

# Schedule of Activities Architecture

The Schedule of Activities should not be a passive read-only table.

It should be a configurable structured artifact.

The SoA Configuration Tool should support:

* Study information
* Epochs
* Arms
* Visits
* Visit windows
* Activities
* Elements
* Assessments / procedures
* Conditional procedures
* Early termination schedules
* Follow-up schedules
* Cell-level metadata
* Downstream mapping hooks

The SoA matrix is a view over structured objects:

Assessment × Visit = Schedule Cell

Each cell may include:

* Required / optional status
* Window
* Condition
* Notes
* Source section
* Linked CDASH form
* Linked SDTM domain
* Validation rules

---

# Validation Architecture

Validation should be layered.

## 1. M11 Structural Validation

Checks whether required M11 sections and elements are present.

## 2. Terminology Validation

Checks alignment with CDISC CORE and controlled terminology.

## 3. Internal Consistency Validation

Checks whether protocol statements agree across sections.

Examples:

* Narrative references an assessment not present in the SoA.
* SoA includes a procedure not described in Section 8.
* Endpoint appears in statistics but not objectives.

## 4. Clinical Design Validation

Checks object relationships.

Examples:

* Objective without endpoint.
* Endpoint without assessment.
* Assessment without visit.
* Estimand without endpoint.

## 5. Operational Feasibility Validation

Checks whether the design may create operational burden.

Examples:

* Too many procedures in one visit.
* Visit window conflicts.
* Excessive site burden.
* Complex branching schedules.

Validation should behave like linting in software development.

---

# AI Architecture

The Protocol Copilot should operate on structured context, not only raw text.

AI actions should be:

* Context-aware
* Standards-aware
* Explainable
* Reviewable
* Auditable
* Reversible where possible

AI should propose changes as structured actions.

Examples:

* Add assessment to SoA
* Create endpoint
* Suggest narrative update
* Flag terminology inconsistency
* Generate amendment summary
* Suggest CDASH mapping
* Suggest SDTM domain linkage

AI should not silently mutate protocol content.

---

# Standards Repository Architecture

Standards should be represented as structured data.

Potential future objects:

* Standard
* StandardVersion
* StandardRule
* ControlledTerm
* TerminologySet
* RuleSet
* ValidationProfile

The system should support multiple active versions over time.

Example:

* M11 version 2025-11-19
* CDISC CORE version X
* SDTM version Y
* CDASH version Z

Protocols should record which standards versions they use.

---

# Graph Architecture

The graph is not a decorative feature.

It is a rendering of the Clinical Design Model.

The 2D graph and 3D graph should share the same relationship data.

Graph features should include:

* Node selection
* Persistent labels
* Clear selection
* Reset camera
* Impact analysis
* Trace path
* Filter by object type
* Filter by validation issue
* Navigate from graph node to protocol section
* Navigate from protocol section to graph neighborhood

Graph nodes should represent real domain objects, not view-only mock items.

---

# Persistence Architecture

During the prototype phase, protocol data may live in JSON.

Long term, protocol data should likely be persisted in Supabase.

Persistence should support:

* Protocol save/load
* Version history
* Audit trail
* User roles
* Collaboration
* Comments
* Change comparison
* Export

Avoid tying the domain model too tightly to one persistence technology.

---

# Development Rules for AI Agents

When modifying the codebase:

1. Read PROJECT_BRIEF.md first.
2. Read ARCHITECTURE_VISION.md second.
3. Preserve the Clinical Design Model as the source of truth.
4. Do not create duplicate data models for different views.
5. Do not turn structured protocol content into unstructured text blobs.
6. Keep 2D and 3D graphs on the same relationship model.
7. Do not silently remove validation, audit, or traceability concepts.
8. Prefer small migrations over large rewrites.
9. Preserve current UI behavior unless explicitly asked to change it.
10. When uncertain, propose a plan before modifying code.

---

# Guiding Architecture Question

For every architectural decision ask:

"Does this strengthen the standards-aware Clinical Design Model, or does it fragment protocol truth across views?"
