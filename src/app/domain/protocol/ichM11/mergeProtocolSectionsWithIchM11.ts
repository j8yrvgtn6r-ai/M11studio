import type { DocumentStatus, ProtocolDocument, SectionNode, SectionViewKind } from '../types';

import { ICH_M11_TEMPLATE_SECTION_SPECS, type IchM11SectionSpec } from './ichM11Template';



function flattenExistingSections(sections: SectionNode[], map = new Map<string, SectionNode>()): Map<string, SectionNode> {

  for (const section of sections) {

    map.set(section.id, section);

    if (section.children?.length) {

      flattenExistingSections(section.children, map);

    }

  }

  return map;

}



function sectionHasAuthoredElements(sectionId: string, document: ProtocolDocument): boolean {

  return document.elements.some((element) => element.sectionId === sectionId);

}



function isLegacyStatisticalSection(section: SectionNode): boolean {

  return /statistical/i.test(section.title);

}



function resolveExistingSection(

  spec: IchM11SectionSpec,

  existingById: Map<string, SectionNode>,

): SectionNode | undefined {

  if (spec.id === '10') {

    const ten = existingById.get('10');

    if (ten) {

      return ten;

    }

    const misplacedNine = existingById.get('9');

    if (misplacedNine && isLegacyStatisticalSection(misplacedNine)) {

      return misplacedNine;

    }

    return undefined;

  }



  if (spec.id === '9') {

    const nine = existingById.get('9');

    if (nine && isLegacyStatisticalSection(nine)) {

      return undefined;

    }

    return nine;

  }



  return existingById.get(spec.id);

}



function isTemplateInstructionSpec(spec: IchM11SectionSpec): boolean {

  return spec.sectionType === 'template-instruction' || spec.metadata?.protocolRole === 'instruction';

}



function mergeNode(

  spec: IchM11SectionSpec,

  existingById: Map<string, SectionNode>,

  document: ProtocolDocument,

  children: SectionNode[],

  specById: Map<string, IchM11SectionSpec>,

): SectionNode {

  const existing = resolveExistingSection(spec, existingById);

  const hasElements = sectionHasAuthoredElements(spec.id, document);

  const viewKind = (spec.metadata?.viewKind as SectionViewKind | undefined) ?? existing?.viewKind;

  const instruction = isTemplateInstructionSpec(spec);



  let status: DocumentStatus = 'requiredMissing';

  if (existing?.status) {

    status = existing.status;

  } else if (hasElements) {

    status = 'inProgress';

  } else if (spec.conformance === 'optional') {

    status = 'conditionalMissing';

  }



  const ichM11TemplateOnly = instruction

    ? false

    : (existing?.ichM11TemplateOnly ?? (!hasElements && !existing));



  const preserveExistingTitle =

    existing !== undefined &&

    (hasElements || existing.status === 'complete' || existing.hasAmendment === true);



  const node: SectionNode = {

    id: spec.id,

    title: preserveExistingTitle ? (existing?.title ?? spec.title) : spec.title,

    level: computeLevel(spec, specById),

    conformance: spec.conformance,

    status,

    ichM11TemplateOnly,

  };



  if (instruction) {

    node.ichM11InstructionOnly = true;

  }



  if (viewKind) {

    node.viewKind = viewKind;

  }



  if (existing?.hasAmendment) {

    node.hasAmendment = true;

  }



  if (existing?.validationCount !== undefined) {

    node.validationCount = existing.validationCount;

  }



  if (existing?.commentCount !== undefined) {

    node.commentCount = existing.commentCount;

  }



  if (children.length > 0) {

    node.children = children;

  }



  return node;

}



function computeLevel(spec: IchM11SectionSpec, specById: Map<string, IchM11SectionSpec>): number {

  if (spec.parentId === null) {

    if (spec.sectionType === 'template-instruction' || spec.sectionType === 'front-matter') {

      return 0;

    }

    return 1;

  }

  const parent = specById.get(spec.parentId);

  if (!parent) {

    return 1;

  }

  return computeLevel(parent, specById) + 1;

}



function buildTree(

  parentId: string | null,

  existingById: Map<string, SectionNode>,

  document: ProtocolDocument,

  specById: Map<string, IchM11SectionSpec>,

): SectionNode[] {

  const specs = ICH_M11_TEMPLATE_SECTION_SPECS.filter((spec) => spec.parentId === parentId).sort(

    (left, right) => left.order - right.order,

  );



  return specs.map((spec) => {

    const children = buildTree(spec.id, existingById, document, specById);

    return mergeNode(spec, existingById, document, children, specById);

  });

}



/** Rebuilds protocol section tree from ICH M11 Template TOC, overlaying existing seed metadata. */

export function mergeProtocolSectionsWithIchM11(

  existingSections: SectionNode[],

  document: ProtocolDocument,

): SectionNode[] {

  const existingById = flattenExistingSections(existingSections);

  const specById = new Map(ICH_M11_TEMPLATE_SECTION_SPECS.map((spec) => [spec.id, spec]));

  return buildTree(null, existingById, document, specById);

}



/** Section ids present in the original abbreviated PROTO-XYZ-301 explorer (pre-template rebuild). */

export const LEGACY_PROTOCOL_SECTION_IDS = [

  'title',

  'amendment',

  '1',

  '1.1',

  '1.1.1',

  '1.1.2',

  '1.2',

  '1.3',

  '2',

  '2.1',

  '2.2',

  '3',

  '3.1',

  '3.2',

  '4',

  '5',

  '8',

  '10',

] as const;

