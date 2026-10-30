/// <reference types="node" />
import { readFileSync } from 'node:fs';
import { Platform } from 'react-native';
import { version } from '../../package.json';
import { APP_NAME, USER_AGENT, userAgentFor } from './userAgent';

const read = (path: string) => readFileSync(new URL(`../../${path}`, `file://${__dirname}/`), 'utf8');

describe('USER_AGENT', () => {
  it('is the app name, the mobile OS and the version, in that order', () => {
    expect(userAgentFor('ios', '0.1.0')).toBe('Jax/ios/0.1.0');
    expect(userAgentFor('android', '1.2.3')).toBe('Jax/android/1.2.3');
    expect(APP_NAME).not.toContain(' ');
  });

  it('uses the platform this runs on and the version in package.json', () => {
    expect(USER_AGENT).toBe(`Jax/${Platform.OS}/${version}`);
    expect(USER_AGENT).toMatch(/^Jax\/(ios|android)\/\d+\.\d+\.\d+$/);
  });

  it('matches the version in the iOS project, so the App Store build and the header agree', () => {
    const versions = [...read('ios/AuraMobile.xcodeproj/project.pbxproj').matchAll(/MARKETING_VERSION = ([^;]+);/g)].map(m => m[1]);
    expect(versions.length).toBeGreaterThan(0);
    for (const v of versions) {
      expect(v).toBe(version);
    }
  });

  it('matches the version in the Android project', () => {
    expect(/versionName "([^"]+)"/.exec(read('android/app/build.gradle'))?.[1]).toBe(version);
  });
});
