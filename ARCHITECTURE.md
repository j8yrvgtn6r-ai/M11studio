# M11 Studio - Architecture Overview

## System Architecture

### High-Level Design
M11 Studio is a single-page application (SPA) built with React that implements an IDE-style interface for clinical protocol authoring. The architecture follows a component-based design with clear separation of concerns.

```
┌─────────────────────────────────────────────────────────────────┐
│                         Top Toolbar                             │
│  Logo | Command Palette | Validation | Export | Save | Theme   │
└─────────────────────────────────────────────────────────────────┘
┌──────────┬──────────────────────────┬───────────────────────────┐
│          │                          │                           │
│ Protocol │   Document Viewport      │  ┌─────────────────────┐ │
│ Explorer │   (Center Panel)         │  │ Detail Inspector    │ │
│          │                          │  │ • Metadata          │ │
│ • Hierar │   Structured Forms:      │  │ • Validation        │ │
│   -chical│   • Text inputs          │  │ • Comments          │ │
│   tree   │   • Dropdowns            │  │ • Audit Trail       │ │
│ • Status │   • Textareas            │  │ • Mappings          │ │
│   dots   │   • Badges               │  └─────────────────────┘ │
│ • Valid- │                          │  ┌─────────────────────┐ │
│   ation  │   OR                     │  │ Protocol Copilot    │ │
│   badges │                          │  │ (AI Chat)           │ │
│ • Expand │   Schedule of Activities:│  │ • Message history   │ │
│   /Coll- │   • Interactive grid     │  │ • Quick actions     │ │
│   apse   │   • Visits × Assessments │  │ • Suggestions       │ │
│          │   • Cell selection       │  └─────────────────────┘ │
│          │                          │  │ Minimap │            │
└──────────┴──────────────────────────┴──┴─────────┴────────────┘
┌─────────────────────────────────────────────────────────────────┐
│                        Status Bar                               │
│  Protocol ID | User | Progress | Validation | Last Saved       │
└─────────────────────────────────────────────────────────────────┘
```

## Component Hierarchy

### App.tsx (Root)
Main application shell that orchestrates all major components and manages global state.

**State Management:**
- `selectedSectionId`: Currently active protocol section
- `selectedFieldId`: Currently active field for detail inspection
- `fields`: All field definitions with values (initialized from `getFieldDefinitions()`)
- `showDependencyGraph`: Toggles authoring vs graph workspace
- `selectedDependencyNode`: Selected graph node for Dependency Inspector
- `commandOpen`: Command palette visibility
- `welcomeOpen`: Welcome dialog visibility
- `lastSaved`: Timestamp of last save operation

**Protocol data:** Loaded at module scope via `getProtocolSections()`, `getFieldDefinitions()`, etc. from `domain/protocol` (canonical seed JSON).

**Key Responsibilities:**
- Layout orchestration with ResizablePanelGroup
- Section selection coordination
- Field value updates
- Command palette management
- Theme initialization
- First-visit detection

### Protocol Explorer Component
**File:** `ProtocolExplorer.tsx`

**Purpose:** Hierarchical navigation tree for protocol structure

**Features:**
- Recursive tree rendering with `SectionTreeNode`
- Expand/collapse for parent sections
- Visual status indicators (colored dots)
- Validation count badges
- Comment count badges
- Amendment indicators
- Level-based indentation
- Click selection with highlight

**Props Interface:**
```typescript
{
  sections: ProtocolSection[]
  selectedSectionId: string | null
  onSelectSection: (sectionId: string) => void
}
```

### Document Viewport Component
**File:** `DocumentViewport.tsx`

**Purpose:** Central editing canvas for protocol sections

**Features:**
- Section header with status badge
- Breadcrumb navigation
- Conformance display
- Field editor instances
- Empty state for non-editable sections

**Sub-Component: FieldEditor**
- Renders appropriate input type based on field definition
- Displays field metadata badges (Required, Conditional, Repeatable, etc.)
- Shows AI hints
- Handles controlled terminology via Select component
- Completion indicators

**Props Interface:**
```typescript
{
  section: ProtocolSection | null
  fields: FieldDefinition[]
  onFieldChange: (fieldId: string, value: any) => void
}
```

