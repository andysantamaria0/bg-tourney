'use client';

import { useMemo } from 'react';
import { MatchCard } from './MatchCard';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import type { Match, Player, Bracket, BracketType } from '@/lib/database.types';

interface MatchWithPlayers extends Match {
  player1?: Player;
  player2?: Player;
}

interface BracketDisplayProps {
  bracket: Bracket;
  matches: MatchWithPlayers[];
  matchLength: number;
  onMatchClick?: (match: MatchWithPlayers) => void;
  compact?: boolean;
}

function getBracketTypeLabel(type: BracketType): string {
  switch (type) {
    case 'main':
      return 'Main Bracket (Winners)';
    case 'consolation':
      return 'Consolation Bracket (Losers)';
    case 'last_chance':
      return 'Last Chance Bracket';
    default:
      return type;
  }
}

function getBracketTypeColor(type: BracketType): string {
  switch (type) {
    case 'main':
      return 'bg-blue-100 text-blue-800';
    case 'consolation':
      return 'bg-orange-100 text-orange-800';
    case 'last_chance':
      return 'bg-purple-100 text-purple-800';
    default:
      return 'bg-gray-100 text-gray-800';
  }
}

export function BracketDisplay({
  bracket,
  matches,
  matchLength,
  onMatchClick,
  compact = false,
}: BracketDisplayProps) {
  // Group matches by round
  const roundsData = useMemo(() => {
    const rounds: Record<number, MatchWithPlayers[]> = {};

    matches.forEach((match) => {
      if (!rounds[match.round_number]) {
        rounds[match.round_number] = [];
      }
      rounds[match.round_number].push(match);
    });

    // Sort each round by match number
    Object.keys(rounds).forEach((round) => {
      rounds[parseInt(round)].sort((a, b) => a.match_number - b.match_number);
    });

    return rounds;
  }, [matches]);

  const roundNumbers = Object.keys(roundsData)
    .map(Number)
    .sort((a, b) => a - b);

  const maxRound = Math.max(...roundNumbers, 0);

  if (matches.length === 0) {
    return (
      <div className="text-center py-8 text-gray-500">
        No matches in this bracket yet
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Bracket Header */}
      <div className="flex items-center justify-between">
        <Badge className={cn('text-sm', getBracketTypeColor(bracket.bracket_type))}>
          {getBracketTypeLabel(bracket.bracket_type)}
        </Badge>
        <span className="text-sm text-gray-500">
          Round {bracket.current_round} of {maxRound}
        </span>
      </div>

      {/* Bracket Visualization */}
      <div className="overflow-x-auto">
        <div className="flex gap-4 min-w-max pb-4">
          {roundNumbers.map((roundNum) => (
            <div
              key={roundNum}
              className={cn(
                'flex-shrink-0',
                compact ? 'w-48' : 'w-64'
              )}
            >
              {/* Round Header */}
              <div className="text-center mb-3">
                <h4 className="font-semibold text-gray-700">
                  {roundNum === maxRound
                    ? bracket.bracket_type === 'main'
                      ? 'Finals'
                      : 'Consolation Finals'
                    : `Round ${roundNum}`}
                </h4>
                <p className="text-xs text-gray-500">
                  {roundsData[roundNum].length} match{roundsData[roundNum].length !== 1 ? 'es' : ''}
                </p>
              </div>

              {/* Matches in this round */}
              <div
                className="space-y-3"
                style={{
                  // Add vertical spacing to align with bracket structure
                  paddingTop: `${Math.pow(2, roundNum - 1) * 10}px`,
                }}
              >
                {roundsData[roundNum].map((match, index) => (
                  <div
                    key={match.id}
                    style={{
                      // Space matches within round for bracket alignment
                      marginTop: index > 0 ? `${Math.pow(2, roundNum - 1) * 20}px` : 0,
                    }}
                  >
                    <MatchCard
                      match={match}
                      matchLength={matchLength}
                      onClick={onMatchClick ? () => onMatchClick(match) : undefined}
                      compact={compact}
                    />
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
