# M11 Studio

## Vision

M11 Studio is an IDE-style protocol engineering environment designed to author, validate, visualize, and manage ICH M11-compliant clinical trial protocols.

Unlike traditional protocol authoring systems that treat protocols as narratives (i.e. - Word documents or PDF), M11 Studio treats the protocol as a structured graph of interconnected objects including objectives, endpoints, assessments, visits, schedules of activities, populations, interventions, statistical analyses, and regulatory metadata.
In addition, in the spirit of the ICH M11 Template, M11 Studio generates a machine-readable file that represents the clinical trial protocol as a digital artifact (JSON) and not a narrative or story. 

The long-term vision is to create a "AI driven IDE for Clinical Protocols" where protocol design, operational planning, data collection strategy, and downstream regulatory deliverables are represented as a single connected knowledge model.

---

# Product Philosophy

Protocols are not documents.

Protocols are systems. Protocols are machine-readable code artifacts.

A protocol should be represented as a network of structured objects with explicit dependencies and relationships.

The document view is only one visualization of the underlying protocol model.

The protocol graph is the primary source of truth.

---

# Primary Users

* Clinical Scientists
* Medical Writers
* Protocol Authors
* Clinical Operations Teams
* Regulatory Affairs
* Biostatisticians
* Study Designers
* Sponsors
* CRO Personnel
* Regulators like FDA or other NRA Personnel

---

# Core Design Principles

## IDE First

The application should feel closer to:

* Cursor
* VS Code
* JetBrains IDEs
* Notion AI

than to:

* Microsoft Word
* SharePoint
* Traditional Document Management Systems

Users should navigate through protocol structures using explorers, inspectors, validation panes, graph views, and AI-assisted workflows.

---

## Structured Content

Protocol content should be stored as structured objects.

Avoid treating protocol sections as large free-text blobs whenever possible.

Every protocol element should be represented as a distinct object with metadata and relationships.

The actual content of the Protocol must follow CDISC Controlled Terminology i.e. CDISC CORE (CDISC Open Rules Engine) https://www.cdisc.org/core

---

## Graph Native

The protocol dependency graph is a first-class feature.

All protocol objects should ultimately be represented within a shared graph model.

Examples:

Objective → Endpoint

Endpoint → Assessment

Assessment → Visit

Visit → Schedule of Activities

Endpoint → Statistical Analysis

Population → Eligibility Criteria

Intervention → Study Arm

---

## Multiple Views, One Data Model

The same protocol data should be visualized through multiple views:

* Document View
* Protocol Explorer
* Schedule of Activities View
* Validation View
* Dependency Graph (2D)
* Dependency Graph (3D)
* AI Copilot

Views are visualizations of the same underlying protocol model.

Do not create separate data models for different views.

---

# Current Major Features

## Protocol Explorer

Hierarchical navigation of protocol sections.

Supports M11 protocol structure.

---

## Structured Authoring Workspace

Section editing and protocol content management.

---

## Validation Engine

Real-time protocol validation.

Examples:

* Missing required M11 content
* Endpoint without objective
* Incomplete protocol sections
* Structural inconsistencies

The validation engine should behave similarly to code linting tools.

---

## Schedule of Activities

The SoA is represented as structured protocol data.

Future enhancements:

* Visit Builder
* Arm Builder
* Procedure Library
* Cycle Templates
* Assessment Templates

---

## Dependency Graph (2D)

Node-editor style visualization of protocol relationships.

Inspired by:

* Node-RED
* Unreal Blueprint
* Houdini
* TouchDesigner

---

## Dependency Graph (3D)

ForceGraph3D visualization of the same dependency model.

Purpose:

* Explore complex protocol relationships
* Understand downstream impacts
* Visualize protocol architecture

This is not a separate graph.

It is an alternate renderer of the same graph data.

---

## AI Protocol Copilot

AI assistant integrated directly into protocol authoring workflows.

Future capabilities:

* Draft protocol sections
* Explain M11 requirements
* Generate protocol content
* Identify inconsistencies
* Generate SoA entries
* Suggest downstream mappings

---

# Long-Term Product Direction

The protocol graph should ultimately expand beyond protocol authoring.

Future graph nodes may include:

* CDASH Forms
* CRFs
* SDTM Domains
* Source Documents
* Monitoring Activities
* Study Risks
* Regulatory Deliverables
* Data Collection Workflows
* Site Operations

Long-term objective:

Represent the entire clinical trial lifecycle as a connected graph.

Protocol

↓

Study Design

↓

Data Collection

↓

Source Documents

↓

Monitoring

↓

SDTM

↓

Analysis

↓

Submission

---

# Technical Direction

## Preferred Architecture

React
TypeScript
Supabase
ForceGraph3D
React Flow (where appropriate)

---

## Data Model Philosophy

Create reusable domain objects.

Examples:

Protocol

Section

Objective

Endpoint

Assessment

Visit

ScheduleActivity

StudyArm

Population

ValidationIssue

GraphNode

GraphEdge

Avoid duplicating domain models across views.

---

# Development Rules

1. Preserve the IDE-style experience.

2. Preserve the graph-native architecture.

3. Avoid dashboard-style redesigns.

4. Avoid converting structured objects into unstructured text.

5. Do not create separate graph data models for 2D and 3D views.

6. Favor modular reusable components.

7. Favor extensibility over short-term hacks.

8. The protocol graph is a strategic asset and should remain central to the product.

---

# Guiding Question

Whenever making architectural decisions ask:

"Does this move M11 Studio closer to becoming the protocol engineering environment for the clinical trial industry?"
