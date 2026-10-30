import { Platform } from 'react-native';
import { version } from '../../package.json';
import { APP_NAME } from '../appName';

/** App name, mobile OS, then version, for example `Jue/ios/0.1.0`. The name is one word with no spaces, as a User-Agent product token must be. */
export const userAgentFor = (os: string, appVersion: string): string => `${APP_NAME}/${os}/${appVersion}`;

/**
 * Sent on every request to Aura, so Neo4j can tell this app, the platform and the version apart in its logs. The version is
 * package.json's, the one place it is set; userAgent.test.ts fails if the iOS or Android project disagrees.
 */
export const USER_AGENT = userAgentFor(Platform.OS, version);
