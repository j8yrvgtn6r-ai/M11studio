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
pnpm install

# Start development server
# Note: The dev server is already running in this environment

# Build for production
# Note: Do not run vite build in this environment
```

## Project Structure

```
src/
├── app/
│   ├── components/
│   │   ├── ui/              # Shadcn/UI components
│   │   ├── ProtocolExplorer.tsx
│   │   ├── DocumentViewport.tsx
│   │   ├── DocumentMinimap.tsx
│   │   ├── DetailInspector.tsx
│   │   ├── ProtocolCopilot.tsx
│   │   ├── ScheduleOfActivities.tsx
│   │   └── ThemeToggle.tsx
│   ├── data/
│   │   └── mockData.ts      # Sample protocol data
│   ├── types/
│   │   └── protocol.ts      # TypeScript type definitions
│   ├── utils/
│   │   └── statusColors.ts  # Status color utilities
│   └── App.tsx              # Main application
└── styles/
    ├── theme.css            # CSS custom properties
    └── index.css            # Style imports
```

## Sample Data

The application includes two pre-populated example protocols:

1. **Phase 3 Oncology Protocol** (PROTO-XYZ-301)
   - Randomized, double-blind, placebo-controlled
   - Advanced non-small cell lung cancer
   - Global amendment example
   - Comprehensive Schedule of Activities

2. **Phase 2 Rare Disease Protocol** (planned)
   - Small sample size rationale
   - Biomarker-driven design
   - Adaptive design features

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
