const requests = new Map<string, { date: string; count: number }>();
export function allowAiRequest(userId: string, limit = 30) { const date = new Date().toISOString().slice(0, 10); const current = requests.get(userId); if (!current || current.date !== date) { requests.set(userId, { date, count: 1 }); return true; } if (current.count >= limit) return false; current.count += 1; return true; }
