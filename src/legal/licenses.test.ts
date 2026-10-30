import { dependencies } from '../../package.json';
import data from './licenses.json';

describe('the open source licence list', () => {
  const names = new Set(data.packages.map(p => p.name));

  it('includes every dependency, so adding one without regenerating the list fails here', () => {
    // Run: node scripts/generate-licenses.mjs
    for (const name of Object.keys(dependencies)) {
      expect(names.has(name)).toBe(true);
    }
  });

  it('gives every package and pod a licence text that exists', () => {
    for (const entry of [...data.packages, ...data.pods]) {
      expect(typeof (entry as { text?: string }).text).toBe('string');
      expect((data.texts as Record<string, string>)[(entry as { text: string }).text]!.length).toBeGreaterThan(100);
    }
  });

  it('credits the code derived from grandstack-web-aura under Apache-2.0', () => {
    const derived = data.packages.find(p => p.name.startsWith('grandstack-web-aura'));
    expect(derived?.license).toBe('Apache-2.0');
  });
});