### Schedule of Activities Component
**File:** `ScheduleOfActivities.tsx`

**Purpose:** Specialized grid view for protocol schedule planning

**Features:**
- Table layout with visits as columns
- Assessments grouped by category (rows)
- Cell states: required (green checkmark) or optional (gray circle)
- Linked section indicators
- Horizontal/vertical scrolling
- Cell click handlers for detail inspection

**Data Model:**
- Visits: timepoint labels (Screening, C1D1, etc.)
- Assessments: categorized procedures
- SoACells: visit-assessment intersections with required flag

### Document Minimap Component
**File:** `DocumentMinimap.tsx`

**Purpose:** Compressed visual overview of entire protocol

**Features:**
- 64px fixed-width vertical strip
- Flattens hierarchical sections into linear map
- Color-coded blocks by status
- Validation/comment indicators overlaid
- Current section ring highlight
- Hover tooltips with section names
- Click to jump to section

**Algorithm:**
```typescript
flattenSections(sections: ProtocolSection[]): ProtocolSection[]
// Recursively flattens tree into array for vertical rendering
```

### Detail Inspector Component
**File:** `DetailInspector.tsx`

**Purpose:** Multi-tab panel for detailed field/section information

**Tabs:**
1. **Metadata** - Field properties, controlled terminology, validation rules, AI hints
2. **Validation** - Active issues with severity colors and quick-fix buttons
3. **Comments** - Discussion threads with user/timestamp
4. **Audit Trail** - Chronological event log
5. **Mappings** - Downstream system mappings (CDASH/SDTM/FHIR)

**Sub-Components:**
- `MetadataTab` - Structured display of M11 element properties
- `ValidationTab` - Issue cards with severity-based styling
- `CommentsTab` - Comment cards with resolved status
- `AuditTab` - Chronological event list
- `MappingsTab` - Mapping cards with status badges

**Empty States:**
Each tab includes a centered empty state with icon when no data exists.

### Protocol Copilot Component
**File:** `ProtocolCopilot.tsx`

**Purpose:** AI-powered conversational assistant

**Features:**
- Message history (user/assistant bubbles)
- Input field with send button
- Quick action chips
- Suggestion cards with action buttons
- Mock response generation based on input context

**Response Patterns:**
- Compliance checking → lists validation issues with suggested fixes
- Section drafting → generates protocol text based on existing data
- SoA suggestions → proposes missing assessments/visits
- General help → explains M11 requirements

**Message Model:**
```typescript
{
  id: string
  role: 'user' | 'assistant'
  content: string
  timestamp: Date
  suggestions?: Array<{ text: string; action: string }>
}
```

### Supporting Components

#### ThemeToggle
Dropdown menu with Light/Dark/System options. Persists selection to localStorage and applies theme class to root element.

#### WelcomeDialog
First-visit onboarding modal with:
- Feature overview cards
- Status color legend
- Quick start instructions
- "Get Started" dismissal button

#### StatusBar
Bottom info bar displaying:
- Protocol ID
- Current user
- Section completion counter
- Validation issue count
- Last saved timestamp
- M11 version badge

#### KeyboardShortcuts
Help dialog listing all keyboard shortcuts with icon + description + key combo badge.

### Dependency Graph Components

#### DependencyGraphContainer
**File:** `DependencyGraphContainer.tsx`

Orchestrates 2D/3D graph tabs, search, and selection callbacks. Used when `showDependencyGraph` is true in `App.tsx`.

#### DependencyGraphNodeEditor (2D)
**File:** `DependencyGraphNodeEditor.tsx`

React Flow node-editor visualization. Data from `getDependencyNodes()` / `getDependencyEdges()`.

#### DependencyGraph3D (3D)
**File:** `DependencyGraph3D.tsx`

ForceGraph3D visualization of the **same** relationship model as the 2D graph.

#### DependencyInspector
**File:** `DependencyInspector.tsx`

Sidebar panel showing parent/child dependencies and impact analysis for the selected graph node.

## Data Layer

### Architecture Overview

