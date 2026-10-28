import fs from 'node:fs';
import { parseArgs } from 'node:util';
import { createRecord, appendTurn, readRecords, pendingRecords, applyTags } from '../lib/records.mjs';

const { positionals, values } = parseArgs({ allowPositionals: true, options: {
  input: { type: 'string' }, id: { type: 'string' }, stdin: { type: 'boolean' },
} });
function input() {
  if (!values.input && !values.stdin) throw new Error('请指定 --input 文件.json 或 --stdin');
  return JSON.parse(fs.readFileSync(values.stdin ? 0 : values.input, 'utf8').replace(/^\uFEFF/, ''));
}
try {
  let result;
  switch (positionals[0]) {
    case 'add': result = createRecord(input()); break;
    case 'append': result = appendTurn(values.id, input()); break;
    case 'pending': result = pendingRecords(); break;
    case 'tags': result = { updated: applyTags(input()) }; break;
    case 'validate': {
      const records = readRecords();
      result = { valid: true, questions: records.filter(record => !record.data.demo).length, examples: records.filter(record => record.data.demo).length };
      break;
    }
    default: throw new Error('用法：journal add|append|pending|tags|validate [--input file.json] [--id id]');
  }
  process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
} catch (error) {
  process.stderr.write(`${error.message}\n`);
  process.exitCode = 1;
}
