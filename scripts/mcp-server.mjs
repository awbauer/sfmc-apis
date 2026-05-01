#!/usr/bin/env node
import { readFileSync, writeFileSync, existsSync, readdirSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import yaml from 'js-yaml';

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(here, '..');
const catalogPath = join(repoRoot, 'dist', 'migration-catalog.json');
const migrationsDir = join(repoRoot, 'specs', 'migrations');
const pkgPath = join(repoRoot, 'package.json');
const connectionConfigPath = join(repoRoot, 'sfmc-connection.config.json');

const CONNECTION_FIELDS = ['clientId', 'clientSecret', 'authBaseUri', 'restBaseUri', 'soapBaseUri'];
const SECRET_FIELDS = new Set(['clientSecret']);

function loadCatalog() {
  if (!existsSync(catalogPath)) {
    const result = spawnSync(process.execPath, [join(here, 'build-migration-catalog.mjs')], {
      stdio: 'inherit',
    });
    if (result.status !== 0) {
      throw new Error(`Failed to build migration catalog (exit ${result.status}).`);
    }
  }
  return JSON.parse(readFileSync(catalogPath, 'utf8'));
}

function loadRecipeByFile(file) {
  const path = join(migrationsDir, file);
  if (!existsSync(path)) return null;
  return yaml.load(readFileSync(path, 'utf8'));
}

function scoreMatch(query, op) {
  const haystack = `${op.operationId} ${op.summary ?? ''} ${(op.tags ?? []).join(' ')}`.toLowerCase();
  const tokens = query.toLowerCase().split(/\s+/).filter(Boolean);
  if (tokens.length === 0) return 0;
  let score = 0;
  for (const t of tokens) {
    if (haystack.includes(t)) score += 1;
  }
  return score;
}

function scoreRecipeMatch(query, recipe) {
  const haystack = `${recipe.id ?? ''} ${recipe.name ?? ''} ${recipe.summary ?? ''} ${recipe.family ?? ''}`.toLowerCase();
  const tokens = query.toLowerCase().split(/\s+/).filter(Boolean);
  if (tokens.length === 0) return 0;
  let score = 0;
  for (const t of tokens) {
    if (haystack.includes(t)) score += 1;
  }
  return score;
}

const TOOL_DEFS = [
  {
    name: 'list_migration_recipes',
    description:
      'List migration recipes in this repo. Optionally filter by direction (import|export) or family (tag-family slug).',
    inputSchema: {
      type: 'object',
      properties: {
        direction: { type: 'string', enum: ['import', 'export'] },
        family: { type: 'string' },
      },
      additionalProperties: false,
    },
  },
  {
    name: 'get_migration_recipe',
    description: 'Get the full body of a migration recipe by id.',
    inputSchema: {
      type: 'object',
      properties: { id: { type: 'string' } },
      required: ['id'],
      additionalProperties: false,
    },
  },
  {
    name: 'get_endpoint_for_task',
    description:
      'Rank SFMC operations by keyword overlap with a free-text task description. Optionally constrain by direction/family.',
    inputSchema: {
      type: 'object',
      properties: {
        task: { type: 'string' },
        direction: { type: 'string', enum: ['import', 'export', 'both', 'control-plane'] },
        family: { type: 'string' },
        limit: { type: 'integer', minimum: 1, maximum: 50 },
      },
      required: ['task'],
      additionalProperties: false,
    },
  },
  {
    name: 'lookup_scope_for_operation',
    description:
      'Return the OAuth2 installed-package scopes, permission IDs, and user permission paths for an operationId.',
    inputSchema: {
      type: 'object',
      properties: { operation_id: { type: 'string' } },
      required: ['operation_id'],
      additionalProperties: false,
    },
  },
  {
    name: 'describe_operation',
    description:
      'Return a flattened description of an operation: method, path, summary, description, scopes, and migration metadata.',
    inputSchema: {
      type: 'object',
      properties: { operation_id: { type: 'string' } },
      required: ['operation_id'],
      additionalProperties: false,
    },
  },
  {
    name: 'resolve_polling_target',
    description:
      'Given a kicker operationId, return every operation whose x-polling-endpoint-of matches it.',
    inputSchema: {
      type: 'object',
      properties: { operation_id: { type: 'string' } },
      required: ['operation_id'],
      additionalProperties: false,
    },
  },
  {
    name: 'plan_migration',
    description:
      'Compose a lightweight sequential migration plan from one or more recipes, with consolidated prerequisites and step-level operation references.',
    inputSchema: {
      type: 'object',
      properties: {
        recipe_ids: {
          type: 'array',
          items: { type: 'string' },
          minItems: 1,
          maxItems: 10,
        },
        task: { type: 'string' },
        direction: { type: 'string', enum: ['import', 'export'] },
        family: { type: 'string' },
        limit: { type: 'integer', minimum: 1, maximum: 10 },
      },
      additionalProperties: false,
    },
  },
  {
    name: 'get_connection_config',
    description:
      'Return the current SFMC connection configuration status. Shows which fields are set and which are missing. Secret values (clientSecret) are never returned — only whether they are set. Call this before executing any SFMC API calls to verify the instance is configured.',
    inputSchema: {
      type: 'object',
      properties: {},
      additionalProperties: false,
    },
  },
  {
    name: 'set_connection_config',
    description:
      'Save SFMC connection configuration fields to sfmc-connection.config.json. Merges with any existing values — omitted fields are left unchanged. Call get_connection_config first to see which fields are already set, then ask the user only for missing ones.',
    inputSchema: {
      type: 'object',
      properties: {
        clientId: { type: 'string', description: 'OAuth2 client ID from the SFMC installed package credentials tab.' },
        clientSecret: { type: 'string', description: 'OAuth2 client secret from the SFMC installed package credentials tab.' },
        authBaseUri: { type: 'string', description: 'Authentication Base URI, e.g. https://YOUR_SUBDOMAIN.auth.marketingcloudapis.com/' },
        restBaseUri: { type: 'string', description: 'REST Base URI, e.g. https://YOUR_SUBDOMAIN.rest.marketingcloudapis.com/' },
        soapBaseUri: { type: 'string', description: 'SOAP Base URI, e.g. https://YOUR_SUBDOMAIN.soap.marketingcloudapis.com/' },
      },
      additionalProperties: false,
    },
  },
];

function handleList(catalog, args) {
  let recipes = catalog.recipes;
  if (args?.direction) recipes = recipes.filter((r) => r.direction === args.direction);
  if (args?.family) recipes = recipes.filter((r) => r.family === args.family);
  return { recipes };
}

function handleGetRecipe(catalog, args) {
  const entry = catalog.recipes.find((r) => r.id === args.id);
  if (!entry) return { error: `Unknown recipe id: ${args.id}` };
  const body = loadRecipeByFile(entry.file);
  return { recipe: body, file: entry.file };
}

function handleGetEndpoint(catalog, args) {
  const limit = args.limit ?? 10;
  let pool = catalog.operations;
  if (args.direction) pool = pool.filter((o) => o.migration?.direction === args.direction);
  if (args.family) pool = pool.filter((o) => (o.tags ?? []).some((t) => t.toLowerCase() === args.family.toLowerCase()));
  const ranked = pool
    .map((o) => ({ op: o, score: scoreMatch(args.task, o) }))
    .filter((e) => e.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map(({ op, score }) => ({
      operationId: op.operationId,
      method: op.method,
      path: op.path,
      tags: op.tags,
      summary: op.summary,
      scopes: op.scopes,
      migration: op.migration,
      score,
    }));
  return { matches: ranked };
}

function handleLookupScope(catalog, args) {
  const op = catalog.operations.find((o) => o.operationId === args.operation_id);
  if (!op) return { error: `Unknown operationId: ${args.operation_id}` };
  return {
    operationId: op.operationId,
    scopes: op.scopes,
    permissionIds: op.permissionIds,
    userPermissionPaths: op.userPermissionPaths,
  };
}

function handleDescribe(catalog, args) {
  const op = catalog.operations.find((o) => o.operationId === args.operation_id);
  if (!op) return { error: `Unknown operationId: ${args.operation_id}` };
  return op;
}

function handleResolvePolling(catalog, args) {
  const matches = catalog.operations
    .filter((o) => o.migration?.pollingFor === args.operation_id)
    .map((o) => ({ operationId: o.operationId, method: o.method, path: o.path, summary: o.summary }));
  return { pollers: matches };
}

function uniqueSorted(values) {
  return [...new Set(values.filter(Boolean))].sort((a, b) => String(a).localeCompare(String(b)));
}

function handlePlanMigration(catalog, args) {
  let selectedRecipes = [];
  if (Array.isArray(args.recipe_ids) && args.recipe_ids.length > 0) {
    const missing = args.recipe_ids.filter((id) => !catalog.recipes.some((r) => r.id === id));
    if (missing.length > 0) {
      return { error: `Unknown recipe id(s): ${missing.join(', ')}` };
    }
    selectedRecipes = catalog.recipes.filter((r) => args.recipe_ids.includes(r.id));
  } else {
    const pool = catalog.recipes.filter((r) => {
      if (args.direction && r.direction !== args.direction) return false;
      if (args.family && r.family !== args.family) return false;
      return true;
    });
    const rankedPool = args.task
      ? pool
          .map((r) => ({ recipe: r, score: scoreRecipeMatch(args.task, r) }))
          .filter((entry) => entry.score > 0)
          .sort((a, b) => b.score - a.score)
          .map((entry) => entry.recipe)
      : pool;
    selectedRecipes = rankedPool.slice(0, args.limit ?? 3);
  }

  const recipePlans = [];
  const allScopes = [];
  const allPermissions = [];
  const allInputs = [];
  const allOperationIds = [];
  for (const recipeEntry of selectedRecipes) {
    const recipe = loadRecipeByFile(recipeEntry.file);
    if (!recipe) continue;

    const prerequisites = recipe.prerequisites ?? {};
    const stepPlan = (recipe.steps ?? []).map((step) => {
      allOperationIds.push(step.operation_id);
      return {
        id: step.id,
        why: step.why ?? null,
        operation_id: step.operation_id,
        polling: step.polling ?? null,
      };
    });

    allScopes.push(...(prerequisites.scopes ?? []));
    allPermissions.push(...(prerequisites.permissions ?? []));
    allInputs.push(...(prerequisites.inputs_required ?? []));

    recipePlans.push({
      id: recipe.id,
      name: recipe.name,
      direction: recipe.direction,
      family: recipe.family,
      source_system: recipe.source_system,
      target_system: recipe.target_system,
      prerequisites,
      steps: stepPlan,
      rollback: recipe.rollback ?? null,
      idempotency_notes: recipe.idempotency_notes ?? null,
      references: recipe.references ?? [],
    });
  }

  return {
    plan: {
      recipe_count: recipePlans.length,
      recipes: recipePlans,
      consolidated_prerequisites: {
        scopes: uniqueSorted(allScopes),
        permissions: uniqueSorted(allPermissions),
        inputs_required: uniqueSorted(allInputs),
      },
      operation_ids: uniqueSorted(allOperationIds),
    },
  };
}

function handleGetConnectionConfig(_catalog) {
  const exists = existsSync(connectionConfigPath);
  const raw = exists ? (() => { try { return JSON.parse(readFileSync(connectionConfigPath, 'utf8')); } catch { return {}; } })() : {};
  const fields = {};
  const missing = [];
  for (const key of CONNECTION_FIELDS) {
    const isSet = Boolean(raw[key]);
    fields[key] = isSet ? (SECRET_FIELDS.has(key) ? '<set — hidden>' : raw[key]) : null;
    if (!isSet) missing.push(key);
  }
  return {
    configured: missing.length === 0,
    config_file_exists: exists,
    fields,
    missing_fields: missing,
    ...(missing.length > 0 && {
      next_step: `Ask the user to provide the following fields, then call set_connection_config: ${missing.join(', ')}`,
    }),
  };
}

function handleSetConnectionConfig(_catalog, args) {
  const existing = existsSync(connectionConfigPath)
    ? (() => { try { return JSON.parse(readFileSync(connectionConfigPath, 'utf8')); } catch { return {}; } })()
    : {};
  const updated = { ...existing };
  for (const key of CONNECTION_FIELDS) {
    if (args[key] !== undefined && args[key] !== null && String(args[key]).trim() !== '') {
      updated[key] = String(args[key]).trim();
    }
  }
  writeFileSync(connectionConfigPath, JSON.stringify(updated, null, 2) + '\n', 'utf8');
  const missing = CONNECTION_FIELDS.filter((k) => !updated[k]);
  return {
    saved: true,
    configured: missing.length === 0,
    missing_fields: missing,
    ...(missing.length > 0 && {
      next_step: `Still missing: ${missing.join(', ')}. Ask the user and call set_connection_config again.`,
    }),
  };
}

const HANDLERS = {
  list_migration_recipes: handleList,
  get_migration_recipe: handleGetRecipe,
  get_endpoint_for_task: handleGetEndpoint,
  lookup_scope_for_operation: handleLookupScope,
  describe_operation: handleDescribe,
  resolve_polling_target: handleResolvePolling,
  plan_migration: handlePlanMigration,
  get_connection_config: handleGetConnectionConfig,
  set_connection_config: handleSetConnectionConfig,
};

async function runSelfCheck(catalog) {
  console.log(`sfmc-migration-toolkit: ${catalog.counts.operations} operations, ${catalog.counts.recipes} recipes.`);
  console.log('Tools:');
  for (const t of TOOL_DEFS) console.log(`- ${t.name}: ${t.description}`);
  process.exit(0);
}

async function startServer(catalog) {
  let Server;
  let StdioServerTransport;
  let schemas;
  try {
    ({ Server } = await import('@modelcontextprotocol/sdk/server/index.js'));
    ({ StdioServerTransport } = await import('@modelcontextprotocol/sdk/server/stdio.js'));
    schemas = await import('@modelcontextprotocol/sdk/types.js');
  } catch (err) {
    console.error(
      'Could not load @modelcontextprotocol/sdk. Run `npm install` first, or use `--self-check` to print tool metadata without starting the server.',
    );
    console.error(err.message);
    process.exit(1);
  }

  const pkg = JSON.parse(readFileSync(pkgPath, 'utf8'));
  const server = new Server(
    { name: 'sfmc-migration-toolkit', version: pkg.version ?? '0.0.0' },
    { capabilities: { tools: {} } },
  );

  server.setRequestHandler(schemas.ListToolsRequestSchema, async () => ({ tools: TOOL_DEFS }));

  server.setRequestHandler(schemas.CallToolRequestSchema, async (req) => {
    const { name, arguments: args } = req.params;
    const handler = HANDLERS[name];
    if (!handler) {
      return {
        isError: true,
        content: [{ type: 'text', text: `Unknown tool: ${name}` }],
      };
    }
    try {
      const result = handler(catalog, args ?? {});
      return {
        content: [{ type: 'text', text: JSON.stringify(result, null, 2) }],
      };
    } catch (err) {
      return {
        isError: true,
        content: [{ type: 'text', text: `Tool ${name} failed: ${err.message}` }],
      };
    }
  });

  const transport = new StdioServerTransport();
  await server.connect(transport);
}

async function main() {
  const catalog = loadCatalog();
  if (process.argv.includes('--self-check')) {
    await runSelfCheck(catalog);
    return;
  }
  await startServer(catalog);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
