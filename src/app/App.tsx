import { useState, useEffect } from 'react';
import { ResizableHandle, ResizablePanel, ResizablePanelGroup } from './components/ui/resizable';
import { ProtocolExplorer } from './components/ProtocolExplorer';
import { DocumentViewport } from './components/DocumentViewport';
import { DocumentMinimap } from './components/DocumentMinimap';
import { DetailInspector } from './components/DetailInspector';
import { ProtocolCopilot } from './components/ProtocolCopilot';
import { ScheduleOfActivities } from './components/ScheduleOfActivities';
import { DependencyGraphContainer } from './components/DependencyGraphContainer';
import { DependencyInspector } from './components/DependencyInspector';
import { ThemeToggle } from './components/ThemeToggle';
import { ProtocolBuildConsole } from './components/ProtocolBuildConsole';
import { useProtocolBuildConsole } from './domain/protocol/build/useProtocolBuildConsole';
import { WelcomeDialog } from './components/WelcomeDialog';
import { StatusBar, type AutosaveStatus } from './components/StatusBar';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from './components/ui/popover';
import { ScrollArea } from './components/ui/scroll-area';
import { Badge } from './components/ui/badge';
import { ProtocolSearchDialog } from './components/protocol-ide/ProtocolSearchDialog';
import { FindReplacePanel } from './components/protocol-ide/FindReplacePanel';
import type { ProtocolSearchMatch } from './domain/protocol/search/protocolSearch';
import { resolveProtocolIdeShortcut } from './domain/protocol/authoring/protocolIdeShortcuts';
import {
  FileText,
  Search,
  Settings,
  Download,
  Users,
  Workflow,
  AlertCircle,
  AlertTriangle,
  CheckCircle2,
  Network,
  Loader2,
  Clock,
} from 'lucide-react';
import { Button } from './components/ui/button';
import {
  getAuditEvents,
  getComments,
  getDependencyNodes,
  getFieldDefinitions,
  getProtocolSections,
  getValidationIssues,
  subscribe,
  updateElementValue,
  downloadProtocolJson,
} from './domain/protocol';
import type { ProtocolSection, FieldDefinition } from './types/protocol';
import type { DependencyNode } from './types/dependencyGraph';
import { SoAAssessmentAuthoringProvider } from './components/soa-configuration/SoAAssessmentAuthoringContext';
import { SettingsWorkspace, type SettingsView } from './components/settings/SettingsWorkspace';
import { SectionAuthoringCanvas } from './components/m11-template-reference/SectionAuthoringCanvas';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from './components/ui/dropdown-menu';
import { NewProjectDialog } from './components/protocol-import/NewProjectDialog';
import { ImportProtocolDialog } from './components/protocol-import/ImportProtocolDialog';
import { resolveProtocolDisplayIdentity } from './domain/protocol/import/protocolIdentity';
import { ImportStorageRecoveryBanner } from './components/protocol-import/ImportStorageRecoveryBanner';
import { ProtocolImportReviewWorkspace } from './components/protocol-import/ProtocolImportReviewWorkspace';
import {
  collectImportValidationFindings,
  getLastPersistedAt,
  subscribeProtocolImportPersist,
} from './domain/protocol/import/protocolImportStore';
import { subscribeStudyModelUpdated } from './agents';
import {
  applyManualSectionContentEdit,
  resolveSectionEditorContent,
} from './domain/protocol/import/sectionAuthoring';
import { resolveSectionGenerationState } from './domain/protocol/build/protocolBuildConsoleStore';
import {
  countAuthoringCompletedSections,
  countAuthoringTotalSections,
} from './domain/protocol/authoring/sectionAuthoringCompletion';
import {
  getProtocolDocumentLastPersistedAt,
  isBlankProjectMode,
  subscribeProtocolDocumentPersist,
} from './domain/protocol/store/protocolStore';
import { getCanonicalDocumentByUploadId } from './domain/document-ingestion';
import akyrianLogo from './assets/akyrian-logo.svg';

