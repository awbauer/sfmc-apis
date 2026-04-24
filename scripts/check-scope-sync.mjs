import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

const rootSpec = readFileSync('specs/sfmc_marketing_cloud_openapi.yaml', 'utf8').split('\n');

const declaredScopes = new Set();
let inClientCredentialsScopes = false;
for (const line of rootSpec) {
  if (line.includes('clientCredentials:')) {
    inClientCredentialsScopes = false;
  }
  if (/^\s{10}scopes:\s*$/.test(line)) {
    inClientCredentialsScopes = true;
    continue;
  }
  if (inClientCredentialsScopes && /^\s{8}[A-Za-z]/.test(line)) {
    inClientCredentialsScopes = false;
  }
  if (inClientCredentialsScopes) {
    const match = line.match(/^\s{12}([a-z0-9_]+):\s+/);
    if (match) declaredScopes.add(match[1]);
  }
}

const pathDir = 'specs/paths';
const usedScopes = new Set();
for (const file of readdirSync(pathDir)) {
  if (!file.endsWith('.yaml')) continue;
  const lines = readFileSync(join(pathDir, file), 'utf8').split('\n');
  let inScopes = false;
  for (const line of lines) {
    if (/^\s*x-sfmc-installed-package-scopes:\s*$/.test(line)) {
      inScopes = true;
      continue;
    }
    if (inScopes) {
      const item = line.match(/^\s*-\s+(.+)\s*$/);
      if (item) {
        const scope = item[1].trim();
        if (scope !== 'None') usedScopes.add(scope);
        continue;
      }
      if (/^\s*\S/.test(line)) inScopes = false;
    }
  }
}

const missingScopes = [...usedScopes].filter((scope) => !declaredScopes.has(scope)).sort();
const unusedScopes = [...declaredScopes].filter((scope) => !usedScopes.has(scope)).sort();

if (missingScopes.length > 0) {
  console.error('Missing declared oauth2 scopes for operation usage:');
  for (const scope of missingScopes) {
    console.error(`- ${scope}`);
  }
  process.exit(1);
}

if (unusedScopes.length > 0) {
  console.error('Unused declared oauth2 scopes (not referenced by any operation):');
  for (const scope of unusedScopes) {
    console.error(`- ${scope}`);
  }
  process.exit(1);
}

console.log(`Scope sync check passed (${usedScopes.size} scopes used, ${declaredScopes.size} declared).`);
