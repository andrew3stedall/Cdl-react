import { gzipSync } from 'node:zlib';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const repositoryRoot = resolve(fileURLToPath(new URL('..', import.meta.url)));
const outputDirectory = resolve(repositoryRoot, 'frontend/dist');
const manifestPath = resolve(outputDirectory, '.vite/manifest.json');
const htmlPath = resolve(outputDirectory, 'index.html');
const budgetBytes = 235_000;

const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'));
const html = readFileSync(htmlPath);
const entry = Object.entries(manifest).find(([, item]) => item.isEntry && item.src === 'index.html');

if (!entry) {
  throw new Error('Vite manifest does not contain the index.html entry.');
}

const initialAssets = new Set();
const visitedEntries = new Set();

function addEntry(key) {
  if (visitedEntries.has(key)) return;
  visitedEntries.add(key);

  const item = manifest[key];
  if (!item) throw new Error(`Vite manifest is missing imported entry: ${key}`);

  if (item.file && /\\.(?:js|css)$/.test(item.file)) initialAssets.add(item.file);
  for (const asset of item.css ?? []) initialAssets.add(asset);
  for (const importedKey of item.imports ?? []) addEntry(importedKey);
}

addEntry(entry[0]);

const compressedHtmlBytes = gzipSync(html).byteLength;
const compressedAssetBytes = [...initialAssets].reduce((total, asset) => {
  const assetPath = resolve(outputDirectory, asset);
  const contents = readFileSync(assetPath);
  return total + gzipSync(contents).byteLength;
}, 0);
const totalBytes = compressedHtmlBytes + compressedAssetBytes;
const rendered = (totalBytes / 1000).toFixed(2);
const budget = (budgetBytes / 1000).toFixed(0);

console.log(`Initial route transfer estimate: ${rendered} kB gzip (budget ${budget} kB; ${initialAssets.size} static JS/CSS assets)`);

if (totalBytes > budgetBytes) {
  throw new Error(`Initial route transfer estimate ${rendered} kB exceeds the ${budget} kB gzip budget.`);
}
