'use client';

import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import type { Match, Player, MatchStatus } from '@/lib/database.types';

interface MatchCardProps {
  match: Match & {
    player1?: Player;
    player2?: Player;
  };
  matchLength: number;
  onClick?: () => void;
  compact?: boolean;
}

function getStatusConfig(status: MatchStatus) {
  switch (status) {
    case 'pending':
      return { label: 'Pending', className: 'bg-gray-100 text-gray-700 border-gray-200' };
    case 'in_progress':
      return { label: 'In Progress', className: 'bg-yellow-100 text-yellow-800 border-yellow-300' };
    case 'completed':
      return { label: 'Completed', className: 'bg-green-100 text-green-800 border-green-300' };
    case 'bye':
      return { label: 'BYE', className: 'bg-blue-100 text-blue-800 border-blue-300' };
    default:
      return { label: status, className: 'bg-gray-100 text-gray-700 border-gray-200' };
  }
}

export function MatchCard({ match, matchLength, onClick, compact = false }: MatchCardProps) {
  const statusConfig = getStatusConfig(match.status);
  const isCompleted = match.status === 'completed';
  const isBye = match.status === 'bye';

  const player1Name = match.player1?.name || 'TBD';
  const player2Name = match.player2?.name || (isBye ? 'BYE' : 'TBD');

  const player1IsWinner = match.winner_id === match.player1_id;
  const player2IsWinner = match.winner_id === match.player2_id;

  return (
    <div
      onClick={onClick}
      className={cn(
        'border rounded-lg bg-white shadow-sm transition-all',
        onClick && 'cursor-pointer hover:shadow-md hover:border-blue-300',
        compact ? 'p-2' : 'p-3',
        statusConfig.className.includes('yellow') && 'ring-2 ring-yellow-300'
      )}
    >
      {/* Header */}
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          {match.table_number && (
            <Badge variant="outline" className="text-xs">
              Table {match.table_number}
            </Badge>
          )}
          <span className="text-xs text-gray-500">Match {match.match_number}</span>
        </div>
        <Badge className={cn('text-xs', statusConfig.className)}>
          {statusConfig.label}
        </Badge>
      </div>

      {/* Players */}
      <div className="space-y-1">
        {/* Player 1 */}
        <div
          className={cn(
            'flex items-center justify-between p-2 rounded',
            player1IsWinner && 'bg-green-50 font-semibold',
            !match.player1_id && 'text-gray-400'
          )}
        >
          <span className={cn('truncate', compact ? 'text-sm' : '')}>
            {player1Name}
          </span>
          {isCompleted && (
            <span
              className={cn(
                'font-mono',
                player1IsWinner ? 'text-green-700 font-bold' : 'text-gray-500',
                compact ? 'text-sm' : ''
              )}
            >
              {match.player1_score}
            </span>
          )}
        </div>

        {/* Divider */}
        <div className="border-t border-gray-100" />

        {/* Player 2 */}
        <div
          className={cn(
            'flex items-center justify-between p-2 rounded',
            player2IsWinner && 'bg-green-50 font-semibold',
            (!match.player2_id || isBye) && 'text-gray-400'
          )}
        >
          <span className={cn('truncate', compact ? 'text-sm' : '')}>
            {player2Name}
          </span>
          {isCompleted && !isBye && (
            <span
              className={cn(
                'font-mono',
                player2IsWinner ? 'text-green-700 font-bold' : 'text-gray-500',
                compact ? 'text-sm' : ''
              )}
            >
              {match.player2_score}
            </span>
          )}
        </div>
      </div>

      {/* Match info footer */}
      {!compact && isCompleted && (
        <div className="mt-2 pt-2 border-t text-xs text-gray-500 text-center">
          Final: {match.player1_score} - {match.player2_score}
          {matchLength > 0 && ` (${matchLength}pt match)`}
        </div>
      )}
    </div>
  );
}
