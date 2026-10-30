export type RootStackParamList = {
  Main: undefined;
  /** devOpenExport is for screenshot runs in Debug builds only: it opens the Save to Files warning. */
  Detail: { auraId: string; devOpenExport?: boolean };
  Create: undefined;
  Licenses: undefined;
  Edit: { auraId: string };
  Operation: { operationId: string };
};

export type TabParamList = {
  Home: undefined;
  Instances: undefined;
  Operations: undefined;
  Account: undefined;
};
