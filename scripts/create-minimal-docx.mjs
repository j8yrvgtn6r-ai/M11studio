import { execSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, 'fixtures', '_docx_build');
const out = path.join(__dirname, 'fixtures', 'minimal.docx');

const contentTypes = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  <Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>
</Types>`;

const rels = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>
</Relationships>`;

const document = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
  <w:body>
    <w:p><w:r><w:t>Minimal test protocol for import smoke.</w:t></w:r></w:p>
  </w:body>
</w:document>`;

fs.rmSync(root, { recursive: true, force: true });
fs.mkdirSync(path.join(root, '_rels'), { recursive: true });
fs.mkdirSync(path.join(root, 'word'), { recursive: true });
fs.writeFileSync(path.join(root, '[Content_Types].xml'), contentTypes);
fs.writeFileSync(path.join(root, '_rels', '.rels'), rels);
fs.writeFileSync(path.join(root, 'word', 'document.xml'), document);

const zipPath = path.join(__dirname, 'fixtures', 'minimal.zip');
fs.rmSync(zipPath, { force: true });
fs.rmSync(out, { force: true });

execSync(
  `powershell -NoProfile -Command "Set-Location -LiteralPath '${root.replace(/'/g, "''")}'; Compress-Archive -Path '*' -DestinationPath '${zipPath.replace(/'/g, "''")}' -Force"`,
  { stdio: 'inherit' },
);

fs.copyFileSync(zipPath, out);
fs.rmSync(zipPath, { force: true });
fs.rmSync(root, { recursive: true, force: true });
console.log('Wrote', out);
