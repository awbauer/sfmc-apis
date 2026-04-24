import { mkdir, copyFile, writeFile, rm, cp } from 'node:fs/promises';

const sourceSpec = 'specs/sfmc_marketing_cloud_openapi.yaml';
const sourcePathsDir = 'specs/paths';
const distDir = 'dist';
const outputSpec = `${distDir}/sfmc_marketing_cloud_openapi.yaml`;
const outputPathsDir = `${distDir}/paths`;
const outputHtml = `${distDir}/index.html`;

await rm(distDir, { recursive: true, force: true });
await mkdir(distDir, { recursive: true });
await copyFile(sourceSpec, outputSpec);
await cp(sourcePathsDir, outputPathsDir, { recursive: true });

const html = `<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>SFMC OpenAPI Docs</title>
    <link rel="stylesheet" href="https://unpkg.com/swagger-ui-dist@5/swagger-ui.css" />
    <style>
      body { margin: 0; background: #fafafa; }
    </style>
  </head>
  <body>
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

console.log(`Swagger docs generated at ${outputHtml}`);
