/** For example a1b2c3d4e5f6a7b8 becomes a1b2....a7b8. Short ids are hidden completely. */
export function maskClientId(clientId: string): string {
  return clientId.length >= 12 ? `${clientId.slice(0, 4)}....${clientId.slice(-4)}` : '....';
}
