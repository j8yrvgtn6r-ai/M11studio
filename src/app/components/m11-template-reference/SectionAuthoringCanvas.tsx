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

function resolveDrawerSizes(drawerCount: number): { main: number; drawer: number } {
  if (drawerCount >= 2) {
    return { main: 50, drawer: 25 };
  }
  return { main: 62, drawer: 38 };
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
    return <div className="flex flex-col h-full min-h-0 overflow-hidden">{children}</div>;
  }

  const { main, drawer } = resolveDrawerSizes(drawers.length);

  return (
    <ResizablePanelGroup direction="horizontal" className="h-full min-h-0">
      <ResizablePanel id="protocol-authoring-main" order={1} defaultSize={main} minSize={35}>
        <div className="flex flex-col h-full min-h-0 overflow-hidden">{children}</div>
      </ResizablePanel>

      {drawers.map((drawerType, index) => (
        <DrawerPanel
          key={drawerType}
          drawer={drawerType}
          order={index + 2}
          defaultSize={drawer}
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
  defaultSize,
  sectionId,
  sectionTitle,
}: {
  drawer: 'template' | 'study-model';
  order: number;
  defaultSize: number;
  sectionId: string | null;
  sectionTitle?: string | null;
}) {
  return (
    <>
      <ResizableHandle withHandle />
      <ResizablePanel
        id={drawer === 'template' ? 'm11-template-reference-drawer' : 'study-model-drawer'}
        order={order}
        defaultSize={defaultSize}
        minSize={24}
        maxSize={45}
      >
        <div className="h-full min-h-0 overflow-hidden">
          {drawer === 'template' ? (
            <M11TemplateReferencePanel sectionId={sectionId} sectionTitle={sectionTitle} />
          ) : (
            <StudyModelPanel sectionId={sectionId} sectionTitle={sectionTitle} />
          )}
        </div>
      </ResizablePanel>
    </>
  );
}