```
PROTO-XYZ-301.json (canonical artifact)
        │
        ▼
  loadProtocol() / getProtocolDocument()
        │
        ▼
  domain/protocol/selectors/  ──►  view DTOs (types/protocol.ts, types/dependencyGraph.ts)
        │
        ▼
  App.tsx, graph components, inspectors
```

**Key principle:** One protocol model, many views. Document, SoA, validation, collaboration, and dependency graphs all derive from the same seed JSON. The 2D and 3D graphs share `clinicalDesign` entities and `relationships`—there is no separate graph dataset.

### Canonical Protocol (`domain/protocol/`)

**Seed artifact:** `domain/protocol/seed/PROTO-XYZ-301.json`

Contains:
- `sections` — hierarchical document tree
- `elements` — authored M11 fields
- `clinicalDesign` — objectives, endpoints, assessments, visits, arms, etc.
- `schedule` — visits, assessments, SoA cells
- `relationships` — directed edges for dependency graphs
- `validationIssues`, `collaboration` — static validation and audit data (until live rule engine)

**Canonical types:** `domain/protocol/types.ts` (`ProtocolDocument`, `DesignEntity`, `ProtocolRelationship`, etc.)

**Selectors:** `domain/protocol/selectors/` adapt canonical data to existing view DTOs:

| Selector | View DTO |
|----------|----------|
| `getProtocolSections()` | `ProtocolSection[]` |
| `getFieldDefinitions()` | `FieldDefinition[]` |
| `getVisits()` / `getAssessments()` / `getSoACells()` | SoA models |
| `getValidationIssues()` | `ValidationIssue[]` |
| `getComments()` / `getAuditEvents()` | Collaboration models |
| `getDependencyNodes()` / `getDependencyEdges()` | Graph models |

**Runtime consumers:**
- `App.tsx` — authoring workspace data
- `DependencyGraphNodeEditor.tsx`, `DependencyGraph3D.tsx`, `DependencyInspector.tsx` — graph data

### View Types (`types/protocol.ts`, `types/dependencyGraph.ts`)

UI-facing DTOs unchanged during migration:
- `ProtocolSection`, `FieldDefinition`, `ValidationIssue`, `AuditEvent`, `Comment`
- `Visit`, `Assessment`, `SoACell`
- `DependencyNode`, `DependencyEdge`

### Legacy Mock Data (parity only — runtime migration complete)

**Files:** `data/mockData.ts`, `data/dependencyGraphData.ts`

Retained **only** for migration parity verification (`npm run test:parity`). **No runtime component imports these files.** They will be removed once parity checks use snapshot fixtures instead of legacy exports.

See [MIGRATION_STATUS.md](../MIGRATION_STATUS.md) for the full migration checklist, import audit, and recommended deletion order.

### Parity Verification (`domain/protocol/parity/`)

`runParityCheck()` compares all selector outputs against legacy mock exports. Run via:

```bash
npm run test:parity
```

### Utilities (`utils/statusColors.ts`)
Status color mapping functions:
- `getStatusColor(status)` - Returns bg/border/text/dot color classes
- `getSeverityColor(severity)` - Returns severity-specific colors
- `getStatusLabel(status)` - Human-readable status strings

## Styling System

### Tailwind CSS v4.0
- Utility-first CSS framework
- JIT (Just-In-Time) compilation
- Dark mode variant support via `.dark` class
- Custom color tokens via CSS custom properties

### Theme CSS (`styles/theme.css`)
**CSS Custom Properties:**
- Semantic colors: `--background`, `--foreground`, `--primary`, etc.
- Status colors: `--status-complete`, `--status-error`, etc. (14 total: 7 × 2 themes)
- Spacing: `--radius` variants (sm/md/lg/xl)
- Chart colors: `--chart-1` through `--chart-5`
- Sidebar colors: dedicated palette for explorer panel

**Dark Mode:**
- Default theme (enterprise standard)
- Higher contrast for accessibility
- Optimized status colors for dark backgrounds

### Component Library
**shadcn/ui (46 components):**
Based on Radix UI primitives with Tailwind styling. Fully accessible, keyboard navigable, and themeable.

