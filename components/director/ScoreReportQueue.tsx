'use client';

import { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { supabase } from '@/lib/supabase';
import { formatRelativeTime } from '@/lib/utils';
import type { ScoreReport, Match, Player } from '@/lib/database.types';

interface ScoreReportWithDetails extends ScoreReport {
  match?: Match & {
    player1?: Player;
    player2?: Player;
    bracket?: {
      division?: {
        match_length: number;
        name: string;
      };
    };
  };
  reporter?: Player;
}

interface ScoreReportQueueProps {
  tournamentId: string;
  onScoreApproved?: () => void;
}

function getConfidenceBadge(score: number | null) {
  if (score === null) return <Badge variant="outline">Unknown</Badge>;
  if (score >= 80) return <Badge className="bg-green-100 text-green-800">High ({score}%)</Badge>;
  if (score >= 50) return <Badge className="bg-yellow-100 text-yellow-800">Medium ({score}%)</Badge>;
  return <Badge className="bg-red-100 text-red-800">Low ({score}%)</Badge>;
}

export function ScoreReportQueue({ tournamentId, onScoreApproved }: ScoreReportQueueProps) {
  const [reports, setReports] = useState<ScoreReportWithDetails[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingReport, setEditingReport] = useState<ScoreReportWithDetails | null>(null);
  const [editScores, setEditScores] = useState({ player1: 0, player2: 0 });
  const [processing, setProcessing] = useState<string | null>(null);

  const loadReports = useCallback(async () => {
    try {
      // Get all brackets for this tournament to filter matches
      const { data: brackets } = await supabase
        .from('brackets')
        .select('id, division:divisions!inner(tournament_id)')
        .eq('division.tournament_id', tournamentId);

      if (!brackets || brackets.length === 0) {
        setReports([]);
        setLoading(false);
        return;
      }

      const bracketIds = brackets.map((b) => b.id);

      // Get pending score reports for matches in this tournament's brackets
      const { data: reportData } = await supabase
        .from('score_reports')
        .select(`
          *,
          match:matches!inner (
            *,
            player1:players!matches_player1_id_fkey (*),
            player2:players!matches_player2_id_fkey (*),
            bracket:brackets!inner (
              division:divisions!inner (name, match_length)
            )
          ),
          reporter:players!score_reports_reported_by_player_id_fkey (*)
        `)
        .eq('status', 'pending')
        .in('match.bracket_id', bracketIds)
        .order('created_at', { ascending: false });

      setReports((reportData || []) as ScoreReportWithDetails[]);
    } catch (error) {
      console.error('Failed to load score reports:', error);
    } finally {
      setLoading(false);
    }
  }, [tournamentId]);

  useEffect(() => {
    loadReports();
  }, [loadReports]);

  // Real-time subscription
  useEffect(() => {
    const channel = supabase
      .channel('score-reports')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'score_reports' },
        () => loadReports()
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [loadReports]);

  const handleApprove = async (report: ScoreReportWithDetails, p1Score?: number, p2Score?: number) => {
    if (!report.match) return;

    setProcessing(report.id);
    try {
      const finalP1Score = p1Score ?? report.parsed_player1_score ?? 0;
      const finalP2Score = p2Score ?? report.parsed_player2_score ?? 0;
      const winnerId = finalP1Score > finalP2Score ? report.match.player1_id : report.match.player2_id;

      // Update the match
      const { error: matchError } = await supabase
        .from('matches')
        .update({
          winner_id: winnerId,
          player1_score: finalP1Score,
          player2_score: finalP2Score,
          status: 'completed',
          completed_at: new Date().toISOString(),
        })
        .eq('id', report.match_id);

      if (matchError) throw matchError;

      // Update the report status
      await supabase
        .from('score_reports')
        .update({
          status: 'approved',
          approved_at: new Date().toISOString(),
        })
        .eq('id', report.id);

      // Send confirmation SMS
      await fetch('/api/sms/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          to: report.reported_by_phone,
          message: `Your score has been approved! ${report.match.player1?.name} ${finalP1Score} - ${report.match.player2?.name} ${finalP2Score}`,
        }),
      });

      loadReports();
      onScoreApproved?.();
      setEditingReport(null);
    } catch (error) {
      console.error('Failed to approve score:', error);
    } finally {
      setProcessing(null);
    }
  };

  const handleReject = async (report: ScoreReportWithDetails, reason?: string) => {
    setProcessing(report.id);
    try {
      await supabase
        .from('score_reports')
        .update({ status: 'rejected' })
        .eq('id', report.id);

      // Send rejection SMS
      await fetch('/api/sms/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          to: report.reported_by_phone,
          message: reason
            ? `Your score report was not accepted: ${reason}. Please re-submit or see the tournament director.`
            : 'Your score report could not be processed. Please re-submit or see the tournament director.',
        }),
      });

      loadReports();
    } catch (error) {
      console.error('Failed to reject score:', error);
    } finally {
      setProcessing(null);
    }
  };

  const handleApproveAll = async () => {
    const highConfidenceReports = reports.filter(
      (r) => r.confidence_score !== null && r.confidence_score >= 80
    );

    for (const report of highConfidenceReports) {
      await handleApprove(report);
    }
  };

  const openEditDialog = (report: ScoreReportWithDetails) => {
    setEditingReport(report);
    setEditScores({
      player1: report.parsed_player1_score ?? 0,
      player2: report.parsed_player2_score ?? 0,
    });
  };

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Score Report Queue</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-gray-500">Loading...</p>
        </CardContent>
      </Card>
    );
  }

  const highConfidenceCount = reports.filter(
    (r) => r.confidence_score !== null && r.confidence_score >= 80
  ).length;

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <span>Score Report Queue</span>
            <Badge variant="outline">{reports.length} pending</Badge>
          </CardTitle>
          <CardDescription>SMS score reports from players awaiting approval</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {reports.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              <p>No pending score reports</p>
              <p className="text-sm mt-1">
                Players can text scores to the tournament phone number
              </p>
            </div>
          ) : (
            <>
              <div className="space-y-3">
                {reports.map((report) => (
                  <div
                    key={report.id}
                    className="p-4 border rounded-lg bg-gray-50 space-y-3"
                  >
                    {/* Header */}
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-mono text-gray-600">
                          {report.reported_by_phone}
                        </span>
                        {getConfidenceBadge(report.confidence_score)}
                        {report.match?.bracket?.division && (
                          <Badge variant="outline">
                            {report.match.bracket.division.name}
                          </Badge>
                        )}
                      </div>
                      <span className="text-xs text-gray-500">
                        {formatRelativeTime(report.created_at)}
                      </span>
                    </div>

                    {/* Match Info */}
                    {report.match && (
                      <div className="text-sm text-gray-600">
                        Match: {report.match.player1?.name || 'TBD'} vs{' '}
                        {report.match.player2?.name || 'TBD'}
                      </div>
                    )}

                    {/* Raw Text */}
                    <div className="bg-white p-2 rounded border">
                      <p className="text-sm text-gray-500 mb-1">Raw message:</p>
                      <p className="font-mono">&quot;{report.raw_text}&quot;</p>
                    </div>

                    {/* Parsed Result */}
                    <div>
                      <p className="text-sm text-gray-500 mb-1">Parsed as:</p>
                      {report.parsed_player1_score !== null &&
                      report.parsed_player2_score !== null ? (
                        <p className="font-medium">
                          {report.match?.player1?.name} {report.parsed_player1_score} -{' '}
                          {report.match?.player2?.name} {report.parsed_player2_score}
                        </p>
                      ) : (
                        <p className="text-red-600">Could not parse scores</p>
                      )}
                    </div>

                    {/* Actions */}
                    <div className="flex gap-2 pt-2">
                      <Button
                        size="sm"
                        className="bg-green-600 hover:bg-green-700"
                        onClick={() => handleApprove(report)}
                        disabled={
                          processing === report.id ||
                          report.parsed_player1_score === null ||
                          report.parsed_player2_score === null
                        }
                      >
                        {processing === report.id ? 'Processing...' : 'Approve'}
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => openEditDialog(report)}
                        disabled={processing === report.id}
                      >
                        Edit & Approve
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        className="text-red-600 hover:text-red-700"
                        onClick={() => handleReject(report)}
                        disabled={processing === report.id}
                      >
                        Reject
                      </Button>
                    </div>
                  </div>
                ))}
              </div>

              {/* Batch Actions */}
              {highConfidenceCount > 0 && (
                <div className="pt-4 border-t">
                  <Button onClick={handleApproveAll} className="w-full">
                    Approve All High-Confidence Reports ({highConfidenceCount})
                  </Button>
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>

      {/* Edit Dialog */}
      <Dialog open={!!editingReport} onOpenChange={() => setEditingReport(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Score</DialogTitle>
          </DialogHeader>
          {editingReport?.match && (
            <div className="space-y-4">
              <div className="text-sm text-gray-600 mb-4">
                Original message: &quot;{editingReport.raw_text}&quot;
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>{editingReport.match.player1?.name || 'Player 1'}</Label>
                  <Input
                    type="number"
                    min={0}
                    value={editScores.player1}
                    onChange={(e) =>
                      setEditScores((s) => ({ ...s, player1: parseInt(e.target.value) || 0 }))
                    }
                  />
                </div>
                <div>
                  <Label>{editingReport.match.player2?.name || 'Player 2'}</Label>
                  <Input
                    type="number"
                    min={0}
                    value={editScores.player2}
                    onChange={(e) =>
                      setEditScores((s) => ({ ...s, player2: parseInt(e.target.value) || 0 }))
                    }
                  />
                </div>
              </div>

              {editingReport.match.bracket?.division && (
                <p className="text-sm text-gray-500">
                  Match length: {editingReport.match.bracket.division.match_length} points
                </p>
              )}

              <div className="flex gap-2 justify-end">
                <Button variant="outline" onClick={() => setEditingReport(null)}>
                  Cancel
                </Button>
                <Button
                  onClick={() =>
                    handleApprove(editingReport, editScores.player1, editScores.player2)
                  }
                  disabled={processing === editingReport.id}
                >
                  Save & Approve
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
