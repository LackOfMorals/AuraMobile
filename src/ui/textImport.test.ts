/// <reference types="node" />
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

/** Every .tsx file under src, and App.tsx. */
function sources(dir: string): string[] {
  return readdirSync(dir).flatMap(name => {
    const path = join(dir, name);
    return statSync(path).isDirectory() ? sources(path) : path.endsWith('.tsx') ? [path] : [];
  });
}

describe('text', () => {
  it('always comes from src/ui/Text, which defaults to 17 pt, never from react-native, which defaults to 14 pt', () => {
    const offenders = [...sources('src'), 'App.tsx']
      .filter(file => !file.endsWith(join('ui', 'Text.tsx')))
      .filter(file => /import\s*\{[^}]*\bText\b[^}]*\}\s*from\s*'react-native'/s.test(readFileSync(file, 'utf8')));
    expect(offenders).toEqual([]);
  });
});
