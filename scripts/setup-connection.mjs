#!/usr/bin/env node
import { createInterface } from 'node:readline';
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const configPath = resolve(here, '..', 'sfmc-connection.config.json');

const FIELDS = [
  {
    key: 'clientId',
    label: 'Client Id',
    secret: false,
    hint: 'From your SFMC installed package credentials tab',
  },
  {
    key: 'clientSecret',
    label: 'Client Secret',
    secret: true,
    hint: 'From your SFMC installed package credentials tab',
  },
  {
    key: 'authBaseUri',
    label: 'Authentication Base URI',
    secret: false,
    hint: 'e.g. https://YOUR_SUBDOMAIN.auth.marketingcloudapis.com/',
  },
  {
    key: 'restBaseUri',
    label: 'REST Base URI',
    secret: false,
    hint: 'e.g. https://YOUR_SUBDOMAIN.rest.marketingcloudapis.com/',
  },
  {
    key: 'soapBaseUri',
    label: 'SOAP Base URI',
    secret: false,
    hint: 'e.g. https://YOUR_SUBDOMAIN.soap.marketingcloudapis.com/',
  },
];

function loadExisting() {
  if (!existsSync(configPath)) return {};
  try {
    return JSON.parse(readFileSync(configPath, 'utf8'));
  } catch (err) {
    console.error(`Error: sfmc-connection.config.json exists but could not be parsed: ${err.message}`);
    console.error('Fix or delete the file before running setup again.');
    process.exit(1);
  }
}

function prompt(rl, question) {
  return new Promise((resolve) => rl.question(question, resolve));
}

function promptSecret(rl, question) {
  return new Promise((resolve) => {
    process.stdout.write(question);
    const origWrite = rl.output.write.bind(rl.output);
    rl.output.write = () => {};
    rl.question('', (answer) => {
      rl.output.write = origWrite;
      process.stdout.write('\n');
      resolve(answer);
    });
  });
}

async function main() {
  const existing = loadExisting();
  const isUpdate = Object.keys(existing).length > 0;

  console.log('\nSFMC Connection Setup');
  console.log('=====================');
  if (isUpdate) {
    console.log('Existing configuration found. Press Enter to keep current values.\n');
  } else {
    console.log('No configuration found. Enter your SFMC instance credentials.\n');
  }

  const rl = createInterface({ input: process.stdin, output: process.stdout });
  const config = { ...existing };

  for (const field of FIELDS) {
    const current = existing[field.key];
    let currentDisplay = '';
    if (current) {
      currentDisplay = field.secret ? ' [currently set — hidden]' : ` [current: ${current}]`;
    }

    const question = `${field.label}${currentDisplay}\n  (${field.hint})\n  > `;
    const answer = field.secret
      ? await promptSecret(rl, question)
      : await prompt(rl, question);
    const value = answer.trim();

    if (value) {
      config[field.key] = value;
    } else if (!current) {
      console.log(`  Warning: ${field.label} left empty.\n`);
    } else {
      console.log(`  Keeping existing value.\n`);
    }
  }

  rl.close();

  const missing = FIELDS.filter((f) => !config[f.key]).map((f) => f.label);
  if (missing.length > 0) {
    console.log(`\nWarning: the following fields are not set: ${missing.join(', ')}`);
  }

  writeFileSync(configPath, JSON.stringify(config, null, 2) + '\n', 'utf8');
  console.log(`\nConfiguration saved to sfmc-connection.config.json`);

  if (missing.length === 0) {
    console.log('All fields are configured. Your agent is ready to connect to SFMC.\n');
  } else {
    console.log('Run `npm run setup` again to fill in the missing fields.\n');
  }
}

main().catch((err) => {
  console.error(err.message);
  process.exit(1);
});
