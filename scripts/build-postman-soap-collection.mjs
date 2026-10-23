import { writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

// Generates a Postman v2.1 collection for querying Automation Studio through the
// SFMC SOAP API, plus a matching environment. The REST surface is covered by the
// OpenAPI spec; this fills the SOAP gap for automation inventory and run status.

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(here, '..');
const outDir = join(repoRoot, 'postman');
const collectionPath = join(outDir, 'sfmc-soap-automations.postman_collection.json');
const environmentPath = join(outDir, 'sfmc-soap.postman_environment.json');

const DOCS = 'https://developer.salesforce.com/docs/marketing/marketing-cloud/guide';
const SOAP_URL = '{{soapInstanceUrl}}Service.asmx';

// Every Automation status code from the SOAP reference, used for the catch-all filter.
const AUTOMATION_STATUS_CODES = ['-1', '0', '1', '2', '3', '4', '5', '6', '7', '8'];

const AUTOMATION_PROPERTIES = [
  'Name',
  'CustomerKey',
  'Description',
  'ObjectID',
  'ProgramID',
  'Status',
  'IsActive',
  'AutomationType',
  'CreatedDate',
  'ModifiedDate',
];

// ---------------------------------------------------------------------------
// XML builders
// ---------------------------------------------------------------------------

function indent(text, spaces) {
  const pad = ' '.repeat(spaces);
  return text
    .split('\n')
    .map((line) => (line ? pad + line : line))
    .join('\n');
}

function envelope(bodyXml) {
  return [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<soapenv:Envelope xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">',
    '  <soapenv:Header>',
    '    <fueloauth>{{accessToken}}</fueloauth>',
    '  </soapenv:Header>',
    '  <soapenv:Body>',
    indent(bodyXml, 4),
    '  </soapenv:Body>',
    '</soapenv:Envelope>',
  ].join('\n');
}

function simpleFilterPart(property, operator, values, tag = 'Filter') {
  const valueXml = [].concat(values).map((v) => `  <Value>${v}</Value>`);
  return [
    `<${tag} xsi:type="SimpleFilterPart">`,
    `  <Property>${property}</Property>`,
    `  <SimpleOperator>${operator}</SimpleOperator>`,
    ...valueXml,
    `</${tag}>`,
  ].join('\n');
}

function complexFilterPart(left, logicalOperator, right) {
  return [
    '<Filter xsi:type="ComplexFilterPart">',
    indent(simpleFilterPart(...left, 'LeftOperand'), 2),
    `  <LogicalOperator>${logicalOperator}</LogicalOperator>`,
    indent(simpleFilterPart(...right, 'RightOperand'), 2),
    '</Filter>',
  ].join('\n');
}

function retrieveBody({ objectType, properties, filter, clientIds }) {
  const lines = ['<RetrieveRequestMsg xmlns="http://exacttarget.com/wsdl/partnerAPI">', '  <RetrieveRequest>'];
  if (clientIds) {
    lines.push('    <ClientIDs>', ...clientIds.map((id) => `      <ClientID>${id}</ClientID>`), '    </ClientIDs>');
  }
  lines.push(`    <ObjectType>${objectType}</ObjectType>`);
  lines.push(...properties.map((p) => `    <Properties>${p}</Properties>`));
  if (filter) lines.push(indent(filter, 4));
  lines.push('  </RetrieveRequest>', '</RetrieveRequestMsg>');
  return envelope(lines.join('\n'));
}

// ---------------------------------------------------------------------------
// Postman item builders
// ---------------------------------------------------------------------------

function soapRequest({ name, action, body, description, tests }) {
  const item = {
    name,
    request: {
      method: 'POST',
      header: [
        { key: 'Content-Type', value: 'text/xml; charset=UTF-8' },
        { key: 'SOAPAction', value: action },
      ],
      body: { mode: 'raw', raw: body, options: { raw: { language: 'xml' } } },
      url: SOAP_URL,
      description,
    },
  };
  if (tests) item.event = [{ listen: 'test', script: { type: 'text/javascript', exec: tests.split('\n') } }];
  return item;
}

function retrieveRequest({ name, description, ...retrieve }) {
  return soapRequest({ name, action: 'Retrieve', body: retrieveBody(retrieve), description });
}

function folder(name, description, items) {
  return { name, description, item: items };
}

// ---------------------------------------------------------------------------
// Scripts
// ---------------------------------------------------------------------------

// Collection-level pre-request: fetch or refresh the OAuth token before any SOAP call.
const collectionPreRequest = String.raw`// Auto-auth: requests an OAuth token when none is cached or the cached one is about to expire.
// The "Get access token" request handles its own auth, so it is skipped here.
if (pm.request.url.toString().indexOf('v2/token') === -1) {
  const expiresAt = Number(pm.collectionVariables.get('tokenExpiresAt') || 0);
  const hasToken = Boolean(pm.collectionVariables.get('accessToken'));

  if (!hasToken || Date.now() > expiresAt - 60 * 1000) {
    const payload = {
      grant_type: 'client_credentials',
      client_id: pm.variables.get('clientId'),
      client_secret: pm.variables.get('clientSecret'),
    };
    const accountId = pm.variables.get('accountId');
    if (accountId) payload.account_id = accountId;

    pm.sendRequest(
      {
        url: pm.variables.replaceIn('{{authBaseUrl}}v2/token'),
        method: 'POST',
        header: { 'Content-Type': 'application/json' },
        body: { mode: 'raw', raw: JSON.stringify(payload) },
      },
      (err, res) => {
        if (err || res.code !== 200) {
          console.error('Token request failed', err || res.text());
          return;
        }
        const token = res.json();
        pm.collectionVariables.set('accessToken', token.access_token);
        pm.collectionVariables.set('tokenExpiresAt', String(Date.now() + token.expires_in * 1000));
        if (token.soap_instance_url) pm.collectionVariables.set('soapInstanceUrl', token.soap_instance_url);
        if (token.rest_instance_url) pm.collectionVariables.set('restInstanceUrl', token.rest_instance_url);
        console.log('Fetched a new access token (expires in ' + token.expires_in + 's)');
      }
    );
  }
}`;

// Collection-level test: parse the SOAP response, assert on it, capture paging state,
// and render the Results as a table in the Visualize tab.
const collectionTests = String.raw`if (pm.request.url.toString().indexOf('Service.asmx') !== -1) {
  const xml2js = require('xml2js');
  const strip = xml2js.processors.stripPrefix;
  let parsed = null;
  xml2js.parseString(
    pm.response.text(),
    { explicitArray: false, tagNameProcessors: [strip], attrNameProcessors: [strip] },
    (err, res) => {
      if (!err) parsed = res;
    }
  );

  pm.test('Response is a SOAP envelope', () => {
    pm.expect(parsed && parsed.Envelope && parsed.Envelope.Body, pm.response.text().slice(0, 300)).to.be.ok;
  });

  const body = (parsed && parsed.Envelope && parsed.Envelope.Body) || {};
  const fault = body.Fault;
  pm.test('No SOAP fault', () => {
    pm.expect(fault, fault && (fault.faultstring || JSON.stringify(fault))).to.be.undefined;
  });

  const msgKey = Object.keys(body).find((k) => k !== '$') || '';
  const msg = body[msgKey] || {};
  const overall = msg.OverallStatus;

  if (overall !== undefined) {
    pm.test('OverallStatus is OK or MoreDataAvailable', () => {
      pm.expect(['OK', 'MoreDataAvailable'], 'OverallStatus: ' + overall).to.include(overall);
    });
  }

  if (msg.RequestID) pm.collectionVariables.set('lastRequestId', msg.RequestID);
  if (overall === 'MoreDataAvailable') {
    pm.collectionVariables.set('continueRequestId', msg.RequestID);
    console.log('More data available. Run "Pagination > Continue a retrieve" to fetch the next page (RequestID ' + msg.RequestID + ').');
  } else if (msgKey === 'RetrieveResponseMsg' && pm.request.body.raw.indexOf('<ContinueRequest>') !== -1) {
    pm.collectionVariables.set('continueRequestId', '');
    console.log('Last page reached.');
  }

  // Pick the list of records to show, depending on the response type.
  let records = [];
  if (msgKey === 'RetrieveResponseMsg') records = [].concat(msg.Results || []);
  else if (msgKey === 'DefinitionResponseMsg') records = [].concat((msg.ObjectDefinition || {}).Properties || []);
  else if (msgKey === 'PerformResponseMsg') records = [].concat((msg.Results || {}).Result || []);
  else if (msgKey === 'ScheduleResponseMsg') records = [].concat((msg.Results || {}).Result || []);

  const STATUS_LABELS = {
    '-1': 'Error', '0': 'Building error', '1': 'Building', '2': 'Ready', '3': 'Running',
    '4': 'Paused', '5': 'Stopped', '6': 'Scheduled', '7': 'Awaiting trigger', '8': 'Inactive trigger',
  };
  const NOISE = ['PartnerKey', 'ObjectState', 'Keyword', 'Client', 'Owner'];

  function scalar(v) {
    if (v === null || v === undefined) return '';
    if (typeof v !== 'object') return String(v);
    if (v._ !== undefined) return String(v._);
    if (v.$ && v.$.nil === 'true') return '';
    return null;
  }

  function flatten(obj, prefix, out, depth) {
    Object.keys(obj).forEach((key) => {
      if (key === '$' || NOISE.indexOf(key) !== -1) return;
      const value = obj[key];
      const name = prefix ? prefix + '.' + key : key;
      const s = scalar(value);
      if (s !== null) out[name] = s;
      else if (Array.isArray(value)) out[name] = value.length + ' item(s)';
      else if (depth < 2) flatten(value, name, out, depth + 1);
      else out[name] = JSON.stringify(value).slice(0, 120);
    });
    return out;
  }

  const rows = records.map((r) => {
    const flat = flatten(r || {}, '', {}, 0);
    const type = r && r.$ && r.$.type;
    if (type === 'Automation' && flat.Status !== undefined) flat.StatusLabel = STATUS_LABELS[flat.Status] || '?';
    return flat;
  });

  const columns = [];
  rows.forEach((row) => Object.keys(row).forEach((k) => {
    if (columns.indexOf(k) === -1 && rows.some((r) => r[k] !== undefined && r[k] !== '')) columns.push(k);
  }));
  if (columns.indexOf('StatusLabel') > 0) {
    columns.splice(columns.indexOf('StatusLabel'), 1);
    columns.splice(columns.indexOf('Status') + 1, 0, 'StatusLabel');
  }

  const summary = msgKey + (overall ? ' / ' + overall : '') + ' / ' + rows.length + ' record(s)';
  console.log(summary);

  pm.visualizer.set(
    '<style>body{font-family:-apple-system,Segoe UI,sans-serif;font-size:12px}table{border-collapse:collapse}' +
      'th,td{border:1px solid #ccc;padding:4px 6px;text-align:left;vertical-align:top}th{background:#f3f3f3;position:sticky;top:0}</style>' +
      '<p><strong>{{summary}}</strong></p>' +
      '{{#if rows.length}}<table><tr>{{#each columns}}<th>{{this}}</th>{{/each}}</tr>' +
      '{{#each rows}}<tr>{{#each this}}<td>{{this}}</td>{{/each}}</tr>{{/each}}</table>{{else}}<p>No records in the response.</p>{{/if}}',
    { summary, columns, rows: rows.map((row) => columns.map((c) => (row[c] === undefined ? '' : row[c]))) }
  );
}`;

const tokenPreRequest = String.raw`// Drop account_id from the body when no MID is set, so the token is issued for the
// package's default business unit.
const body = JSON.parse(pm.variables.replaceIn(pm.request.body.raw));
if (!body.account_id) delete body.account_id;
pm.request.body.raw = JSON.stringify(body, null, 2);`;

const tokenTests = String.raw`pm.test('Token issued', () => pm.response.to.have.status(200));
const token = pm.response.json();
pm.collectionVariables.set('accessToken', token.access_token);
pm.collectionVariables.set('tokenExpiresAt', String(Date.now() + token.expires_in * 1000));
pm.collectionVariables.set('soapInstanceUrl', token.soap_instance_url);
pm.collectionVariables.set('restInstanceUrl', token.rest_instance_url);
console.log('Token scopes: ' + token.scope);`;

const performStartTests = String.raw`// The SOAP guide notes that the ProgramInstanceID used by "Get a single run" comes back
// from Perform as an ObjectID. Capture whichever ObjectID the result carries.
const text = pm.response.text();
const match = text.match(/<Result>[\s\S]*?<ObjectID>([^<]+)<\/ObjectID>/);
if (match) {
  pm.collectionVariables.set('automationInstanceId', match[1]);
  console.log('Saved automationInstanceId = ' + match[1]);
}`;

// ---------------------------------------------------------------------------
// Descriptions
// ---------------------------------------------------------------------------

const collectionDescription = `Query **Automation Studio** in Salesforce Marketing Cloud Engagement through the **SOAP API**: automation inventory, status, single-run status, the query and import activities that automations call, and their folders.

The repo's OpenAPI spec covers the REST surface. Use this collection for the SOAP-only objects, and for SOAP's filter and paging model when you're building inventory or monitoring automations.

---

## Quick start

1. **Import** this collection and \`sfmc-soap.postman_environment.json\`, then select the **SFMC SOAP** environment.
2. In **Setup > Installed Packages**, create an API Integration (Server-to-Server) component. At minimum, grant **Automation > Automations: Read** (add **Execute** only if you'll use the *Actions* folder). Copy the values into the environment:
   - \`subdomain\`: the part before \`.auth.marketingcloudapis.com\` in the Authentication Base URI
   - \`clientId\` / \`clientSecret\`
   - \`accountId\` (optional): the MID of the business unit to query. Leave it blank for the package's default BU.
3. Send **Setup > Get access token**. You can also skip it, because the collection pre-request script fetches and refreshes tokens automatically.
4. Run **Setup > Describe the Automation object**, then **Automations > List all automations**. Open the **Visualize** tab in the response pane to see results as a table.

## How an SFMC SOAP call is shaped

Every request in this collection is a \`POST\` to \`{{soapInstanceUrl}}Service.asmx\` with:

| Part | Value | Why |
|---|---|---|
| \`Content-Type\` header | \`text/xml; charset=UTF-8\` | SOAP 1.1 |
| \`SOAPAction\` header | \`Retrieve\`, \`Describe\`, \`Perform\`, \`Schedule\` | Picks the method. It must match the \`*RequestMsg\` element in the body. |
| \`<fueloauth>\` in \`<soapenv:Header>\` | the OAuth access token | OAuth auth for SOAP. The token only covers the BU it was issued for and doesn't flow down to child BUs. |
| \`<RetrieveRequest>\` in the body | \`ObjectType\` + \`Properties\` + optional \`Filter\` | What to fetch |

### Properties
You must name each column you want with a \`<Properties>\` element. There's no \`SELECT *\`. Requesting a property that isn't retrievable fails the **whole** call with an error in \`OverallStatus\`. Use **Describe** to see what each object allows.

### Filters
- \`SimpleFilterPart\`: one \`Property\`, one \`SimpleOperator\`, and one or more \`Value\`s.
  Operators: \`equals\`, \`notEquals\`, \`greaterThan\`, \`greaterThanOrEqual\`, \`lessThan\`, \`lessThanOrEqual\`, \`isNull\`, \`isNotNull\`, \`between\`, \`IN\`, \`like\` (use \`%\` as the wildcard).
- \`ComplexFilterPart\`: a \`LeftOperand\` and \`RightOperand\` (each is a filter part) joined by \`AND\` / \`OR\`. Nest them for more conditions.

### Paging
A Retrieve returns up to 2,500 records. If more exist, \`OverallStatus\` is \`MoreDataAvailable\`. Send a new Retrieve that carries only \`<ContinueRequest>{RequestID}</ContinueRequest>\` and repeat until \`OverallStatus\` is \`OK\`. This collection saves the RequestID for you, so just run **Pagination > Continue a retrieve**.

### Business units
- **Option A (simplest):** set \`accountId\` to the child MID. The auto-auth script requests a token for that BU.
- **Option B:** authenticate at the parent and add \`<ClientIDs><ClientID>MID</ClientID></ClientIDs>\` to the RetrieveRequest. See **Automations > List automations in another business unit**.

Clear \`accessToken\` (collection variables) after you change \`accountId\` to force a new token.

## Automation status codes

| Code | Meaning |
|---|---|
| -1 | Error (failed) |
| 0 | Failed while being built |
| 1 | Building |
| 2 | Ready |
| 3 | Running |
| 4 | Paused |
| 5 | Stopped |
| 6 | Scheduled |
| 7 | Waiting for a trigger |
| 8 | Trigger inactive |

The visualizer adds a \`StatusLabel\` column with these meanings.

## What the collection scripts do

- **Pre-request (collection level):** if there's no token, or it expires in under 60 seconds, the script calls \`{{authBaseUrl}}v2/token\` and stores \`accessToken\`, \`tokenExpiresAt\`, \`soapInstanceUrl\`, and \`restInstanceUrl\` as collection variables.
- **Tests (collection level):** for each SOAP response, the script:
  - parses the XML
  - asserts there's no SOAP Fault and that \`OverallStatus\` is \`OK\` or \`MoreDataAvailable\`
  - saves \`lastRequestId\` and, when paging, \`continueRequestId\`
  - logs a summary to the Postman console
  - renders the records in the **Visualize** tab

## What SOAP can't tell you (use REST instead)

- Script (SSJS), File Transfer, Data Extract, Verification, and Wait activities have no SOAP Retrieve. Use \`/automation/v1/...\` in the OpenAPI spec.
- Per-step run history and detailed error logs come from the REST automation endpoints and the Automation Studio UI. On SOAP, \`AutomationInstance\` is documented for looking up a single run by its instance ID.
- Salesforce's SOAP guide notes that IDs for automations created in the UI may not work with every SOAP call. If a lookup by \`ObjectID\` returns nothing, try \`Name\` or \`CustomerKey\`.

## Troubleshooting

| Symptom | Likely cause |
|---|---|
| HTTP 500 with \`Login failed\` or \`Token expired\` in a Fault | Missing or expired token. Clear \`accessToken\` and resend. |
| \`OverallStatus\` = \`Error: The Request Property(s) X do not match with the fields of Y retrieve\` | Property X isn't retrievable on that object. Check **Describe**. |
| \`OverallStatus\` = \`OK\` but no Results | The filter matched nothing, or you're in the wrong BU (see *Business units*). |
| HTTP 500 \`Server was unable to process request\` | Malformed XML. Check that \`SOAPAction\` matches the body and that \`xsi:type\` is spelled correctly. |
| Permission errors | The installed package lacks **Automations: Read** (or **Execute** for Perform). Changes to a package can take up to 5 minutes to apply. |

## Reference
- [Authenticate SOAP API calls](${DOCS}/authenticate-soap-api.html)
- [Interact with Automation Studio (SOAP)](${DOCS}/interacting_with_automation_studio_via_the_web_service_soap_api.html)
- [Automation object](${DOCS}/automation.html) · [AutomationInstance](${DOCS}/automationinstance.html)
- [RetrieveRequest](${DOCS}/retrieverequest.html) · [SimpleFilterPart](${DOCS}/simplefilterpart.html) · [ComplexFilterPart](${DOCS}/complexfilterpart.html)
- [Supported operations by object](${DOCS}/supported_operations_for_objects_and_methods.html)

_Generated by \`scripts/build-postman-soap-collection.mjs\`. Edit the script, not this file, then run \`npm run postman:soap\`._`;

// ---------------------------------------------------------------------------
// Requests
// ---------------------------------------------------------------------------

const setupFolder = folder(
  'Setup',
  'Authentication and object discovery. Run these first when you connect to a new tenant or BU.',
  [
    {
      name: 'Get access token',
      event: [
        { listen: 'prerequest', script: { type: 'text/javascript', exec: tokenPreRequest.split('\n') } },
        { listen: 'test', script: { type: 'text/javascript', exec: tokenTests.split('\n') } },
      ],
      request: {
        method: 'POST',
        header: [{ key: 'Content-Type', value: 'application/json' }],
        body: {
          mode: 'raw',
          raw: JSON.stringify(
            {
              grant_type: 'client_credentials',
              client_id: '{{clientId}}',
              client_secret: '{{clientSecret}}',
              account_id: '{{accountId}}',
            },
            null,
            2
          ),
          options: { raw: { language: 'json' } },
        },
        url: '{{authBaseUrl}}v2/token',
        description: `Exchanges your installed package's client ID and secret for an OAuth access token (OAuth 2.0 client credentials).

**You don't usually need to run this by hand.** The collection-level pre-request script does the same thing whenever the token is missing or about to expire. Run it to check credentials, to see which scopes were granted (they're logged to the console), or to switch BUs.

**Saves:** \`accessToken\`, \`tokenExpiresAt\`, \`soapInstanceUrl\`, \`restInstanceUrl\` (collection variables).

**account_id:** set \`accountId\` in the environment to issue a token for a specific business unit (MID). If it's blank, the pre-request step removes it and the token is issued for the package's default BU.

Tokens last about 20 minutes (\`expires_in\` is in seconds).`,
      },
    },
    soapRequest({
      name: 'Describe the Automation object',
      action: 'Describe',
      body: envelope(
        [
          '<DefinitionRequestMsg xmlns="http://exacttarget.com/wsdl/partnerAPI">',
          '  <DescribeRequests>',
          '    <ObjectDefinitionRequest>',
          '      <ObjectType>{{describeObjectType}}</ObjectType>',
          '    </ObjectDefinitionRequest>',
          '  </DescribeRequests>',
          '</DefinitionRequestMsg>',
        ].join('\n')
      ),
      description: `Lists every property of an SFMC SOAP object and whether you can retrieve, filter, or update it. **Use it before you write a Retrieve.** If you request one property the object won't return, the whole call fails.

**Variable:** \`describeObjectType\` (default \`Automation\`). Change it to \`AutomationInstance\`, \`QueryDefinition\`, \`ImportDefinition\`, \`FileTrigger\`, \`DataFolder\`, and so on.

**Read the response:** in the **Visualize** tab, find the \`IsRetrievable\` column. Only properties with \`true\` can go in \`<Properties>\`. Check \`IsFilterable\` as well if the response includes it.`,
    }),
  ]
);

const automationsFolder = folder(
  'Automations',
  `Retrieve **Automation** definitions: name, keys, status, type, and dates.

Each request asks for the same properties (\`${AUTOMATION_PROPERTIES.join('`, `')}\`). Add or remove \`<Properties>\` lines as you need, and check **Describe** first.

**Keys you'll see:**
- \`ObjectID\`: the GUID used by Perform (start), Update, and Schedule (pause)
- \`CustomerKey\`: the external key shown in the UI
- \`ProgramID\`: a read-only identifier for the automation. The official example filters on it.`,
  [
    retrieveRequest({
      name: 'List all automations',
      objectType: 'Automation',
      properties: AUTOMATION_PROPERTIES,
      filter: simpleFilterPart('Status', 'IN', AUTOMATION_STATUS_CODES),
      description: `Returns every automation in the current BU.

**Why a filter on a "list all" call?** Automation retrieves don't reliably return results without a filter, so this one uses \`Status IN (-1…8)\`, which covers every status code.

**Paging:** large accounts return \`MoreDataAvailable\`. Run **Pagination > Continue a retrieve** until \`OverallStatus\` is \`OK\`.

**Tip:** sort by \`StatusLabel\` in the Visualize tab to spot failed (\`Error\`) or \`Paused\` automations.`,
    }),
    retrieveRequest({
      name: 'Get automation by name',
      objectType: 'Automation',
      properties: AUTOMATION_PROPERTIES,
      filter: simpleFilterPart('Name', 'equals', '{{automationName}}'),
      description: `Exact-match lookup on the automation name, as shown in Automation Studio.

**Variable:** \`automationName\`.

Names aren't guaranteed to be unique. If you get more than one result, use \`CustomerKey\` or \`ObjectID\` to tell them apart. The response \`ObjectID\` is the value to put in \`automationObjectId\` for the *Actions* folder.`,
    }),
    retrieveRequest({
      name: 'Search automations by name (like)',
      objectType: 'Automation',
      properties: AUTOMATION_PROPERTIES,
      filter: simpleFilterPart('Name', 'like', '{{automationNamePattern}}'),
      description: `Wildcard search on the name, using \`%\` as the wildcard.

**Variable:** \`automationNamePattern\`. Examples:
- \`%Daily%\` matches names containing "Daily"
- \`ETL_%\` matches names starting with "ETL_"

Handy for naming-convention audits, such as listing every automation a team owns.`,
    }),
    retrieveRequest({
      name: 'Get automation by customer key',
      objectType: 'Automation',
      properties: AUTOMATION_PROPERTIES,
      filter: simpleFilterPart('CustomerKey', 'equals', '{{automationCustomerKey}}'),
      description: `Looks up one automation by its external key (\`CustomerKey\`). The key is unique within a BU, which makes it the most reliable lookup for scripts and deployments.

**Variable:** \`automationCustomerKey\`.`,
    }),
    retrieveRequest({
      name: 'Get automation by ProgramID',
      objectType: 'Automation',
      properties: AUTOMATION_PROPERTIES,
      filter: simpleFilterPart('ProgramID', 'equals', '{{automationProgramId}}'),
      description: `Follows the official Salesforce example, which filters on \`ProgramID\`. In that example's response, \`ProgramID\` and \`CustomerKey\` hold the same GUID, so try your automation's CustomerKey here if you don't have a ProgramID.

**Variable:** \`automationProgramId\`.

The example's response also includes \`AutomationTasks\` (steps and their activities). If your response includes them too, the Visualize tab shows the item count. Read the raw XML for the full step and activity tree.`,
    }),
    retrieveRequest({
      name: 'Running automations',
      objectType: 'Automation',
      properties: AUTOMATION_PROPERTIES,
      filter: simpleFilterPart('Status', 'equals', '3'),
      description: `Returns automations with \`Status = 3\` (running right now). Poll it to watch for long-running automations or to check before you deploy.`,
    }),
    retrieveRequest({
      name: 'Failed or errored automations',
      objectType: 'Automation',
      properties: AUTOMATION_PROPERTIES,
      filter: simpleFilterPart('Status', 'IN', ['-1', '0']),
      description: `Returns automations whose current status is **Error** (\`-1\`) or **failed while building** (\`0\`).

This reflects the *current* status only, not run history. An automation that failed yesterday and ran fine today won't show up. For step-level error detail, use the REST automation endpoints or the Automation Studio UI.`,
    }),
    retrieveRequest({
      name: 'Scheduled vs paused automations',
      objectType: 'Automation',
      properties: AUTOMATION_PROPERTIES,
      filter: simpleFilterPart('Status', 'IN', ['4', '5', '6']),
      description: `Returns automations that are **Paused** (4), **Stopped** (5), or **Scheduled** (6). Use it to audit which scheduled automations are actually active. Something that's meant to run daily but shows *Paused* is a common cause of missing data.`,
    }),
    retrieveRequest({
      name: 'Name pattern AND status (complex filter)',
      objectType: 'Automation',
      properties: AUTOMATION_PROPERTIES,
      filter: complexFilterPart(['Name', 'like', '{{automationNamePattern}}'], 'AND', ['Status', 'equals', '{{automationStatus}}']),
      description: `Shows how to write a \`ComplexFilterPart\`: two \`SimpleFilterPart\`s joined by \`AND\`.

**Variables:** \`automationNamePattern\` (for example \`%Daily%\`) and \`automationStatus\` (a status code, for example \`4\` for Paused).

To add a third condition, replace one operand with another \`ComplexFilterPart\` (set \`xsi:type="ComplexFilterPart"\` on the \`LeftOperand\`/\`RightOperand\` element).`,
    }),
    retrieveRequest({
      name: 'List automations in another business unit',
      objectType: 'Automation',
      properties: AUTOMATION_PROPERTIES,
      filter: simpleFilterPart('Status', 'IN', AUTOMATION_STATUS_CODES),
      clientIds: ['{{childMid}}'],
      description: `Same as *List all automations*, but scoped to the BU in \`<ClientIDs>\`.

**Variable:** \`childMid\`, the MID of the BU to query.

This only works when your token's user and package have access to that BU. If you get no results or a permission error, use the simpler route: set \`accountId\` in the environment to the child MID, clear \`accessToken\`, and run *List all automations*.`,
    }),
  ]
);

const runsFolder = folder(
  'Runs',
  `Status of a single automation run (\`AutomationInstance\`).

SFMC creates an \`AutomationInstance\` each time an automation runs, whether on a schedule or manually. The SOAP guide documents retrieving **one** instance by its ID. You get that ID back when you start the automation via SOAP (see *Actions > Start an automation now*).`,
  [
    retrieveRequest({
      name: 'Get a single automation run',
      objectType: 'AutomationInstance',
      properties: ['ProgramID', 'Status', 'Name', 'CreatedDate', 'ModifiedDate', 'CustomerKey', 'RecurrenceID', 'ClientID'],
      filter: simpleFilterPart('ProgramInstanceID', 'equals', '{{automationInstanceId}}'),
      description: `Retrieves the status of one automation run by \`ProgramInstanceID\`. The body follows Salesforce's documented example.

**Variable:** \`automationInstanceId\`. *Actions > Start an automation now* sets it automatically.

**Other properties to try** (from the AutomationInstance reference, check **Describe** first): \`StartTime\`, \`CompletedTime\`, \`StatusMessage\`, \`StatusLastUpdate\`. If one isn't retrievable, the whole call fails, so add them one at a time.

**Polling:** re-send it until \`Status\` stops changing, then read \`StatusMessage\` for the outcome.`,
    }),
  ]
);

const activitiesFolder = folder(
  'Activities',
  `Activity definitions that automations call and that the SOAP API can retrieve.

| Activity | SOAP object | Retrieve on SOAP? |
|---|---|---|
| SQL Query | \`QueryDefinition\` | Yes |
| Import File | \`ImportDefinition\` | Yes |
| Data Extract (definitions) | \`ExtractDefinition\` | Yes |
| File Drop trigger | \`FileTrigger\` | Yes |
| Data Extract activity | \`DataExtractActivity\` | No (Perform/Update only) |
| File Transfer | \`FileTransferActivity\` | No (Create/Perform only) |
| Script (SSJS) | none | No. Use REST \`/automation/v1/scripts\`. |

To see which automation uses an activity, retrieve the automation and look in its \`AutomationTasks > Activities\` for the activity's \`ObjectID\`.`,
  [
    retrieveRequest({
      name: 'List all SQL query activities',
      objectType: 'QueryDefinition',
      properties: [
        'Name',
        'CustomerKey',
        'ObjectID',
        'Description',
        'QueryText',
        'TargetType',
        'TargetUpdateType',
        'DataExtensionTarget.Name',
        'DataExtensionTarget.CustomerKey',
        'CategoryID',
        'CreatedDate',
        'ModifiedDate',
      ],
      filter: simpleFilterPart('Name', 'isNotNull', []),
      description: `Returns every SQL Query activity, with its SQL (\`QueryText\`) and target data extension.

**Fields:**
- \`TargetUpdateType\`: \`Overwrite\`, \`Update\`, or \`Append\`
- \`DataExtensionTarget.Name\` / \`.CustomerKey\`: the DE the query writes to
- \`CategoryID\`: the folder ID. Look it up with *Folders > Query activity folders*.

The \`Name isNotNull\` filter is a catch-all.

**Use cases:** search all SQL for a DE or field name before you change a schema, or export every query for code review. Save the response and grep the XML, or copy the Visualize table.`,
    }),
    retrieveRequest({
      name: 'Search SQL query activities by name',
      objectType: 'QueryDefinition',
      properties: ['Name', 'CustomerKey', 'ObjectID', 'QueryText', 'TargetUpdateType', 'DataExtensionTarget.Name', 'ModifiedDate'],
      filter: simpleFilterPart('Name', 'like', '{{queryNamePattern}}'),
      description: `Wildcard lookup on Query activity names.

**Variable:** \`queryNamePattern\` (for example \`%Sendable%\`).`,
    }),
    retrieveRequest({
      name: 'Get SQL query activity by customer key',
      objectType: 'QueryDefinition',
      properties: ['Name', 'CustomerKey', 'ObjectID', 'Description', 'QueryText', 'TargetType', 'TargetUpdateType', 'DataExtensionTarget.Name', 'DataExtensionTarget.CustomerKey', 'CategoryID', 'ModifiedDate'],
      filter: simpleFilterPart('CustomerKey', 'equals', '{{queryCustomerKey}}'),
      description: `Gets one Query activity by its external key, including its full SQL.

**Variable:** \`queryCustomerKey\`.`,
    }),
    retrieveRequest({
      name: 'List all import activities',
      objectType: 'ImportDefinition',
      properties: ['Name', 'CustomerKey', 'ObjectID', 'Description', 'FileSpec', 'FileType', 'UpdateType', 'AllowErrors', 'DestinationObject.ObjectID', 'FieldMappingType', 'ModifiedDate'],
      filter: simpleFilterPart('Name', 'isNotNull', []),
      description: `Returns every Import File activity.

**Fields:**
- \`FileSpec\`: the file name pattern the import picks up, often with date substitution strings such as \`%%Year%%\`
- \`UpdateType\`: \`AddAndUpdate\`, \`Overwrite\`, and so on
- \`DestinationObject.ObjectID\`: the target DE or list

If a property is rejected, run **Describe** with \`describeObjectType = ImportDefinition\` and remove it. Nested properties (\`DestinationObject.*\`) vary by account.`,
    }),
    retrieveRequest({
      name: 'List data extract definitions',
      objectType: 'ExtractDefinition',
      properties: ['Name', 'CustomerKey', 'ObjectID', 'CreatedDate', 'ModifiedDate'],
      filter: simpleFilterPart('Name', 'isNotNull', []),
      description: `Lists extract definitions, the templates that Data Extract activities are based on (for example *Data Extension Extract* and *Tracking Extract*).

The Data Extract **activities** in your automations can't be retrieved over SOAP. Use the REST automation endpoints to get their settings.`,
    }),
    retrieveRequest({
      name: 'List file drop triggers',
      objectType: 'FileTrigger',
      properties: ['Name', 'CustomerKey', 'ObjectID', 'FileName', 'IsActive', 'LastPullDate', 'Status', 'StatusMessage', 'Type', 'ModifiedDate'],
      filter: simpleFilterPart('Name', 'isNotNull', []),
      description: `Lists file-based triggers, the "File Drop" starting sources that run automations when a file lands on the Enhanced FTP.

**Fields:** \`FileName\` (the pattern watched for), \`IsActive\`, \`LastPullDate\` (when a file last fired the trigger), and \`Status\` / \`StatusMessage\`.

If a property is rejected, check **Describe** with \`describeObjectType = FileTrigger\`.`,
    }),
  ]
);

const foldersFolder = folder(
  'Folders',
  `Folder structure via \`DataFolder\`. Filter on \`ContentType\` to get the folder tree for one kind of asset, then rebuild the full paths from \`ID\` and \`ParentFolder.ID\`.

Content types for Automation Studio: \`automations\`, \`queryactivity\`, \`ssjsactivity\`, \`filteractivity\`.`,
  [
    retrieveRequest({
      name: 'Automation folders',
      objectType: 'DataFolder',
      properties: ['ID', 'Name', 'CustomerKey', 'ContentType', 'ParentFolder.ID', 'ParentFolder.Name', 'IsActive', 'ModifiedDate'],
      filter: simpleFilterPart('ContentType', 'equals', 'automations'),
      description: `Returns the folder tree under Automation Studio > Automations.

To build full paths, index the results by \`ID\` and walk \`ParentFolder.ID\` up to the root, where \`ParentFolder.ID\` is \`0\`.`,
    }),
    retrieveRequest({
      name: 'Query activity folders',
      objectType: 'DataFolder',
      properties: ['ID', 'Name', 'CustomerKey', 'ContentType', 'ParentFolder.ID', 'ParentFolder.Name', 'ModifiedDate'],
      filter: simpleFilterPart('ContentType', 'equals', 'queryactivity'),
      description: `Returns the folder tree for SQL Query activities. Match \`ID\` here to \`CategoryID\` on *Activities > List all SQL query activities* to put each query in its folder.`,
    }),
  ]
);

const paginationFolder = folder(
  'Pagination',
  'Fetch the next page of any Retrieve that returned `OverallStatus = MoreDataAvailable`.',
  [
    soapRequest({
      name: 'Continue a retrieve',
      action: 'Retrieve',
      body: envelope(
        [
          '<RetrieveRequestMsg xmlns="http://exacttarget.com/wsdl/partnerAPI">',
          '  <RetrieveRequest>',
          '    <ContinueRequest>{{continueRequestId}}</ContinueRequest>',
          '  </RetrieveRequest>',
          '</RetrieveRequestMsg>',
        ].join('\n')
      ),
      description: `Returns the next batch (up to 2,500 records) of an earlier Retrieve.

**How it works:**
1. Run any Retrieve. If the response says \`MoreDataAvailable\`, the collection test script saves its \`RequestID\` to \`continueRequestId\`.
2. Send this request. Each response that also says \`MoreDataAvailable\` updates \`continueRequestId\` again.
3. Repeat until \`OverallStatus\` is \`OK\`. The script then clears \`continueRequestId\`.

The body carries only \`ContinueRequest\`. SFMC remembers the object type, properties, and filter from the original request.

**Collection Runner tip:** for a full export, use \`postman.setNextRequest('Continue a retrieve')\` in a test script while \`continueRequestId\` is set.`,
    }),
  ]
);

const actionsFolder = folder(
  'Actions (change state)',
  `⚠️ **These requests change your tenant.** They start or pause real automations. They're here because starting an automation over SOAP is how you get an \`AutomationInstance\` ID for *Runs > Get a single automation run*.

They need **Automation > Automations: Execute** on the installed package, plus the **Automation | Automations | Execute** user permission.`,
  [
    soapRequest({
      name: 'Start an automation now',
      action: 'Perform',
      body: envelope(
        [
          '<PerformRequestMsg xmlns="http://exacttarget.com/wsdl/partnerAPI">',
          '  <Action>start</Action>',
          '  <Definitions>',
          '    <Definition xsi:type="Automation">',
          '      <ObjectID>{{automationObjectId}}</ObjectID>',
          '    </Definition>',
          '  </Definitions>',
          '</PerformRequestMsg>',
        ].join('\n')
      ),
      tests: performStartTests,
      description: `⚠️ **Starts the automation immediately.** It runs every step for real.

**Variable:** \`automationObjectId\`, the automation's \`ObjectID\` from any Automations request.

**After it runs:** the test script saves the returned ObjectID to \`automationInstanceId\`, so you can poll *Runs > Get a single automation run*.

Salesforce's guide recommends creating automations via SOAP if you plan to drive them with later API calls. Some UI-created automations may not accept every SOAP action.`,
    }),
    soapRequest({
      name: 'Pause a scheduled automation',
      action: 'Schedule',
      body: envelope(
        [
          '<ScheduleRequestMsg xmlns="http://exacttarget.com/wsdl/partnerAPI">',
          '  <Action>pause</Action>',
          '  <Schedule></Schedule>',
          '  <Interactions>',
          '    <Interaction xsi:type="Automation">',
          '      <ObjectID>{{automationObjectId}}</ObjectID>',
          '    </Interaction>',
          '  </Interactions>',
          '</ScheduleRequestMsg>',
        ].join('\n')
      ),
      description: `⚠️ **Pauses the automation's schedule.** It won't run again until someone reactivates it in Automation Studio.

**Variable:** \`automationObjectId\`.

Pause uses the \`Schedule\` method, not \`Perform\`. That's why the \`SOAPAction\` header and the body element differ from *Start*.`,
    }),
  ]
);

// ---------------------------------------------------------------------------
// Assemble
// ---------------------------------------------------------------------------

const collectionVariables = [
  ['authBaseUrl', 'https://{{subdomain}}.auth.marketingcloudapis.com/', 'Auth base URL. Built from `subdomain` in the environment.'],
  ['soapInstanceUrl', 'https://{{subdomain}}.soap.marketingcloudapis.com/', 'SOAP base URL. Overwritten from the token response.'],
  ['restInstanceUrl', 'https://{{subdomain}}.rest.marketingcloudapis.com/', 'REST base URL. Overwritten from the token response.'],
  ['accessToken', '', 'Set by the auth scripts. Clear it to force a new token.'],
  ['tokenExpiresAt', '0', 'Epoch ms when the token expires. Set by the auth scripts.'],
  ['describeObjectType', 'Automation', 'Object for Setup > Describe.'],
  ['automationName', 'My Automation', 'Exact automation name.'],
  ['automationNamePattern', '%Daily%', 'LIKE pattern, % is the wildcard.'],
  ['automationCustomerKey', '', 'Automation external key.'],
  ['automationProgramId', '', 'Automation ProgramID.'],
  ['automationStatus', '4', 'Status code for the complex filter example.'],
  ['automationObjectId', '', 'Automation ObjectID for the Actions folder.'],
  ['automationInstanceId', '', 'ProgramInstanceID of one run. Set by Start.'],
  ['childMid', '', 'Child BU MID for the ClientIDs example.'],
  ['queryNamePattern', '%', 'LIKE pattern for Query activity names.'],
  ['queryCustomerKey', '', 'Query activity external key.'],
  ['continueRequestId', '', 'Set automatically when a Retrieve returns MoreDataAvailable.'],
  ['lastRequestId', '', 'RequestID of the last SOAP response.'],
].map(([key, value, description]) => ({ key, value, type: 'string', description }));

const collection = {
  info: {
    _postman_id: '6f0c6d0e-6b8e-4b9e-9a3e-3a0f2e5c9b41',
    name: 'SFMC SOAP: Automations',
    description: collectionDescription,
    schema: 'https://schema.getpostman.com/json/collection/v2.1.0/collection.json',
  },
  item: [setupFolder, automationsFolder, runsFolder, activitiesFolder, foldersFolder, paginationFolder, actionsFolder],
  event: [
    { listen: 'prerequest', script: { type: 'text/javascript', exec: collectionPreRequest.split('\n') } },
    { listen: 'test', script: { type: 'text/javascript', exec: collectionTests.split('\n') } },
  ],
  variable: collectionVariables,
};

const environment = {
  id: '0d8f3c52-6a1e-4c7b-8a55-2f1d7e9b6c10',
  name: 'SFMC SOAP',
  values: [
    { key: 'subdomain', value: 'YOUR_SUBDOMAIN', type: 'default', enabled: true },
    { key: 'clientId', value: '', type: 'default', enabled: true },
    { key: 'clientSecret', value: '', type: 'secret', enabled: true },
    { key: 'accountId', value: '', type: 'default', enabled: true },
  ],
  _postman_variable_scope: 'environment',
};

mkdirSync(outDir, { recursive: true });
writeFileSync(collectionPath, JSON.stringify(collection, null, 2) + '\n');
writeFileSync(environmentPath, JSON.stringify(environment, null, 2) + '\n');

const requestCount = collection.item.reduce((n, f) => n + f.item.length, 0);
console.log(`Wrote ${collectionPath} (${collection.item.length} folders, ${requestCount} requests).`);
console.log(`Wrote ${environmentPath}.`);
