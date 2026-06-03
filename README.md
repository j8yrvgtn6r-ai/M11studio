# M11 Studio

An enterprise-grade IDE-style application for authoring ICH M11 / CeSHarP-compliant clinical trial protocols.

## Overview

M11 Studio transforms clinical protocol authoring from a document-centric process into a structured, data-driven workflow. Built with React, TypeScript, and Tailwind CSS, it provides a modern development environment for creating validated, compliant clinical trial protocols.

## Key Features

### 🏗️ IDE-Style Architecture
- **Protocol Explorer**: Hierarchical tree navigation with real-time status indicators
- **Document Viewport**: Structured form-based editing with controlled terminology
- **Document Minimap**: Visual overview with validation hotspots
- **Detail Inspector**: Multi-tab panel for metadata, validation, comments, audit trail, and downstream mappings
- **AI Protocol Copilot**: Intelligent assistant for M11 compliance checking and content generation

### ✅ M11 Compliance
- Structured data model based on ICH M11 Technical Specification
- Controlled terminology support (CDISC, NCI Thesaurus)
- Built-in validation rules with real-time feedback
- Conformance tracking (Required, Optional, Conditional)
- Amendment management with change tracking

### 📊 Schedule of Activities (SoA)
- Interactive grid interface for visit/assessment planning
- Automatic downstream mapping suggestions (CDASH, SDTM, FHIR)
- Linked to protocol sections for traceability
- Visual indicators for required vs optional procedures

### 🔗 Dependency Graph (2D & 3D)
- Node-editor style 2D graph (React Flow) and force-directed 3D graph (ForceGraph3D)
- Both views render the same canonical protocol relationships from seed JSON
- Dependency Inspector with parent/child dependencies and impact analysis
- Double-click navigation back to document sections

### 🎨 Enterprise UI/UX
- Dark mode by default with light/system theme support
- Resizable panels for customized workspace layouts
- Command palette (⌘K) for quick navigation
- Keyboard shortcuts for common actions
- Status color system:
  - 🟢 Green: Complete
  - 🔵 Blue: In Progress
  - 🔴 Red: Required Missing
  - 🟠 Amber: Conditional Missing
  - 🟣 Violet: AI Suggestion
  - 🟣 Purple: Reused/Linked Content
  - 🟠 Orange: Amended

### 🔄 Collaborative Features
- Real-time validation feedback
- Comment threads on sections and fields
- Comprehensive audit trail
- User role support (Protocol Author, Medical Writer, Clinical Scientist, Statistician, etc.)

## Technology Stack

- **Frontend**: React 18.3 with TypeScript
- **Styling**: Tailwind CSS v4.0
- **Components**: Radix UI primitives
- **Icons**: Lucide React
- **Date Handling**: date-fns
- **Build Tool**: Vite

## Getting Started

```bash
# Install dependencies
npm install

# Start development server
npm run dev

# Verify selector parity against legacy mock exports
npm run test:parity

# Build for production
npm run build
```

## Data Architecture

M11 Studio uses a **single canonical protocol artifact** as the source of truth:

- **Seed JSON:** `src/app/domain/protocol/seed/PROTO-XYZ-301.json`
- **Domain layer:** `src/app/domain/protocol/` (types, loaders, selectors, parity checks)
- **View DTOs:** `src/app/types/protocol.ts` and `src/app/types/dependencyGraph.ts` (unchanged UI contracts)

All runtime views consume data through **selector/adapters** in `src/app/domain/protocol/selectors/`, re-exported from `src/app/domain/protocol`:

| Selector | Used by |
|----------|---------|
| `getProtocolSections()` | Protocol Explorer, Minimap, App shell |
| `getFieldDefinitions()` | Document Viewport (via App state) |
| `getVisits()`, `getAssessments()`, `getSoACells()` | Schedule of Activities |
| `getValidationIssues()`, `getComments()`, `getAuditEvents()` | Detail Inspector, Status Bar |
| `getDependencyNodes()`, `getDependencyEdges()` | 2D graph, 3D graph, Dependency Inspector |

