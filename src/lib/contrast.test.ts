import { contrastRatio, luminance } from './contrast';

describe('contrastRatio', () => {
  it('검정과 흰색이 21:1이다', () => {
    expect(contrastRatio('#000000', '#ffffff')).toBeCloseTo(21, 5);
  });

  it('같은 색은 1:1이다', () => {
    expect(contrastRatio('#0a84ff', '#0a84ff')).toBeCloseTo(1, 10);
  });

  it('순서를 바꿔도 같다', () => {
    expect(contrastRatio('#1c1c1e', '#ffffff')).toBeCloseTo(
      contrastRatio('#ffffff', '#1c1c1e'),
      10,
    );
  });

  it('세 자리 표기를 여섯 자리와 같게 센다', () => {
    expect(contrastRatio('#fff', '#000')).toBeCloseTo(contrastRatio('#ffffff', '#000000'), 10);
  });

  it('색 형식이 아니면 던진다', () => {
    expect(() => contrastRatio('rgb(0,0,0)', '#fff')).toThrow();
    expect(() => contrastRatio('#12345', '#fff')).toThrow();
  });

  it('이미 손으로 계산해 둔 값과 맞는다', () => {
    // 수면 버튼 색을 고를 때 쓴 수치다. 계산식이 바뀌면 여기서 걸린다.
    expect(contrastRatio('#ffffff', '#b85c00')).toBeCloseTo(4.6, 1);
    expect(contrastRatio('#ffffff', '#9f3a20')).toBeCloseTo(6.77, 1);
    expect(contrastRatio('#0a5cbf', '#f2f2f7')).toBeCloseTo(5.71, 1);
  });
});

describe('luminance', () => {
  it('검정이 0이고 흰색이 1이다', () => {
    expect(luminance('#000000')).toBeCloseTo(0, 10);
    expect(luminance('#ffffff')).toBeCloseTo(1, 10);
  });
});
