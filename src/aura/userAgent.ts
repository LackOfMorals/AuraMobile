import { Platform } from 'react-native';
import { version } from '../../package.json';

/** One word, no spaces: a User-Agent product token. The display name is "Jax". */
export const APP_NAME = 'Jax';

/** App name, mobile OS, then version: `Jax/ios/0.1.0`. */
export const userAgentFor = (os: string, appVersion: string): string => `${APP_NAME}/${os}/${appVersion}`;

/**
 * Sent on every request to Aura, so Neo4j can tell this app, the platform and the version apart in its logs. The version is
 * package.json's, the one place it is set; userAgent.test.ts fails if the iOS or Android project disagrees.
 */
export const USER_AGENT = userAgentFor(Platform.OS, version);
