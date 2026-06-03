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
import { WelcomeDialog } from './components/WelcomeDialog';
import { StatusBar } from './components/StatusBar';
import { Button } from './components/ui/button';
import { Badge } from './components/ui/badge';
import {
  Command,
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from './components/ui/command';
import {
  FileText,
  Search,
  Settings,
  Save,
  Download,
  Users,
  Workflow,
  AlertCircle,
  CheckCircle2,
  Network,
} from 'lucide-react';
import {
  getAssessments,
  getAuditEvents,
  getComments,
  getDependencyNodes,
  getFieldDefinitions,
  getProtocolSections,
  getSoACells,
  getValidationIssues,
  getVisits,
  subscribe,
  updateElementValue,
  downloadProtocolJson,
} from './domain/protocol';
import type { ProtocolSection, FieldDefinition } from './types/protocol';
import type { DependencyNode } from './types/dependencyGraph';

const protocolSections = getProtocolSections();
const validationIssues = getValidationIssues();
const auditEvents = getAuditEvents();
const comments = getComments();
const visits = getVisits();
const assessments = getAssessments();
const soaCells = getSoACells();

export default function App() {
  const [selectedSectionId, setSelectedSectionId] = useState<string | null>('1');
  const [selectedFieldId, setSelectedFieldId] = useState<string | null>(null);
  const [fields, setFields] = useState(() => getFieldDefinitions());
  const [commandOpen, setCommandOpen] = useState(false);
  const [welcomeOpen, setWelcomeOpen] = useState(false);
  const [lastSaved, setLastSaved] = useState(new Date());
  const [showDependencyGraph, setShowDependencyGraph] = useState(false);
  const [selectedDependencyNode, setSelectedDependencyNode] = useState<DependencyNode | null>(null);
  const [dependencyGraphRevision, setDependencyGraphRevision] = useState(0);

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
    const down = (e: KeyboardEvent) => {
      if (e.key === 'k' && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setCommandOpen((open) => !open);
      }
    };

    document.addEventListener('keydown', down);
    return () => document.removeEventListener('keydown', down);
  }, []);

  useEffect(() => {
    return subscribe(() => {
      setFields(getFieldDefinitions());
      setDependencyGraphRevision((revision) => revision + 1);
      setSelectedDependencyNode((current) => {
        if (!current) {
          return null;
        }

        return getDependencyNodes().find((node) => node.id === current.id) ?? current;
      });
    });
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
  const selectedField = selectedFieldId ? fields.find((f) => f.id === selectedFieldId) || null : null;

  const handleFieldChange = (fieldId: string, value: any) => {
    updateElementValue(fieldId, value);
  };

  const handleSectionSelect = (sectionId: string) => {
    setSelectedSectionId(sectionId);
    setSelectedFieldId(null);
  };

  const handleSoACellClick = (visitId: string, assessmentId: string) => {
    console.log('SoA cell clicked:', visitId, assessmentId);
    // In a real app, this would open the detail inspector with cell metadata
  };

  const countCompletedSections = (sections: ProtocolSection[]): number => {
    let count = 0;
    sections.forEach((section) => {
      if (section.status === 'complete') count++;
      if (section.children) count += countCompletedSections(section.children);
    });
    return count;
  };

  const countTotalSections = (sections: ProtocolSection[]): number => {
    let count = sections.length;
    sections.forEach((section) => {
      if (section.children) count += countTotalSections(section.children);
    });
    return count;
  };

  const totalValidationIssues = validationIssues.length;
  const errorCount = validationIssues.filter((i) => i.severity === 'error').length;
  const warningCount = validationIssues.filter((i) => i.severity === 'warning').length;

  return (
    <div className="h-screen w-screen flex flex-col bg-background" key="app-root">
      {/* Top Toolbar */}
      <div className="h-12 border-b border-border bg-card flex items-center px-4 gap-3 shrink-0">
        <div className="flex items-center gap-2">
          <FileText className="h-5 w-5 text-primary" />
          <h1 className="font-semibold">M11 Studio</h1>
        </div>

        <div className="flex-1" />

        <Button
          variant="ghost"
          size="sm"
          onClick={() => setCommandOpen(true)}
          className="h-8 text-xs text-muted-foreground"
        >
          <Search className="h-3.5 w-3.5 mr-1.5" />
          Quick actions... <kbd className="ml-2 pointer-events-none inline-flex h-5 select-none items-center gap-1 rounded border bg-muted px-1.5 font-mono text-[10px] font-medium opacity-100">⌘K</kbd>
        </Button>

        <div className="flex items-center gap-2">
          {totalValidationIssues > 0 ? (
            <Badge variant="destructive" className="h-6 text-xs">
              <AlertCircle className="h-3 w-3 mr-1" />
              {errorCount} errors, {warningCount} warnings
            </Badge>
          ) : (
            <Badge variant="outline" className="h-6 text-xs text-green-600 dark:text-green-400 border-green-500/30">
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

          <Button variant="outline" size="sm" className="h-8 text-xs" onClick={downloadProtocolJson}>
            <Download className="h-3.5 w-3.5 mr-1.5" />
            Export
          </Button>

          <Button variant="default" size="sm" className="h-8 text-xs">
            <Save className="h-3.5 w-3.5 mr-1.5" />
            Save
          </Button>

          <ThemeToggle />

          <Button variant="ghost" size="sm" className="h-8 w-8 px-0">
            <Settings className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Main IDE Layout */}
      <div className="flex-1 overflow-hidden">
        {showDependencyGraph ? (
          <ResizablePanelGroup direction="horizontal">
            {/* Dependency Graph */}
            <ResizablePanel id="dependency-graph-main" order={1} defaultSize={70} minSize={50}>
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
            </ResizablePanel>

            <ResizableHandle />

            {/* Right: Dependency Inspector + AI Copilot */}
            <ResizablePanel id="dependency-graph-sidebar" order={2} defaultSize={30} minSize={25} maxSize={40}>
              <ResizablePanelGroup direction="vertical">
                <ResizablePanel id="dependency-inspector" order={1} defaultSize={60} minSize={40}>
                  <DependencyInspector selectedNode={selectedDependencyNode} />
                </ResizablePanel>

                <ResizableHandle />

                <ResizablePanel id="dependency-copilot" order={2} defaultSize={40} minSize={30}>
                  <ProtocolCopilot />
                </ResizablePanel>
              </ResizablePanelGroup>
            </ResizablePanel>
          </ResizablePanelGroup>
        ) : (
          <ResizablePanelGroup direction="horizontal">
            {/* Left: Protocol Explorer */}
            <ResizablePanel id="protocol-explorer" order={1} defaultSize={20} minSize={15} maxSize={30}>
              <ProtocolExplorer
                sections={protocolSections}
                selectedSectionId={selectedSectionId}
                onSelectSection={handleSectionSelect}
              />
            </ResizablePanel>

            <ResizableHandle />

            {/* Center: Document Viewport */}
            <ResizablePanel id="document-viewport" order={2} defaultSize={50} minSize={30}>
              {isScheduleOfActivities ? (
                <ScheduleOfActivities
                  visits={visits}
                  assessments={assessments}
                  cells={soaCells}
                  onCellClick={handleSoACellClick}
                />
              ) : (
                <DocumentViewport
                  section={selectedSection}
                  fields={sectionFields}
                  onFieldChange={handleFieldChange}
                />
              )}
            </ResizablePanel>

            <ResizableHandle />

            {/* Right: Minimap + Detail Inspector + AI Copilot */}
            <ResizablePanel id="right-sidebar" order={3} defaultSize={30} minSize={25} maxSize={40}>
              <ResizablePanelGroup direction="vertical">
                {/* Top Right: Minimap */}
                <ResizablePanel id="right-sidebar-main" order={1} defaultSize={100} minSize={80}>
                  <div className="flex h-full">
                    <div className="flex-1">
                      <ResizablePanelGroup direction="vertical">
                        {/* Detail Inspector */}
                        <ResizablePanel id="detail-inspector" order={1} defaultSize={50} minSize={30}>
                          <DetailInspector
                            selectedField={selectedField}
                            selectedSectionId={selectedSectionId}
                            validationIssues={validationIssues}
                            auditEvents={auditEvents}
                            comments={comments}
                          />
                        </ResizablePanel>

                        <ResizableHandle />

                        {/* AI Copilot */}
                        <ResizablePanel id="protocol-copilot" order={2} defaultSize={50} minSize={30}>
                          <ProtocolCopilot />
                        </ResizablePanel>
                      </ResizablePanelGroup>
                    </div>

                    {/* Minimap */}
                    <DocumentMinimap
                      sections={protocolSections}
                      selectedSectionId={selectedSectionId}
                      onSelectSection={handleSectionSelect}
                    />
                  </div>
                </ResizablePanel>
              </ResizablePanelGroup>
            </ResizablePanel>
          </ResizablePanelGroup>
        )}
      </div>

      {/* Command Palette */}
      <CommandDialog open={commandOpen} onOpenChange={setCommandOpen}>
        <CommandInput placeholder="Search sections, fields, or actions..." />
        <CommandList>
          <CommandEmpty>No results found.</CommandEmpty>
          <CommandGroup heading="Sections">
            {protocolSections.slice(0, 5).map((section) => (
              <CommandItem
                key={section.id}
                onSelect={() => {
                  handleSectionSelect(section.id);
                  setCommandOpen(false);
                }}
              >
                <FileText className="mr-2 h-4 w-4" />
                {section.title}
              </CommandItem>
            ))}
          </CommandGroup>
          <CommandGroup heading="Actions">
            <CommandItem>
              <Save className="mr-2 h-4 w-4" />
              Save Protocol
            </CommandItem>
            <CommandItem
              onSelect={() => {
                downloadProtocolJson();
                setCommandOpen(false);
              }}
            >
              <Download className="mr-2 h-4 w-4" />
              Export Protocol
            </CommandItem>
            <CommandItem>
              <AlertCircle className="mr-2 h-4 w-4" />
              View All Validation Issues
            </CommandItem>
          </CommandGroup>
        </CommandList>
      </CommandDialog>

      {/* Welcome Dialog */}
      <WelcomeDialog open={welcomeOpen} onOpenChange={setWelcomeOpen} />

      {/* Status Bar */}
      <StatusBar
        protocolId="PROTO-XYZ-301"
        currentUser="Dr. Sarah Chen"
        lastSaved={lastSaved}
        totalSections={countTotalSections(protocolSections)}
        completedSections={countCompletedSections(protocolSections)}
        validationIssues={totalValidationIssues}
      />
    </div>
  );
}