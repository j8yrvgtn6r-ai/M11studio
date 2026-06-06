import { ICH_M11_TEMPLATE_SECTION_SPECS } from '../ichM11/ichM11Template';

export function listM11GenerationTargetSectionIds(sectionIds?: string[]): string[] {
  const specs = ICH_M11_TEMPLATE_SECTION_SPECS.filter((spec) => {
    if (spec.sectionType === 'template-instruction') return false;
    if (spec.id === '0' || spec.id.startsWith('0.')) return false;
    return true;
  });
  if (!sectionIds) {
    return specs.map((spec) => spec.id);
  }
  const filter = new Set(sectionIds);
  return specs.filter((spec) => filter.has(spec.id)).map((spec) => spec.id);
}

export function flattenProtocolSectionIds(
  sections: Array<{ id: string; children?: Array<{ id: string; children?: unknown[] }> }>,
): string[] {
  const result: string[] = [];
  for (const section of sections) {
    result.push(section.id);
    if (section.children) {
      result.push(...flattenProtocolSectionIds(section.children as typeof sections));
    }
  }
  return result;
}
