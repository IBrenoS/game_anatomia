import { GameRoom } from './game-room.js';

export { GameRoom };

export interface Env {
  GAME_ROOM: DurableObjectNamespace<GameRoom>;
  ASSETS: Fetcher;
}

export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const url = new URL(request.url);
    
    // API routes
    if (url.pathname.startsWith('/api/')) {
      return handleApi(request, env, url);
    }
    
    // Static assets / SPA fallback handled by ASSETS binding
    return env.ASSETS.fetch(request);
  },
};

async function handleApi(request: Request, env: Env, url: URL): Promise<Response> {
  // POST /api/rooms - Create room
  if (url.pathname === '/api/rooms' && request.method === 'POST') {
    const pin = generatePin();
    const id = env.GAME_ROOM.idFromName(pin);
    const stub = env.GAME_ROOM.get(id);
    
    const hostToken = crypto.randomUUID();
    const initResponse = await stub.fetch(new Request('http://internal/init', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ pin, hostToken }),
    }));
    
    if (!initResponse.ok) {
      return initResponse;
    }
    
    const joinUrl = `${url.origin}/join/${pin}`;
    
    return Response.json({ pin, joinUrl, hostToken }, {
      status: 201,
      headers: corsHeaders(),
    });
  }
  
  // GET /api/rooms/:pin - Check room
  const roomMatch = url.pathname.match(/^\/api\/rooms\/(\d{6})$/);
  if (roomMatch && request.method === 'GET') {
    const pin = roomMatch[1];
    const id = env.GAME_ROOM.idFromName(pin);
    const stub = env.GAME_ROOM.get(id);
    const res = await stub.fetch(new Request('http://internal/status'));
    return new Response(res.body, { status: res.status, headers: corsHeaders() });
  }
  
  // WebSocket upgrade: /api/rooms/:pin/ws
  const wsMatch = url.pathname.match(/^\/api\/rooms\/(\d{6})\/ws$/);
  if (wsMatch) {
    const pin = wsMatch[1];
    const id = env.GAME_ROOM.idFromName(pin);
    const stub = env.GAME_ROOM.get(id);
    return stub.fetch(request);
  }
  
  // OPTIONS for CORS
  if (request.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: corsHeaders() });
  }
  
  return Response.json({ error: 'Not found' }, { status: 404 });
}

function generatePin(): string {
  const array = new Uint32Array(1);
  crypto.getRandomValues(array);
  return String(array[0] % 1_000_000).padStart(6, '0');
}

function corsHeaders(): HeadersInit {
  return {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
  };
}
