export { ContextCompiler } from './context-compiler.js'
export type { ContextCompilerOptions } from './context-compiler.js'

export {
  extractFactAnchorsFromTurn,
  extractDecisionStatements,
  mergeFactAnchors,
  formatFactAnchors,
} from './fact-anchor.js'
export type {
  FactAnchor,
  FactAnchorStatus,
  FactAnchorCategory,
  FactAnchorExtractOptions,
} from './fact-anchor.js'

export {
  isolateCurrentTurn,
  groupItemsByTurn,
  listTurnIds,
  generateTurnBoundaryId,
  verifyTurnIsolation,
  detectContextLeakage,
} from './turn-isolation.js'
export type { TurnIsolationResult, TurnIsolationOptions } from './turn-isolation.js'

export {
  stablePrefixFromImmutable,
} from './stable-prefix.js'
export type {
  StablePrefixComponents,
  StablePrefixBuildOptions,
} from './stable-prefix.js'
