/**
 * The file "Save to Files" writes: an instance's address, username and password as environment variables, in the same names the Aura
 * console uses for its own credentials download, so tools that read `.env` style files (and Neo4j's driver examples) can use it as it is.
 * It never holds the Aura API client ID or secret.
 */
import { APP_NAME } from '../appName';

export interface ConnectionDetails {
  uri: string;
  username: string;
  password: string;
  instanceId: string;
  instanceName: string;
}

/** Characters that need no quoting in a `.env` file. Anything else, including spaces, quotes, # and $, is quoted. */
const PLAIN = /^[A-Za-z0-9_@%+=:,./-]+$/;

export function envValue(value: string): string {
  if (PLAIN.test(value)) {
    return value;
  }
  return `"${value.replace(/\\/g, '\\\\').replace(/"/g, '\\"').replace(/\r?\n/g, '\\n')}"`;
}

/** A name for the header comment: one line, so a name can never add a line of its own to the file. */
const oneLine = (text: string): string => text.replace(/[\u0000-\u001f\u007f\u2028\u2029]+/g, ' ').trim();

export function buildConnectionFile(details: ConnectionDetails, createdAt: Date): string {
  return (
    [
      `# Created by ${APP_NAME} on ${createdAt.toISOString()} for the Aura instance "${oneLine(details.instanceName)}".`,
      '# This file contains a database password. Keep it private and do not commit it to version control.',
      `NEO4J_URI=${envValue(details.uri)}`,
      `NEO4J_USERNAME=${envValue(details.username)}`,
      `NEO4J_PASSWORD=${envValue(details.password)}`,
      `AURA_INSTANCEID=${envValue(details.instanceId)}`,
      `AURA_INSTANCENAME=${envValue(oneLine(details.instanceName))}`,
    ].join('\n') + '\n'
  );
}

const slug = (text: string, max: number): string =>
  text
    .normalize('NFKD')
    .replace(/[^A-Za-z0-9._-]+/g, '-')
    .replace(/-{2,}/g, '-')
    .replace(/^[-.]+|[-.]+$/g, '')
    .slice(0, max)
    .replace(/[-.]+$/g, '');

/** For example `<App name>-orders-prod-d0000001-connection.txt`. Made of the instance's name and id only, never a secret. */
export function connectionFileName(instanceName: string, auraId: string): string {
  return `${APP_NAME}-${slug(instanceName, 40) || 'instance'}-${slug(auraId, 40) || 'id'}-connection.txt`;
}
