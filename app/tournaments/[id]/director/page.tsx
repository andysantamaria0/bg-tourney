'use client';

import { useEffect, useState, useCallback } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { ManualScoreEntry } from '@/components/director/ManualScoreEntry';
import { ScoreReportQueue } from '@/components/director/ScoreReportQueue';
import { supabase } from '@/lib/supabase';
import { toast } from 'sonner';
import { getMatchStatusColor, formatRelativeTime } from '@/lib/utils';
import type { Tournament, Division, Bracket, Match, Player } from '@/lib/database.types';

interface MatchWithPlayers extends Match {
  player1?: Player;
  player2?: Player;
}

interface BracketWithMatches extends Bracket {
  matches: MatchWithPlayers[];
}

interface DivisionWithBrackets extends Division {
  mainBracket?: BracketWithMatches;
  consolationBracket?: BracketWithMatches;
}

export default function DirectorDashboardPage() {
  const params = useParams();
  const tournamentId = params.id as string;

  const [tournament, setTournament] = useState<Tournament | null>(null);
  const [divisions, setDivisions] = useState<DivisionWithBrackets[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<string>('');
  const [selectedMatch, setSelectedMatch] = useState<MatchWithPlayers | null>(null);
  const [selectedMatchLength, setSelectedMatchLength] = useState<number>(9);
  const [showAdvanceDialog, setShowAdvanceDialog] = useState(false);
  const [advanceLoading, setAdvanceLoading] = useState(false);

  const loadData = useCallback(async () => {
    try {
      // Load tournament
      const { data: tournamentData, error: tournamentError } = await supabase
        .from('tournaments')
        .select('*')
        .eq('id', tournamentId)
        .single();

      if (tournamentError) throw tournamentError;
      setTournament(tournamentData);

      // Load divisions with brackets and matches
      const { data: divisionsData, error: divisionsError } = await supabase
        .from('divisions')
        .select('*')
        .eq('tournament_id', tournamentId)
        .order('match_length', { ascending: false });

      if (divisionsError) throw divisionsError;

      const divisionsWithBrackets: DivisionWithBrackets[] = [];

      for (const division of divisionsData) {
        const { data: brackets } = await supabase
          .from('brackets')
          .select('*')
          .eq('division_id', division.id);

        const divisionData: DivisionWithBrackets = { ...division };

        for (const bracket of brackets || []) {
          const { data: matches } = await supabase
            .from('matches')
            .select(`
              *,
              player1:players!matches_player1_id_fkey (*),
              player2:players!matches_player2_id_fkey (*)
            `)
            .eq('bracket_id', bracket.id)
            .order('round_number')
            .order('match_number');

          const bracketWithMatches: BracketWithMatches = {
            ...bracket,
            matches: (matches || []) as MatchWithPlayers[],
          };

          if (bracket.bracket_type === 'main') {
            divisionData.mainBracket = bracketWithMatches;
          } else if (bracket.bracket_type === 'consolation') {
            divisionData.consolationBracket = bracketWithMatches;
          }
        }

        divisionsWithBrackets.push(divisionData);
      }

      setDivisions(divisionsWithBrackets);

      if (divisionsWithBrackets.length > 0 && !activeTab) {
        setActiveTab(divisionsWithBrackets[0].id);
      }
    } catch (error) {
      console.error('Error loading data:', error);
      toast.error('Failed to load dashboard data');
    } finally {
      setLoading(false);
    }
  }, [tournamentId, activeTab]);

  useEffect(() => {
    if (tournamentId) {
      loadData();
    }
  }, [tournamentId, loadData]);

  // Auto-refresh every 30 seconds
  useEffect(() => {
    const interval = setInterval(loadData, 30000);
    return () => clearInterval(interval);
  }, [loadData]);

  const getActiveDivision = () => divisions.find((d) => d.id === activeTab);

  const getCurrentRoundMatches = (division: DivisionWithBrackets) => {
    const mainMatches = division.mainBracket?.matches || [];
    const consolationMatches = division.consolationBracket?.matches || [];
    const allMatches = [...mainMatches, ...consolationMatches];

    const currentRound = division.mainBracket?.current_round || 1;
    return allMatches.filter((m) => m.round_number === currentRound);
  };

  const canAdvanceRound = (division: DivisionWithBrackets) => {
    const currentMatches = getCurrentRoundMatches(division);
    return currentMatches.length > 0 &&
      currentMatches.every((m) => m.status === 'completed' || m.status === 'bye');
  };

  const handleAdvanceRound = async () => {
    const division = getActiveDivision();
    if (!division || !division.mainBracket) return;

    setAdvanceLoading(true);
    try {
      const currentRound = division.mainBracket.current_round;
      const mainMatches = division.mainBracket.matches.filter(
        (m) => m.round_number === currentRound
      );

      // Get winners from current round
      const winners = mainMatches
        .filter((m) => m.winner_id)
        .map((m) => m.winner_id!);

      // Get losers for consolation bracket
      const losers = mainMatches
        .filter((m) => m.status === 'completed' && m.winner_id)
        .map((m) => (m.winner_id === m.player1_id ? m.player2_id : m.player1_id))
        .filter((id): id is string => id !== null);

      // Create next round matches in main bracket
      const nextRound = currentRound + 1;
      let matchNumber = 1;
      const newMainMatches = [];

      for (let i = 0; i < winners.length; i += 2) {
        const player1 = winners[i];
        const player2 = winners[i + 1];

        newMainMatches.push({
          bracket_id: division.mainBracket.id,
          round_number: nextRound,
          match_number: matchNumber++,
          player1_id: player1,
          player2_id: player2 || null,
          winner_id: player2 ? null : player1,
          status: player2 ? 'pending' : 'bye',
          table_number: player2 ? matchNumber : null,
        });
      }

      // Insert new main bracket matches
      if (newMainMatches.length > 0) {
        const { error: mainError } = await supabase
          .from('matches')
          .insert(newMainMatches);
        if (mainError) throw mainError;
      }

      // Create consolation bracket matches from losers (if we have a consolation bracket)
      if (division.consolationBracket && losers.length > 0) {
        const consolationMatches = [];
        let consolationMatchNum = 1;

        for (let i = 0; i < losers.length; i += 2) {
          const player1 = losers[i];
          const player2 = losers[i + 1];

          consolationMatches.push({
            bracket_id: division.consolationBracket.id,
            round_number: nextRound,
            match_number: consolationMatchNum++,
            player1_id: player1,
            player2_id: player2 || null,
            winner_id: player2 ? null : player1,
            status: player2 ? 'pending' : 'bye',
          });
        }

        if (consolationMatches.length > 0) {
          const { error: consolationError } = await supabase
            .from('matches')
            .insert(consolationMatches);
          if (consolationError) throw consolationError;
        }

        // Update consolation bracket current round
        await supabase
          .from('brackets')
          .update({ current_round: nextRound, status: 'in_progress' })
          .eq('id', division.consolationBracket.id);
      }

      // Update main bracket current round
      await supabase
        .from('brackets')
        .update({ current_round: nextRound })
        .eq('id', division.mainBracket.id);

      toast.success(`Advanced to Round ${nextRound}`);
      setShowAdvanceDialog(false);
      loadData();
    } catch (error) {
      console.error('Error advancing round:', error);
      toast.error('Failed to advance round');
    } finally {
      setAdvanceLoading(false);
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
          <div className="grid lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2">
              <Skeleton className="h-96 w-full" />
            </div>
            <Skeleton className="h-96 w-full" />
          </div>
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

  const activeDivision = getActiveDivision();
  const currentRoundMatches = activeDivision ? getCurrentRoundMatches(activeDivision) : [];

  // Stats
  const allMatches = divisions.flatMap((d) => [
    ...(d.mainBracket?.matches || []),
    ...(d.consolationBracket?.matches || []),
  ]);
  const completedCount = allMatches.filter((m) => m.status === 'completed').length;
  const inProgressCount = allMatches.filter((m) => m.status === 'in_progress').length;
  const pendingCount = allMatches.filter((m) => m.status === 'pending').length;

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
        {/* Page Header */}
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 mb-8">
          <div>
            <div className="flex items-center gap-2 text-sm text-gray-500 mb-1">
              <Link href={`/tournaments/${tournamentId}`} className="hover:text-gray-700">
                {tournament.name}
              </Link>
              <span>/</span>
              <span>Director Dashboard</span>
            </div>
            <h1 className="text-3xl font-bold text-gray-900">Director Dashboard</h1>
          </div>
          <div className="flex gap-2">
            <Link href={`/tournaments/${tournamentId}/brackets`}>
              <Button variant="outline">View Brackets</Button>
            </Link>
            <Link href={`/tournaments/${tournamentId}/public`}>
              <Button variant="outline">Public View</Button>
            </Link>
          </div>
        </div>

        {/* Overview Stats */}
        <div className="grid sm:grid-cols-4 gap-4 mb-8">
          <Card>
            <CardHeader className="pb-2">
              <CardDescription>Status</CardDescription>
              <CardTitle className="text-xl capitalize">
                {tournament.status.replace('_', ' ')}
              </CardTitle>
            </CardHeader>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardDescription>Completed</CardDescription>
              <CardTitle className="text-xl text-green-600">{completedCount}</CardTitle>
            </CardHeader>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardDescription>In Progress</CardDescription>
              <CardTitle className="text-xl text-yellow-600">{inProgressCount}</CardTitle>
            </CardHeader>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardDescription>Pending</CardDescription>
              <CardTitle className="text-xl text-gray-600">{pendingCount}</CardTitle>
            </CardHeader>
          </Card>
        </div>

        <div className="grid lg:grid-cols-3 gap-6">
          {/* Main Content */}
          <div className="lg:col-span-2 space-y-6">
            {/* Division Tabs and Matches */}
            <Card>
              <CardHeader>
                <CardTitle>Active Matches</CardTitle>
                <CardDescription>Current round matches by division</CardDescription>
              </CardHeader>
              <CardContent>
                <Tabs value={activeTab} onValueChange={setActiveTab}>
                  <TabsList className="mb-4">
                    {divisions.map((division) => (
                      <TabsTrigger key={division.id} value={division.id}>
                        {division.name}
                      </TabsTrigger>
                    ))}
                  </TabsList>

                  {divisions.map((division) => (
                    <TabsContent key={division.id} value={division.id}>
                      {/* Round Info */}
                      <div className="flex items-center justify-between mb-4">
                        <div>
                          <h3 className="font-semibold">
                            Round {division.mainBracket?.current_round || 1}
                          </h3>
                          <p className="text-sm text-gray-500">
                            {division.match_length}-point matches
                          </p>
                        </div>
                        <Button
                          onClick={() => setShowAdvanceDialog(true)}
                          disabled={!canAdvanceRound(division)}
                        >
                          Advance to Next Round
                        </Button>
                      </div>

                      {/* Matches Table */}
                      <div className="rounded-md border">
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead className="w-16">Table</TableHead>
                              <TableHead>Player 1</TableHead>
                              <TableHead>Player 2</TableHead>
                              <TableHead className="w-24">Status</TableHead>
                              <TableHead className="w-24">Score</TableHead>
                              <TableHead className="w-24">Actions</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {getCurrentRoundMatches(division).length === 0 ? (
                              <TableRow>
                                <TableCell colSpan={6} className="text-center text-gray-500 py-8">
                                  No matches in current round
                                </TableCell>
                              </TableRow>
                            ) : (
                              getCurrentRoundMatches(division).map((match) => (
                                <TableRow key={match.id}>
                                  <TableCell className="font-mono">
                                    {match.table_number || '-'}
                                  </TableCell>
                                  <TableCell className={match.winner_id === match.player1_id ? 'font-bold' : ''}>
                                    {match.player1?.name || 'TBD'}
                                  </TableCell>
                                  <TableCell className={match.winner_id === match.player2_id ? 'font-bold' : ''}>
                                    {match.player2?.name || (match.status === 'bye' ? 'BYE' : 'TBD')}
                                  </TableCell>
                                  <TableCell>
                                    <Badge className={getMatchStatusColor(match.status)}>
                                      {match.status.replace('_', ' ')}
                                    </Badge>
                                  </TableCell>
                                  <TableCell className="font-mono">
                                    {match.status === 'completed'
                                      ? `${match.player1_score}-${match.player2_score}`
                                      : '-'}
                                  </TableCell>
                                  <TableCell>
                                    {match.status !== 'bye' && match.status !== 'completed' && match.player1_id && match.player2_id && (
                                      <Button
                                        size="sm"
                                        onClick={() => {
                                          setSelectedMatch(match);
                                          setSelectedMatchLength(division.match_length);
                                        }}
                                      >
                                        Enter Score
                                      </Button>
                                    )}
                                  </TableCell>
                                </TableRow>
                              ))
                            )}
                          </TableBody>
                        </Table>
                      </div>
                    </TabsContent>
                  ))}
                </Tabs>
              </CardContent>
            </Card>

            {/* Recent Completions */}
            <Card>
              <CardHeader>
                <CardTitle>Recent Completions</CardTitle>
                <CardDescription>Latest match results</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {allMatches
                    .filter((m) => m.status === 'completed')
                    .sort((a, b) =>
                      new Date(b.completed_at || 0).getTime() - new Date(a.completed_at || 0).getTime()
                    )
                    .slice(0, 5)
                    .map((match) => (
                      <div
                        key={match.id}
                        className="flex items-center justify-between p-2 bg-gray-50 rounded"
                      >
                        <span>
                          <span className="font-medium">
                            {match.winner_id === match.player1_id
                              ? match.player1?.name
                              : match.player2?.name}
                          </span>
                          {' def. '}
                          {match.winner_id === match.player1_id
                            ? match.player2?.name
                            : match.player1?.name}
                          {' '}
                          <span className="font-mono text-gray-600">
                            {match.player1_score}-{match.player2_score}
                          </span>
                        </span>
                        <span className="text-xs text-gray-500">
                          {match.completed_at && formatRelativeTime(match.completed_at)}
                        </span>
                      </div>
                    ))}
                  {allMatches.filter((m) => m.status === 'completed').length === 0 && (
                    <p className="text-center text-gray-500 py-4">
                      No completed matches yet
                    </p>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Sidebar */}
          <div className="space-y-6">
            <ScoreReportQueue tournamentId={tournamentId} onScoreApproved={loadData} />
          </div>
        </div>

        {/* Score Entry Modal */}
        <ManualScoreEntry
          match={selectedMatch}
          matchLength={selectedMatchLength}
          open={!!selectedMatch}
          onClose={() => setSelectedMatch(null)}
          onSuccess={loadData}
        />

        {/* Advance Round Dialog */}
        <Dialog open={showAdvanceDialog} onOpenChange={setShowAdvanceDialog}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Advance to Next Round?</DialogTitle>
              <DialogDescription>
                This will generate the next round of matches for {activeDivision?.name}.
                Winners will continue in the main bracket, losers will move to consolation.
              </DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <Button variant="outline" onClick={() => setShowAdvanceDialog(false)}>
                Cancel
              </Button>
              <Button onClick={handleAdvanceRound} disabled={advanceLoading}>
                {advanceLoading ? 'Advancing...' : 'Advance Round'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </main>
    </div>
  );
}
