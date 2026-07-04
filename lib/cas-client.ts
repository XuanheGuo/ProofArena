export type CASMethod =
  | 'symbolic'
  | 'numeric'
  | 'undecidable'
  | 'parse_error'
  | 'condition'
  | 'derived'
  | 'equivalent'
  | 'no_math'
  | 'no_equation'
  | 'partial'
  | 'mixed';

export interface EquivalenceResult {
  equivalent: boolean | null;
  method: CASMethod;
  error?: string;
}

export interface StepVerification {
  step: string;
  index: number;
  valid: boolean | null;
  method: CASMethod;
  detail?: string;
  error?: string;
}

export interface StepsResult {
  verifications: StepVerification[];
  summary: string;
}

export async function casCheckEquivalence(
  exprA: string,
  exprB: string,
): Promise<EquivalenceResult> {
  const res = await fetch('/api/cas', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action: 'equivalence', expr_a: exprA, expr_b: exprB }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    return { equivalent: null, method: 'parse_error', error: (err as { error?: string }).error ?? `HTTP ${res.status}` };
  }
  return res.json();
}

export async function casCheckSteps(steps: string[]): Promise<StepsResult> {
  const res = await fetch('/api/cas', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action: 'steps', steps }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    return {
      verifications: [],
      summary: (err as { error?: string }).error ?? `HTTP ${res.status}`,
    };
  }
  return res.json();
}