Key components used:
- Layout: ResizablePanel, ScrollArea, Tabs, Separator
- Forms: Input, Textarea, Select, Label, Checkbox
- Feedback: Badge, Alert, Progress, Skeleton
- Overlays: Dialog, Popover, Tooltip, Command
- Navigation: Breadcrumb, DropdownMenu

## State Management Strategy

### Local Component State
Most state is co-located in components using React's `useState`:
- UI state (open/closed, expanded/collapsed)
- Form inputs (controlled components)
- Local selections

### Lifted State in App.tsx
Shared state lifted to root:
- `selectedSectionId` - Coordinates Explorer, Viewport, Inspector, Minimap
- `fields` - Single source of truth for all field values
- `commandOpen` - Command palette visibility

### Props Drilling
Intentionally used for simplicity in this prototype. For production scale:
- Consider Context API for theme state
- Consider state management library (Zustand, Redux) for complex interactions
- Consider React Query for server state when backend is added

### Local Storage
Persistent client-side storage:
- `theme` - User's theme preference
- `m11-studio-visited` - First-visit flag

## Event Flow Examples

### Section Selection
1. User clicks section in Protocol Explorer
2. `onSelectSection(sectionId)` called
3. `handleSectionSelect` in App updates `selectedSectionId` state
4. React re-renders:
   - Explorer highlights selected section
   - Viewport loads section fields
   - Inspector filters validation issues
   - Minimap adds ring highlight

### Field Editing
1. User types in field input in Document Viewport
2. `onChange` event fires in FieldEditor
3. `onFieldChange(fieldId, value)` called
4. `handleFieldChange` in App updates fields array
5. React re-renders:
   - Field shows new value
   - Validation re-runs (in production)
   - Audit event logged (in production)

### Command Palette Navigation
1. User presses ⌘K
2. Command palette dialog opens
3. User types search query
4. Fuzzy matching filters sections/actions
5. User selects section
6. `handleSectionSelect` called with section ID
7. Palette closes, section loads in viewport

## Performance Considerations

### Optimizations Implemented
- **Conditional Rendering**: Only render active viewport (Document OR SoA)
- **Lazy Rendering**: ScrollArea virtualizes long lists
- **Memoization Candidates**: `findSection`, `flattenSections` (currently recalculated on each render)

### Future Optimizations
- React.memo for expensive components (SectionTreeNode, FieldEditor)
- useMemo for derived state (section counts, validation grouping)
- useCallback for event handlers passed as props
- Virtual scrolling for large SoA grids (react-window)

## Accessibility

### Keyboard Navigation
- Tab order follows visual layout
- Enter/Space activates buttons
- Arrow keys navigate command palette
- Esc closes dialogs/popovers
- ⌘K global command palette

### Screen Reader Support
- Semantic HTML (`<button>`, `<input>`, `<label>`)
- ARIA labels on icon-only buttons
- Role attributes on complex widgets
- Live regions for dynamic content (validation alerts)

### Visual Accessibility
- WCAG 2.1 AA contrast ratios
- Focus visible indicators
- Color + icon for status (not color alone)
- Resizable text (rem units)

## Security Considerations

### Client-Side Only (Current)
- No authentication/authorization (prototype)
- No sensitive data transmission
- Local storage only (theme, visit flags)

### Production Hardening Needed
- [ ] User authentication (JWT, OAuth)
- [ ] Role-based access control (RBAC)
- [ ] API request signing
- [ ] Input sanitization (XSS prevention)
- [ ] CSRF protection
- [ ] Audit trail integrity (signed events)
- [ ] Encrypted storage for sensitive fields

## Extensibility Points

### Plugin Architecture (Future)
Modular design allows:
- Custom validation rules (register in rule engine)
- Additional inspector tabs (mappings to new systems)
- Custom field types (new input widgets)
- Export formats (PDF, Word, FHIR, CDISC ODM)

### API Integration (Ready)
The domain layer is designed for backend swap without changing component props:
- `PROTO-XYZ-301.json` → API fetch / Supabase persistence
- Selectors remain the adapter boundary; add React Query for caching/mutations
- Keep view DTO shapes stable for UI components

### Theming (Extensible)
CSS custom properties allow:
- Organization-specific color schemes
- Multiple theme presets (not just light/dark)
- Per-protocol branding

