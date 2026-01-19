import { NextRequest, NextResponse } from 'next/server';
import { validateTwilioSignature, twimlResponse } from '@/lib/twilio';
import { parseScoreText, validateScore } from '@/lib/score-parser';
import { supabase } from '@/lib/supabase';

/**
 * SMS Webhook Endpoint for Twilio
 * Receives incoming SMS messages and processes score reports
 */
export async function POST(request: NextRequest) {
  console.log('SMS webhook received:', new Date().toISOString());

  try {
    // Parse form data from Twilio
    const formData = await request.formData();
    const params: Record<string, string> = {};
    formData.forEach((value, key) => {
      params[key] = value.toString();
    });

    const from = params['From'] || '';
    const body = params['Body'] || '';
    const signature = request.headers.get('x-twilio-signature') || '';

    console.log('From:', from);
    console.log('Body:', body);

    // Validate Twilio signature in production
    if (process.env.NODE_ENV === 'production') {
      const url = `${process.env.NEXT_PUBLIC_APP_URL || ''}/api/sms`;
      if (!validateTwilioSignature(signature, url, params)) {
        console.error('Invalid Twilio signature');
        return new NextResponse(twimlResponse('Invalid request'), {
          status: 200,
          headers: { 'Content-Type': 'text/xml' },
        });
      }
    }

    // Clean phone number (remove formatting)
    const cleanPhone = from.replace(/\D/g, '');
    const phoneVariants = [from, `+${cleanPhone}`, cleanPhone, `+1${cleanPhone}`];

    // Find player by phone number
    const { data: player } = await supabase
      .from('players')
      .select('*')
      .or(phoneVariants.map(p => `phone.eq.${p}`).join(','))
      .single();

    if (!player) {
      return new NextResponse(
        twimlResponse(
          "We couldn't find your phone number in our system. Please check in with the tournament director."
        ),
        { status: 200, headers: { 'Content-Type': 'text/xml' } }
      );
    }

    // Find active matches for this player
    const { data: activeMatches } = await supabase
      .from('matches')
      .select(`
        *,
        bracket:brackets!inner (
          *,
          division:divisions!inner (*)
        ),
        player1:players!matches_player1_id_fkey (*),
        player2:players!matches_player2_id_fkey (*)
      `)
      .or(`player1_id.eq.${player.id},player2_id.eq.${player.id}`)
      .in('status', ['pending', 'in_progress']);

    if (!activeMatches || activeMatches.length === 0) {
      return new NextResponse(
        twimlResponse(
          "You don't have any active matches right now. Please check with the tournament director."
        ),
        { status: 200, headers: { 'Content-Type': 'text/xml' } }
      );
    }

    // If multiple active matches, try to match based on player names in the message
    let targetMatch = activeMatches[0];
    if (activeMatches.length > 1) {
      const bodyLower = body.toLowerCase();
      for (const match of activeMatches) {
        const p1Name = (match.player1 as { name: string })?.name?.toLowerCase() || '';
        const p2Name = (match.player2 as { name: string })?.name?.toLowerCase() || '';
        if (bodyLower.includes(p1Name) || bodyLower.includes(p2Name)) {
          targetMatch = match;
          break;
        }
      }
    }

    // Parse the score from SMS text
    const parsed = parseScoreText(body);
    const bracket = targetMatch.bracket as { division: { match_length: number } };
    const matchLength = bracket?.division?.match_length || 9;

    // Determine if we can identify the winner
    let parsedWinnerId: string | null = null;
    if (parsed.player1Score !== undefined && parsed.player2Score !== undefined) {
      const validation = validateScore(parsed, matchLength);
      if (validation.valid) {
        // Try to match winner name if provided
        if (parsed.winnerName) {
          const winnerNameLower = parsed.winnerName.toLowerCase();
          const p1 = targetMatch.player1 as { id: string; name: string } | null;
          const p2 = targetMatch.player2 as { id: string; name: string } | null;

          if (p1?.name?.toLowerCase().includes(winnerNameLower)) {
            parsedWinnerId = p1.id;
          } else if (p2?.name?.toLowerCase().includes(winnerNameLower)) {
            parsedWinnerId = p2.id;
          }
        }

        // If no name match, determine by scores
        if (!parsedWinnerId && parsed.player1Score !== undefined && parsed.player2Score !== undefined) {
          if (parsed.player1Score > parsed.player2Score) {
            parsedWinnerId = targetMatch.player1_id;
          } else {
            parsedWinnerId = targetMatch.player2_id;
          }
        }
      }
    }

    // Calculate confidence score (0-100)
    let confidenceScore = 0;
    if (parsed.confidence === 'high') confidenceScore = 90;
    else if (parsed.confidence === 'medium') confidenceScore = 60;
    else confidenceScore = 30;

    // Reduce confidence if scores don't validate
    if (parsed.player1Score !== undefined && parsed.player2Score !== undefined) {
      const validation = validateScore(parsed, matchLength);
      if (!validation.valid) {
        confidenceScore = Math.min(confidenceScore, 40);
      }
    }

    // Create score report
    const { data: scoreReport, error: reportError } = await supabase
      .from('score_reports')
      .insert({
        match_id: targetMatch.id,
        reported_by_phone: from,
        reported_by_player_id: player.id,
        raw_text: body,
        parsed_winner_id: parsedWinnerId,
        parsed_player1_score: parsed.player1Score ?? null,
        parsed_player2_score: parsed.player2Score ?? null,
        confidence_score: confidenceScore,
        status: 'pending',
      })
      .select()
      .single();

    if (reportError) {
      console.error('Failed to create score report:', reportError);
      return new NextResponse(
        twimlResponse('Sorry, there was an error recording your score. Please try again or contact the director.'),
        { status: 200, headers: { 'Content-Type': 'text/xml' } }
      );
    }

    // Auto-approve high confidence scores (90+)
    const p1 = targetMatch.player1 as { name: string } | null;
    const p2 = targetMatch.player2 as { name: string } | null;

    if (confidenceScore >= 90 && parsedWinnerId && parsed.player1Score !== undefined && parsed.player2Score !== undefined) {
      // Update the match directly
      const { error: matchError } = await supabase
        .from('matches')
        .update({
          winner_id: parsedWinnerId,
          player1_score: parsed.player1Score,
          player2_score: parsed.player2Score,
          status: 'completed',
          completed_at: new Date().toISOString(),
        })
        .eq('id', targetMatch.id);

      if (!matchError) {
        // Mark report as approved
        await supabase
          .from('score_reports')
          .update({ status: 'approved', approved_at: new Date().toISOString() })
          .eq('id', scoreReport.id);

        const winnerName = parsedWinnerId === targetMatch.player1_id ? p1?.name : p2?.name;
        return new NextResponse(
          twimlResponse(
            `Score recorded! ${winnerName} wins ${parsed.player1Score}-${parsed.player2Score}. Thanks for reporting!`
          ),
          { status: 200, headers: { 'Content-Type': 'text/xml' } }
        );
      }
    }

    // Score needs director approval
    let responseMsg = 'Thanks! Your score report has been received and is pending director approval.';
    if (parsed.player1Score !== undefined && parsed.player2Score !== undefined) {
      responseMsg = `Score report received: ${p1?.name || 'Player 1'} ${parsed.player1Score} - ${p2?.name || 'Player 2'} ${parsed.player2Score}. Pending director approval.`;
    }

    return new NextResponse(twimlResponse(responseMsg), {
      status: 200,
      headers: { 'Content-Type': 'text/xml' },
    });
  } catch (error) {
    console.error('SMS webhook error:', error);
    return new NextResponse(
      twimlResponse('Sorry, there was an error processing your message. Please try again.'),
      { status: 200, headers: { 'Content-Type': 'text/xml' } }
    );
  }
}

// Handle GET requests for webhook verification
export async function GET() {
  return NextResponse.json({
    status: 'ok',
    message: 'SMS webhook endpoint is ready',
    endpoint: '/api/sms',
  });
}
