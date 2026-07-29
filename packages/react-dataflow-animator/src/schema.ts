import schemaJson from '@dataflow-animator/core/schema.generated.json';

/**
 * JSON Schema (draft-07) of the DataFlow specification.
 * Automatically generated from types.ts by scripts/generate-schema.mjs.
 * DO NOT MODIFY BY HAND — run `npm run generate:schema` instead.
 *
 * The schema JSON is owned by the framework-agnostic core workspace; this thin
 * module stays in the package so the published bundle keeps inlining the schema
 * at the same module boundary (`src/schema.ts`).
 */
export const dataFlowSchema = schemaJson;
export type DataFlowSchema = typeof dataFlowSchema;
