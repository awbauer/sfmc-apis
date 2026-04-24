import { readFileSync, readdirSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import yaml from 'js-yaml';

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(here, '..');
const rootSpecPath = join(repoRoot, 'specs', 'sfmc_marketing_cloud_openapi.yaml');
const pathsDir = join(repoRoot, 'specs', 'paths');
const migrationsDir = join(repoRoot, 'specs', 'migrations');
const distDir = join(repoRoot, 'dist');
const outPath = join(distDir, 'migration-catalog.json');

const METHODS = new Set(['get', 'post', 'put', 'patch', 'delete', 'head', 'options']);

function loadYaml(path) {
  return yaml.load(readFileSync(path, 'utf8'));
}

function collectOperations() {
  const operations = [];
  const byOperationId = new Map();
  const rootSpec = loadYaml(rootSpecPath);
  const specVersion = rootSpec?.info?.version ?? 'unknown';

  for (const file of readdirSync(pathsDir)) {
    if (!file.endsWith('.yaml')) continue;
    const doc = loadYaml(join(pathsDir, file));
    const paths = doc?.paths ?? {};
    for (const [pathTemplate, pathItem] of Object.entries(paths)) {
      for (const [method, op] of Object.entries(pathItem)) {
        if (!METHODS.has(method)) continue;
        const opId = op.operationId;
        if (!opId) continue;
        const entry = {
          operationId: opId,
          file,
          path: pathTemplate,
          method: method.toUpperCase(),
          tags: op.tags ?? [],
          summary: op.summary ?? '',
          description: op.description ?? '',
          scopes: op['x-sfmc-installed-package-scopes'] ?? [],
          permissionIds: op['x-sfmc-permission-ids'] ?? [],
          userPermissionPaths: op['x-sfmc-user-permission-paths'] ?? [],
          migration: {
            direction: op['x-migration-direction'] ?? null,
            bulkCapable: op['x-bulk-capable'] === true,
            pollingFor: op['x-polling-endpoint-of'] ?? null,
          },
        };
        operations.push(entry);
        byOperationId.set(opId, entry);
      }
    }
  }
  return { operations, byOperationId, specVersion };
}

function collectRecipes(byOperationId) {
  const recipes = [];
  if (!existsSync(migrationsDir)) return recipes;
  for (const file of readdirSync(migrationsDir)) {
    if (!file.endsWith('.yaml')) continue;
    if (file.startsWith('_')) continue;
    const doc = loadYaml(join(migrationsDir, file));
    if (!doc || typeof doc !== 'object') continue;
    const stepOps = (doc.steps ?? []).map((s) => s.operation_id);
    const pollOps = (doc.steps ?? [])
      .map((s) => s?.polling?.poll_operation_id)
      .filter(Boolean);
    const allReferenced = [...new Set([...stepOps, ...pollOps])];
    const missing = allReferenced.filter((id) => !byOperationId.has(id));
    if (missing.length > 0) {
      console.error(`Recipe ${file} references unknown operationId(s): ${missing.join(', ')}`);
      process.exitCode = 1;
    }
    recipes.push({
      id: doc.id,
      name: doc.name,
      direction: doc.direction,
      family: doc.family,
      summary: doc.description ?? '',
      steps: stepOps,
      file,
    });
  }
  return recipes;
}

function groupBy(items, key) {
  const out = {};
  for (const item of items) {
    const k = item[key];
    if (!k) continue;
    (out[k] ??= []).push(item.id);
  }
  return out;
}

function main() {
  const { operations, byOperationId, specVersion } = collectOperations();

  for (const op of operations) {
    const pollingFor = op.migration.pollingFor;
    if (pollingFor && !byOperationId.has(pollingFor)) {
      console.error(
        `Operation ${op.operationId} declares x-polling-endpoint-of: ${pollingFor} which is not a known operationId.`,
      );
      process.exitCode = 1;
    }
  }

  const recipes = collectRecipes(byOperationId);

  const catalog = {
    generatedAt: new Date().toISOString(),
    specVersion,
    operations: operations.sort((a, b) => a.operationId.localeCompare(b.operationId)),
    recipes: recipes.sort((a, b) => (a.id ?? '').localeCompare(b.id ?? '')),
    byDirection: groupBy(recipes, 'direction'),
    byFamily: groupBy(recipes, 'family'),
    counts: {
      operations: operations.length,
      recipes: recipes.length,
      bulkCapableOperations: operations.filter((o) => o.migration.bulkCapable).length,
      operationsWithDirection: operations.filter((o) => o.migration.direction !== null).length,
    },
  };

  mkdirSync(distDir, { recursive: true });
  writeFileSync(outPath, JSON.stringify(catalog, null, 2) + '\n', 'utf8');
  console.log(
    `Wrote ${outPath} (${catalog.counts.operations} operations, ${catalog.counts.recipes} recipes).`,
  );

  if (process.exitCode) {
    process.exit(process.exitCode);
  }
}

main();
