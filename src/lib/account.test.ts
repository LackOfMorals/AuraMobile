import { maskClientId } from './account';

describe('maskClientId', () => {
  it('keeps the first and last four characters of a long id', () => {
    expect(maskClientId('a1b2c3d4e5f6a7b8')).toBe('a1b2....a7b8');
  });
  it('hides a short id completely', () => {
    expect(maskClientId('short')).toBe('....');
    expect(maskClientId('elevenchars')).toBe('....');
  });
});