## Testing Strategy

### Parity Tests (Implemented)
- **Command:** `npm run test:parity`
- **Location:** `domain/protocol/parity/checkParity.ts`, `scripts/check-protocol-parity.ts`
- **Purpose:** Verify selector outputs match legacy mock exports during migration

### Recommended Additional Coverage
- **Unit Tests**: Utilities, validators, status color functions
- **Component Tests**: Each major component in isolation with mock props
- **Integration Tests**: Multi-component workflows (select section → edit field → validate)
- **E2E Tests**: Full user journeys (Playwright, Cypress)

### Test Pyramid
```
       /\
      /E2E\          5% - Critical user paths
     /------\
    /  Int.  \       15% - Component interactions
   /----------\
  /   Unit     \     80% - Pure functions, utilities
 /--------------\
```

## Deployment Architecture (Future)

### Static Hosting (Current Capability)
Build output from Vite can be hosted on:
- Vercel, Netlify (CDN + serverless functions)
- AWS S3 + CloudFront
- Azure Static Web Apps

### Full-Stack (Production)
```
┌──────────┐      ┌──────────┐      ┌──────────┐
│  React   │─────>│   API    │─────>│ Database │
│  (SPA)   │ HTTPS│ (Node.js)│  SQL │(Postgres)│
└──────────┘      └──────────┘      └──────────┘
      │                 │                 │
      │                 V                 │
      │           ┌──────────┐            │
      │           │  Auth    │            │
      └──────────>│(Keycloak)│<───────────┘
                  └──────────┘
```

### Microservices (Enterprise Scale)
- Protocol Service (CRUD, versioning)
- Validation Service (rule engine)
- Export Service (PDF, Word generation)
- Mapping Service (CDASH/SDTM/FHIR)
- Collaboration Service (comments, real-time)
- Audit Service (tamper-proof log)

## Technology Decisions Rationale

### React vs. Vue/Angular
✅ **React** - Largest ecosystem, best TypeScript support, Vite compatibility

### Tailwind vs. CSS Modules/Styled Components
✅ **Tailwind** - Rapid prototyping, consistent spacing, dark mode built-in

### Radix UI vs. Material UI/Ant Design
✅ **Radix UI** - Unstyled primitives (maximum design flexibility), better accessibility

### Vite vs. Create React App/Next.js
✅ **Vite** - Fastest HMR, optimized builds, required by Figma Make environment

### TypeScript vs. JavaScript
✅ **TypeScript** - Type safety for complex medical domain model, better DX

## Maintenance & Operations

### Development Workflow
```bash
# Local development
npm install
npm run dev

# Verify selector parity (migration safety net)
npm run test:parity

# Production build
npm run build
```

### Version Control (Recommended)
- Feature branches: `feature/schedule-of-activities`
- Conventional commits: `feat:`, `fix:`, `docs:`, `refactor:`
- Semantic versioning: `v1.0.0` (major.minor.patch)

### Documentation
- [ ] Component API docs (JSDoc comments)
- [x] Architecture overview (this file)
- [x] Feature list (FEATURES.md)
- [x] User guide (README.md)
- [x] Migration status (MIGRATION_STATUS.md)
- [ ] API documentation (when backend added)

## Glossary of M11 Terms

- **ICH M11**: International Council for Harmonisation guideline for Clinical Electronic Structured Harmonised Protocol (CeSHarP)
- **CeSHarP**: Clinical Electronic Structured Harmonised Protocol - the M11 standard
- **SoA**: Schedule of Activities - grid of visits × assessments
- **CDASH**: Clinical Data Acquisition Standards Harmonization (CDISC)
- **SDTM**: Study Data Tabulation Model (CDISC)
- **FHIR**: Fast Healthcare Interoperability Resources (HL7)
- **Conformance**: Requiredness level (Required, Optional, Conditional)
- **Cardinality**: Number of allowed instances (one-to-one, one-to-many)
- **Controlled Terminology**: Predefined value sets (CDISC, NCI Thesaurus)

---

**Document Version**: 1.1  
**Last Updated**: 2026-06-02  
**Maintained By**: M11 Studio Development Team
