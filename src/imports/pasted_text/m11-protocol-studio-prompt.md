# M11 Protocol Studio — Figma Make Prototype Artifact

## 1. Figma Make Mega-Prompt

Build a database-backed, IDE-style structured protocol authoring application called M11 Protocol Studio for creating ICH M11 / CeSHarP-compliant clinical trial protocols. The app should feel like a modern software developer IDE rather than a Word processor: use a left Protocol Explorer tree, a central structured document viewport, a right-side document minimap and validation rail, a bottom detail inspector, and a persistent AI Protocol Copilot chat panel. The source model is the ICH M11 Technical Specification, where each protocol element has a term/variable, data type, heading-data-value classification, definition concept code, user guidance, conformance status, cardinality, hierarchy relationship, value or controlled terminology, business rules, and repeating/reuse rules. Treat every protocol section, heading, data element, valid-value field, table, and Schedule of Activities entry as a structured component backed by metadata, not as plain text.

The main layout and UI should look exactly like any modern software development IDE and should include: (1) a left Protocol Explorer showing the M11 hierarchy with sections such as Title Page, Amendment Details, 1 Protocol Summary, 1.1 Protocol Synopsis, 1.3 Schedule of Activities, 2 Introduction, 3 Trial Objectives and Associated Estimands, 4 Trial Design, 5 Trial Population, 6 Trial Intervention and Concomitant Therapy, 7 Participant Discontinuation, 8 Trial Assessments and Procedures, 9 Safety Reporting, 10 Statistical Considerations, 11 Trial Oversight and General Considerations, 12 Supporting Details, 13 Glossary, and 14 References; (2) a central document viewport where each selected section renders as an editable structured form plus narrative blocks, with chips showing Required, Optional, Conditional, Repeatable, Reused, Controlled Terminology, and Linked Downstream; (3) a right document minimap showing the whole protocol as a compressed vertical map with status colors; (4) a right-side split screen inspector with tabs for Metadata, M11 Rules, Controlled Terminology, Schedule of Activities, Downstream Mappings, Validation, Comments, Version History, and Audit Trail; and (5) on the right split screen in a bottom inspector, a Protocol Copilot chat box that can draft sections, explain M11 requirements, check consistency, propose Schedule of Activities rows, identify missing required fields, suggest objective-endpoint-estimand linkages, summarize amendment impact, and suggest CDASH/SDTM/FHIR-oriented downstream mappings.

Use status colors consistently: green for complete, blue for in progress, red for missing required content, amber for conditional or recommended content needing attention, violet for AI suggestions, purple for reused/downstream-linked content, and orange for amended content. Build sample data for a Phase 3 oncology protocol and a Phase 2 rare disease protocol. In the Phase 3 example include a title page with sponsor protocol identifier, trial phase, original protocol indicator, amendment logic, investigational product names, regulatory identifiers, protocol synopsis, objectives/endpoints/estimands, study design, eligibility criteria, intervention details, safety reporting, statistical considerations, and a Schedule of Activities grid with visits across screening, baseline, treatment cycles, end of treatment, and follow-up. The Schedule of Activities module should behave like a structured grid whose rows are assessments/procedures and columns are visits/timepoints; selecting any cell opens the bottom inspector showing metadata, source section links, downstream mappings, and validation rules. It would also be useful to give the user light and dark modes, potentially even pre-fabricated color schemas to choose from in a user preferences section. 

Make the app feel enterprise-grade and technical: dark theme by default, compact panels, crisp grid, command palette, breadcrumb navigation, quick filters, resizable split panes, inline validation icons, and inspector cards. Include workflows for authoring, review, amendment creation, validation, and export. Include user roles for Protocol Author, Medical Writer, Clinical Scientist, Statistician, Regulatory Reviewer, Standards Librarian, and Administrator. Add realistic mock interactions: clicking a section in the explorer loads it in the center viewport; clicking a field reveals M11 metadata in the bottom inspector; clicking a validation issue jumps to the field; asking the AI assistant “Check this section for M11 compliance” produces issue cards and suggested fixes; selecting Schedule of Activities creates downstream assessment definitions and mapping candidates. The prototype should demonstrate that the protocol is a structured data product with reusable components, audit trail, validation rules, controlled terminology, versioning, amendment diffing, and downstream operational mappings, not merely a formatted document.

