import type { ReactNode } from 'react';
import { ResizableHandle, ResizablePanel, ResizablePanelGroup } from '../ui/resizable';
import { M11TemplateReferencePanel } from './M11TemplateReferencePanel';
import { StudyModelPanel } from '../study-model/StudyModelPanel';

interface SectionAuthoringCanvasProps {
  templateReferenceOpen: boolean;
  studyModelOpen: boolean;
  sectionId: string | null;
  sectionTitle?: string | null;
  children: ReactNode;
}

/**
 * Main authoring canvas: protocol content plus optional Template Reference and Study Model drawers.
 */
export function SectionAuthoringCanvas({
  templateReferenceOpen,
  studyModelOpen,
  sectionId,
  sectionTitle,
  children,
}: SectionAuthoringCanvasProps) {
  const drawers: Array<'template' | 'study-model'> = [];
  if (templateReferenceOpen) drawers.push('template');
  if (studyModelOpen) drawers.push('study-model');

  if (drawers.length === 0) {
    return <div className="flex flex-col h-full min-h-0">{children}</div>;
  }

  return (
    <ResizablePanelGroup direction="horizontal" className="h-full min-h-0">
      <ResizablePanel id="protocol-authoring-main" order={1} defaultSize={drawers.length === 2 ? 50 : 62} minSize={35}>
        <div className="flex flex-col h-full min-h-0 overflow-hidden">{children}</div>
      </ResizablePanel>

      {drawers.map((drawer, index) => (
        <DrawerPanel
          key={drawer}
          drawer={drawer}
          order={index + 2}
          sectionId={sectionId}
          sectionTitle={sectionTitle}
        />
      ))}
    </ResizablePanelGroup>
  );
}

function DrawerPanel({
  drawer,
  order,
  sectionId,
  sectionTitle,
}: {
  drawer: 'template' | 'study-model';
  order: number;
  sectionId: string | null;
  sectionTitle?: string | null;
}) {
  return (
    <>
      <ResizableHandle withHandle />
      <ResizablePanel
        id={drawer === 'template' ? 'm11-template-reference-drawer' : 'study-model-drawer'}
        order={order}
        defaultSize={drawer === 'template' ? 38 : 34}
        minSize={24}
        maxSize={45}
      >
        {drawer === 'template' ? (
          <M11TemplateReferencePanel sectionId={sectionId} sectionTitle={sectionTitle} />
        ) : (
          <StudyModelPanel sectionId={sectionId} sectionTitle={sectionTitle} />
        )}
      </ResizablePanel>
    </>
  );
}
