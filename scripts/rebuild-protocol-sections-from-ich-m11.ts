/**
 * Rewrites PROTO-XYZ-301.json sections from ICH M11 Template TOC and fixes legacy section id mappings.
 * Run: npm run rebuild:protocol-sections
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import type { ProtocolDocument } from '../src/app/domain/protocol/types';
import { countIchM11TemplateSections, mergeProtocolSectionsWithIchM11 } from '../src/app/domain/protocol/ichM11';

const __dirname = dirname(fileURLToPath(import.meta.url));
const seedPath = join(__dirname, '../src/app/domain/protocol/seed/PROTO-XYZ-301.json');

const document = JSON.parse(readFileSync(seedPath, 'utf8')) as ProtocolDocument;

document.sections = mergeProtocolSectionsWithIchM11(document.sections, document);

for (const analysis of document.clinicalDesign.statisticalAnalyses ?? []) {
  if (analysis.sectionRef === '9') {
    analysis.sectionRef = '10';
  }
}

for (const event of document.collaboration.auditEvents ?? []) {
  if (event.sectionId === '9' && /sample size|statistic/i.test(event.details ?? '')) {
    event.sectionId = '10';
  }
}

writeFileSync(seedPath, `${JSON.stringify(document, null, 2)}\n`, 'utf8');
console.log(`Rebuilt ${document.sections.length} top-level protocol sections from ICH M11 Template.`);
console.log(`Template nodes: ${countIchM11TemplateSections()}.`);
