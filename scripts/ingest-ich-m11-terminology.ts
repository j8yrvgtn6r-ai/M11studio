/**
 * One-time / maintenance ingest of ICH M11 Controlled Terminology from NCI EVS HTML.
 * Run: npm run ingest:ich-m11-terminology
 *
 * Writes:
 * - src/app/domain/protocol/ichM11/data/ichM11ControlledTerminology.json
 * - public/reference/ichM11ControlledTerminology.json
 */
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const SOURCE_URL = 'https://evs.nci.nih.gov/ftp1/ICH/M11/ICH%20M11%20Terminology.html';
const CACHE_HTML = join(__dirname, 'cache/ich-m11-terminology.html');
const OUT_DOMAIN = join(__dirname, '../src/app/domain/protocol/ichM11/data/ichM11ControlledTerminology.json');
const OUT_PUBLIC = join(__dirname, '../public/reference/ichM11ControlledTerminology.json');

interface M11Term {
  code: string;
  ichPreferredTerm: string;
  preferredTerm: string;
  definition: string;
}

interface M11Codelist {
  id: string;
  oid: string;
  name: string;
  preferredTerm: string;
  extensible: boolean;
  dataType: string;
  ichDefinition?: string;
  terms: M11Term[];
}

interface M11TerminologyDocument {
  source: string;
  name: string;
  terminologyDate: string;
  sourceUrl: string;
  loadedAt: string;
  ingestionMode: 'full' | 'partial';
  codelists: M11Codelist[];
}

function parseTableRow(line: string): string[] {
  return line
    .split('|')
    .map((cell) => cell.trim())
    .filter((cell) => cell.length > 0);
}

function isCodelistHeader(cells: string[]): boolean {
  return cells[0]?.startsWith('CL.C') ?? false;
}

function isTermRow(cells: string[]): boolean {
  if (cells.length < 4) {
    return false;
  }
  const codeCell = cells[1];
  return /^C\d+$/i.test(codeCell);
}

function parseCodelistHeader(cells: string[]): Omit<M11Codelist, 'terms'> {
  const oidRaw = cells[0];
  const oid = oidRaw.split('.')[0] + '.' + oidRaw.split('.')[1];
  const nciMatch = cells.find((cell) => /^C\d+$/i.test(cell));
  const id = nciMatch ?? oidRaw.replace(/^CL\./, '').split('.')[0];
  const metaCell = cells.find((cell) => /Extensible:/i.test(cell)) ?? cells[2] ?? '';
  const extensible = /Extensible:\s*Yes/i.test(metaCell);
  const dataType = metaCell.includes('text') ? 'text' : 'text';

  return {
    id: id.startsWith('C') ? id : `C${id}`,
    oid: oidRaw.startsWith('CL.') ? oidRaw : `CL.${id}`,
    name: cells[1] ?? oidRaw,
    preferredTerm: cells[cells.length - 1] ?? cells[1] ?? '',
    extensible,
    dataType,
    ichDefinition: cells.find((cell) => cell.length > 80 && !cell.startsWith('CL.')),
  };
}

function parseTermRow(cells: string[]): M11Term {
  return {
    ichPreferredTerm: cells[0],
    code: cells[1],
    definition: cells[2] ?? '',
    preferredTerm: cells[3] ?? cells[0],
  };
}

function parseTerminologyFromLines(lines: string[]): M11Codelist[] {
  const codelists: M11Codelist[] = [];
  let current: M11Codelist | null = null;

  for (const line of lines) {
    if (!line.startsWith('|')) {
      continue;
    }
    if (line.includes('Back to top')) {
      current = null;
      continue;
    }

    const cells = parseTableRow(line);
    if (cells.length === 0) {
      continue;
    }

    if (isCodelistHeader(cells)) {
      const header = parseCodelistHeader(cells);
      current = { ...header, terms: [] };
      codelists.push(current);
      continue;
    }

    if (current && isTermRow(cells)) {
      current.terms.push(parseTermRow(cells));
    }
  }

  return codelists.filter((list) => list.terms.length > 0 || list.name);
}

async function loadHtml(): Promise<string> {
  mkdirSync(dirname(CACHE_HTML), { recursive: true });
  try {
    return readFileSync(CACHE_HTML, 'utf8');
  } catch {
    const response = await fetch(SOURCE_URL);
    if (!response.ok) {
      throw new Error(`Failed to fetch terminology HTML: ${response.status}`);
    }
    const html = await response.text();
    writeFileSync(CACHE_HTML, html, 'utf8');
    return html;
  }
}

function htmlToTableLines(html: string): string[] {
  const lines: string[] = [];
  const rowRegex = /<tr[^>]*>([\s\S]*?)<\/tr>/gi;
  let match: RegExpExecArray | null;
  while ((match = rowRegex.exec(html)) !== null) {
    const rowHtml = match[1];
    const cells: string[] = [];
    const cellRegex = /<t[dh][^>]*>([\s\S]*?)<\/t[dh]>/gi;
    let cellMatch: RegExpExecArray | null;
    while ((cellMatch = cellRegex.exec(rowHtml)) !== null) {
      const text = cellMatch[1]
        .replace(/<[^>]+>/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();
      cells.push(text);
    }
    if (cells.length > 0) {
      lines.push(`| ${cells.join(' | ')} |`);
    }
  }
  return lines;
}

function extractTerminologyDate(html: string): string {
  const match = html.match(/ICH M11 Controlled Terminology,\s*(\d{4}-\d{2}-\d{2})/i);
  return match?.[1] ?? '2025-12-19';
}

async function main() {
  const html = await loadHtml();
  const lines = htmlToTableLines(html);
  const codelists = parseTerminologyFromLines(lines);

  const PRIORITY_IDS = new Set([
    'C217045',
    'C217279',
    'C217277',
    'C217283',
    'C217047',
    'C217046',
    'C217048',
    'C217342',
    'C217349',
  ]);

  const hasFullCoverage = codelists.length >= 30;
  const ingestionMode = hasFullCoverage ? 'full' : 'partial';
  const filtered =
    ingestionMode === 'partial'
      ? codelists.filter((list) => PRIORITY_IDS.has(list.id) || list.oid.includes('Section'))
      : codelists;

  const document: M11TerminologyDocument = {
    source: 'NCI EVS',
    name: 'ICH M11 Controlled Terminology',
    terminologyDate: extractTerminologyDate(html),
    sourceUrl: SOURCE_URL,
    loadedAt: new Date().toISOString(),
    ingestionMode,
    codelists: filtered,
  };

  const termCount = document.codelists.reduce((sum, list) => sum + list.terms.length, 0);

  mkdirSync(dirname(OUT_DOMAIN), { recursive: true });
  mkdirSync(dirname(OUT_PUBLIC), { recursive: true });
  const json = `${JSON.stringify(document, null, 2)}\n`;
  writeFileSync(OUT_DOMAIN, json, 'utf8');
  writeFileSync(OUT_PUBLIC, json, 'utf8');

  console.log(`Ingested ${document.codelists.length} codelists, ${termCount} terms (${ingestionMode}).`);
  console.log(`Wrote ${OUT_DOMAIN}`);
  console.log(`Wrote ${OUT_PUBLIC}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
