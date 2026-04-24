import { mkdir, copyFile, writeFile, rm, cp, stat } from 'node:fs/promises';
import { existsSync } from 'node:fs';

const sourceSpec = 'specs/sfmc_marketing_cloud_openapi.yaml';
const sourcePathsDir = 'specs/paths';
const sourceMigrationsDir = 'specs/migrations';
const sourceCatalog = 'dist/migration-catalog.json';
const distDir = 'dist';
const outputSpec = `${distDir}/sfmc_marketing_cloud_openapi.yaml`;
const outputPathsDir = `${distDir}/paths`;
const outputMigrationsDir = `${distDir}/migrations`;
const outputHtml = `${distDir}/index.html`;

// If the catalog was built into dist/ before we wipe the directory, preserve it.
let preservedCatalog = null;
if (existsSync(sourceCatalog)) {
  preservedCatalog = await (await import('node:fs/promises')).readFile(sourceCatalog);
}

await rm(distDir, { recursive: true, force: true });
await mkdir(distDir, { recursive: true });
await copyFile(sourceSpec, outputSpec);
await cp(sourcePathsDir, outputPathsDir, { recursive: true });

if (existsSync(sourceMigrationsDir)) {
  await cp(sourceMigrationsDir, outputMigrationsDir, { recursive: true });
}

if (preservedCatalog) {
  await writeFile(sourceCatalog, preservedCatalog);
}

const html = `<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>SFMC Migration Toolkit Docs</title>
    <link rel="stylesheet" href="https://unpkg.com/swagger-ui-dist@5/swagger-ui.css" />
    <style>
      body { margin: 0; background: #fafafa; }
      .toolkit-banner {
        padding: 12px 24px;
        background: #0f2e4c;
        color: #fff;
        font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
        font-size: 14px;
      }
      .toolkit-banner a { color: #8ac4ff; margin-left: 12px; }
    </style>
  </head>
  <body>
    <div class="toolkit-banner">
      SFMC Migration Toolkit &mdash; OpenAPI contract, migration recipes, and agent tooling.
      <a href="./migration-catalog.json">migration-catalog.json</a>
      <a href="./migrations/">recipes/</a>
    </div>
    <div id="swagger-ui"></div>
    <script src="https://unpkg.com/swagger-ui-dist@5/swagger-ui-bundle.js" crossorigin></script>
    <script>
      window.ui = SwaggerUIBundle({
        url: './sfmc_marketing_cloud_openapi.yaml',
        dom_id: '#swagger-ui',
        deepLinking: true,
        presets: [SwaggerUIBundle.presets.apis],
      });
    </script>
  </body>
</html>
`;

await writeFile(outputHtml, html, 'utf8');

const hasCatalog = existsSync(sourceCatalog);
console.log(`Swagger docs generated at ${outputHtml}`);
if (hasCatalog) {
  console.log('dist/migration-catalog.json present.');
} else {
  console.log('No dist/migration-catalog.json yet. Run `npm run catalog` to generate one.');
}
