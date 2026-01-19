'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Separator } from '@/components/ui/separator';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { supabase } from '@/lib/supabase';
import { formatDate, formatDateTime, getTournamentStatusColor } from '@/lib/utils';
import { toast } from 'sonner';
import type { Tournament, Division, TournamentEntry } from '@/lib/database.types';

interface DivisionWithEntries extends Division {
  tournament_entries: TournamentEntry[];
  checkedInCount?: number;
}

interface TournamentData extends Tournament {
  divisions: DivisionWithEntries[];
}

export default function TournamentDetailsPage() {
  const params = useParams();
  const router = useRouter();
  const tournamentId = params.id as string;

  const [tournament, setTournament] = useState<TournamentData | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [showGenerateDialog, setShowGenerateDialog] = useState(false);

  useEffect(() => {
    if (tournamentId) {
      loadTournament();
    }
  }, [tournamentId]);

  const loadTournament = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('tournaments')
        .select(`
          *,
          divisions (
            *,
            tournament_entries (*)
          )
        `)
        .eq('id', tournamentId)
        .single();

      if (error) throw error;

      // Cast to our expected type
      const tournamentData = data as unknown as TournamentData;

      // Calculate checked-in counts
      if (tournamentData.divisions) {
        tournamentData.divisions = tournamentData.divisions.map((div) => ({
          ...div,
          checkedInCount: div.tournament_entries?.filter((e) => e.checked_in).length || 0,
        }));
      }

      setTournament(tournamentData);
    } catch (error) {
      console.error('Error loading tournament:', error);
      toast.error('Failed to load tournament');
    } finally {
      setLoading(false);
    }
  };

  const updateTournamentStatus = async (newStatus: Tournament['status']) => {
    if (!tournament) return;

    setActionLoading(true);
    try {
      const { error } = await supabase
        .from('tournaments')
        .update({ status: newStatus })
        .eq('id', tournamentId);

      if (error) throw error;

      setTournament({ ...tournament, status: newStatus });
      toast.success(`Tournament ${newStatus === 'in_progress' ? 'started' : newStatus}`);
    } catch (error) {
      console.error('Error updating tournament:', error);
      toast.error('Failed to update tournament status');
    } finally {
      setActionLoading(false);
    }
  };

  const generateBrackets = async () => {
    if (!tournament) return;

    // Check that each division has at least 2 checked-in players
    const insufficientDivisions = tournament.divisions.filter(
      (div) => (div.checkedInCount || 0) < 2
    );

    if (insufficientDivisions.length > 0) {
      toast.error(
        `These divisions need at least 2 checked-in players: ${insufficientDivisions
          .map((d) => d.name)
          .join(', ')}`
      );
      return;
    }

    setActionLoading(true);
    setShowGenerateDialog(false);

    try {
      // For each division, create brackets and matches
      for (const division of tournament.divisions) {
        // Get checked-in players for this division
        const checkedInEntries = division.tournament_entries.filter((e) => e.checked_in);

        // Create Main bracket
        const { data: mainBracket, error: mainBracketError } = await supabase
          .from('brackets')
          .insert({
            division_id: division.id,
            bracket_type: 'main',
            current_round: 1,
            status: 'in_progress',
          })
          .select()
          .single();

        if (mainBracketError) throw mainBracketError;

        // Create Consolation bracket
        const { data: consolationBracket, error: consolationBracketError } = await supabase
          .from('brackets')
          .insert({
            division_id: division.id,
            bracket_type: 'consolation',
            current_round: 1,
            status: 'pending',
          })
          .select()
          .single();

        if (consolationBracketError) throw consolationBracketError;

        // Shuffle players for random seeding
        const shuffledEntries = [...checkedInEntries].sort(() => Math.random() - 0.5);

        // Generate Round 1 matches
        let tableNumber = 1;
        const matches = [];

        for (let i = 0; i < shuffledEntries.length; i += 2) {
          const player1 = shuffledEntries[i];
          const player2 = shuffledEntries[i + 1];

          if (player2) {
            // Regular match
            matches.push({
              bracket_id: mainBracket.id,
              round_number: 1,
              match_number: matches.length + 1,
              player1_id: player1.player_id,
              player2_id: player2.player_id,
              table_number: tableNumber++,
              status: 'pending',
            });
          } else {
            // Bye - player auto-advances
            matches.push({
              bracket_id: mainBracket.id,
              round_number: 1,
              match_number: matches.length + 1,
              player1_id: player1.player_id,
              player2_id: null,
              winner_id: player1.player_id,
              table_number: null,
              status: 'bye',
            });
          }
        }

        // Insert matches
        if (matches.length > 0) {
          const { error: matchesError } = await supabase.from('matches').insert(matches);
          if (matchesError) throw matchesError;
        }
      }

      // Update tournament status
      await updateTournamentStatus('in_progress');
      toast.success('Brackets generated! Tournament started.');
      router.push(`/tournaments/${tournamentId}/brackets`);
    } catch (error) {
      console.error('Error generating brackets:', error);
      toast.error('Failed to generate brackets');
    } finally {
      setActionLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50">
        <header className="border-b bg-white sticky top-0 z-50">
          <div className="container mx-auto px-4 py-4">
            <Skeleton className="h-8 w-64" />
          </div>
        </header>
        <main className="container mx-auto px-4 py-8">
          <Skeleton className="h-12 w-96 mb-4" />
          <Skeleton className="h-64 w-full" />
        </main>
      </div>
    );
  }

  if (!tournament) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-gray-900 mb-4">Tournament Not Found</h1>
          <Link href="/tournaments">
            <Button>Back to Tournaments</Button>
          </Link>
        </div>
      </div>
    );
  }

  const totalPlayers = tournament.divisions.reduce(
    (sum, div) => sum + (div.tournament_entries?.length || 0),
    0
  );
  const totalCheckedIn = tournament.divisions.reduce(
    (sum, div) => sum + (div.checkedInCount || 0),
    0
  );

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="border-b bg-white sticky top-0 z-50">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <Link href="/" className="text-xl font-bold text-gray-900">
            Destiny 2&apos;s Backgammon Smackdown
          </Link>
          <nav className="flex gap-4">
            <Link href="/tournaments">
              <Button variant="ghost">Tournaments</Button>
            </Link>
            <Link href="/players">
              <Button variant="ghost">Players</Button>
            </Link>
          </nav>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8">
        {/* Tournament Header */}
        <div className="flex flex-col lg:flex-row lg:items-start justify-between gap-4 mb-8">
          <div>
            <div className="flex items-center gap-3 mb-2">
              <h1 className="text-3xl font-bold text-gray-900">{tournament.name}</h1>
              <Badge className={getTournamentStatusColor(tournament.status)}>
                {tournament.status.replace('_', ' ')}
              </Badge>
            </div>
            <div className="text-gray-600 space-y-1">
              {tournament.location && <p>{tournament.location}</p>}
              <p>
                {formatDateTime(tournament.start_date)}
                {tournament.end_date && ` - ${formatDateTime(tournament.end_date)}`}
              </p>
              {tournament.sms_phone_number && (
                <p>SMS: {tournament.sms_phone_number}</p>
              )}
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            <Link href={`/tournaments/${tournamentId}/players`}>
              <Button variant="outline">Manage Players</Button>
            </Link>
            {tournament.status === 'in_progress' && (
              <>
                <Link href={`/tournaments/${tournamentId}/brackets`}>
                  <Button variant="outline">View Brackets</Button>
                </Link>
                <Link href={`/tournaments/${tournamentId}/director`}>
                  <Button>Director Dashboard</Button>
                </Link>
              </>
            )}
          </div>
        </div>

        {/* Summary Cards */}
        <div className="grid md:grid-cols-3 gap-4 mb-8">
          <Card>
            <CardHeader className="pb-2">
              <CardDescription>Total Players</CardDescription>
              <CardTitle className="text-3xl">{totalPlayers}</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-gray-600">
                {totalCheckedIn} checked in
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardDescription>Divisions</CardDescription>
              <CardTitle className="text-3xl">{tournament.divisions.length}</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-gray-600">
                Championship, Intermediate, Beginner
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardDescription>Status</CardDescription>
              <CardTitle className="text-3xl capitalize">
                {tournament.status.replace('_', ' ')}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-gray-600">
                {tournament.status === 'draft' && 'Ready to add players'}
                {tournament.status === 'in_progress' && 'Tournament is active'}
                {tournament.status === 'completed' && 'Tournament finished'}
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Divisions */}
        <Card className="mb-8">
          <CardHeader>
            <CardTitle>Divisions</CardTitle>
            <CardDescription>Player counts and match settings per division</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {tournament.divisions.map((division) => (
                <div
                  key={division.id}
                  className="flex items-center justify-between p-4 bg-gray-50 rounded-lg"
                >
                  <div>
                    <h3 className="font-semibold">{division.name}</h3>
                    <p className="text-sm text-gray-600">
                      {division.match_length}-point matches
                      {division.clock_required && ' • Clock required'}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="font-semibold">
                      {division.tournament_entries?.length || 0} players
                    </p>
                    <p className="text-sm text-gray-600">
                      {division.checkedInCount || 0} checked in
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Tournament Controls */}
        <Card>
          <CardHeader>
            <CardTitle>Tournament Controls</CardTitle>
            <CardDescription>Manage tournament status and generate brackets</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {tournament.status === 'draft' && (
                <>
                  <p className="text-gray-600">
                    Once all players are registered and checked in, generate brackets to start the tournament.
                  </p>
                  <div className="flex gap-4">
                    <Dialog open={showGenerateDialog} onOpenChange={setShowGenerateDialog}>
                      <DialogTrigger asChild>
                        <Button disabled={totalCheckedIn < 2}>
                          Generate Brackets & Start
                        </Button>
                      </DialogTrigger>
                      <DialogContent>
                        <DialogHeader>
                          <DialogTitle>Generate Brackets?</DialogTitle>
                          <DialogDescription>
                            This will create double elimination brackets for all divisions and start the tournament.
                            Make sure all players are checked in before proceeding.
                          </DialogDescription>
                        </DialogHeader>
                        <div className="py-4">
                          <h4 className="font-medium mb-2">Division Summary:</h4>
                          <ul className="space-y-1 text-sm">
                            {tournament.divisions.map((div) => (
                              <li key={div.id} className="flex justify-between">
                                <span>{div.name}</span>
                                <span>
                                  {div.checkedInCount || 0} players
                                  {(div.checkedInCount || 0) < 2 && (
                                    <span className="text-red-500 ml-2">(need 2+)</span>
                                  )}
                                </span>
                              </li>
                            ))}
                          </ul>
                        </div>
                        <DialogFooter>
                          <Button variant="outline" onClick={() => setShowGenerateDialog(false)}>
                            Cancel
                          </Button>
                          <Button onClick={generateBrackets} disabled={actionLoading}>
                            {actionLoading ? 'Generating...' : 'Generate & Start'}
                          </Button>
                        </DialogFooter>
                      </DialogContent>
                    </Dialog>

                    <Link href={`/tournaments/${tournamentId}/players`}>
                      <Button variant="outline">Add Players First</Button>
                    </Link>
                  </div>
                </>
              )}

              {tournament.status === 'in_progress' && (
                <>
                  <p className="text-gray-600">
                    Tournament is active. Use the Director Dashboard to manage matches and scores.
                  </p>
                  <div className="flex gap-4">
                    <Link href={`/tournaments/${tournamentId}/director`}>
                      <Button>Open Director Dashboard</Button>
                    </Link>
                    <Link href={`/tournaments/${tournamentId}/public`}>
                      <Button variant="outline">Public Bracket View</Button>
                    </Link>
                    <Button
                      variant="outline"
                      onClick={() => updateTournamentStatus('completed')}
                      disabled={actionLoading}
                    >
                      Complete Tournament
                    </Button>
                  </div>
                </>
              )}

              {tournament.status === 'completed' && (
                <>
                  <p className="text-gray-600">
                    Tournament is complete. View final results and brackets.
                  </p>
                  <div className="flex gap-4">
                    <Link href={`/tournaments/${tournamentId}/results`}>
                      <Button>View Results</Button>
                    </Link>
                    <Link href={`/tournaments/${tournamentId}/brackets`}>
                      <Button variant="outline">View Final Brackets</Button>
                    </Link>
                  </div>
                </>
              )}
            </div>
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
