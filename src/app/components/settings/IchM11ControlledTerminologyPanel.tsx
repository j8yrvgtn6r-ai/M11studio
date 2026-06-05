import { ListTree } from 'lucide-react';

import { IchM11ControlledTerminologyViewer } from './IchM11ControlledTerminologyViewer';
import { IchM11TerminologyDocumentCard } from './IchM11TerminologyDocumentCard';

export function IchM11ControlledTerminologyPanel() {
  return (
    <div className="space-y-6 max-w-5xl" data-testid="ich-m11-controlled-terminology-panel">
      <div>
        <h2 className="text-lg font-semibold flex items-center gap-2">
          <ListTree className="h-5 w-5" />
          Controlled Terminology
        </h2>
        <p className="text-sm text-muted-foreground mt-1">
          NCI EVS ICH M11 codelists and preferred terms for harmonized vocabulary and validation scaffolding.
        </p>
      </div>

      <IchM11TerminologyDocumentCard />
      <IchM11ControlledTerminologyViewer />
    </div>
  );
}
