import type { ReactNode } from 'react';
import { ResizableHandle, ResizablePanel, ResizablePanelGroup } from '../ui/resizable';
import { M11TemplateReferencePanel } from './M11TemplateReferencePanel';

interface SectionAuthoringCanvasProps {
  templateReferenceOpen: boolean;
  sectionId: string | null;
  sectionTitle?: string | null;
  children: ReactNode;
}

/**
 * Main authoring canvas: protocol content plus optional M11 Template reference subdrawer.
 */
export function SectionAuthoringCanvas({
  templateReferenceOpen,
  sectionId,
  sectionTitle,
  children,
}: SectionAuthoringCanvasProps) {
  if (!templateReferenceOpen) {
    return <div className="flex flex-col h-full min-h-0">{children}</div>;
  }

  return (
    <ResizablePanelGroup direction="horizontal" className="h-full min-h-0">
      <ResizablePanel id="protocol-authoring-main" order={1} defaultSize={62} minSize={40}>
        <div className="flex flex-col h-full min-h-0 overflow-hidden">{children}</div>
      </ResizablePanel>

      <ResizableHandle withHandle />

      <ResizablePanel
        id="m11-template-reference-drawer"
        order={2}
        defaultSize={38}
        minSize={28}
        maxSize={50}
      >
        <M11TemplateReferencePanel sectionId={sectionId} sectionTitle={sectionTitle} />
      </ResizablePanel>
    </ResizablePanelGroup>
  );
}
