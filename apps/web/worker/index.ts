import { GameRoom } from './game-room.js';

export { GameRoom };

export interface Env {
  GAME_ROOM: DurableObjectNamespace<GameRoom>;
  ASSETS: Fetcher;
}

// In-memory sliding-window rate limiter for room creation (P1.9)
const ROOM_CREATION_WINDOW_MS = 60_000;
const MAX_ROOM_CREATIONS_PER_WINDOW = 10;
const ipRoomCreationHistory = new Map<string, number[]>();

function isRateLimited(ip: string): boolean {
  const now = Date.now();
  const windowStart = now - ROOM_CREATION_WINDOW_MS;
  const history = (ipRoomCreationHistory.get(ip) || []).filter(timestamp => timestamp > windowStart);
  
  if (history.length >= MAX_ROOM_CREATIONS_PER_WINDOW) {
    ipRoomCreationHistory.set(ip, history);
    return true;
  }
  
  history.push(now);
  ipRoomCreationHistory.set(ip, history);
  
  // Periodic cleanup if map grows too large
  if (ipRoomCreationHistory.size > 1000) {
    for (const [key, timestamps] of ipRoomCreationHistory.entries()) {
      const valid = timestamps.filter(t => t > windowStart);
      if (valid.length === 0) {
        ipRoomCreationHistory.delete(key);
      } else {
        ipRoomCreationHistory.set(key, valid);
      }
    }
  }
  
  return false;
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
    // Check payload size (P1.9)
    const contentLength = request.headers.get('content-length');
    if (contentLength && parseInt(contentLength, 10) > 32768) {
      return Response.json(
        { error: 'PAYLOAD_TOO_LARGE', message: 'Payload size exceeds 32KB' },
        { status: 413, headers: corsHeaders() }
      );
    }

    // Rate limiting by client IP (P1.9)
    const clientIp = request.headers.get('cf-connecting-ip')
      || request.headers.get('x-forwarded-for')?.split(',')[0].trim()
      || request.headers.get('x-real-ip')
      || '127.0.0.1';

    if (isRateLimited(clientIp)) {
      return Response.json(
        { error: 'RATE_LIMITED', message: 'Too many room creation requests. Please try again later.' },
        { status: 429, headers: { 'Retry-After': '60', ...corsHeaders() } }
      );
    }

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
    
    const headers = new Headers(corsHeaders());
    // P1.8 Host Session Security: set HttpOnly cookie for host session
    headers.set('Set-Cookie', `batalha_host_${pin}=${hostToken}; Path=/; HttpOnly; SameSite=Strict`);

    return Response.json({ pin, joinUrl, hostToken }, {
      status: 201,
      headers,
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
