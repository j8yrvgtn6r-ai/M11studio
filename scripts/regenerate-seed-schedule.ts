import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { ProtocolDocument } from '../src/app/domain/protocol/types';
import { regenerateScheduleCacheInDocument } from '../src/app/domain/protocol/scheduleGeneration/scheduleCache';

const __dirname = dirname(fileURLToPath(import.meta.url));
const seedPath = join(__dirname, '../src/app/domain/protocol/seed/PROTO-XYZ-301.json');

const seed = JSON.parse(readFileSync(seedPath, 'utf8')) as ProtocolDocument;
regenerateScheduleCacheInDocument(seed);

writeFileSync(seedPath, `${JSON.stringify(seed, null, 2)}\n`, 'utf8');

console.log(`Regenerated schedule cache in ${seedPath}`);
console.log(`  visits: ${seed.schedule.visits.length}`);
console.log(`  assessments: ${seed.schedule.assessments.length}`);
console.log(`  cells: ${seed.schedule.cells.length}`);
console.log(`  sourceHash: ${seed.schedule.metadata?.sourceHash}`);
