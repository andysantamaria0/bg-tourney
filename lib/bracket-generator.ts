import type { Player, Match, Bracket } from './database.types';

interface BracketMatch {
  round_number: number;
  match_number: number;
  player1_id: string | null;
  player2_id: string | null;
  status: 'pending' | 'bye';
  winner_id: string | null;
}

/**
 * Calculate the number of rounds needed for a double elimination bracket
 */
export function calculateRounds(playerCount: number): number {
  if (playerCount <= 1) return 0;
  return Math.ceil(Math.log2(playerCount));
}

/**
 * Calculate the next power of 2 (for bracket sizing)
 */
function nextPowerOf2(n: number): number {
  return Math.pow(2, Math.ceil(Math.log2(n)));
}

/**
 * Shuffle an array using Fisher-Yates algorithm
 */
function shuffle<T>(array: T[]): T[] {
  const shuffled = [...array];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
}

/**
 * Generate round 1 matches for a main bracket
 * Handles byes when player count is not a power of 2
 */
export function generateRound1Matches(
  players: Player[],
  startingTableNumber: number = 1
): BracketMatch[] {
  const shuffledPlayers = shuffle(players);
  const bracketSize = nextPowerOf2(shuffledPlayers.length);
  const byeCount = bracketSize - shuffledPlayers.length;
  const matches: BracketMatch[] = [];

  // Players who get byes (highest seeds in a real tournament,
  // but we're using random seeding so just pick the first ones)
  const byePlayers = shuffledPlayers.slice(0, byeCount);
  const regularPlayers = shuffledPlayers.slice(byeCount);

  let matchNumber = 1;

  // Create bye matches first (these players auto-advance)
  for (const player of byePlayers) {
    matches.push({
      round_number: 1,
      match_number: matchNumber++,
      player1_id: player.id,
      player2_id: null,
      status: 'bye',
      winner_id: player.id, // Auto-win
    });
  }

  // Create regular matches
  for (let i = 0; i < regularPlayers.length; i += 2) {
    matches.push({
      round_number: 1,
      match_number: matchNumber++,
      player1_id: regularPlayers[i].id,
      player2_id: regularPlayers[i + 1]?.id || null,
      status: regularPlayers[i + 1] ? 'pending' : 'bye',
      winner_id: regularPlayers[i + 1] ? null : regularPlayers[i].id,
    });
  }

  return matches;
}

/**
 * Generate next round matches based on completed matches
 * Winners advance in their current bracket
 */
export function generateNextRoundMatches(
  completedMatches: Match[],
  currentRound: number,
  startingMatchNumber: number = 1
): BracketMatch[] {
  // Get winners from current round
  const winners = completedMatches
    .filter(m => m.round_number === currentRound && m.winner_id)
    .sort((a, b) => a.match_number - b.match_number)
    .map(m => m.winner_id!);

  const matches: BracketMatch[] = [];
  let matchNumber = startingMatchNumber;

  // Pair winners for next round
  for (let i = 0; i < winners.length; i += 2) {
    const player1_id = winners[i];
    const player2_id = winners[i + 1] || null;

    matches.push({
      round_number: currentRound + 1,
      match_number: matchNumber++,
      player1_id,
      player2_id,
      status: player2_id ? 'pending' : 'bye',
      winner_id: player2_id ? null : player1_id,
    });
  }

  return matches;
}

/**
 * Get losers from main bracket to move to consolation
 */
export function getLosersFromRound(
  matches: Match[],
  roundNumber: number
): string[] {
  return matches
    .filter(m => m.round_number === roundNumber && m.status === 'completed')
    .map(m => {
      // Loser is the player who isn't the winner
      if (m.winner_id === m.player1_id) return m.player2_id;
      return m.player1_id;
    })
    .filter((id): id is string => id !== null);
}

/**
 * Assign sequential table numbers to matches
 */
export function assignTableNumbers(
  matches: BracketMatch[],
  startingTable: number = 1
): (BracketMatch & { table_number: number | null })[] {
  let tableNumber = startingTable;

  return matches.map(match => ({
    ...match,
    // Only assign table numbers to matches that will actually be played
    table_number: match.status === 'bye' ? null : tableNumber++,
  }));
}

/**
 * Check if all matches in a round are completed
 */
export function isRoundComplete(matches: Match[], roundNumber: number): boolean {
  const roundMatches = matches.filter(m => m.round_number === roundNumber);
  return roundMatches.length > 0 &&
    roundMatches.every(m => m.status === 'completed' || m.status === 'bye');
}

/**
 * Get the current active round number for a bracket
 */
export function getCurrentRound(matches: Match[]): number {
  if (matches.length === 0) return 1;

  const rounds = [...new Set(matches.map(m => m.round_number))].sort((a, b) => a - b);

  for (const round of rounds) {
    if (!isRoundComplete(matches, round)) {
      return round;
    }
  }

  // All rounds complete, return the last round
  return Math.max(...rounds);
}

/**
 * Determine if a bracket is complete (has a winner)
 */
export function isBracketComplete(matches: Match[]): boolean {
  if (matches.length === 0) return false;

  const maxRound = Math.max(...matches.map(m => m.round_number));
  const finalMatches = matches.filter(m => m.round_number === maxRound);

  // Final round should have exactly 1 match with a winner
  return finalMatches.length === 1 && finalMatches[0].winner_id !== null;
}

/**
 * Get bracket winner
 */
export function getBracketWinner(matches: Match[]): string | null {
  if (!isBracketComplete(matches)) return null;

  const maxRound = Math.max(...matches.map(m => m.round_number));
  const finalMatch = matches.find(m => m.round_number === maxRound);

  return finalMatch?.winner_id || null;
}
