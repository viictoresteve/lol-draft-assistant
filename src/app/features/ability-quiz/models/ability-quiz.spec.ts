import { computeQuizPoints, PTS_CHAMPION, PTS_SLOT, HINT_PENALTY } from './ability-quiz.interface';

describe('computeQuizPoints', () => {
  it('awards full points for both correct (no hint)', () => {
    expect(computeQuizPoints(true, true, false)).toBe(PTS_CHAMPION + PTS_SLOT); // 100
  });

  it('awards only champion points when slot is wrong', () => {
    expect(computeQuizPoints(true, false, false)).toBe(PTS_CHAMPION); // 60
  });

  it('awards only slot points when champion is wrong', () => {
    expect(computeQuizPoints(false, true, false)).toBe(PTS_SLOT); // 40
  });

  it('awards zero when both are wrong', () => {
    expect(computeQuizPoints(false, false, false)).toBe(0);
  });

  it('subtracts the hint penalty from the earned points', () => {
    expect(computeQuizPoints(true, true, true)).toBe(100 - HINT_PENALTY);  // 75
    expect(computeQuizPoints(true, false, true)).toBe(60 - HINT_PENALTY);  // 35
    expect(computeQuizPoints(false, true, true)).toBe(40 - HINT_PENALTY);  // 15
  });

  it('never goes negative when hint penalty exceeds earned points', () => {
    expect(computeQuizPoints(false, false, true)).toBe(0);
  });
});
