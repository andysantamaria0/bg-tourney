'use client';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { formatRelativeTime } from '@/lib/utils';

// Mock data for Phase 1 UI demonstration
const mockScoreReports = [
  {
    id: '1',
    phone: '+1-555-0123',
    rawText: 'John 9 Sarah 4',
    parsedMatch: 'John Wilson def. Sarah Chen 9-4',
    confidence: 'high' as const,
    timestamp: new Date(Date.now() - 2 * 60 * 1000).toISOString(), // 2 min ago
  },
  {
    id: '2',
    phone: '+1-555-0456',
    rawText: 'Mike beat Lisa 7-2',
    parsedMatch: 'Mike Thompson def. Lisa Park 7-2',
    confidence: 'high' as const,
    timestamp: new Date(Date.now() - 5 * 60 * 1000).toISOString(), // 5 min ago
  },
  {
    id: '3',
    phone: '+1-555-0789',
    rawText: "We're done table 5",
    parsedMatch: 'Could not parse score',
    confidence: 'low' as const,
    timestamp: new Date(Date.now() - 8 * 60 * 1000).toISOString(), // 8 min ago
  },
  {
    id: '4',
    phone: '+1-555-0321',
    rawText: 'David won 5-3',
    parsedMatch: 'David Lee wins 5-3 (opponent unknown)',
    confidence: 'medium' as const,
    timestamp: new Date(Date.now() - 12 * 60 * 1000).toISOString(), // 12 min ago
  },
];

function getConfidenceBadge(confidence: 'high' | 'medium' | 'low') {
  switch (confidence) {
    case 'high':
      return <Badge className="bg-green-100 text-green-800">High Confidence</Badge>;
    case 'medium':
      return <Badge className="bg-yellow-100 text-yellow-800">Medium</Badge>;
    case 'low':
      return <Badge className="bg-red-100 text-red-800">Low Confidence</Badge>;
  }
}

export function ScoreReportQueue() {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <span>Score Report Queue</span>
          <Badge variant="outline">{mockScoreReports.length} pending</Badge>
        </CardTitle>
        <CardDescription>
          SMS score reports from players awaiting approval
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Info Banner */}
        <Alert>
          <AlertTitle>SMS Integration Coming Soon</AlertTitle>
          <AlertDescription>
            This is a preview of the score reporting interface. SMS integration with Twilio
            will be enabled in Phase 2. For now, use manual score entry.
          </AlertDescription>
        </Alert>

        {/* Mock Reports */}
        <div className="space-y-3">
          {mockScoreReports.map((report) => (
            <div
              key={report.id}
              className="p-4 border rounded-lg bg-gray-50 space-y-3"
            >
              {/* Header */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-mono text-gray-600">{report.phone}</span>
                  {getConfidenceBadge(report.confidence)}
                </div>
                <span className="text-xs text-gray-500">
                  {formatRelativeTime(report.timestamp)}
                </span>
              </div>

              {/* Raw Text */}
              <div className="bg-white p-2 rounded border">
                <p className="text-sm text-gray-500 mb-1">Raw message:</p>
                <p className="font-mono">&quot;{report.rawText}&quot;</p>
              </div>

              {/* Parsed Result */}
              <div>
                <p className="text-sm text-gray-500 mb-1">Parsed as:</p>
                <p className={report.confidence === 'low' ? 'text-red-600' : 'font-medium'}>
                  {report.confidence === 'low' ? '⚠️ ' : ''}
                  {report.parsedMatch}
                </p>
              </div>

              {/* Actions */}
              <div className="flex gap-2 pt-2">
                <Button
                  size="sm"
                  className="bg-green-600 hover:bg-green-700"
                  disabled
                >
                  Approve
                </Button>
                <Button size="sm" variant="outline" disabled>
                  Edit
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  className="text-red-600 hover:text-red-700"
                  disabled
                >
                  Reject
                </Button>
              </div>
            </div>
          ))}
        </div>

        {/* Batch Actions */}
        <div className="pt-4 border-t">
          <Button disabled className="w-full">
            Approve All High-Confidence Reports
          </Button>
          <p className="text-xs text-center text-gray-500 mt-2">
            Buttons disabled - SMS integration not yet active
          </p>
        </div>
      </CardContent>
    </Card>
  );
}
