import ReactTestRenderer from 'react-test-renderer';
import { APP_NAME } from '../appName';
import type { ExportDeps } from '../services/exportConnection';
import { ICLOUD_OFF_TEXT, SaveToFiles, WARNING_TEXT, WARNING_TITLE } from './SaveToFiles';

let mockIcloud = true;
jest.mock('../native/fileExport', () => ({
  fileExportAvailable: true,
  fileExport: { iCloudSignedIn: () => Promise.resolve(mockIcloud), saveText: jest.fn(), sweep: jest.fn() },
}));
// The real vault needs the device's Keychain and database
jest.mock('../security/instanceVault', () => ({ instanceVault: {} }));

const instance = { auraId: 'd0000001', name: 'orders-prod', connectionUrl: 'neo4j+s://d0000001.databases.neo4j.io' };

function fakeDeps() {
  const calls: string[] = [];
  const deps: ExportDeps = {
    reveal: async () => { calls.push('reveal'); return { username: 'neo4j', password: 'pw' }; },
    saveText: async name => { calls.push('save'); return { saved: true, name }; },
    recordExport: async () => { calls.push('record'); },
    now: () => new Date('2026-10-30T12:00:00Z'),
  };
  return { deps, calls };
}

const text = (r: ReactTestRenderer.ReactTestRenderer) => JSON.stringify(r.toJSON());
const textOf = (n: ReactTestRenderer.ReactTestInstance | string): string => (typeof n === 'string' ? n : n.children.map(textOf).join(''));
function press(r: ReactTestRenderer.ReactTestRenderer, label: string) {
  const hit = r.root.findAll(n => typeof n.props.onPress === 'function' && textOf(n) === label)[0];
  if (!hit) {
    throw new Error(`No button "${label}"`);
  }
  return ReactTestRenderer.act(async () => {
    await hit.props.onPress();
  });
}
async function render(deps: ExportDeps) {
  let r!: ReactTestRenderer.ReactTestRenderer;
  await ReactTestRenderer.act(async () => {
    r = ReactTestRenderer.create(<SaveToFiles instance={instance} deps={deps} />);
  });
  return r;
}

describe('SaveToFiles', () => {
  beforeEach(() => { mockIcloud = true; });

  it('shows only the button until it is pressed, and nothing has been unlocked', async () => {
    const { deps, calls } = fakeDeps();
    const r = await render(deps);
    expect(text(r)).toContain('Save to Files');
    expect(text(r)).not.toContain(WARNING_TITLE);
    expect(calls).toEqual([]);
  });

  it('warns before anything is unlocked: plain text, iCloud sync, anyone with the file, and version control', async () => {
    const { deps, calls } = fakeDeps();
    const r = await render(deps);
    await press(r, 'Save to Files');
    expect(text(r)).toContain(WARNING_TITLE);
    expect(WARNING_TEXT).toMatch(/plain text file/);
    expect(WARNING_TEXT).toMatch(/every device signed in to your Apple ID, including your Mac/);
    expect(WARNING_TEXT).toMatch(/Anyone who gets the file can connect/);
    expect(WARNING_TEXT).toMatch(/never add it to version control/);
    expect(calls).toEqual([]);
  });

  it('does not unlock or save anything when cancelled', async () => {
    const { deps, calls } = fakeDeps();
    const r = await render(deps);
    await press(r, 'Save to Files');
    await press(r, 'Cancel');
    expect(calls).toEqual([]);
  });

  it('unlocks, saves and counts once Continue is pressed, then says it saved', async () => {
    const { deps, calls } = fakeDeps();
    const r = await render(deps);
    await press(r, 'Save to Files');
    await press(r, 'Continue');
    expect(calls).toEqual(['reveal', 'save', 'record']);
    expect(text(r)).toContain(`Saved as ${APP_NAME}-orders-prod-d0000001-connection.txt`);
  });

  it('says so when iCloud is not signed in, so the file will not reach a Mac', async () => {
    mockIcloud = false;
    const { deps } = fakeDeps();
    const r = await render(deps);
    await press(r, 'Save to Files');
    expect(text(r)).toContain(ICLOUD_OFF_TEXT.slice(0, 40));
  });

  it('does not claim a save when Face ID was cancelled', async () => {
    const { deps, calls } = fakeDeps();
    deps.reveal = async () => null;
    const r = await render(deps);
    await press(r, 'Save to Files');
    await press(r, 'Continue');
    expect(calls).toEqual([]);
    expect(text(r)).toContain('nothing was saved');
    expect(text(r)).not.toContain('Saved as');
  });

  it('is disabled while the instance is being created, so nothing can be opened or unlocked', async () => {
    const { deps, calls } = fakeDeps();
    let r!: ReactTestRenderer.ReactTestRenderer;
    await ReactTestRenderer.act(async () => {
      r = ReactTestRenderer.create(<SaveToFiles instance={instance} deps={deps} disabled />);
    });
    const button = r.root.findAll(n => typeof n.props.onPress === 'function' && textOf(n) === 'Save to Files')[0]!;
    expect(button.props.disabled).toBe(true);
    await press(r, 'Save to Files');
    expect(text(r)).not.toContain(WARNING_TITLE);
    expect(calls).toEqual([]);
  });
});
