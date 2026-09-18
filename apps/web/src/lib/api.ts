const API_BASE = '/api';

export async function createRoom(): Promise<{ pin: string; joinUrl: string }> {
  const response = await fetch(`${API_BASE}/rooms`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
  });
  
  if (!response.ok) {
    throw new Error('Failed to create room');
  }
  
  return response.json();
}

export async function checkRoom(pin: string): Promise<{ pin: string; status: string; playerCount: number; entryLocked: boolean } | null> {
  const response = await fetch(`${API_BASE}/rooms/${pin}`);
  
  if (response.status === 404) {
    return null;
  }
  
  if (!response.ok) {
    throw new Error('Failed to check room');
  }
  
  return response.json();
}
