/**
 * The structured shape-operation interface. The AI Rail emits these as JSON,
 * the inspector commits them, and the executor wraps each batch in one undo group.
 */
export { ShapeOpSchema } from './shape-ops/schema'
export type { ExecuteOpsOptions, ExecuteResult, OpError, ShapeOp } from './shape-ops/schema'
export { executeOps } from './shape-ops/executor'
