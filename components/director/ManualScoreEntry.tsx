'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { supabase } from '@/lib/supabase';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import type { Match, Player } from '@/lib/database.types';

interface MatchWithPlayers extends Match {
  player1?: Player;
  player2?: Player;
}

interface ManualScoreEntryProps {
  match: MatchWithPlayers | null;
  matchLength: number;
  open: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export function ManualScoreEntry({
  match,
  matchLength,
  open,
  onClose,
  onSuccess,
}: ManualScoreEntryProps) {
  const [player1Score, setPlayer1Score] = useState<string>('');
  const [player2Score, setPlayer2Score] = useState<string>('');
  const [tableNumber, setTableNumber] = useState<string>('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Reset form when match changes
  useEffect(() => {
    if (match) {
      setPlayer1Score(match.player1_score?.toString() || '');
      setPlayer2Score(match.player2_score?.toString() || '');
      setTableNumber(match.table_number?.toString() || '');
      setError(null);
    }
  }, [match]);

  if (!match) return null;

  const player1Name = match.player1?.name || 'Player 1';
  const player2Name = match.player2?.name || 'Player 2';

  const p1Score = parseInt(player1Score) || 0;
  const p2Score = parseInt(player2Score) || 0;

  // Determine winner based on scores
  const winnerId =
    p1Score > p2Score
      ? match.player1_id
      : p2Score > p1Score
      ? match.player2_id
      : null;

  const winnerName =
    winnerId === match.player1_id
      ? player1Name
      : winnerId === match.player2_id
      ? player2Name
      : null;

  // Validation
  const validateScores = (): string | null => {
    if (p1Score < 0 || p2Score < 0) {
      return 'Scores must be positive';
    }
    if (p1Score > matchLength && p2Score > matchLength) {
      return `Scores cannot both exceed match length (${matchLength})`;
    }
    if (p1Score !== matchLength && p2Score !== matchLength) {
      return `One player must reach ${matchLength} points to win`;
    }
    if (p1Score === p2Score) {
      return 'Scores cannot be tied';
    }
    if (Math.max(p1Score, p2Score) !== matchLength) {
      return `Winner must have exactly ${matchLength} points`;
    }
    if (Math.min(p1Score, p2Score) >= matchLength) {
      return `Losing score must be less than ${matchLength}`;
    }
    return null;
  };

  const validationError = player1Score && player2Score ? validateScores() : null;
  const isValid = !validationError && winnerId !== null;

  const handleSubmit = async () => {
    const err = validateScores();
    if (err) {
      setError(err);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const { error: updateError } = await supabase
        .from('matches')
        .update({
          player1_score: p1Score,
          player2_score: p2Score,
          winner_id: winnerId,
          table_number: tableNumber ? parseInt(tableNumber) : null,
          status: 'completed',
          completed_at: new Date().toISOString(),
        })
        .eq('id', match.id);

      if (updateError) throw updateError;

      toast.success(`Score saved! ${winnerName} wins ${p1Score}-${p2Score}`);
      onSuccess();
      onClose();
    } catch (err) {
      console.error('Error saving score:', err);
      toast.error('Failed to save score');
      setError('Failed to save score. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Enter Match Score</DialogTitle>
          <DialogDescription>
            Match {match.match_number} • Round {match.round_number} • {matchLength}-point match
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {/* Player 1 */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label htmlFor="player1Score" className="text-base font-medium">
                {player1Name}
              </Label>
              {winnerId === match.player1_id && (
                <Badge className="bg-green-100 text-green-800">Winner</Badge>
              )}
            </div>
            <Input
              id="player1Score"
              type="number"
              min="0"
              max={matchLength}
              value={player1Score}
              onChange={(e) => setPlayer1Score(e.target.value)}
              placeholder="Score"
              className={cn(
                'text-2xl text-center font-mono h-14',
                winnerId === match.player1_id && 'border-green-500 bg-green-50'
              )}
            />
          </div>

          {/* VS Divider */}
          <div className="text-center text-gray-400 font-medium">vs</div>

          {/* Player 2 */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label htmlFor="player2Score" className="text-base font-medium">
                {player2Name}
              </Label>
              {winnerId === match.player2_id && (
                <Badge className="bg-green-100 text-green-800">Winner</Badge>
              )}
            </div>
            <Input
              id="player2Score"
              type="number"
              min="0"
              max={matchLength}
              value={player2Score}
              onChange={(e) => setPlayer2Score(e.target.value)}
              placeholder="Score"
              className={cn(
                'text-2xl text-center font-mono h-14',
                winnerId === match.player2_id && 'border-green-500 bg-green-50'
              )}
            />
          </div>

          {/* Table Number */}
          <div className="space-y-2">
            <Label htmlFor="tableNumber">Table Number (Optional)</Label>
            <Input
              id="tableNumber"
              type="number"
              min="1"
              value={tableNumber}
              onChange={(e) => setTableNumber(e.target.value)}
              placeholder="Table #"
            />
          </div>

          {/* Validation Error */}
          {(error || validationError) && (
            <Alert variant="destructive">
              <AlertDescription>{error || validationError}</AlertDescription>
            </Alert>
          )}

          {/* Winner Preview */}
          {isValid && winnerName && (
            <div className="p-3 bg-green-50 rounded-lg text-center">
              <p className="text-green-800 font-medium">
                {winnerName} wins {p1Score}-{p2Score}
              </p>
            </div>
          )}
        </div>

        <DialogFooter className="flex gap-2">
          <Button variant="outline" onClick={onClose} disabled={loading}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={loading || !isValid}>
            {loading ? 'Saving...' : 'Save Score'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