**2D and 3D dependency graphs** derive from the same protocol relationship model (`clinicalDesign` entities + `relationships` in the seed JSON)—not separate graph datasets.

Legacy files `src/app/data/mockData.ts` and `src/app/data/dependencyGraphData.ts` are **retained only for parity verification** (`npm run test:parity`). The runtime app no longer imports them.

See [MIGRATION_STATUS.md](./MIGRATION_STATUS.md) for the full migration checklist and remaining cleanup steps.

## Project Structure

```
src/
├── app/
│   ├── domain/
│   │   └── protocol/
│   │       ├── seed/
│   │       │   └── PROTO-XYZ-301.json   # Canonical protocol artifact
│   │       ├── selectors/               # Adapters → view DTOs
│   │       ├── parity/                  # Legacy parity verification
│   │       ├── types.ts                 # Canonical domain types
│   │       ├── loadProtocol.ts
│   │       └── index.ts
│   ├── components/
│   │   ├── ui/                          # Shadcn/UI components
│   │   ├── ProtocolExplorer.tsx
│   │   ├── DocumentViewport.tsx
│   │   ├── DocumentMinimap.tsx
│   │   ├── DetailInspector.tsx
│   │   ├── ProtocolCopilot.tsx
│   │   ├── ScheduleOfActivities.tsx
│   │   ├── DependencyGraphContainer.tsx
│   │   ├── DependencyGraphNodeEditor.tsx  # 2D graph (React Flow)
│   │   ├── DependencyGraph3D.tsx            # 3D graph (ForceGraph3D)
│   │   └── DependencyInspector.tsx
│   ├── data/
│   │   ├── mockData.ts                  # Legacy — parity only
│   │   └── dependencyGraphData.ts       # Legacy — parity only
│   ├── types/
│   │   ├── protocol.ts                  # View-layer DTOs
│   │   └── dependencyGraph.ts
│   ├── utils/
│   │   └── statusColors.ts
│   └── App.tsx
└── styles/
    ├── theme.css
    └── index.css
```

## Sample Data

The application ships with one fully populated example protocol loaded from the canonical seed:

**Phase 3 Oncology Protocol** (`PROTO-XYZ-301`) — defined in `src/app/domain/protocol/seed/PROTO-XYZ-301.json`

- Randomized, double-blind, placebo-controlled oncology study
- Global amendment example with validation issues
- Comprehensive Schedule of Activities (9 visits × 12 assessments)
- Clinical design dependency graph (22 nodes, 21 relationships) shared by 2D and 3D views

A second example protocol (Phase 2 rare disease) remains planned for a future release.

## M11 Data Model

The application implements a normalized M11 element model:

- **Source Fields**: termVariable, dataType, entryClass (H/D/V), definitionConceptCode, userGuidance, conformance, cardinality, tocRelationship, valueOrValueList, businessRules, repeatingReuseRules
- **Normalized Fields**: id, label, sectionId, kind, dataType, requiredness, cardinality, repeatable, reusable, visibilityRules, validationRules, controlledTerminology, downstreamLinks, aiHints, auditEvents

## Validation Rules

Built-in validation rules include:

- **VR-001**: Required M11 element missing
- **VR-002**: Conditional amendment data missing
- **VR-003**: Non-global amendment scope lacks geographic identifier
- **VR-004**: Objective without linked endpoint
- **VR-005**: Assessment referenced in text but absent from SoA

## Keyboard Shortcuts

- `⌘K / Ctrl+K` - Open command palette
- `⌘S / Ctrl+S` - Save protocol
- `⌘E / Ctrl+E` - Export protocol
- `⌘F / Ctrl+F` - Search in document

## Future Enhancements

- [ ] Real-time collaboration with WebSocket support
- [ ] Version control integration
- [ ] PDF/Word export with M11 formatting
- [ ] Regulatory submission package generation
- [ ] CDASH/SDTM/FHIR auto-mapping engine
- [ ] Integration with electronic data capture (EDC) systems
- [ ] Multi-protocol workspace management

## License

Proprietary - M11 Studio

## Support

For issues, questions, or feature requests, please contact the development team.
