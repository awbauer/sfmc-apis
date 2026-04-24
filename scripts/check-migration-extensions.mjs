import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import yaml from 'js-yaml';

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(here, '..');
const pathsDir = join(repoRoot, 'specs', 'paths');
const migrationsDir = join(repoRoot, 'specs', 'migrations');
const schemaPath = join(migrationsDir, '_schema.yaml');

const METHODS = new Set(['get', 'post', 'put', 'patch', 'delete', 'head', 'options']);
const ALLOWED_DIRECTIONS = new Set(['import', 'export', 'both', 'control-plane']);

const errors = [];

function loadYaml(path) {
  return yaml.load(readFileSync(path, 'utf8'));
}

function collectOperations() {
  const byId = new Map();
  for (const file of readdirSync(pathsDir)) {
    if (!file.endsWith('.yaml')) continue;
    const doc = loadYaml(join(pathsDir, file));
    for (const [pathTemplate, pathItem] of Object.entries(doc?.paths ?? {})) {
      for (const [method, op] of Object.entries(pathItem)) {
        if (!METHODS.has(method)) continue;
        if (!op.operationId) continue;
        byId.set(op.operationId, { op, file, pathTemplate, method });
      }
    }
  }
  return byId;
}

function checkOperationExtensions(operations) {
  for (const [id, { op, file }] of operations) {
    const direction = op['x-migration-direction'];
    if (direction !== undefined && !ALLOWED_DIRECTIONS.has(direction)) {
      errors.push(
        `${file}: ${id} has x-migration-direction: ${direction} (must be one of ${[...ALLOWED_DIRECTIONS].join(', ')}).`,
      );
    }
    const bulk = op['x-bulk-capable'];
    if (bulk !== undefined && typeof bulk !== 'boolean') {
      errors.push(`${file}: ${id} has x-bulk-capable: ${bulk} (must be boolean).`);
    }
    const pollingFor = op['x-polling-endpoint-of'];
    if (pollingFor !== undefined) {
      if (typeof pollingFor !== 'string') {
        errors.push(`${file}: ${id} has non-string x-polling-endpoint-of.`);
      } else if (!operations.has(pollingFor)) {
        errors.push(
          `${file}: ${id} has x-polling-endpoint-of: ${pollingFor} but that operationId is not defined anywhere.`,
        );
      }
    }
  }
}

const PRIMITIVE_CHECKERS = {
  string: (v) => typeof v === 'string',
  integer: (v) => Number.isInteger(v),
  number: (v) => typeof v === 'number',
  boolean: (v) => typeof v === 'boolean',
  array: Array.isArray,
  object: (v) => v !== null && typeof v === 'object' && !Array.isArray(v),
};

function validateAgainstSchema(value, schema, path, schemaErrors) {
  if (schema.enum && !schema.enum.includes(value)) {
    schemaErrors.push(`${path}: expected one of ${schema.enum.join(', ')} but got ${JSON.stringify(value)}.`);
    return;
  }
  if (schema.type) {
    const checker = PRIMITIVE_CHECKERS[schema.type];
    if (checker && !checker(value)) {
      schemaErrors.push(`${path}: expected ${schema.type} but got ${Array.isArray(value) ? 'array' : typeof value}.`);
      return;
    }
  }
  if (schema.type === 'object' && value && typeof value === 'object') {
    const required = schema.required ?? [];
    for (const r of required) {
      if (!(r in value)) {
        schemaErrors.push(`${path}: missing required property "${r}".`);
      }
    }
    const props = schema.properties ?? {};
    if (schema.additionalProperties === false) {
      for (const k of Object.keys(value)) {
        if (!(k in props)) {
          schemaErrors.push(`${path}: unexpected property "${k}".`);
        }
      }
    }
    for (const [k, v] of Object.entries(value)) {
      if (props[k]) validateAgainstSchema(v, props[k], `${path}.${k}`, schemaErrors);
      else if (schema.additionalProperties && typeof schema.additionalProperties === 'object') {
        validateAgainstSchema(v, schema.additionalProperties, `${path}.${k}`, schemaErrors);
      }
    }
    if (schema.pattern && typeof value === 'string' && !new RegExp(schema.pattern).test(value)) {
      schemaErrors.push(`${path}: value "${value}" does not match pattern ${schema.pattern}.`);
    }
  }
  if (schema.type === 'array' && Array.isArray(value) && schema.items) {
    if (schema.minItems && value.length < schema.minItems) {
      schemaErrors.push(`${path}: array must have at least ${schema.minItems} item(s).`);
    }
    value.forEach((item, idx) => validateAgainstSchema(item, schema.items, `${path}[${idx}]`, schemaErrors));
  }
  if (schema.type === 'string' && schema.pattern && typeof value === 'string') {
    if (!new RegExp(schema.pattern).test(value)) {
      schemaErrors.push(`${path}: value "${value}" does not match pattern ${schema.pattern}.`);
    }
  }
}

function checkRecipes(operations) {
  if (!existsSync(schemaPath)) {
    errors.push(`Missing recipe schema at ${schemaPath}.`);
    return;
  }
  const schema = loadYaml(schemaPath);
  for (const file of readdirSync(migrationsDir)) {
    if (!file.endsWith('.yaml')) continue;
    if (file.startsWith('_')) continue;
    const filePath = join(migrationsDir, file);
    let recipe;
    try {
      recipe = loadYaml(filePath);
    } catch (err) {
      errors.push(`${file}: YAML parse error: ${err.message}`);
      continue;
    }
    const schemaErrors = [];
    validateAgainstSchema(recipe, schema, recipe?.id ?? file, schemaErrors);
    for (const e of schemaErrors) errors.push(`${file}: ${e}`);

    const stemId = file.replace(/\.yaml$/, '');
    if (recipe?.id && recipe.id !== stemId) {
      errors.push(`${file}: recipe id "${recipe.id}" must match filename stem "${stemId}".`);
    }

    const referenced = new Set();
    for (const step of recipe?.steps ?? []) {
      if (step?.operation_id) referenced.add(step.operation_id);
      if (step?.polling?.poll_operation_id) referenced.add(step.polling.poll_operation_id);
    }
    for (const opId of referenced) {
      const entry = operations.get(opId);
      if (!entry) {
        errors.push(`${file}: references unknown operationId "${opId}".`);
        continue;
      }
      if (entry.op['x-migration-direction'] == null) {
        errors.push(
          `${file}: references ${opId} which is missing x-migration-direction (required for recipe-referenced operations).`,
        );
      }
    }
  }
}

function main() {
  const operations = collectOperations();
  checkOperationExtensions(operations);
  checkRecipes(operations);

  if (errors.length > 0) {
    console.error('Migration extension check failed:');
    for (const e of errors) console.error(`- ${e}`);
    process.exit(1);
  }

  console.log(
    `Migration extension check passed (${operations.size} operations scanned).`,
  );
}

main();
