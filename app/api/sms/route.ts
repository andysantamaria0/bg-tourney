import { NextRequest, NextResponse } from 'next/server';

/**
 * SMS Webhook Endpoint (Stub for Phase 2)
 *
 * This endpoint will receive incoming SMS messages from Twilio in Phase 2.
 * For now, it returns a placeholder response.
 *
 * Phase 2 Implementation will:
 * 1. Validate the Twilio signature
 * 2. Parse the incoming message (from, body)
 * 3. Use the score parser to extract match results
 * 4. Create a score_report record
 * 5. Optionally auto-approve high-confidence reports
 * 6. Send a confirmation SMS back to the player
 */

export async function POST(request: NextRequest) {
  // Log the incoming request for debugging
  console.log('SMS webhook received:', new Date().toISOString());

  try {
    // In Phase 2, we'll parse the Twilio request body
    const formData = await request.formData();
    const from = formData.get('From') as string;
    const body = formData.get('Body') as string;

    console.log('From:', from);
    console.log('Body:', body);

    // Return TwiML response (Twilio Markup Language)
    // This tells Twilio what to do after receiving the message
    const twimlResponse = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Message>Thanks for your score report! SMS integration will be fully enabled in Phase 2.</Message>
</Response>`;

    return new NextResponse(twimlResponse, {
      status: 200,
      headers: {
        'Content-Type': 'text/xml',
      },
    });
  } catch (error) {
    console.error('SMS webhook error:', error);

    return new NextResponse(
      `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Message>Sorry, there was an error processing your message. Please try again.</Message>
</Response>`,
      {
        status: 200, // Always return 200 to Twilio
        headers: {
          'Content-Type': 'text/xml',
        },
      }
    );
  }
}

// Also handle GET requests for webhook verification
export async function GET() {
  return NextResponse.json({
    status: 'ok',
    message: 'SMS webhook endpoint is ready. Full integration coming in Phase 2.',
    endpoint: '/api/sms',
  });
}
