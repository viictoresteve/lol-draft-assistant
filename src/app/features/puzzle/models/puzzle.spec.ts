import { computeRoundPoints, applyRealDataFloor, GRADE_POINTS } from './puzzle.interface';

describe('computeRoundPoints', () => {
  it('awards full points for a perfect first-try pick (hints on)', () => {
    expect(computeRoundPoints('perfect', 0, true, false)).toBe(100);
  });

  it('awards 70 for a great first-try pick', () => {
    expect(computeRoundPoints('great', 0, true, false)).toBe(70);
  });

  it('subtracts 20 points per wrong attempt', () => {
    expect(computeRoundPoints('perfect', 1, true, false)).toBe(80);
    expect(computeRoundPoints('perfect', 2, true, false)).toBe(60);
    expect(computeRoundPoints('great', 1, true, false)).toBe(50);
  });

  it('never drops below the floor of 15 when solved', () => {
    expect(computeRoundPoints('great', 10, true, false)).toBe(15);
    expect(computeRoundPoints('perfect', 99, true, false)).toBe(15);
  });

  it('applies the +30% hardcore multiplier when hints are off', () => {
    expect(computeRoundPoints('perfect', 0, false, false)).toBe(130);
    expect(computeRoundPoints('great', 0, false, false)).toBe(91); // round(70 * 1.3)
    expect(computeRoundPoints('perfect', 1, false, false)).toBe(104); // round(80 * 1.3)
  });

  it('returns 0 when the player gave up, regardless of grade', () => {
    expect(computeRoundPoints('perfect', 0, true, true)).toBe(0);
    expect(computeRoundPoints('great', 0, false, true)).toBe(0);
  });

  it('grade points constants are ordered correctly', () => {
    expect(GRADE_POINTS.perfect).toBeGreaterThan(GRADE_POINTS.great);
    expect(GRADE_POINTS.great).toBeGreaterThan(GRADE_POINTS.good);
    expect(GRADE_POINTS.trap).toBe(0);
  });
});

describe('applyRealDataFloor', () => {
  it('upgrades a "trap" to "good" when real WR proves it wins lane (>=53%)', () => {
    expect(applyRealDataFloor('trap', 61)).toBe('good');
    expect(applyRealDataFloor('trap', 53)).toBe('good');
  });

  it('upgrades a "questionable" to "good" with strong real WR', () => {
    expect(applyRealDataFloor('questionable', 55)).toBe('good');
  });

  it('does NOT upgrade when WR is below the 53% threshold', () => {
    expect(applyRealDataFloor('trap', 52)).toBe('trap');
    expect(applyRealDataFloor('trap', 48)).toBe('trap');
  });

  it('does NOT touch already-strong grades (no false promotion to great/perfect)', () => {
    expect(applyRealDataFloor('good', 61)).toBe('good');
    expect(applyRealDataFloor('great', 61)).toBe('great');
    expect(applyRealDataFloor('perfect', 61)).toBe('perfect');
  });

  it('never downgrades on lane data alone (comp fit stays the AI\'s call)', () => {
    // A "perfect" comp pick that happens to lose lane stays perfect
    expect(applyRealDataFloor('perfect', 45)).toBe('perfect');
    expect(applyRealDataFloor('great', 40)).toBe('great');
  });

  it('is a no-op when there is no real win-rate data', () => {
    expect(applyRealDataFloor('trap', undefined)).toBe('trap');
    expect(applyRealDataFloor('questionable', undefined)).toBe('questionable');
  });
});
