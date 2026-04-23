/**
 * BetPulse Overround Algorithm
 *
 * The overround (or "vig/juice") ensures the platform always profits.
 * When true probabilities sum to 100%, the bookmaker sets odds so that
 * implied probabilities sum to 107-110%, creating a guaranteed margin.
 *
 * Overround % = (sum of implied probs - 1) * 100
 * Implied prob for odds X = 1 / X
 *
 * Example:
 *   True probs: Home 45%, Draw 27%, Away 28% (sum = 100%)
 *   With 7% overround: Home 48.2%, Draw 28.9%, Away 30% (sum = 107%)
 *   Bookmaker odds: Home 2.07, Draw 3.46, Away 3.33
 */

export function calcOverround(oddsHome: number, oddsDraw: number, oddsAway: number): number {
  const implied = 1 / oddsHome + 1 / oddsDraw + 1 / oddsAway;
  return Math.round((implied - 1) * 10000) / 100;
}

export function calcImplied(odds: number): number {
  return Math.round((1 / odds) * 10000) / 100;
}

/**
 * Apply house margin to a set of true probabilities.
 * Returns decimal odds with ~7% overround baked in.
 */
export function applyMargin(
  trueHomePct: number,
  trueDrawPct: number,
  trueAwayPct: number,
  marginPct = 7,
): { oddsHome: number; oddsDraw: number; oddsAway: number } {
  const factor = 1 + marginPct / 100;
  const oddsHome = Math.round((factor / (trueHomePct / 100)) * 100) / 100;
  const oddsDraw = Math.round((factor / (trueDrawPct / 100)) * 100) / 100;
  const oddsAway = Math.round((factor / (trueAwayPct / 100)) * 100) / 100;
  return { oddsHome, oddsDraw, oddsAway };
}