Use this compact schema as the domain model reference:
{
  "m11ElementModel": {
    "sourceFields": [
      "termVariable",
      "dataType",
      "entryClass: H/D/V",
      "definitionConceptCode",
      "userGuidance",
      "conformance",
      "cardinality",
      "tocRelationship",
      "valueOrValueList",
      "businessRules",
      "repeatingReuseRules"
    ],
    "normalizedFields": [
      "id",
      "label",
      "sectionId",
      "kind",
      "dataType",
      "requiredness",
      "cardinality",
      "repeatable",
      "reusable",
      "visibilityRules",
      "validationRules",
      "controlledTerminology",
      "downstreamLinks",
      "aiHints",
      "auditEvents"
    ]
  },
  "appShell": {
    "name": "M11 Protocol Studio",
    "metaphor": "software developer IDE for structured clinical protocol authoring",
    "regions": [
      {
        "id": "left_protocol_explorer",
        "label": "Protocol Explorer",
        "description": "Hierarchical document navigator with M11 sections, completion state, validation count, and reusable blocks."
      },
      {
        "id": "center_document_viewport",
        "label": "Structured Document Viewport",
        "description": "Editable protocol canvas. Each heading, data element, controlled value, table, and SoA row is a component backed by schema metadata."
      },
      {
        "id": "right_minimap",
        "label": "Document Minimap",
        "description": "Compressed protocol map with status colors, comment pins, amendment marks, and validation hot spots."
      },
      {
        "id": "bottom_detail_inspector",
        "label": "Detail Inspector",
        "description": "Tabbed pane for metadata, business rules, controlled terminology, SoA, downstream mappings, validation, comments, version history, and audit trail."
      },
      {
        "id": "ai_copilot",
        "label": "Protocol Copilot",
        "description": "Chat panel that can draft sections, explain M11 requirements, detect inconsistencies, propose SoA rows, and summarize amendment impact."
      }
    ]
  },
  "statusModel": {
    "complete": "green",
    "inProgress": "blue",
    "requiredMissing": "red",
    "conditionalMissing": "amber",
    "aiSuggestion": "violet",
    "reusedLinkedContent": "purple",
    "amended": "orange"
  },
  "entities": [
    "Protocol",
    "ProtocolVersion",
    "ProtocolSection",
    "SectionElement",
    "FieldDefinition",
    "FieldValue",
    "ControlledTerminologySet",
    "ScheduleOfActivities",
    "Visit",
    "Activity",
    "Assessment",
    "Objective",
    "Endpoint",
    "Estimand",
    "Intervention",
    "Amendment",
    "Comment",
    "ValidationIssue",
    "AuditEvent",
    "AIConversation"
  ],
  "sampleValidationRules": [
    {
      "id": "VR-001",
      "name": "Required M11 element missing",
      "severity": "error",
      "logic": "requiredness == 'required' AND value is blank",
      "ui": "red marker in explorer, minimap, and inspector"
    },
    {
      "id": "VR-002",
      "name": "Conditional amendment data missing",
      "severity": "error",
      "logic": "original_protocol_indicator == 'No' AND amendment_identifier is blank",
      "ui": "red issue card with quick fix"
    },
    {
      "id": "VR-003",
      "name": "Non-global amendment scope lacks geographic/site identifier",
      "severity": "error",
      "logic": "amendment_scope == 'Not Global' AND no country/region/site identifier",
      "ui": "inline guided field prompt"
    },
    {
      "id": "VR-004",
      "name": "Objective without endpoint",
      "severity": "warning",
      "logic": "objective exists AND no linked endpoint or estimand",
      "ui": "amber dependency chip"
    },
    {
      "id": "VR-005",
      "name": "Assessment referenced in text but absent from SoA",
      "severity": "warning",
      "logic": "assessment/procedure term appears in protocol body AND no corresponding SoA row",
      "ui": "AI suggestion to add SoA row"
    }
  ]
}

---

## 2. Compact JSON Schema

