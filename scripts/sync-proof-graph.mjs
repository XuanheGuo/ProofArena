import fs from 'node:fs';
import path from 'node:path';
import { createClient } from '@supabase/supabase-js';

const ROOT = process.cwd();
const TARGET_PROBLEM_IDS = ['tj-2026-09', 'ng1-2026-18', 'ng2-2026-18'];

function loadEnvFile(filePath) {
  if (!fs.existsSync(filePath)) return {};
  const env = {};
  for (const line of fs.readFileSync(filePath, 'utf8').split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const match = trimmed.match(/^([A-Za-z_][A-Za-z0-9_]*)=(.*)$/);
    if (!match) continue;
    const [, key, rawValue] = match;
    env[key] = rawValue.replace(/^['"]|['"]$/g, '');
  }
  return env;
}

function findMatchingBrace(source, startIndex) {
  let depth = 0;
  let quote = null;
  let escaped = false;

  for (let i = startIndex; i < source.length; i += 1) {
    const char = source[i];

    if (quote) {
      if (escaped) {
        escaped = false;
      } else if (char === '\\') {
        escaped = true;
      } else if (char === quote) {
        quote = null;
      }
      continue;
    }

    if (char === '"' || char === "'" || char === '`') {
      quote = char;
      continue;
    }

    if (char === '{') depth += 1;
    if (char === '}') {
      depth -= 1;
      if (depth === 0) return i;
    }
  }

  throw new Error(`Could not find matching brace from index ${startIndex}`);
}

function extractObjectAfter(source, marker, afterIndex = 0) {
  const markerIndex = source.indexOf(marker, afterIndex);
  if (markerIndex === -1) throw new Error(`Marker not found: ${marker}`);
  const start = source.indexOf('{', markerIndex);
  if (start === -1) throw new Error(`Object start not found after marker: ${marker}`);
  const end = findMatchingBrace(source, start);
  return { text: source.slice(start, end + 1), end };
}

function extractProofGraph(source, problemId) {
  const problemMarker = `id: "${problemId}"`;
  const markerIndex = source.indexOf(problemMarker);
  if (markerIndex === -1) throw new Error(`Problem id not found: ${problemId}`);
  const problemStart = source.lastIndexOf('\n  {', markerIndex);
  if (problemStart === -1) throw new Error(`Problem object start not found: ${problemId}`);
  const problemEnd = findMatchingBrace(source, problemStart + 3);
  const problemObject = { text: source.slice(problemStart + 3, problemEnd + 1) };
  const proofGraph = extractObjectAfter(problemObject.text, 'proofGraph:');
  // The proofGraph blocks are plain object literals: strings, arrays, and nested objects only.
  // They intentionally do not evaluate the full data file or import project code.
  return Function(`"use strict"; return (${proofGraph.text});`)();
}

async function main() {
  const env = { ...process.env, ...loadEnvFile(path.join(ROOT, '.env.local')) };
  const supabaseUrl = env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in environment/.env.local');
  }

  const source = fs.readFileSync(path.join(ROOT, 'data/problems.ts'), 'utf8');
  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  for (const problemId of TARGET_PROBLEM_IDS) {
    const proofGraph = extractProofGraph(source, problemId);
    const { error } = await supabase
      .from('problems')
      .update({ proof_graph: proofGraph })
      .eq('id', problemId);

    if (error) throw new Error(`${problemId}: ${error.message}`);

    console.log(`${problemId}: proof_graph synced`);
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
