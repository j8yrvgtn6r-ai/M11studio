import JSZip from 'jszip';
import mammoth from 'mammoth';

import { detectSourceSections } from './sourceSectionDetection';
import type {
  ExtractedHeading,
  ExtractedParagraph,
  ExtractedTable,
  ImportedProtocolSource,
} from './types';

const W_NS = 'http://schemas.openxmlformats.org/wordprocessingml/2006/main';

function elementsByLocalName(parent: Document | Element, localName: string): Element[] {
  return Array.from(parent.getElementsByTagName('*')).filter(
    (node) => node.localName === localName,
  );
}

function firstChildByLocalName(parent: Element, localName: string): Element | undefined {
  return elementsByLocalName(parent, localName)[0];
}

function textFromParagraph(paragraph: Element): string {
  const parts: string[] = [];
  for (const node of elementsByLocalName(paragraph, 't')) {
    parts.push(node.textContent ?? '');
  }
  return parts.join('').replace(/\s+/g, ' ').trim();
}

function paragraphStyleName(paragraph: Element): string | undefined {
  const pPr = firstChildByLocalName(paragraph, 'pPr');
  if (!pPr) {
    return undefined;
  }
  const pStyle = firstChildByLocalName(pPr, 'pStyle');
  const val = pStyle?.getAttributeNS(W_NS, 'val') ?? pStyle?.getAttribute('w:val') ?? pStyle?.getAttribute('val');
  return val ?? undefined;
}

function headingLevelFromStyle(styleName?: string): number | undefined {
  if (!styleName) {
    return undefined;
  }
  const match = /heading\s*(\d)/i.exec(styleName);
  if (match) {
    return Number.parseInt(match[1], 10);
  }
  if (/title/i.test(styleName)) {
    return 1;
  }
  return undefined;
}

function parseDocumentXml(xml: string): ExtractedParagraph[] {
  const doc = new DOMParser().parseFromString(xml, 'application/xml');
  const paragraphs = elementsByLocalName(doc, 'p');
  const extracted: ExtractedParagraph[] = [];
  let charCursor = 0;

  for (let index = 0; index < paragraphs.length; index += 1) {
    const paragraph = paragraphs[index];
    const text = textFromParagraph(paragraph);
    const styleName = paragraphStyleName(paragraph);
    const headingLevel = headingLevelFromStyle(styleName);
    const isHeadingStyle = headingLevel !== undefined || /^heading/i.test(styleName ?? '');

    extracted.push({
      id: `paragraph-${index}`,
      index,
      text,
      styleName,
      isHeadingStyle,
      headingLevel,
    });

    if (text) {
      charCursor += text.length + 1;
    }
  }

  return extracted;
}

function buildHeadingsFromParagraphs(paragraphs: ExtractedParagraph[]): ExtractedHeading[] {
  const headings: ExtractedHeading[] = [];
  let charCursor = 0;

  for (const paragraph of paragraphs) {
    if (paragraph.text) {
      if (paragraph.isHeadingStyle && paragraph.headingLevel) {
        headings.push({
          id: `heading-${paragraph.index}`,
          index: headings.length,
          text: paragraph.text,
          level: paragraph.headingLevel,
          styleName: paragraph.styleName,
          paragraphIndex: paragraph.index,
          charStart: charCursor,
        });
      }
      charCursor += paragraph.text.length + 1;
    }
  }

  return headings;
}

function parseTablesFromHtml(html: string): ExtractedTable[] {
  const doc = new DOMParser().parseFromString(html, 'text/html');
  const tableNodes = Array.from(doc.querySelectorAll('table'));
  return tableNodes.map((table, index) => {
    const rows = Array.from(table.querySelectorAll('tr')).map((row) =>
      Array.from(row.querySelectorAll('th,td')).map((cell) => cell.textContent?.trim() ?? ''),
    );
    const text = rows.map((row) => row.join('\t')).join('\n');
    return {
      id: `table-${index}`,
      index,
      rows,
      text,
    };
  });
}

export class DocxExtractionError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'DocxExtractionError';
  }
}

/** Extracts structured source content from a DOCX blob using mammoth + OOXML parsing. */
export async function extractDocxProtocolSource(
  blob: Blob,
  uploadId: string,
  filename: string,
): Promise<ImportedProtocolSource> {
  const warnings: string[] = [];
  const arrayBuffer = await blob.arrayBuffer();

  let paragraphs: ExtractedParagraph[] = [];
  try {
    const zip = await JSZip.loadAsync(arrayBuffer);
    const documentEntry =
      zip.file('word/document.xml') ?? zip.file('word\\document.xml');
    const documentXml = await documentEntry?.async('string');
    if (!documentXml) {
      throw new DocxExtractionError('DOCX is missing word/document.xml.');
    }
    paragraphs = parseDocumentXml(documentXml);
  } catch (error) {
    if (error instanceof DocxExtractionError) {
      throw error;
    }
    warnings.push('Could not parse OOXML structure; falling back to mammoth text extraction only.');
  }

  let fullText = '';
  let tables: ExtractedTable[] = [];

  try {
    const [rawResult, htmlResult] = await Promise.all([
      mammoth.extractRawText({ arrayBuffer }),
      mammoth.convertToHtml(
        { arrayBuffer },
        {
          styleMap: [
            "p[style-name='Heading 1'] => h1:fresh",
            "p[style-name='Heading 2'] => h2:fresh",
            "p[style-name='Heading 3'] => h3:fresh",
            "p[style-name='Heading 4'] => h4:fresh",
            "p[style-name='Title'] => h1:fresh",
          ],
        },
      ),
    ]);

    fullText = rawResult.value.trim();
    tables = parseTablesFromHtml(htmlResult.value);

    for (const message of [...rawResult.messages, ...htmlResult.messages]) {
      warnings.push(`${message.type}: ${message.message}`);
    }
  } catch (error) {
    throw new DocxExtractionError(
      error instanceof Error ? error.message : 'Failed to extract text from DOCX.',
    );
  }

  if (!fullText) {
    throw new DocxExtractionError('DOCX contains no readable text.');
  }

  if (paragraphs.length === 0) {
    paragraphs = fullText
      .split(/\n+/)
      .map((line, index) => ({
        id: `paragraph-fallback-${index}`,
        index,
        text: line.trim(),
        isHeadingStyle: false,
      }))
      .filter((paragraph) => paragraph.text.length > 0);
    warnings.push('Paragraph structure inferred from plain text lines.');
  }

  const alignedFullText =
    paragraphs.length > 0
      ? paragraphs
          .map((paragraph) => paragraph.text)
          .filter((text) => text.length > 0)
          .join('\n')
      : fullText;

  const headings = buildHeadingsFromParagraphs(paragraphs);

  if (headings.length === 0) {
    warnings.push('No Word heading styles detected in OOXML.');
  }

  return detectSourceSections(uploadId, filename, alignedFullText, paragraphs, headings, tables, warnings);
}
