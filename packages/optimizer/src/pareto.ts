/**
 * PromptDial 2.0 - Pareto Optimization Engine
 *
 * Implements multi-objective optimization for prompt variants
 */

import { createLogger } from '@promptdial/shared'

import {
  ParetoSolution,
  OptimizationObjective,
  OptimizationPreferences,
  OptimizationConstraints,
  TradeOffAnalysis,
} from './types'

const logger = createLogger('pareto-optimizer')

export class ParetoOptimizer {
  /**
   * Check if solution A dominates solution B
   * A dominates B if A is no worse than B in all objectives and better in at least one
   */
  dominates(a: ParetoSolution, b: ParetoSolution): boolean {
    let betterInOne = false
    let worseInOne = false

    // For quality: higher is better
    if (a.objectives.quality > b.objectives.quality) {
      betterInOne = true
    } else if (a.objectives.quality < b.objectives.quality) {
      worseInOne = true
    }

    // For cost: lower is better
    if (a.objectives.cost < b.objectives.cost) {
      betterInOne = true
    } else if (a.objectives.cost > b.objectives.cost) {
      worseInOne = true
    }

    // For latency: lower is better
    if (a.objectives.latency < b.objectives.latency) {
      betterInOne = true
    } else if (a.objectives.latency > b.objectives.latency) {
      worseInOne = true
    }

    // A dominates B if it's better in at least one objective and not worse in any
    return betterInOne && !worseInOne
  }

  /**
   * Find the Pareto frontier from a set of solutions
   */
  findParetoFrontier(solutions: ParetoSolution[]): ParetoSolution[] {
    if (solutions.length === 0) return []
    if (solutions.length === 1) return solutions

    const frontier: ParetoSolution[] = []

    // For each solution, check if it's dominated by any other
    for (const candidate of solutions) {
      let isDominated = false

      for (const other of solutions) {
        if (candidate !== other && this.dominates(other, candidate)) {
          isDominated = true
          break
        }
      }

      if (!isDominated) {
        frontier.push(candidate)
      }
    }

    // Sort frontier by quality for consistent ordering
    frontier.sort((a, b) => b.objectives.quality - a.objectives.quality)

    logger.info(
      `Found Pareto frontier with ${frontier.length} solutions out of ${solutions.length}`,
    )

    return frontier
  }

  /**
   * Select best solution based on user preferences
   */
  selectByPreference(
    solutions: ParetoSolution[],
    preferences: OptimizationPreferences,
  ): ParetoSolution {
    // Normalize preferences
    const total = preferences.quality + preferences.cost + preferences.latency
    const weights = {
      quality: preferences.quality / total,
      cost: preferences.cost / total,
      latency: preferences.latency / total,
    }

    let bestSolution = solutions[0]
    let bestUtility = this.calculateUtility(solutions[0], weights)

    for (const solution of solutions.slice(1)) {
      const utility = this.calculateUtility(solution, weights)
      if (utility > bestUtility) {
        bestUtility = utility
        bestSolution = solution
      }
    }

    logger.info(
      `Selected variant ${bestSolution.variant_id} with utility ${bestUtility.toFixed(3)}`,
    )

    return bestSolution
  }

  /**
   * Calculate utility score for a solution given weights
   */
  calculateUtility(solution: ParetoSolution, weights: OptimizationPreferences): number {
    // Quality: higher is better (use as-is)
    const qualityUtil = solution.objectives.quality * weights.quality

    // Cost: lower is better (invert)
    const costUtil = (1 - solution.objectives.cost) * weights.cost

    // Latency: lower is better (invert)
    const latencyUtil = (1 - solution.objectives.latency) * weights.latency

    return qualityUtil + costUtil + latencyUtil
  }

  /**
   * Apply constraints to filter solutions
   */
  applyConstraints(
    solutions: ParetoSolution[],
    constraints: OptimizationConstraints,
  ): ParetoSolution[] {
    return solutions.filter((solution) => {
      if (
        constraints.min_quality !== undefined &&
        solution.objectives.quality < constraints.min_quality
      ) {
        return false
      }

      if (constraints.max_cost !== undefined && solution.objectives.cost > constraints.max_cost) {
        return false
      }

      if (
        constraints.max_latency !== undefined &&
        solution.objectives.latency > constraints.max_latency
      ) {
        return false
      }

      return true
    })
  }