```json
{
  "artifactName": "ICH M11 CeSHarP IDE Prototype Schema",
  "sourceDocument": "ICH Step 4 M11 Final Technical Specification, adopted 19 November 2025",
  "purpose": "Figma Make input for an IDE-style structured protocol authoring workflow builder, not a static document editor.",
  "m11ElementModel": {
    "sourceFields": [
      "termVariable",
      "dataType",
      "entryClass: H/D/V",
      "definitionConceptCode",
      "userGuidance",
      "conformance",
      "cardinality",
      "tocRelationship",
      "valueOrValueList",
      "businessRules",
      "repeatingReuseRules"
    ],
    "normalizedFields": [
      "id",
      "label",
      "sectionId",
      "kind",
      "dataType",
      "requiredness",
      "cardinality",
      "repeatable",
      "reusable",
      "visibilityRules",
      "validationRules",
      "controlledTerminology",
      "downstreamLinks",
      "aiHints",
      "auditEvents"
    ]
  },
  "appShell": {
    "name": "M11 Protocol Studio",
    "metaphor": "software developer IDE for structured clinical protocol authoring",
    "regions": [
      {
        "id": "left_protocol_explorer",
        "label": "Protocol Explorer",
        "description": "Hierarchical document navigator with M11 sections, completion state, validation count, and reusable blocks."
      },
      {
        "id": "center_document_viewport",
        "label": "Structured Document Viewport",
        "description": "Editable protocol canvas. Each heading, data element, controlled value, table, and SoA row is a component backed by schema metadata."
      },
      {
        "id": "right_minimap",
        "label": "Document Minimap",
        "description": "Compressed protocol map with status colors, comment pins, amendment marks, and validation hot spots."
      },
      {
        "id": "bottom_detail_inspector",
        "label": "Detail Inspector",
        "description": "Tabbed pane for metadata, business rules, controlled terminology, SoA, downstream mappings, validation, comments, version history, and audit trail."
      },
      {
        "id": "ai_copilot",
        "label": "Protocol Copilot",
        "description": "Chat panel that can draft sections, explain M11 requirements, detect inconsistencies, propose SoA rows, and summarize amendment impact."
      }
    ]
  },
  "statusModel": {
    "complete": "green",
    "inProgress": "blue",
    "requiredMissing": "red",
    "conditionalMissing": "amber",
    "aiSuggestion": "violet",
    "reusedLinkedContent": "purple",
    "amended": "orange"
  },
  "sectionHierarchy": [
    {
      "id": "1",
      "title": "PROTOCOL SUMMARY",
      "level": 1,
      "conformance": "required_unless_context_says_otherwise",
      "uiComponent": "ProtocolSectionNode"
    },
    {
      "id": "1.1",
      "title": "Protocol Synopsis",
      "level": 2,
      "conformance": "required_unless_context_says_otherwise",
      "uiComponent": "ProtocolSectionNode"
    },
    {
      "id": "1.1.1",
      "title": "Primary and Secondary Objectives and Estimands",
      "level": 3,
      "conformance": "required_unless_context_says_otherwise",
      "uiComponent": "ProtocolSectionNode"
    },
    {
      "id": "1.1.2",
      "title": "Overall Design",
      "level": 3,
      "conformance": "required_unless_context_says_otherwise",
      "uiComponent": "ProtocolSectionNode"
    },
    {
      "id": "1.2",
      "title": "Trial Schema",
      "level": 2,
      "conformance": "required_unless_context_says_otherwise",
      "uiComponent": "ProtocolSectionNode"
    },
    {
      "id": "1.3",
      "title": "Schedule of Activities",
      "level": 2,
      "conformance": "required_unless_context_says_otherwise",
      "uiComponent": "ProtocolSectionNode"
    },
    {
      "id": "2",
      "title": "INTRODUCTION",
      "level": 1,
      "conformance": "required_unless_context_says_otherwise",
      "uiComponent": "ProtocolSectionNode"
    },
    {
      "id": "2.1",
      "title": "Purpose of Trial",
      "level": 2,
      "conformance": "required_unless_context_says_otherwise",
      "uiComponent": "ProtocolSectionNode"
    },
    {
      "id": "2.2",
      "title": "Assessment of Risks and Benefits",
      "level": 2,
      "conformance": "required_unless_context_says_otherwise",
      "uiComponent": "ProtocolSectionNode"
    },
    {
      "id": "2.2.1",
      "title": "Risk Summary and Mitigation Strategy",
      "level": 3,
      "conformance": "required_unless_context_says_otherwise",
      "uiComponent": "ProtocolSectionNode"
    },
    {
      "id": "2.2.2",
      "title": "Benefit Summary",
      "level": 3,
      "conformance": "required_unless_context_says_otherwise",
      "uiComponent": "ProtocolSectionNode"
    },
    {
      "id": "2.2.3",
      "title": "Overall Risk-Benefit Assessment",
      "level": 3,
      "conformance": "required_unless_context_says_otherwise",
      "uiComponent": "ProtocolSectionNode"
    },
    {
      "id": "3",
      "title": "TRIAL OBJECTIVES AND ASSOCIATED ESTIMANDS",
      "level": 1,
      "conformance": "required_unless_context_says_otherwise",
      "uiComponent": "ProtocolSectionNode"
    },
    {
      "id": "3.1",
      "title": "Primary Objective(s) and Associated Estimand(s)",
      "level": 2,
      "conformance": "required_unless_context_says_otherwise",
      "uiComponent": "ProtocolSectionNode"
    },
    {
      "id": "3.2",
      "title": "Secondary Objective(s) and Associated Estimand(s)",
      "level": 2,
      "conformance": "required_unless_context_says_otherwise",
      "uiComponent": "ProtocolSectionNode"
    },
    {
      "id": "3.3",
      "title": "Exploratory Objective(s)",
      "level": 2,
      "conformance": "required_unless_context_says_otherwise",
      "uiComponent": "ProtocolSectionNode"
    },
    {
      "id": "4",
      "title": "TRIAL DESIGN",
      "level": 1,
      "conformance": "required_unless_context_says_otherwise",
      "uiComponent": "ProtocolSectionNode"
    },
    {
      "id": "4.1",
      "title": "Description of Trial Design",
      "level": 2,
      "conformance": "required_unless_context_says_otherwise",
      "uiComponent": "ProtocolSectionNode"
    },
    {
      "id": "10.9",
      "title": "Interim Analyses",
      "level": 2,
      "conformance": "required_unless_context_says_otherwise",
      "uiComponent": "ProtocolSectionNode"
    },
    {
      "id": "4.1.1",
      "title": "Stakeholder Input into Design",
      "level": 3,
      "conformance": "required_unless_context_says_otherwise",
      "uiComponent": "ProtocolSectionNode"
    },
    {
      "id": "4.2",
      "title": "Rationale for Trial Design",
      "level": 2,
      "conformance": "required_unless_context_says_otherwise",
      "uiComponent": "ProtocolSectionNode"
    },
    {
      "id": "4.2.1",
      "title": "Rationale for Estimand(s)",
      "level": 3,
      "conformance": "required_unless_context_says_otherwise",
      "uiComponent": "ProtocolSectionNode"
    },
    {
      "id": "4.2.2",
      "title": "Rationale for Intervention Model",
      "level": 3,
      "conformance": "required_unless_context_says_otherwise",
      "uiComponent": "ProtocolSectionNode"
    },
    {
      "id": "4.2.3",
      "title": "Rationale for Control Type",
      "level": 3,
      "conformance": "required_unless_context_says_otherwise",
      "uiComponent": "ProtocolSectionNode"
    },
    {
      "id": "4.2.4",
      "title": "Rationale for Trial Duration",
      "level": 3,
      "conformance": "required_unless_context_says_otherwise",
      "uiComponent": "ProtocolSectionNode"
    },
    {
      "id": "4.2.5",
      "title": "Rationale for Adaptive or Novel Trial Design",
      "level": 3,
      "conformance": "required_unless_context_says_otherwise",
      "uiComponent": "ProtocolSectionNode"
    },
    {
      "id": "4.2.6",
      "title": "Rationale for Interim Analysis",
      "level": 3,
      "conformance": "required_unless_context_says_otherwise",
      "uiComponent": "ProtocolSectionNode"
    },
    {
      "id": "4.2.7",
      "title": "Rationale for Other Trial Design Aspects",
      "level": 3,
      "conformance": "required_unless_context_says_otherwise",
      "uiComponent": "ProtocolSectionNode"
    },
    {
      "id": "4.3",
      "title": "Trial Stopping Rules",
      "level": 2,
      "conformance": "required_unless_context_says_otherwise",
      "uiComponent": "ProtocolSectionNode"
    },
    {
      "id": "4.4",
      "title": "Start of Trial and End of Trial",
      "level": 2,
      "conformance": "required_unless_context_says_otherwise",
      "uiComponent": "ProtocolSectionNode"
    },
    {
      "id": "4.5",
      "title": "Access to Trial Intervention After End of Trial",
      "level": 2,
      "conformance": "required_unless_context_says_otherwise",
      "uiComponent": "ProtocolSectionNode"
    },
    {
      "id": "5",
      "title": "TRIAL POPULATION",
      "level": 1,
      "conformance": "required_unless_context_says_otherwise",
      "uiComponent": "ProtocolSectionNode"
    },
    {
      "id": "5.1",
      "title": "Description of Trial Population and Rationale",
      "level": 2,
      "conformance": "required_unless_context_says_otherwise",
      "uiComponent": "ProtocolSectionNode"
    },
    {
      "id": "5.2",
      "title": "Inclusion Criteria",
      "level": 2,
      "conformance": "required_unless_context_says_otherwise",
      "uiComponent": "ProtocolSectionNode"
    },
    {
      "id": "5.3",
      "title": "Exclusion Criteria",
      "level": 2,
      "conformance": "required_unless_context_says_otherwise",
      "uiComponent": "ProtocolSectionNode"
    },
    {
      "id": "5.4",
      "title": "Contraception",
      "level": 2,
      "conformance": "required_unless_context_says_otherwise",
      "uiComponent": "ProtocolSectionNode"
    },
    {
      "id": "5.4.1",
      "title": "Definitions Related to Childbearing Potential",
      "level": 3,
      "conformance": "required_unless_context_says_otherwise",
      "uiComponent": "ProtocolSectionNode"
    },
    {
      "id": "5.4.2",
      "title": "Contraception Requirements",
      "level": 3,
      "conformance": "required_unless_context_says_otherwise",
      "uiComponent": "ProtocolSectionNode"
    },
    {
      "id": "5.5",
      "title": "Lifestyle Restrictions",
      "level": 2,
      "conformance": "required_unless_context_says_otherwise",
      "uiComponent": "ProtocolSectionNode"
    },
    {
      "id": "5.5.1",
      "title": "Meals and Dietary Restrictions",
      "level": 3,
      "conformance": "required_unless_context_says_otherwise",
      "uiComponent": "ProtocolSectionNode"
    },
    {
      "id": "5.5.2",
      "title": "Caffeine, Alcohol, Tobacco, and Other Restrictions",
      "level": 3,
      "conformance": "required_unless_context_says_otherwise",
      "uiComponent": "ProtocolSectionNode"
    },
    {
      "id": "5.5.3",
      "title": "Physical Activity Restrictions",
      "level": 3,
      "conformance": "required_unless_context_says_otherwise",
      "uiComponent": "ProtocolSectionNode"
    },
    {
      "id": "5.5.4",
      "title": "Other Activity Restrictions",
      "level": 3,
      "conformance": "required_unless_context_says_otherwise",
      "uiComponent": "ProtocolSectionNode"
    },
    {
      "id": "5.6",
      "title": "Screen Failure and Rescreening",
      "level": 2,
      "conformance": "required_unless_context_says_otherwise",
      "uiComponent": "ProtocolSectionNode"
    },
    {
      "id": "6",
      "title": "TRIAL INTERVENTION AND CONCOMITANT THERAPY",
      "level": 1,
      "conformance": "required_unless_context_says_otherwise",
      "uiComponent": "ProtocolSectionNode"
    },
    {
      "id": "6.1",
      "title": "Description of Investigational Trial Intervention",
      "level": 2,
      "conformance": "required_unless_context_says_otherwise",
      "uiComponent": "ProtocolSectionNode"
    },
    {
      "id": "6.2",
      "title": "Rationale for Investigational Trial Intervention Dose and Regimen",
      "level": 2,
      "conformance": "required_unless_context_says_otherwise",
      "uiComponent": "ProtocolSectionNode"
    },
    {
      "id": "6.3",
      "title": "Investigational Trial Intervention Administration",
      "level": 2,
      "conformance": "required_unless_context_says_otherwise",
      "uiComponent": "ProtocolSectionNode"
    },
    {
      "id": "6.4",
      "title": "Investigational Trial Intervention Dose Modification",
      "level": 2,
      "conformance": "required_unless_context_says_otherwise",
      "uiComponent": "ProtocolSectionNode"
    },
    {
      "id": "6.5",
      "title": "Management of Investigational Trial Intervention Overdose",
      "level": 2,
      "conformance": "required_unless_context_says_otherwise",
      "uiComponent": "ProtocolSectionNode"
    },
    {
      "id": "6.6",
      "title": "Preparation, Storage, Handling and Accountability of Investigational Trial Intervention",
      "level": 2,
      "conformance": "required_unless_context_says_otherwise",
      "uiComponent": "ProtocolSectionNode"
    },
    {
      "id": "6.6.1",
      "title": "Preparation of Investigational Trial Intervention",
      "level": 3,
      "conformance": "required_unless_context_says_otherwise",
      "uiComponent": "ProtocolSectionNode"
    },
    {
      "id": "6.6.2",
      "title": "Storage and Handling of Investigational Trial Intervention",
      "level": 3,
      "conformance": "required_unless_context_says_otherwise",
      "uiComponent": "ProtocolSectionNode"
    },
    {
      "id": "6.6.3",
      "title": "Accountability of Investigational Trial Intervention",
      "level": 3,
      "conformance": "required_unless_context_says_otherwise",
      "uiComponent": "ProtocolSectionNode"
    },
    {
      "id": "6.7",
      "title": "Investigational Trial Intervention Assignment, Randomisation and Blinding",
      "level": 2,
      "conformance": "required_unless_context_says_otherwise",
      "uiComponent": "ProtocolSectionNode"
    },
    {
      "id": "6.7.1",
      "title": "Participant Assignment to Investigational Trial Intervention",
      "level": 3,
      "conformance": "required_unless_context_says_otherwise",
      "uiComponent": "ProtocolSectionNode"
    },
    {
      "id": "6.8",
      "title": "Investigational Trial Intervention Adherence",
      "level": 2,
      "conformance": "required_unless_context_says_otherwise",
      "uiComponent": "ProtocolSectionNode"
    },
    {
      "id": "6.9",
      "title": "Description of Noninvestigational Trial Intervention",
      "level": 2,
      "conformance": "required_unless_context_says_otherwise",
      "uiComponent": "ProtocolSectionNode"
    },
    {
      "id": "6.10",
      "title": "Concomitant Therapy",
      "level": 2,
      "conformance": "required_unless_context_says_otherwise",
      "uiComponent": "ProtocolSectionNode"
    },
    {
      "id": "7",
      "title": "PARTICIPANT DISCONTINUATION OF TRIAL INTERVENTION AND DISCONTINUATION OR WITHDRAWAL FROM TRIAL",
      "level": 1,
      "conformance": "required_unless_context_says_otherwise",
      "uiComponent": "ProtocolSectionNode"
    },
    {
      "id": "7.1",
      "title": "Discontinuation of Trial Intervention for Individual Participants",
      "level": 2,
      "conformance": "required_unless_context_says_otherwise",
      "uiComponent": "ProtocolSectionNode"
    },
    {
      "id": "7.1.1",
      "title": "Permanent Discontinuation of Trial Intervention",
      "level": 3,
      "conformance": "required_unless_context_says_otherwise",
      "uiComponent": "ProtocolSectionNode"
    },
    {
      "id": "7.1.2",
      "title": "Temporary Discontinuation of Trial Intervention",
      "level": 3,
      "conformance": "required_unless_context_says_otherwise",
      "uiComponent": "ProtocolSectionNode"
    },
    {
      "id": "7.1.3",
      "title": "Rechallenge",
      "level": 3,
      "conformance": "required_unless_context_says_otherwise",
      "uiComponent": "ProtocolSectionNode"
    },
    {
      "id": "7.2",
      "title": "Participant Discontinuation or Withdrawal from the Trial",
      "level": 2,
      "conformance": "required_unless_context_says_otherwise",
      "uiComponent": "ProtocolSectionNode"
    },
    {
      "id": "7.3",
      "title": "Management of Loss to Follow-Up",
      "level": 2,
      "conformance": "required_unless_context_says_otherwise",
      "uiComponent": "ProtocolSectionNode"
    },
    {
      "id": "8",
      "title": "TRIAL ASSESSMENTS AND PROCEDURES",
      "level": 1,
      "conformance": "required_unless_context_says_otherwise",
      "uiComponent": "ProtocolSectionNode"
    },
    {
      "id": "8.1",
      "title": "Trial Assessments and Procedures Considerations",
      "level": 2,
      "conformance": "required_unless_context_says_otherwise",
      "uiComponent": "ProtocolSectionNode"
    },
    {
      "id": "8.2",
      "title": "Screening/Baseline Assessments and Procedures",
      "level": 2,
      "conformance": "required_unless_context_says_otherwise",
      "uiComponent": "ProtocolSectionNode"
    },
    {
      "id": "8.3",
      "title": "Efficacy Assessments and Procedures",
      "level": 2,
      "conformance": "required_unless_context_says_otherwise",
      "uiComponent": "ProtocolSectionNode"
    },
    {
      "id": "8.4",
      "title": "Safety Assessments and Procedures",
      "level": 2,
      "conformance": "required_unless_context_says_otherwise",
      "uiComponent": "ProtocolSectionNode"
    },
    {
      "id": "8.5",
      "title": "Pharmacokinetics",
      "level": 2,
      "conformance": "required_unless_context_says_otherwise",
      "uiComponent": "ProtocolSectionNode"
    },
    {
      "id": "8.6",
      "title": "Biomarkers",
      "level": 2,
      "conformance": "required_unless_context_says_otherwise",
      "uiComponent": "ProtocolSectionNode"
    },
    {
      "id": "8.6.1",
      "title": "Genetics, Genomics, Pharmacogenetics, and Pharmacogenomics",
      "level": 3,
      "conformance": "required_unless_context_says_otherwise",
      "uiComponent": "ProtocolSectionNode"
    },
    {
      "id": "8.6.2",
      "title": "Pharmacodynamic Biomarkers",
      "level": 3,
      "conformance": "required_unless_context_says_otherwise",
      "uiComponent": "ProtocolSectionNode"
    },
    {
      "id": "8.7",
      "title": "Immunogenicity Assessments",
      "level": 2,
      "conformance": "required_unless_context_says_otherwise",
      "uiComponent": "ProtocolSectionNode"
    },
    {
      "id": "8.8",
      "title": "Medical Resource Utilisation and Health Economics",
      "level": 2,
      "conformance": "required_unless_context_says_otherwise",
      "uiComponent": "ProtocolSectionNode"
    },
    {
      "id": "9",
      "title": "ADVERSE EVENTS, SERIOUS ADVERSE EVENTS, PRODUCT COMPLAINTS, AND OTHER SAFETY REPORTING",
      "level": 1,
      "conformance": "required_unless_context_says_otherwise",
      "uiComponent": "ProtocolSectionNode"
    },
    {
      "id": "9.1",
      "title": "Definitions",
      "level": 2,
      "conformance": "required_unless_context_says_otherwise",
      "uiComponent": "ProtocolSectionNode"
    },
    {
      "id": "9.1.1",
      "title": "Definitions of Adverse Events",
      "level": 3,
      "conformance": "required_unless_context_says_otherwise",
      "uiComponent": "ProtocolSectionNode"
    },
    {
      "id": "9.1.2",
      "title": "Definitions of Serious Adverse Events",
      "level": 3,
      "conformance": "required_unless_context_says_otherwise",
      "uiComponent": "ProtocolSectionNode"
    },
    {
      "id": "9.1.3",
      "title": "Definitions of Product Complaints",
      "level": 3,
      "conformance": "required_unless_context_says_otherwise",
      "uiComponent": "ProtocolSectionNode"
    },
    {
      "id": "9.2",
      "title": "Timing and Procedures for Collection and Reporting",
      "level": 2,
      "conformance": "required_unless_context_says_otherwise",
      "uiComponent": "ProtocolSectionNode"
    },
    {
      "id": "9.2.1",
      "title": "Timing",
      "level": 3,
      "conformance": "required_unless_context_says_otherwise",
      "uiComponent": "ProtocolSectionNode"
    },
    {
      "id": "9.2.2",
      "title": "Collection Procedures",
      "level": 3,
      "conformance": "required_unless_context_says_otherwise",
      "uiComponent": "ProtocolSectionNode"
    },
    {
      "id": "9.2.3",
      "title": "Reporting",
      "level": 3,
      "conformance": "required_unless_context_says_otherwise",
      "uiComponent": "ProtocolSectionNode"
    },
    {
      "id": "9.2.3.1",
      "title": "Regulatory Reporting Requirements",
      "level": 4,
      "conformance": "required_unless_context_says_otherwise",
      "uiComponent": "ProtocolSectionNode"
    },
    {
      "id": "9.2.4",
      "title": "Adverse Events of Special Interest",
      "level": 3,
      "conformance": "required_unless_context_says_otherwise",
      "uiComponent": "ProtocolSectionNode"
    },
    {
      "id": "9.2.5",
      "title": "Disease-related Events or Outcomes Not Qualifying as AEs or SAEs",
      "level": 3,
      "conformance": "required_unless_context_says_otherwise",
      "uiComponent": "ProtocolSectionNode"
    },
    {
      "id": "9.3",
      "title": "Pregnancy and Postpartum Information",
      "level": 2,
      "conformance": "required_unless_context_says_otherwise",
      "uiComponent": "ProtocolSectionNode"
    },
    {
      "id": "9.4",
      "title": "Special Safety Situations",
      "level": 2,
      "conformance": "required_unless_context_says_otherwise",
      "uiComponent": "ProtocolSectionNode"
    },
    {
      "id": "10",
      "title": "STATISTICAL CONSIDERATIONS",
      "level": 1,
      "conformance": "required_unless_context_says_otherwise",
      "uiComponent": "ProtocolSectionNode"
    },
    {
      "id": "10.1",
      "title": "General Considerations",
      "level": 2,
      "conformance": "required_unless_context_says_otherwise",
      "uiComponent": "ProtocolSectionNode"
    },
    {
      "id": "10.2",
      "title": "Analysis Sets",
      "level": 2,
      "conformance": "required_unless_context_says_otherwise",
      "uiComponent": "ProtocolSectionNode"
    },
    {
      "id": "10.3",
      "title": "Analyses of Demographics and Other Baseline Variables",
      "level": 2,
      "conformance": "required_unless_context_says_otherwise",
      "uiComponent": "ProtocolSectionNode"
    },
    {
      "id": "10.4",
      "title": "Analyses Associated with the Primary Objective(s)",
      "level": 2,
      "conformance": "required_unless_context_says_otherwise",
      "uiComponent": "ProtocolSectionNode"
    },
    {
      "id": "10.5",
      "title": "Analyses Associated with the Secondary Objective(s)",
      "level": 2,
      "conformance": "required_unless_context_says_otherwise",
      "uiComponent": "ProtocolSectionNode"
    },
    {
      "id": "10.6",
      "title": "Analyses Associated with the Exploratory Objective(s)",
      "level": 2,
      "conformance": "required_unless_context_says_otherwise",
      "uiComponent": "ProtocolSectionNode"
    },
    {
      "id": "10.7",
      "title": "Safety Analyses",
      "level": 2,
      "conformance": "required_unless_context_says_otherwise",
      "uiComponent": "ProtocolSectionNode"
    },
    {
      "id": "10.8",
      "title": "Other Analyses",
      "level": 2,
      "conformance": "required_unless_context_says_otherwise",
      "uiComponent": "ProtocolSectionNode"
    },
    {
      "id": "10.10",
      "title": "Multiplicity Adjustments",
      "level": 2,
      "conformance": "required_unless_context_says_otherwise",
      "uiComponent": "ProtocolSectionNode"
    },
    {
      "id": "10.11",
      "title": "Sample Size Determination",
      "level": 2,
      "conformance": "required_unless_context_says_otherwise",
      "uiComponent": "ProtocolSectionNode"
    },
    {
      "id": "11",
      "title": "TRIAL OVERSIGHT AND OTHER GENERAL CONSIDERATIONS",
      "level": 1,
      "conformance": "required_unless_context_says_otherwise",
      "uiComponent": "ProtocolSectionNode"
    },
    {
      "id": "11.1",
      "title": "Regulatory and Ethical Considerations",
      "level": 2,
      "conformance": "required_unless_context_says_otherwise",
      "uiComponent": "ProtocolSectionNode"
    },
    {
      "id": "11.2",
      "title": "Trial Oversight",
      "level": 2,
      "conformance": "required_unless_context_says_otherwise",
      "uiComponent": "ProtocolSectionNode"
    },
    {
      "id": "11.2.1",
      "title": "Investigator Responsibilities",
      "level": 3,
      "conformance": "required_unless_context_says_otherwise",
      "uiComponent": "ProtocolSectionNode"
    },
    {
      "id": "11.2.2",
      "title": "Sponsor Responsibilities",
      "level": 3,
      "conformance": "required_unless_context_says_otherwise",
      "uiComponent": "ProtocolSectionNode"
    },
    {
      "id": "11.3",
      "title": "Informed Consent Process",
      "level": 2,
      "conformance": "required_unless_context_says_otherwise",
      "uiComponent": "ProtocolSectionNode"
    },
    {
      "id": "11.4",
      "title": "Committees",
      "level": 2,
      "conformance": "required_unless_context_says_otherwise",
      "uiComponent": "ProtocolSectionNode"
    },
    {
      "id": "11.5",
      "title": "Insurance and Indemnity",
      "level": 2,
      "conformance": "required_unless_context_says_otherwise",
      "uiComponent": "ProtocolSectionNode"
    },
    {
      "id": "11.6",
      "title": "Risk-Based Quality Management",
      "level": 2,
      "conformance": "required_unless_context_says_otherwise",
      "uiComponent": "ProtocolSectionNode"
    },
    {
      "id": "11.7",
      "title": "Data Governance",
      "level": 2,
      "conformance": "required_unless_context_says_otherwise",
      "uiComponent": "ProtocolSectionNode"
    },
    {
      "id": "11.8",
      "title": "Data Protection",
      "level": 2,
      "conformance": "required_unless_context_says_otherwise",
      "uiComponent": "ProtocolSectionNode"
    },
    {
      "id": "11.9",
      "title": "Source Records",
      "level": 2,
      "conformance": "required_unless_context_says_otherwise",
      "uiComponent": "ProtocolSectionNode"
    },
    {
      "id": "11.10",
      "title": "Protocol Deviations",
      "level": 2,
      "conformance": "required_unless_context_says_otherwise",
      "uiComponent": "ProtocolSectionNode"
    },
    {
      "id": "11.11",
      "title": "Early Site Closure",
      "level": 2,
      "conformance": "required_unless_context_says_otherwise",
      "uiComponent": "ProtocolSectionNode"
    },
    {
      "id": "11.12",
      "title": "Data Dissemination",
      "level": 2,
      "conformance": "required_unless_context_says_otherwise",
      "uiComponent": "ProtocolSectionNode"
    },
    {
      "id": "12",
      "title": "APPENDIX: SUPPORTING DETAILS",
      "level": 1,
      "conformance": "required_unless_context_says_otherwise",
      "uiComponent": "ProtocolSectionNode"
    },
    {
      "id": "12.1",
      "title": "Clinical Laboratory Tests",
      "level": 2,
      "conformance": "required_unless_context_says_otherwise",
      "uiComponent": "ProtocolSectionNode"
    },
    {
      "id": "12.2",
      "title": "Country/Region-Specific Differences",
      "level": 2,
      "conformance": "required_unless_context_says_otherwise",
      "uiComponent": "ProtocolSectionNode"
    },
    {
      "id": "12.3",
      "title": "Prior Protocol Amendment(s)",
      "level": 2,
      "conformance": "required_unless_context_says_otherwise",
      "uiComponent": "ProtocolSectionNode"
    },
    {
      "id": "13",
      "title": "APPENDIX: GLOSSARY OF TERMS AND ABBREVIATIONS",
      "level": 1,
      "conformance": "required_unless_context_says_otherwise",
      "uiComponent": "ProtocolSectionNode"
    },
    {
      "id": "14",
      "title": "APPENDIX: REFERENCES",
      "level": 1,
      "conformance": "required_unless_context_says_otherwise",
      "uiComponent": "ProtocolSectionNode"
    }
  ],
  "fieldDefinitionExamples": [
    {
      "id": "title_page.full_title",
      "sectionId": "Title Page",
      "label": "Full Title",
      "sourceTerm": "<Full Title>",
      "kind": "data",
      "dataType": "text",
      "requiredness": "required",
      "cardinality": "one_to_one",
      "repeatable": false,
      "controlledTerminology": null,
      "validationRules": [
        "must_not_be_blank"
      ],
      "aiHints": [
        "Should identify scientific aspects of the trial and population clearly."
      ]
    },
    {
      "id": "title_page.sponsor_protocol_identifier",
      "sectionId": "Title Page",
      "label": "Sponsor Protocol Identifier",
      "sourceTerm": "<Sponsor Protocol Identifier>",
      "kind": "data",
      "dataType": "text",
      "requiredness": "required",
      "cardinality": "one_to_one",
      "repeatable": false,
      "validationRules": [
        "must_have_at_least_one_non_space_character"
      ]
    },
    {
      "id": "title_page.original_protocol_indicator",
      "sectionId": "Title Page",
      "label": "Original Protocol",
      "sourceTerm": "[Original Protocol Indicator]",
      "kind": "value",
      "dataType": "valid_value",
      "requiredness": "required",
      "cardinality": "one_to_one",
      "controlledTerminology": {
        "codeList": "C217046",
        "values": [
          {
            "label": "Yes",
            "code": "C49488"
          },
          {
            "label": "No",
            "code": "C49487"
          }
        ]
      },
      "validationRules": [
        "if_no_then_amendment_identifier_required"
      ]
    },
    {
      "id": "title_page.amendment_scope",
      "sectionId": "Title Page",
      "label": "Amendment Scope",
      "sourceTerm": "[Amendment Scope]",
      "kind": "value",
      "dataType": "valid_value",
      "requiredness": "conditional",
      "visibilityRules": [
        "show_when original_protocol_indicator == 'No'"
      ],
      "controlledTerminology": {
        "codeList": "C217047",
        "values": [
          {
            "label": "Global",
            "code": "C68846"
          },
          {
            "label": "Not Global",
            "code": "C217026"
          }
        ]
      },
      "validationRules": [
        "if_not_global_then_country_region_or_site_identifier_required"
      ]
    },
    {
      "id": "title_page.trial_phase",
      "sectionId": "Title Page",
      "label": "Trial Phase",
      "sourceTerm": "[Trial Phase]",
      "kind": "value",
      "dataType": "valid_value",
      "requiredness": "required",
      "controlledTerminology": {
        "codeList": "C217045",
        "values": [
          "Early Phase 1",
          "Phase 1",
          "Phase 1/Phase 2",
          "Phase 1/Phase 2/Phase 3",
          "Phase 1/Phase 3",
          "Phase 2",
          "Phase 2/Phase 3",
          "Phase 2/Phase 3/Phase 4",
          "Phase 3",
          "Phase 3/Phase 4",
          "Phase 4"
        ]
      }
    },
    {
      "id": "1.1.1.primary_secondary_objectives_estimands",
      "sectionId": "1.1.1",
      "label": "Primary and Secondary Objectives and Estimands",
      "kind": "data",
      "dataType": "rich_text",
      "requiredness": "required",
      "aiHints": [
        "Summarize in natural, nontechnical language for synopsis; link to technical detail in Section 3."
      ]
    },
    {
      "id": "1.3.schedule_of_activities",
      "sectionId": "1.3",
      "label": "Schedule of Activities",
      "kind": "table",
      "dataType": "structured_table",
      "requiredness": "required",
      "repeatable": true,
      "downstreamLinks": [
        "visits",
        "assessments",
        "procedures",
        "SoA rows",
        "SDTM domain candidates",
        "CDASH form candidates"
      ]
    }
  ],
  "sampleValidationRules": [
    {
      "id": "VR-001",
      "name": "Required M11 element missing",
      "severity": "error",
      "logic": "requiredness == 'required' AND value is blank",
      "ui": "red marker in explorer, minimap, and inspector"
    },
    {
      "id": "VR-002",
      "name": "Conditional amendment data missing",
      "severity": "error",
      "logic": "original_protocol_indicator == 'No' AND amendment_identifier is blank",
      "ui": "red issue card with quick fix"
    },
    {
      "id": "VR-003",
      "name": "Non-global amendment scope lacks geographic/site identifier",
      "severity": "error",
      "logic": "amendment_scope == 'Not Global' AND no country/region/site identifier",
      "ui": "inline guided field prompt"
    },
    {
      "id": "VR-004",
      "name": "Objective without endpoint",
      "severity": "warning",
      "logic": "objective exists AND no linked endpoint or estimand",
      "ui": "amber dependency chip"
    },
    {
      "id": "VR-005",
      "name": "Assessment referenced in text but absent from SoA",
      "severity": "warning",
      "logic": "assessment/procedure term appears in protocol body AND no corresponding SoA row",
      "ui": "AI suggestion to add SoA row"
    }
  ],
  "entities": [
    "Protocol",
    "ProtocolVersion",
    "ProtocolSection",
    "SectionElement",
    "FieldDefinition",
    "FieldValue",
    "ControlledTerminologySet",
    "ScheduleOfActivities",
    "Visit",
    "Activity",
    "Assessment",
    "Objective",
    "Endpoint",
    "Estimand",
    "Intervention",
    "Amendment",
    "Comment",
    "ValidationIssue",
    "AuditEvent",
    "AIConversation"
  ],
  "seedProtocols": [
    {
      "id": "seed_oncology_phase3",
      "title": "Phase 3 randomized oncology protocol",
      "phase": "Phase 3",
      "features": [
        "global amendment example",
        "objectives/endpoints/estimands linkage",
        "SoA with screening, treatment cycles, EOT, follow-up"
      ]
    },
    {
      "id": "seed_rare_disease_phase2",
      "title": "Phase 2 rare disease protocol",
      "phase": "Phase 2",
      "features": [
        "small sample size rationale",
        "biomarker assessments",
        "adaptive design rationale"
      ]
    }
  ]
}
```
