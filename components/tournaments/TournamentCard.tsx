'use client';

import Link from 'next/link';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import type { Tournament, Division } from '@/lib/database.types';
import { formatDate, getTournamentStatusColor } from '@/lib/utils';

interface TournamentWithDivisions extends Tournament {
  divisions?: Division[];
}

interface TournamentCardProps {
  tournament: TournamentWithDivisions;
  playerCounts?: Record<string, number>;
}

export function TournamentCard({ tournament, playerCounts = {} }: TournamentCardProps) {
  const totalPlayers = Object.values(playerCounts).reduce((sum, count) => sum + count, 0);

  return (
    <Card className="hover:shadow-md transition-shadow">
      <CardHeader>
        <div className="flex items-start justify-between">
          <div>
            <CardTitle className="text-xl">{tournament.name}</CardTitle>
            <CardDescription className="mt-1">
              {tournament.location || 'Location TBD'}
            </CardDescription>
          </div>
          <Badge className={getTournamentStatusColor(tournament.status)}>
            {tournament.status.replace('_', ' ')}
          </Badge>
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          <div className="text-sm text-gray-600">
            <p>
              <span className="font-medium">Date:</span> {formatDate(tournament.start_date)}
              {tournament.end_date && ` - ${formatDate(tournament.end_date)}`}
            </p>
            {totalPlayers > 0 && (
              <p>
                <span className="font-medium">Players:</span> {totalPlayers} registered
              </p>
            )}
          </div>

          {tournament.divisions && tournament.divisions.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {tournament.divisions.map((division) => (
                <Badge key={division.id} variant="outline" className="text-xs">
                  {division.name} ({division.match_length}pt)
                  {playerCounts[division.id] !== undefined && (
                    <span className="ml-1 text-gray-500">
                      · {playerCounts[division.id]}
                    </span>
                  )}
                </Badge>
              ))}
            </div>
          )}

          <div className="flex gap-2 pt-2">
            <Link href={`/tournaments/${tournament.id}`} className="flex-1">
              <Button variant="outline" className="w-full">
                View Details
              </Button>
            </Link>
            {tournament.status === 'in_progress' && (
              <Link href={`/tournaments/${tournament.id}/brackets`}>
                <Button>Brackets</Button>
              </Link>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