  /**
   * Analyze trade-offs between solutions
   */
  analyzeTradeOffs(from: ParetoSolution, to: ParetoSolution): TradeOffAnalysis {
    const qualityChange = to.objectives.quality - from.objectives.quality
    const costChange = to.objectives.cost - from.objectives.cost
    const latencyChange = to.objectives.latency - from.objectives.latency

    // Generate recommendation
    const improvements: string[] = []
    const degradations: string[] = []

    if (qualityChange > 0.05) {
      improvements.push(`${(qualityChange * 100).toFixed(1)}% better quality`)
    } else if (qualityChange < -0.05) {
      degradations.push(`${(-qualityChange * 100).toFixed(1)}% worse quality`)
    }

    if (costChange < -0.05) {
      improvements.push(`${(-costChange * 100).toFixed(1)}% cheaper`)
    } else if (costChange > 0.05) {
      degradations.push(`${(costChange * 100).toFixed(1)}% more expensive`)
    }

    if (latencyChange < -0.05) {
      improvements.push(`${(-latencyChange * 100).toFixed(1)}% faster`)
    } else if (latencyChange > 0.05) {
      degradations.push(`${(latencyChange * 100).toFixed(1)}% slower`)
    }

    let recommendation = ''
    if (improvements.length > 0 && degradations.length === 0) {
      recommendation = `Strongly recommended: ${improvements.join(', ')}`
    } else if (improvements.length > degradations.length) {
      recommendation = `Recommended: ${improvements.join(', ')} but ${degradations.join(', ')}`
    } else if (improvements.length === degradations.length) {
      recommendation = `Trade-off: ${improvements.join(', ')} vs ${degradations.join(', ')}`
    } else {
      recommendation = `Not recommended: ${degradations.join(', ')}`
    }

    return {
      from_variant: from.variant_id,
      to_variant: to.variant_id,
      quality_change: qualityChange,
      cost_change: costChange,
      latency_change: latencyChange,
      recommendation,
    }
  }

  /**
   * Find knee point on Pareto frontier (best compromise solution)
   */
  findKneePoint(frontier: ParetoSolution[]): ParetoSolution {
    if (frontier.length === 1) return frontier[0]

    // Normalize objectives to 0-1 range
    const normalized = this.normalizeObjectives(frontier)

    // Find solution closest to ideal point (1, 0, 0) in normalized space
    let bestSolution = frontier[0]
    let bestDistance = Infinity

    for (let i = 0; i < frontier.length; i++) {
      const norm = normalized[i]
      // Distance to ideal point (max quality, min cost, min latency)
      const distance = Math.sqrt(
        Math.pow(1 - norm.objectives.quality, 2) +
          Math.pow(norm.objectives.cost, 2) +
          Math.pow(norm.objectives.latency, 2),
      )

      if (distance < bestDistance) {
        bestDistance = distance
        bestSolution = frontier[i]
      }
    }

    logger.info(`Knee point: ${bestSolution.variant_id} with distance ${bestDistance.toFixed(3)}`)

    return bestSolution
  }

  /**
   * Normalize objectives across solutions
   */
  private normalizeObjectives(solutions: ParetoSolution[]): ParetoSolution[] {
    if (solutions.length === 0) return []

    // Find min/max for each objective
    let minQuality = Infinity,
      maxQuality = -Infinity
    let minCost = Infinity,
      maxCost = -Infinity
    let minLatency = Infinity,
      maxLatency = -Infinity

    for (const sol of solutions) {
      minQuality = Math.min(minQuality, sol.objectives.quality)
      maxQuality = Math.max(maxQuality, sol.objectives.quality)
      minCost = Math.min(minCost, sol.objectives.cost)
      maxCost = Math.max(maxCost, sol.objectives.cost)
      minLatency = Math.min(minLatency, sol.objectives.latency)
      maxLatency = Math.max(maxLatency, sol.objectives.latency)
    }

    // Normalize each solution
    return solutions.map((sol) => ({
      ...sol,
      objectives: {
        quality:
          maxQuality > minQuality
            ? (sol.objectives.quality - minQuality) / (maxQuality - minQuality)
            : sol.objectives.quality,
        cost:
          maxCost > minCost
            ? (sol.objectives.cost - minCost) / (maxCost - minCost)
            : sol.objectives.cost,
        latency:
          maxLatency > minLatency
            ? (sol.objectives.latency - minLatency) / (maxLatency - minLatency)
            : sol.objectives.latency,
      },
    }))
  }
}
