/**
 * Score parser stub for Phase 2 SMS integration
 * This module will parse SMS text messages containing match scores
 */

export interface ParsedScore {
  player1Name?: string;
  player2Name?: string;
  player1Score?: number;
  player2Score?: number;
  winnerName?: string;
  confidence: 'high' | 'medium' | 'low';
  error?: string;
}

/**
 * Parse score text from SMS message
 * Phase 1: Stub implementation - returns mock data
 * Phase 2: Will implement actual NLP parsing
 */
export function parseScoreText(text: string): ParsedScore {
  // Basic pattern matching for common formats
  // Examples: "John 9 Sarah 4", "Mike beat Lisa 7-2", "Won 9-5"

  // Try pattern: "Name Score Name Score"
  const pattern1 = /(\w+)\s+(\d+)\s+(\w+)\s+(\d+)/i;
  const match1 = text.match(pattern1);

  if (match1) {
    const [, name1, score1, name2, score2] = match1;
    const s1 = parseInt(score1);
    const s2 = parseInt(score2);

    return {
      player1Name: name1,
      player2Name: name2,
      player1Score: s1,
      player2Score: s2,
      winnerName: s1 > s2 ? name1 : name2,
      confidence: 'high',
    };
  }

  // Try pattern: "Name beat/def Name Score-Score"
  const pattern2 = /(\w+)\s+(?:beat|def|defeated)\s+(\w+)\s+(\d+)-(\d+)/i;
  const match2 = text.match(pattern2);

  if (match2) {
    const [, winner, loser, score1, score2] = match2;
    return {
      player1Name: winner,
      player2Name: loser,
      player1Score: parseInt(score1),
      player2Score: parseInt(score2),
      winnerName: winner,
      confidence: 'high',
    };
  }

  // Try pattern: just scores "9-4" or "9 4"
  const pattern3 = /(\d+)\s*[-:]\s*(\d+)/;
  const match3 = text.match(pattern3);

  if (match3) {
    const [, score1, score2] = match3;
    return {
      player1Score: parseInt(score1),
      player2Score: parseInt(score2),
      confidence: 'medium',
    };
  }

  // Could not parse
  return {
    confidence: 'low',
    error: 'Could not parse score from text',
  };
}

/**
 * Validate parsed score against match requirements
 */
export function validateScore(
  parsed: ParsedScore,
  matchLength: number
): { valid: boolean; error?: string } {
  if (parsed.player1Score === undefined || parsed.player2Score === undefined) {
    return { valid: false, error: 'Could not determine both scores' };
  }

  const { player1Score, player2Score } = parsed;

  // One score must equal match length
  if (player1Score !== matchLength && player2Score !== matchLength) {
    return {
      valid: false,
      error: `One player must reach ${matchLength} points`,
    };
  }

  // Winner must have higher score
  if (player1Score === player2Score) {
    return { valid: false, error: 'Scores cannot be tied' };
  }

  // Scores must be positive
  if (player1Score < 0 || player2Score < 0) {
    return { valid: false, error: 'Scores must be positive' };
  }

  // Loser score must be less than match length
  const loserScore = Math.min(player1Score, player2Score);
  if (loserScore >= matchLength) {
    return { valid: false, error: 'Losing score must be less than match length' };
  }

  return { valid: true };
}
