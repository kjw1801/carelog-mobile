import { clampName, NAME_BUDGET, nameWidth } from './name';

describe('nameWidth', () => {
  it('한글은 한 글자가 2다', () => {
    expect(nameWidth('은하')).toBe(4);
  });

  it('영문과 숫자는 한 글자가 1이다', () => {
    expect(nameWidth('Eunha12')).toBe(7);
  });

  it('섞이면 각각 더한다', () => {
    expect(nameWidth('은하 A')).toBe(2 + 2 + 1 + 1);
  });

  it('빈 문자열은 0이다', () => {
    expect(nameWidth('')).toBe(0);
  });

  it('이모지를 둘로 세지 않는다', () => {
    // `'👶'.length`는 2다. 코드 포인트로 돌지 않으면 두 배가 된다.
    expect(nameWidth('👶')).toBe(1);
  });
});

describe('clampName', () => {
  it('한글은 5자까지 들어간다', () => {
    expect(clampName('가나다라마')).toBe('가나다라마');
    expect(nameWidth('가나다라마')).toBe(NAME_BUDGET);
  });

  it('한글 6자째는 잘린다', () => {
    expect(clampName('가나다라마바')).toBe('가나다라마');
  });

  it('영문은 10자까지 들어간다', () => {
    expect(clampName('abcdefghij')).toBe('abcdefghij');
  });

  it('영문 11자째는 잘린다', () => {
    expect(clampName('abcdefghijk')).toBe('abcdefghij');
  });

  it('자리가 모자라면 한글을 반만 넣지 않는다', () => {
    // `abcdefghi`가 9라 1이 남는다. 한글은 2이므로 들어가지 못한다.
    expect(clampName('abcdefghi가')).toBe('abcdefghi');
  });

  it('예산 안이면 그대로 둔다', () => {
    expect(clampName('은하')).toBe('은하');
    expect(clampName('')).toBe('');
  });
});
