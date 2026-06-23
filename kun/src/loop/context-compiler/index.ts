export { ContextCompiler } from './context-compiler.js'
export type { CompiledContext, ContextCompilerOptions } from './context-compiler.js'

export {
  extractFactAnchorsFromTurn,
  extractDecisionStatements,
  mergeFactAnchors,
  formatFactAnchors,
  fingerprintFactAnchors,
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
  createTurnBoundaryMarker,
  generateTurnBoundaryId,
  verifyTurnIsolation,
  detectContextLeakage,
} from './turn-isolator.js'
export type { TurnIsolationResult, TurnIsolationOptions } from './turn-isolator.js'

export {
  buildStablePrefix,
  rebuildStablePrefix,
  stablePrefixFromImmutable,
  detectPrefixChanges,
  stablePrefixByteSize,
} from './stable-prefix.js'
export type {
  StablePrefix,
  StablePrefixComponents,
  StablePrefixBuildOptions,
} from './stable-prefix.js'
