import { NextRequest, NextResponse } from 'next/server';

const CAS_URL = process.env.CAS_SERVICE_URL ?? 'http://localhost:8000';

function vercelCasUrl() {
  if (process.env.CAS_SERVICE_URL) return null;
  if (!process.env.VERCEL_URL) return null;
  return `https://${process.env.VERCEL_URL}/api/cas_service`;
}

export async function POST(req: NextRequest) {
  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const { action, ...params } = body as { action: string; [k: string]: unknown };

  if (action !== 'equivalence' && action !== 'steps') {
    return NextResponse.json({ error: 'action must be "equivalence" or "steps"' }, { status: 400 });
  }

  try {
    const internalUrl = vercelCasUrl();
    const upstream = await fetch(internalUrl ?? `${CAS_URL}${action === 'equivalence' ? '/verify/equivalence' : '/verify/steps'}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(internalUrl ? { action, ...params } : params),
      signal: AbortSignal.timeout(15_000),
    });
    const data = await upstream.json();
    return NextResponse.json(data, { status: upstream.status });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: `CAS service unreachable: ${msg}` }, { status: 502 });
  }
}
