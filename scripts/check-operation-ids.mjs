import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import yaml from 'js-yaml';

const pathsDir = 'specs/paths';
const METHODS = new Set(['get', 'post', 'put', 'patch', 'delete', 'head', 'options']);
const seen = new Map();
const duplicates = [];

for (const file of readdirSync(pathsDir)) {
  if (!file.endsWith('.yaml')) continue;
  const doc = yaml.load(readFileSync(join(pathsDir, file), 'utf8'));
  for (const [pathTemplate, pathItem] of Object.entries(doc?.paths ?? {})) {
    for (const [method, operation] of Object.entries(pathItem ?? {})) {
      if (!METHODS.has(method)) continue;
      const operationId = operation?.operationId;
      if (!operationId) continue;
      const location = `${file}:${method.toUpperCase()} ${pathTemplate}`;
      if (seen.has(operationId)) {
        duplicates.push({
          operationId,
          first: seen.get(operationId),
          second: location,
        });
      } else {
        seen.set(operationId, location);
      }
    }
  }
}

if (duplicates.length > 0) {
  console.error('Duplicate operationId values detected:');
  for (const dup of duplicates) {
    console.error(`- ${dup.operationId}`);
    console.error(`  - ${dup.first}`);
    console.error(`  - ${dup.second}`);
  }
  process.exit(1);
}

console.log(`OperationId uniqueness check passed (${seen.size} operationIds).`);
