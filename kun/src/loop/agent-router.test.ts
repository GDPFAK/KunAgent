import { describe, expect, it } from 'vitest'
import {
  heuristicAgentRole,
  scoredHeuristicAgentRole,
  detectRoleSwitchIntent,
  autoModelHeuristic,
  AUTO_MODEL_FLASH,
  AUTO_MODEL_PRO,
  parseAgentRouteRecommendation
} from './agent-router.js'

describe('scoredHeuristicAgentRole', () => {
  it('includes scores for all roles', () => {
    const result = scoredHeuristicAgentRole('fix the login bug')
    expect(result.role).toBe('coder')
    expect(result.scores).toBeDefined()
    expect(Object.keys(result.scores).length).toBe(7) // all 7 roles scored
  })

  it('decides planner over coder with mixed keywords when plan dominates', () => {
    // Both coder and planner keywords match; 'plan' is specific to planner role
    const result = scoredHeuristicAgentRole('plan and implement the new auth feature')
    expect(result.role).toBe('planner')
    expect(result.scores['planner']!).toBeGreaterThan(0)
  })

  it('decides reviewer over coder when review dominates', () => {
    const result = scoredHeuristicAgentRole('review the code quality for security issues')
    expect(result.role).toBe('reviewer')
  })

  it('gives all roles score 0 for gibberish and defaults to coder', () => {
    const result = scoredHeuristicAgentRole('!@#$%^&*()')
    expect(result.role).toBe('coder') // default fallback
  })

  it('handles empty string gracefully', () => {
    const result = scoredHeuristicAgentRole('')
    expect(result.role).toBe('coder')
  })

  it('confidence is capped at 1.0', () => {
    // Multiple matches should push score above 1.0, but it should cap
    const result = scoredHeuristicAgentRole('fix implement build create write debug test error bug refactor')
    expect(result.confidence).toBeLessThanOrEqual(1.0)
  })
})

describe('heuristicAgentRole', () => {
  it('returns coder for coding tasks', () => {
    const result = heuristicAgentRole('implement user authentication')
    expect(result.role).toBe('coder')
    expect(result.confidence).toBeGreaterThanOrEqual(0.7)
  })

  it('returns coder for debug tasks', () => {
    const result = heuristicAgentRole('fix the login bug')
    expect(result.role).toBe('coder')
  })

  it('returns planner for planning tasks', () => {
    const result = heuristicAgentRole('plan the architecture for the new feature')
    expect(result.role).toBe('planner')
    expect(result.confidence).toBeGreaterThanOrEqual(0.8)
  })

  it('returns reviewer for review tasks', () => {
    const result = heuristicAgentRole('review the code changes in this PR')
    expect(result.role).toBe('reviewer')
    expect(result.confidence).toBeGreaterThanOrEqual(0.85)
  })

  it('returns researcher for investigation tasks', () => {
    const result = heuristicAgentRole('find where the API endpoint is defined')
    expect(result.role).toBe('researcher')
  })

  it('returns title for short title generation', () => {
    const result = heuristicAgentRole('title')
    expect(result.role).toBe('title')
    expect(result.confidence).toBeGreaterThanOrEqual(0.9)
  })

  it('returns summarizer for summarization tasks', () => {
    const result = heuristicAgentRole('summarize the conversation so far')
    expect(result.role).toBe('summarizer')
    expect(result.confidence).toBeGreaterThanOrEqual(0.85)
  })

  it('returns explore for short exploration questions', () => {
    const result = heuristicAgentRole('where are the config files')
    expect(result.role).toBe('explore')
  })

  it('defaults to coder with low confidence for unclear input', () => {
    const result = heuristicAgentRole('hello world')
    expect(result.role).toBe('coder')
    expect(result.confidence).toBeLessThan(0.6)
  })
})

describe('detectRoleSwitchIntent', () => {
  it('detects valid role switch', () => {
    const result = detectRoleSwitchIntent('Let me switch to review mode [switch_role: reviewer]')
    expect(result).not.toBeNull()
    expect(result!.role).toBe('reviewer')
    expect(result!.cleanText).toBe('Let me switch to review mode')
  })

  it('returns null for text without switch', () => {
    expect(detectRoleSwitchIntent('plain text')).toBeNull()
  })

  it('handles invalid role id gracefully', () => {
    expect(detectRoleSwitchIntent('[switch_role: invalid_role]')).toBeNull()
  })
})

describe('autoModelHeuristic', () => {
  it('returns flash for short trivial input', () => {
    expect(autoModelHeuristic('hello')).toBe(AUTO_MODEL_FLASH)
  })

  it('returns pro for complex keywords', () => {
    expect(autoModelHeuristic('refactor the auth module')).toBe(AUTO_MODEL_PRO)
    expect(autoModelHeuristic('design the database schema')).toBe(AUTO_MODEL_PRO)
    expect(autoModelHeuristic('implement the new feature')).toBe(AUTO_MODEL_PRO)
    expect(autoModelHeuristic('analyze the performance issue')).toBe(AUTO_MODEL_PRO)
  })

  it('returns pro for long input', () => {
    const longInput = 'x'.repeat(600)
    expect(autoModelHeuristic(longInput)).toBe(AUTO_MODEL_PRO)
  })

  it('returns flash for medium-length non-coding input', () => {
    const mediumInput = 'x'.repeat(200)
    expect(autoModelHeuristic(mediumInput)).toBe(AUTO_MODEL_FLASH)
  })
})

describe('parseAgentRouteRecommendation', () => {
  it('parses valid JSON with role, model, and thinking', () => {
    const result = parseAgentRouteRecommendation(
      '{"role":"coder","model":"deepseek-v4-pro","thinking":"max"}'
    )
    expect(result).not.toBeNull()
    expect(result!.role).toBe('coder')
    expect(result!.model).toBe(AUTO_MODEL_PRO)
    expect(result!.reasoningEffort).toBe('max')
  })

  it('parses JSON with reasoning_effort field', () => {
    const result = parseAgentRouteRecommendation(
      '{"role":"reviewer","model":"deepseek-v4-flash","reasoning_effort":"high"}'
    )
    expect(result).not.toBeNull()
    expect(result!.role).toBe('reviewer')
    expect(result!.reasoningEffort).toBe('high')
  })

  it('returns null for invalid JSON', () => {
    expect(parseAgentRouteRecommendation('not json')).toBeNull()
    expect(parseAgentRouteRecommendation('')).toBeNull()
  })

  it('returns null for missing model field', () => {
    expect(parseAgentRouteRecommendation('{"role":"coder"}')).toBeNull()
  })

  it('extracts first JSON object from surrounding text', () => {
    const result = parseAgentRouteRecommendation(
      'Some text before {"role":"planner","model":"deepseek-v4-pro"} and after'
    )
    expect(result).not.toBeNull()
    expect(result!.role).toBe('planner')
  })

  it('returns partial result with role undefined when role is missing', () => {
    const result = parseAgentRouteRecommendation(
      '{"model":"deepseek-v4-flash","thinking":"off"}'
    )
    expect(result).not.toBeNull()
    expect(result!.role).toBeUndefined()
    expect(result!.model).toBe(AUTO_MODEL_FLASH)
    expect(result!.reasoningEffort).toBe('off')
  })
})
