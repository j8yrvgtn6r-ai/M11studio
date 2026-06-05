import { BookOpen } from 'lucide-react';

import { countIchM11TechnicalSpecSections, countIchM11TemplateSections } from '../../domain/protocol/ichM11';
import { IchM11DocumentCard } from './IchM11DocumentCard';

export function IchM11SettingsPanel() {
  const templateSectionCount = countIchM11TemplateSections();
  const technicalSpecSectionCount = countIchM11TechnicalSpecSections();

  return (
    <div className="space-y-4 max-w-4xl" data-testid="ich-m11-settings-panel">
      <div>
        <h2 className="text-lg font-semibold flex items-center gap-2">
          <BookOpen className="h-5 w-5" />
          ICH M11
        </h2>
        <p className="text-sm text-muted-foreground mt-1">
          Authoritative M11 source documents loaded locally. Use Controlled Terminology for NCI EVS
          codelists and vocabulary.
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <IchM11DocumentCard kind="technical-specification" sectionCount={technicalSpecSectionCount} />
        <IchM11DocumentCard kind="template" sectionCount={templateSectionCount} />
      </div>
    </div>
  );
}