import { useProtocolImport, useSectionImportDraft } from './domain/protocol/import/ProtocolImportContext';

type HeaderValidationFinding = {
  id: string;
  sectionId: string;
  severity: 'error' | 'warning' | 'info';
  message: string;
  name?: string;
};
const initialProtocolSections = getProtocolSections();
const auditEvents = getAuditEvents();
const comments = getComments();

export default function App() {
  const [selectedSectionId, setSelectedSectionId] = useState<string | null>('title');
  const [selectedFieldId, setSelectedFieldId] = useState<string | null>(null);
  const [fields, setFields] = useState(() => getFieldDefinitions());
  const [commandOpen, setCommandOpen] = useState(false);
  const [findReplaceOpen, setFindReplaceOpen] = useState(false);
  const [findReplaceMode, setFindReplaceMode] = useState<'find' | 'replace'>('find');
  const [highlightQuery, setHighlightQuery] = useState<string | undefined>();
  const [forceSaveSignal, setForceSaveSignal] = useState(0);
  const [welcomeOpen, setWelcomeOpen] = useState(false);
  const [protocolValidationIssues, setProtocolValidationIssues] = useState(() => getValidationIssues());
  const [autosaveStatus, setAutosaveStatus] = useState<AutosaveStatus>('idle');
  const [autosaveError, setAutosaveError] = useState<string | null>(null);
  const [lastSaved, setLastSaved] = useState<Date | null>(() => {
    const importPersisted = getLastPersistedAt();
    const documentPersisted = getProtocolDocumentLastPersistedAt();
    const persisted = importPersisted ?? documentPersisted;
    return persisted ? new Date(persisted) : null;
  });
  const [showDependencyGraph, setShowDependencyGraph] = useState(false);
  const [selectedDependencyNode, setSelectedDependencyNode] = useState<DependencyNode | null>(null);
  const [dependencyGraphRevision, setDependencyGraphRevision] = useState(0);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [settingsView, setSettingsView] = useState<SettingsView>('ich-m11');
  const [protocolSections, setProtocolSections] = useState(initialProtocolSections);
  const [templateReferenceEnabled, setTemplateReferenceEnabled] = useState(() => {
    return localStorage.getItem('m11-template-reference-enabled') === 'true';
  });
  const [studyModelEnabled, setStudyModelEnabled] = useState(() => {
    return localStorage.getItem('m11-study-model-enabled') === 'true';
  });
  const [importDialogOpen, setImportDialogOpen] = useState(false);
  const [newProjectDialogOpen, setNewProjectDialogOpen] = useState(false);
  const [importReviewOpen, setImportReviewOpen] = useState(false);
  const [importCompleteBanner, setImportCompleteBanner] = useState<string | null>(null);
  const [studyModelUpdatedBanner, setStudyModelUpdatedBanner] = useState<string | null>(null);
  const { state: importState, storageWarnings } = useProtocolImport();
  const buildState = useProtocolBuildConsole();
  const buildActive = buildState.status === 'running' || buildState.status === 'paused';
  const sectionImportDraft = useSectionImportDraft(selectedSectionId);
  const selectedSectionGenerationState = selectedSectionId
    ? resolveSectionGenerationState(
        selectedSectionId,
        buildState.sectionStates,
        importState.sectionDrafts[selectedSectionId],
        buildActive || buildState.status === 'complete',
      )
    : undefined;

  console.log('M11 Studio loaded');

  // Set dark mode by default and check for first visit
  useEffect(() => {
    const root = window.document.documentElement;
    const storedTheme = localStorage.getItem('theme');
    if (!storedTheme) {
      root.classList.add('dark');
      localStorage.setItem('theme', 'dark');
    }

    // Show welcome dialog on first visit
    const hasVisited = localStorage.getItem('m11-studio-visited');
    if (!hasVisited) {
      setWelcomeOpen(true);
      localStorage.setItem('m11-studio-visited', 'true');
    }
  }, []);

  useEffect(() => {
    return subscribeStudyModelUpdated((message) => {
      setStudyModelUpdatedBanner(message);
    });
  }, []);

  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      const action = resolveProtocolIdeShortcut(e);
      if (!action) {
        return;
      }
      e.preventDefault();
      switch (action) {
        case 'toggle-protocol-search':
          setCommandOpen((open) => !open);
          break;
        case 'open-find':
          setFindReplaceMode('find');
          setCommandOpen(true);
          break;
        case 'open-replace':
          setFindReplaceMode('replace');
          setFindReplaceOpen(true);
          break;
        case 'force-save':
          setForceSaveSignal((value) => value + 1);
          break;
        default:
          break;
      }
    };

    document.addEventListener('keydown', down);
    return () => document.removeEventListener('keydown', down);
  }, []);

  useEffect(() => {
    return subscribe(() => {
      setProtocolSections(getProtocolSections());
      setFields(getFieldDefinitions());
      setProtocolValidationIssues(getValidationIssues());
      setDependencyGraphRevision((revision) => revision + 1);
      setSelectedDependencyNode((current) => {
        if (!current) {
          return null;
        }

        return getDependencyNodes().find((node) => node.id === current.id) ?? current;
      });
    });
  }, []);

  useEffect(() => {
    let savingTimer: ReturnType<typeof setTimeout> | undefined;
    const handlePersist = (timestamp: string) => {
      setAutosaveError(null);
      setAutosaveStatus('saving');
      if (savingTimer) {
        clearTimeout(savingTimer);
      }
      savingTimer = setTimeout(() => {
        setLastSaved(new Date(timestamp));
        setAutosaveStatus('saved');
      }, 250);
    };
    const unsubscribeImport = subscribeProtocolImportPersist(handlePersist);
    const unsubscribeDocument = subscribeProtocolDocumentPersist(handlePersist);
    return () => {
      if (savingTimer) {
        clearTimeout(savingTimer);
      }
      unsubscribeImport();
      unsubscribeDocument();
    };
  }, []);

  const findSection = (sections: ProtocolSection[], id: string): ProtocolSection | null => {
    for (const section of sections) {
      if (section.id === id) return section;
      if (section.children) {
        const found = findSection(section.children, id);
        if (found) return found;
      }
    }
    return null;
  };

  const selectedSection = selectedSectionId ? findSection(protocolSections, selectedSectionId) : null;
  const isScheduleOfActivities = selectedSection?.viewKind === 'schedule-of-activities';
  const sectionFields = fields.filter((f) => f.sectionId === selectedSectionId);
  const titlePageFields = fields.filter((field) => field.sectionId === 'title');
  const selectedField = selectedFieldId ? fields.find((f) => f.id === selectedFieldId) || null : null;
  const selectedStructuralMapping =
    selectedSectionId && importState.structuralMappings
      ? importState.structuralMappings.find((mapping) => mapping.mappedM11SectionId === selectedSectionId) ?? null
      : null;
  const selectedSectionImportDiagnostics =
    selectedSectionId && importState.sectionImportDiagnostics
      ? importState.sectionImportDiagnostics[selectedSectionId] ?? null
      : null;
  const canonicalDocument = importState.importedSourceSummary?.uploadId
    ? getCanonicalDocumentByUploadId(importState.importedSourceSummary.uploadId)
    : null;
  const selectedCanonicalSourceSection =
    canonicalDocument && selectedSectionImportDiagnostics?.canonicalSectionId
      ? canonicalDocument.sections.find(
          (section) => section.id === selectedSectionImportDiagnostics.canonicalSectionId,
        ) ?? null
      : canonicalDocument && selectedSectionImportDiagnostics?.sourceHeadingMatch
        ? canonicalDocument.sections.find(
            (section) =>
              section.title.trim().toLowerCase() ===
              selectedSectionImportDiagnostics.sourceHeadingMatch!.trim().toLowerCase(),
          ) ?? null
        : null;
  const hasImportDrafts = Object.keys(importState.sectionDrafts).length > 0;
  const importValidationFindings = collectImportValidationFindings(importState.sectionDrafts);
  const headerValidationFindings: HeaderValidationFinding[] = hasImportDrafts
    ? importValidationFindings.map((finding, index) => ({
        id: `${finding.sectionId}-${finding.code ?? index}`,
        sectionId: finding.sectionId,
        severity: finding.severity,
        message: finding.message,
        name: finding.code,
      }))
    : isBlankProjectMode()
      ? []
      : protocolValidationIssues.map((issue) => ({
          id: issue.id,
          sectionId: issue.sectionId,
          severity: issue.severity,
          message: issue.message,
          name: issue.name,
        }));
  const errorCount = headerValidationFindings.filter((finding) => finding.severity === 'error').length;
  const warningCount = headerValidationFindings.filter((finding) => finding.severity === 'warning').length;
  const autosaveLabel =
    autosaveStatus === 'saving'
      ? 'Saving…'
      : autosaveStatus === 'error'
        ? autosaveError ?? 'Save failed'
        : lastSaved
          ? `Autosaved ${lastSaved.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}`
          : autosaveStatus === 'saved'
            ? 'Autosaved'
            : '';

  const handleFieldChange = (fieldId: string, value: unknown) => {
    updateElementValue(fieldId, value);
  };

  const handleFieldFocus = (fieldId: string) => {
    setSelectedFieldId(fieldId);
  };

  const handleFieldBlur = () => {
    // Keep last focused field selected so metadata remains visible after blur.
  };

  const handleSectionSelect = (sectionId: string) => {
    setSelectedSectionId(sectionId);
    setSelectedFieldId(null);
  };

  const handleTemplateReferenceChange = (enabled: boolean) => {
    setTemplateReferenceEnabled(enabled);
    localStorage.setItem('m11-template-reference-enabled', enabled ? 'true' : 'false');
  };

  const handleStudyModelChange = (enabled: boolean) => {
    setStudyModelEnabled(enabled);
    localStorage.setItem('m11-study-model-enabled', enabled ? 'true' : 'false');
  };

  const handleSoACellClick = (visitId: string, assessmentId: string) => {
    console.log('SoA cell clicked:', visitId, assessmentId);
    // In a real app, this would open the detail inspector with cell metadata
  };

  const completedSections = countAuthoringCompletedSections(protocolSections, importState.sectionDrafts);
  const totalSections = countAuthoringTotalSections(protocolSections);
  const totalValidationIssues = headerValidationFindings.length;
  const protocolDisplayIdentity = resolveProtocolDisplayIdentity({
    importedSourceSummary: importState.importedSourceSummary,
    fallbackProtocolId: importState.protocolId,
  });

  return (
    <SoAAssessmentAuthoringProvider>
    <div className="h-screen w-screen flex flex-col bg-background overflow-hidden" key="app-root">
      {/* Top Toolbar */}
      <div className="h-12 border-b border-border bg-card flex items-center px-4 gap-3 shrink-0">
        <div className="flex items-center gap-2">
          <img
            src={akyrianLogo}
            alt="Akyrian"
            className="h-7 w-auto shrink-0"
            data-testid="app-akyrian-logo"
          />
          <h1 className="font-semibold">M11 Studio</h1>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="sm" className="h-8 text-xs" data-testid="app-file-menu">
                File
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start">
              <DropdownMenuItem
                data-testid="app-new-project-menu-item"
                onSelect={() => setNewProjectDialogOpen(true)}
              >
                New Project
              </DropdownMenuItem>
              <DropdownMenuItem
                data-testid="app-import-protocol-menu-item"
                onSelect={() => setImportDialogOpen(true)}
              >
                Import Protocol
              </DropdownMenuItem>
              <DropdownMenuItem
                data-testid="app-export-menu-item"
                onSelect={() => downloadProtocolJson()}
              >
                Export
              </DropdownMenuItem>
              <DropdownMenuItem
                data-testid="app-settings-menu-item"
                onSelect={() => setSettingsOpen(true)}
              >
                Settings
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        <div className="flex-1" />

        <Button
          variant="ghost"
          size="sm"
          onClick={() => setCommandOpen(true)}
          className="h-8 text-xs text-muted-foreground"
        >
          <Search className="h-3.5 w-3.5 mr-1.5" />
          Protocol Search <kbd className="ml-2 pointer-events-none inline-flex h-5 select-none items-center gap-1 rounded border bg-muted px-1.5 font-mono text-[10px] font-medium opacity-100">⌘K</kbd>
        </Button>

        <div className="flex items-center gap-2">
          {totalValidationIssues > 0 ? (
            <Popover>
              <PopoverTrigger asChild>
                <button
                  type="button"
                  className="inline-flex items-center rounded-md border border-transparent bg-destructive px-2 py-0.5 text-xs font-semibold text-destructive-foreground hover:bg-destructive/90"
                  data-testid="header-validation-summary"
                >
                  <AlertCircle className="h-3 w-3 mr-1" />
                  {errorCount} errors, {warningCount} warnings
                </button>
              </PopoverTrigger>
              <PopoverContent align="end" className="w-80 p-0">
                <div className="px-3 py-2 border-b border-border">
                  <p className="text-sm font-medium">Validation issues</p>
                  <p className="text-xs text-muted-foreground">
                    {hasImportDrafts ? 'From import validation findings' : 'From protocol validation'}
                  </p>
                </div>
                <ScrollArea className="max-h-64">
                  <div className="p-2 space-y-2">
                    {headerValidationFindings.map((finding) => (
                      <button
                        key={finding.id}
                        type="button"
                        className="w-full text-left p-2 rounded-md border border-border hover:bg-muted/50"
                        onClick={() => handleSectionSelect(finding.sectionId)}
                      >
                        <div className="flex items-start gap-2">
                          {finding.severity === 'error' ? (
                            <AlertCircle className="h-3.5 w-3.5 mt-0.5 text-red-500" />
                          ) : finding.severity === 'warning' ? (
                            <AlertTriangle className="h-3.5 w-3.5 mt-0.5 text-amber-500" />
                          ) : (
                            <CheckCircle2 className="h-3.5 w-3.5 mt-0.5 text-muted-foreground" />
                          )}
                          <div className="min-w-0">
                            <p className="text-xs font-medium truncate">
                              {finding.name ?? finding.sectionId}
                            </p>
                            <p className="text-xs text-muted-foreground">{finding.message}</p>
                          </div>
                        </div>
                      </button>
                    ))}
                  </div>
                </ScrollArea>
              </PopoverContent>
            </Popover>
          ) : (
            <Badge variant="outline" className="h-6 text-xs text-green-600 dark:text-green-400 border-green-500/30" data-testid="header-validation-summary">
              <CheckCircle2 className="h-3 w-3 mr-1" />
              No issues
            </Badge>
          )}

          <Button variant="ghost" size="sm" className="h-8 text-xs">
            <Users className="h-3.5 w-3.5 mr-1.5" />
            Collaborators
          </Button>

          <Button
            variant={showDependencyGraph ? "default" : "ghost"}
            size="sm"
            className="h-8 text-xs"
            onClick={() => setShowDependencyGraph(!showDependencyGraph)}
          >
            <Network className="h-3.5 w-3.5 mr-1.5" />
            Dependency Graph
          </Button>

          {importState.lastImportCompletedAt ? (
            <Button
              variant="outline"
              size="sm"
              className="h-8 text-xs"
              data-testid="app-review-import-button"
              onClick={() => setImportReviewOpen(true)}
            >
              Review Import
            </Button>
          ) : null}

          <Button variant="outline" size="sm" className="h-8 text-xs" onClick={downloadProtocolJson}>
            <Download className="h-3.5 w-3.5 mr-1.5" />
            Export
          </Button>

          <div
            className="inline-flex items-center h-8 px-2 text-xs text-muted-foreground"
            data-testid="header-autosave-status"
            data-autosave-state={autosaveStatus}
          >
            {autosaveStatus === 'saving' ? (
              <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />
            ) : (
              <Clock className="h-3.5 w-3.5 mr-1.5" />
            )}
            {autosaveLabel}
          </div>

          <ThemeToggle />

          <Button
            variant={settingsOpen ? 'secondary' : 'ghost'}
            size="sm"
            className="h-8 w-8 px-0"
            aria-label="Settings"
            title="Settings"
            data-testid="app-settings-button"
            onClick={() => setSettingsOpen(true)}
          >
            <Settings className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {!importReviewOpen && storageWarnings.length > 0 ? (
        <div className="px-4 py-2 border-b border-border shrink-0">
          <ImportStorageRecoveryBanner warnings={storageWarnings} />
        </div>
      ) : null}

      {studyModelUpdatedBanner ? (
        <div className="px-4 py-2 border-b border-border shrink-0 bg-cyan-500/10" data-testid="study-model-updated-banner">
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-start gap-2 text-sm">
              <CheckCircle2 className="h-4 w-4 text-cyan-600 mt-0.5 shrink-0" />
              <p>{studyModelUpdatedBanner}</p>
            </div>
            <Button variant="ghost" size="sm" className="h-7 text-xs shrink-0" onClick={() => setStudyModelUpdatedBanner(null)}>
              Dismiss
            </Button>
          </div>
        </div>
      ) : null}

      {importCompleteBanner ? (
        <div className="px-4 py-2 border-b border-border shrink-0 bg-green-500/10" data-testid="import-reconstruction-banner">
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-start gap-2 text-sm">
              <CheckCircle2 className="h-4 w-4 text-green-600 mt-0.5 shrink-0" />
              <p>{importCompleteBanner}</p>
            </div>
            <Button variant="ghost" size="sm" className="h-7 text-xs shrink-0" onClick={() => setImportCompleteBanner(null)}>
              Dismiss
            </Button>
          </div>
        </div>
      ) : null}

      {/* Main IDE Layout */}
      <div className="flex flex-1 min-h-0 overflow-hidden">
        {importReviewOpen ? (
          <ProtocolImportReviewWorkspace
            templateReferenceEnabled={templateReferenceEnabled}
            onBack={() => setImportReviewOpen(false)}
          />
        ) : settingsOpen ? (
          <SettingsWorkspace
            activeView={settingsView}
            onViewChange={setSettingsView}
            onClose={() => setSettingsOpen(false)}
          />
        ) : showDependencyGraph ? (
          <ResizablePanelGroup direction="horizontal" className="h-full min-h-0">
            {/* Dependency Graph */}
            <ResizablePanel id="dependency-graph-main" order={1} defaultSize={70} minSize={50}>
              <div className="h-full min-h-0 overflow-hidden">
                <DependencyGraphContainer
                  graphRevision={dependencyGraphRevision}
                  onNodeDoubleClick={(nodeId, sectionId) => {
                    if (sectionId) {
                      setShowDependencyGraph(false);
                      setSelectedSectionId(sectionId);
                    }
                  }}
                  onNodeSelect={setSelectedDependencyNode}
                />
              </div>
            </ResizablePanel>

            <ResizableHandle />

            {/* Right: Dependency Inspector + AI Copilot */}
            <ResizablePanel id="dependency-graph-sidebar" order={2} defaultSize={30} minSize={25} maxSize={40}>
              <ResizablePanelGroup direction="vertical" className="h-full min-h-0">
                <ResizablePanel id="dependency-inspector" order={1} defaultSize={60} minSize={40}>
                  <div className="h-full min-h-0 overflow-hidden">
                    <DependencyInspector selectedNode={selectedDependencyNode} />
                  </div>
                </ResizablePanel>

                <ResizableHandle />

                <ResizablePanel id="dependency-copilot" order={2} defaultSize={40} minSize={30}>
                  <div className="h-full min-h-0 overflow-hidden">
                    <ProtocolCopilot />
                  </div>
                </ResizablePanel>
              </ResizablePanelGroup>
            </ResizablePanel>
          </ResizablePanelGroup>
        ) : (
          <ResizablePanelGroup direction="horizontal" className="h-full min-h-0">
            {/* Left: Protocol Explorer */}
            <ResizablePanel id="protocol-explorer" order={1} defaultSize={20} minSize={15} maxSize={30}>
              <div className="h-full min-h-0 overflow-hidden">
                <ProtocolExplorer
                sections={protocolSections}
                selectedSectionId={selectedSectionId}
                onSelectSection={handleSectionSelect}
                protocolDisplayIdentity={protocolDisplayIdentity}
                templateReferenceEnabled={templateReferenceEnabled}
                onTemplateReferenceChange={handleTemplateReferenceChange}
                studyModelEnabled={studyModelEnabled}
                onStudyModelChange={handleStudyModelChange}
                sectionImportDrafts={importState.sectionDrafts}
                sectionGenerationStates={buildState.sectionStates}
                buildActive={buildActive || buildState.status === 'complete'}
                visualizationPhase={buildState.visualizationPhase}
                generationProgress={buildState.generationProgress}
              />
              </div>
            </ResizablePanel>

            <ResizableHandle />

            {/* Center: Document Viewport */}
            <ResizablePanel id="document-viewport" order={2} defaultSize={50} minSize={30}>
              <div className="h-full min-h-0 overflow-hidden">
              <SectionAuthoringCanvas
                templateReferenceOpen={templateReferenceEnabled}
                studyModelOpen={studyModelEnabled}
                sectionId={selectedSectionId}
                sectionTitle={selectedSection?.title ?? null}
              >
                {isScheduleOfActivities ? (
                  <ScheduleOfActivities onCellClick={handleSoACellClick} />
                ) : (
                  <DocumentViewport
                    section={selectedSection}
                    fields={sectionFields}
                    onFieldChange={handleFieldChange}
                    onFieldFocus={handleFieldFocus}
                    onFieldBlur={handleFieldBlur}
                    importDraft={sectionImportDraft}
                    sectionGenerationState={selectedSectionGenerationState}
                    buildActive={buildActive || buildState.status === 'complete'}
                    autosaveStatus={autosaveStatus}
                    lastSaved={lastSaved}
                    validationIssues={protocolValidationIssues}
                    allSections={protocolSections}
                    highlightQuery={highlightQuery}
                    forceSaveSignal={forceSaveSignal}
                    onFind={() => {
                      setFindReplaceMode('find');
                      setCommandOpen(true);
                    }}
                    onReplace={() => {
                      setFindReplaceMode('replace');
                      setFindReplaceOpen(true);
                    }}
                    onApplyManualSectionSave={(text) => {
                      if (selectedSectionId && selectedSection) {
                        applyManualSectionContentEdit(
                          selectedSectionId,
                          selectedSection.title,
                          text,
                          sectionImportDraft
                            ? resolveSectionEditorContent(sectionImportDraft)
                            : undefined,
                        );
                      }
                    }}
                  />
                )}
              </SectionAuthoringCanvas>
              </div>
            </ResizablePanel>

            <ResizableHandle />

            {/* Right: Minimap + Detail Inspector + AI Copilot */}
            <ResizablePanel id="right-sidebar" order={3} defaultSize={30} minSize={25} maxSize={40}>
              <div className="flex h-full min-h-0 overflow-hidden">
                <div className="flex-1 min-h-0 overflow-hidden">
                  <ResizablePanelGroup direction="vertical" className="h-full min-h-0">
                        {/* Detail Inspector */}
                        <ResizablePanel id="detail-inspector" order={1} defaultSize={50} minSize={30}>
                          <div className="h-full min-h-0 overflow-hidden">
                          <DetailInspector
                            selectedField={selectedField}
                            selectedSectionId={selectedSectionId}
                            selectedSectionTitle={selectedSection?.title}
                            titlePageFields={titlePageFields}
                            sectionDraft={sectionImportDraft}
                            sectionGenerationState={selectedSectionGenerationState}
                            structuralMapping={selectedStructuralMapping}
                            sectionImportDiagnostics={selectedSectionImportDiagnostics}
                            canonicalDocument={canonicalDocument}
                            canonicalSourceSection={selectedCanonicalSourceSection}
                            validationIssues={protocolValidationIssues}
                            auditEvents={auditEvents}
                            comments={comments}
                            isScheduleOfActivitiesView={isScheduleOfActivities}
                            allSections={protocolSections}
                          />
                          </div>
                        </ResizablePanel>

                        <ResizableHandle />

                        {/* AI Copilot */}
                        <ResizablePanel id="protocol-copilot" order={2} defaultSize={50} minSize={30}>
                          <div className="h-full min-h-0 overflow-hidden">
                          <ProtocolCopilot />
                          </div>
                        </ResizablePanel>
                      </ResizablePanelGroup>
                </div>

                    {/* Minimap */}
                    <DocumentMinimap
                      sections={protocolSections}
                      selectedSectionId={selectedSectionId}
                      onSelectSection={handleSectionSelect}
                      sectionImportDrafts={importState.sectionDrafts}
                      sectionGenerationStates={buildState.sectionStates}
                      sectionSkipReasons={buildState.sectionSkipReasons}
                      sectionImportDiagnostics={importState.sectionImportDiagnostics}
                      buildActive={buildActive || buildState.status === 'complete'}
                      visualizationPhase={buildState.visualizationPhase}
                      generationProgress={buildState.generationProgress}
                    />
              </div>
            </ResizablePanel>
          </ResizablePanelGroup>
        )}
      </div>

      <ProtocolSearchDialog
        open={commandOpen}
        onOpenChange={setCommandOpen}
        sections={protocolSections}
        sectionDrafts={importState.sectionDrafts}
        fields={fields}
        currentSectionId={selectedSectionId}
        onNavigateToMatch={(match: ProtocolSearchMatch, query: string) => {
          setSelectedSectionId(match.sectionId);
          setSelectedFieldId(null);
          setHighlightQuery(query);
        }}
      />

      <FindReplacePanel
        open={findReplaceOpen}
        onOpenChange={setFindReplaceOpen}
        sections={protocolSections}
        sectionDrafts={importState.sectionDrafts}
        currentSectionId={selectedSectionId}
        initialMode={findReplaceMode}
      />

      <ImportProtocolDialog
        open={importDialogOpen}
        onOpenChange={setImportDialogOpen}
        onImportComplete={({ sectionCount, failedSectionIds, partialGenerationFailure }) => {
          setTemplateReferenceEnabled(true);
          handleTemplateReferenceChange(true);
          setImportCompleteBanner(
            partialGenerationFailure
              ? `Protocol reconstruction finished with ${sectionCount - failedSectionIds.length}/${sectionCount} sections generated. Review completed sections now — retry failed sections from Protocol Reconstruction Progress.`
              : `Protocol reconstruction complete — ${sectionCount} M11 section proposals are ready for review while you continue working in the workspace.`,
          );
        }}
      />

      <NewProjectDialog
        open={newProjectDialogOpen}
        onOpenChange={setNewProjectDialogOpen}
        onProjectReset={() => {
          setImportReviewOpen(false);
          setImportCompleteBanner(null);
          setProtocolSections(getProtocolSections());
          setFields(getFieldDefinitions());
          setSelectedSectionId('1');
        }}
      />

      {/* Welcome Dialog */}
      <WelcomeDialog open={welcomeOpen} onOpenChange={setWelcomeOpen} />

      {/* Build Console + Status Bar */}
      <ProtocolBuildConsole
        showReviewWorkspace={Boolean(importState.lastImportCompletedAt)}
        onOpenReviewWorkspace={() => setImportReviewOpen(true)}
      />
      <StatusBar
        protocolId={protocolDisplayIdentity}
        autosaveStatus={autosaveStatus}
        lastSaved={lastSaved}
        autosaveError={autosaveError}
        totalSections={totalSections}
        completedSections={completedSections}
      />
    </div>
    </SoAAssessmentAuthoringProvider>
  );
}