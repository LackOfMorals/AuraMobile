import { NativeModules, Platform } from 'react-native';

interface SaveResult {
  saved: boolean;
  name?: string | null;
  error?: string | null;
}

/** The native module in ios/AuraMobile/FileExport.swift. iOS only; Android has no module yet. */
interface FileExportModule {
  iCloudSignedIn(): Promise<boolean>;
  sweep(): Promise<number>;
  saveText(filename: string, contents: string): Promise<SaveResult>;
}

const native: FileExportModule | undefined = Platform.OS === 'ios' ? NativeModules.FileExport : undefined;

/** Whether this build can save to Files. The button is hidden where it cannot. */
export const fileExportAvailable: boolean = native !== undefined;

export const fileExport = {
  /** Whether iCloud is signed in, so a file saved to iCloud Drive can reach other devices such as a Mac. */
  iCloudSignedIn: async (): Promise<boolean> => (native ? native.iCloudSignedIn() : false),
  /** Removes a temporary export folder an earlier run left behind, for example if the app was closed while the sheet was open. */
  sweep: async (): Promise<number> => (native ? native.sweep() : 0),
  saveText: async (filename: string, contents: string): Promise<SaveResult> => {
    if (!native) {
      throw new Error('Saving to Files is not available on this device.');
    }
    return native.saveText(filename, contents);
  },
};
