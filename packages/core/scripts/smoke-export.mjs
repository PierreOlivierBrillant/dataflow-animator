import schema from '../dist/schema.json' with { type: 'json' };

const titleOk = schema.title === 'DataFlowSpec';
const defCount = Object.keys(schema.definitions ?? {}).length;
const defsOk = defCount > 5;

if (!titleOk || !defsOk) {
  console.error(`smoke-export FAILED: title=${schema.title}, definitions=${defCount}`);
  process.exit(1);
}

console.log(`smoke-export OK: title="${schema.title}", definitions=${defCount}`);
