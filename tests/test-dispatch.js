/**
 * Test LiveKit Agent Dispatch API directly
 */

require('dotenv').config({ path: './agent/.env' });
const { AccessToken } = require('livekit-server-sdk');

const LIVEKIT_URL = process.env.LIVEKIT_URL;
const LIVEKIT_API_KEY = process.env.LIVEKIT_API_KEY;
const LIVEKIT_API_SECRET = process.env.LIVEKIT_API_SECRET;

async function testDispatch() {
  console.log('Testing LiveKit Agent Dispatch...\n');
  console.log('LIVEKIT_URL:', LIVEKIT_URL);
  console.log('LIVEKIT_API_KEY:', LIVEKIT_API_KEY ? '***set***' : 'NOT SET');
  console.log('LIVEKIT_API_SECRET:', LIVEKIT_API_SECRET ? '***set***' : 'NOT SET');

  // Create API token with full admin permissions
  const at = new AccessToken(LIVEKIT_API_KEY, LIVEKIT_API_SECRET);
  at.addGrant({
    roomAdmin: true,
    roomCreate: true,
    // Try different permission combinations
    room: '*', // All rooms
    canPublish: true,
    canSubscribe: true,
  });
  const token = await at.toJwt();
  console.log('\nGenerated token:', token.substring(0, 50) + '...');

  // Convert URL
  const httpUrl = LIVEKIT_URL.replace('wss://', 'https://');
  const endpoint = `${httpUrl}/twirp/livekit.AgentDispatchService/CreateDispatch`;
  console.log('\nDispatch endpoint:', endpoint);

  // Test dispatch
  const roomName = `test_dispatch_${Date.now()}`;
  console.log('Test room:', roomName);

  try {
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
      },
      body: JSON.stringify({
        room: roomName,
        agent_name: '',
        metadata: JSON.stringify({ test: true }),
      }),
    });

    console.log('\nResponse status:', response.status);
    const text = await response.text();
    console.log('Response body:', text);

    if (response.ok) {
      console.log('\n✅ Dispatch successful!');
    } else {
      console.log('\n❌ Dispatch failed');
    }
  } catch (error) {
    console.error('\n❌ Error:', error.message);
  }
}

testDispatch().catch(console.error);
