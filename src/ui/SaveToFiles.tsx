import { useEffect, useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { fileExport, fileExportAvailable } from '../native/fileExport';
import { instanceVault } from '../security/instanceVault';
import { exportConnection, type ExportDeps, type ExportInstance, type ExportOutcome } from '../services/exportConnection';
import { useColors } from '../theme/colors';
import { Icon } from './Icon';
import { Banner, Button } from './index';
import { Text } from './Text';

const realDeps: ExportDeps = {
  reveal: auraId => instanceVault.reveal(auraId),
  saveText: (filename, contents) => fileExport.saveText(filename, contents),
  recordExport: auraId => instanceVault.recordExport(auraId),
  now: () => new Date(),
};

export const WARNING_TITLE = 'Save connection details to Files';
export const WARNING_TEXT =
  "This saves a plain text file with this instance's address, username and password.\n\n" +
  'If you choose iCloud Drive, the file syncs to every device signed in to your Apple ID, including your Mac. Anyone who gets the file can connect to this database.\n\n' +
  'Delete the file when you no longer need it, and never add it to version control.';
export const ICLOUD_OFF_TEXT = 'iCloud is not signed in on this iPhone, so a file saved to iCloud Drive will not reach your Mac. You can still save it on this iPhone.';

/**
 * "Save to Files" for an instance whose password this app stored: a warning first, then Face ID or the passcode, then the system save
 * sheet, where the person chooses the place, for example iCloud Drive so a developer can pick the file up on a Mac.
 * It shows nothing where the build cannot save to Files.
 */
export function SaveToFiles({ instance, startOpen = false, disabled = false, deps = realDeps }: { instance: ExportInstance; startOpen?: boolean; disabled?: boolean; deps?: ExportDeps }) {
  const c = useColors();
  const [open, setOpen] = useState(startOpen);
  const [icloud, setIcloud] = useState<boolean | null>(null);
  const [busy, setBusy] = useState(false);
  const [outcome, setOutcome] = useState<ExportOutcome | null>(null);

  useEffect(() => {
    if (open) {
      fileExport.iCloudSignedIn().then(setIcloud).catch(() => setIcloud(null));
    }
  }, [open]);

  if (!fileExportAvailable) {
    return null;
  }

  async function proceed() {
    setOpen(false);
    setOutcome(null);
    setBusy(true);
    try {
      setOutcome(await exportConnection(deps, instance));
    } finally {
      setBusy(false);
    }
  }

  return (
    <View style={styles.box}>
      <Button label={busy ? 'Saving…' : 'Save to Files'} variant="secondary" disabled={busy || disabled} onPress={() => !disabled && setOpen(true)} />
      {outcome?.kind === 'saved' && (
        <Banner tone="info">{`Saved${outcome.name ? ` as ${outcome.name}` : ''}. In iCloud Drive it usually reaches your Mac within a minute. Delete the file when you no longer need it.`}</Banner>
      )}
      {(outcome?.kind === 'failed' || outcome?.kind === 'unavailable') && <Banner tone="danger">{outcome.message}</Banner>}
      {outcome?.kind === 'not-unlocked' && <Text style={{ color: c.muted }}>The password was not unlocked, so nothing was saved.</Text>}

      <Modal animationType="slide" transparent visible={open} onRequestClose={() => setOpen(false)}>
        <Pressable accessibilityLabel="Close" onPress={() => setOpen(false)} style={styles.scrim} />
        <View accessibilityViewIsModal style={[styles.sheet, { backgroundColor: c.bg }]}>
          <View style={styles.head}>
            <Text accessibilityRole="header" style={[styles.title, { color: c.text }]}>{WARNING_TITLE}</Text>
            <Pressable accessibilityLabel="Close" accessibilityRole="button" onPress={() => setOpen(false)} style={styles.close}>
              <Icon name="x" color={c.text} />
            </Pressable>
          </View>
          <ScrollView contentContainerStyle={styles.body}>
            <Banner tone="warning">{WARNING_TEXT}</Banner>
            {icloud === false && <Banner tone="info">{ICLOUD_OFF_TEXT}</Banner>}
            <Text style={{ color: c.muted }}>You will be asked for Face ID or your passcode first.</Text>
          </ScrollView>
          <View style={styles.footer}>
            <Button label="Continue" onPress={proceed} />
            <Button label="Cancel" variant="secondary" onPress={() => setOpen(false)} />
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  box: { gap: 10 },
  scrim: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)' },
  sheet: { maxHeight: '88%', width: '100%', maxWidth: 560, alignSelf: 'center', borderTopLeftRadius: 20, borderTopRightRadius: 20, paddingBottom: 24 },
  head: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 16, paddingBottom: 4 },
  title: { flex: 1, fontSize: 20, fontWeight: '700' },
  close: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  body: { paddingHorizontal: 16, gap: 12 },
  footer: { paddingHorizontal: 16, paddingTop: 12, gap: 10 },
});
