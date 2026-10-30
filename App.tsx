import { createNavigationContainerRef, DarkTheme, DefaultTheme, NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { useEffect } from 'react';
import { ActivityIndicator, AppState, LogBox, StatusBar, useColorScheme, View } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { FirstSyncScreen } from './src/screens/FirstSyncScreen';
import { DetailScreen } from './src/screens/DetailScreen';
import { CreateScreen } from './src/screens/CreateScreen';
import { EditScreen } from './src/screens/EditScreen';
import { LicensesScreen } from './src/screens/LicensesScreen';
import { OperationScreen } from './src/screens/OperationScreen';
import { Tabs } from './src/navigation/Tabs';
import type { RootStackParamList } from './src/navigation/types';
import { devArg } from './src/dev/launchArgs';
import { SetupScreen } from './src/screens/SetupScreen';
import { LockGate } from './src/security/LockGate';
import { ErrorBoundary } from './src/ui/ErrorBoundary';
import { operations, useSession } from './src/state/session';
import { useColors } from './src/theme/colors';

const Stack = createNativeStackNavigator<RootStackParamList>();
const Gate = createNativeStackNavigator();
const navigationRef = createNavigationContainerRef<RootStackParamList>();

// Development only (see devArg): a screenshot run must not have a "Open debugger to view warnings" toast in the picture
if (devArg('JaxSkipLock') !== undefined) {
  LogBox.ignoreAllLogs();
}

/** Development only (see devArg): the screen a screenshot run opens on. Demo instances d0000001 and d0000002 are fixed ids. */
function openDevScreen(name: string) {
  switch (name) {
    case 'Home':
    case 'Instances':
    case 'Operations':
    case 'Account':
      navigationRef.navigate('Main', { screen: name } as never);
      break;
    case 'Detail':
      navigationRef.navigate('Detail', { auraId: 'd0000001' });
      break;
    case 'Edit':
      navigationRef.navigate('Edit', { auraId: 'd0000002' });
      break;
    case 'Create':
      navigationRef.navigate('Create');
      break;
    case 'Licenses':
      navigationRef.navigate('Licenses');
      break;
  }
}

function Routes() {
  const { ready, mode, synced, init, bump } = useSession();
  const c = useColors();
  const dark = useColorScheme() === 'dark';
  // Without this the navigation bar is white in dark mode, and the status bar's light text vanishes on it
  const theme = {
    ...(dark ? DarkTheme : DefaultTheme),
    colors: { ...(dark ? DarkTheme : DefaultTheme).colors, primary: c.primary, background: c.bg, card: c.card, text: c.text, border: c.border },
  };

  useEffect(() => {
    init();
  }, [init]);

  // Timers pause while the app is in the background. On return, read what changed and pick up any change that stopped.
  useEffect(() => {
    if (mode === null) {
      return;
    }
    const sub = AppState.addEventListener('change', state => {
      if (state === 'active') {
        operations().recover().catch(() => undefined);
        bump();
      }
    });
    return () => sub.remove();
  }, [mode, bump]);

  // Development only: start the demo, and open the screen asked for, so a screenshot run needs no taps
  const startDemo = useSession(s => s.startDemo);
  const devDemo = devArg('JaxDemo') !== undefined;
  useEffect(() => {
    if (devDemo && ready && mode === null) {
      startDemo();
    }
  }, [devDemo, ready, mode, startDemo]);
  const devScreen = devArg('JaxScreen');
  useEffect(() => {
    if (devScreen && mode !== null && synced) {
      // Wait until the main screens exist: navigating before they do is a warning, and goes nowhere
      const t = setInterval(() => {
        if (navigationRef.isReady() && navigationRef.getRootState()?.routeNames?.includes('Main')) {
          clearInterval(t);
          openDevScreen(devScreen);
        }
      }, 300);
      return () => clearInterval(t);
    }
  }, [devScreen, mode, synced]);

  if (!ready) {
    return (
      <View style={{ flex: 1, justifyContent: 'center' }}>
        <ActivityIndicator />
      </View>
    );
  }

  // The screen follows the session, so connecting or disconnecting moves the person without navigating by hand.
  return (
    <NavigationContainer ref={navigationRef} theme={theme}>
      {mode !== null && synced ? (
        <Stack.Navigator>
          <Stack.Screen name="Main" component={Tabs} options={{ headerShown: false }} />
          <Stack.Screen name="Detail" component={DetailScreen} options={{ title: 'Instance', headerBackTitle: 'Back' }} />
          <Stack.Screen name="Licenses" component={LicensesScreen} options={{ title: 'Open source licences', headerBackTitle: 'Back' }} />
          <Stack.Screen name="Create" component={CreateScreen} options={{ title: 'New instance', headerBackTitle: 'Back' }} />
          <Stack.Screen name="Edit" component={EditScreen} options={{ title: 'Edit instance', headerBackTitle: 'Back' }} />
          <Stack.Screen name="Operation" component={OperationScreen} options={{ title: 'Change', headerBackTitle: 'Back' }} />
        </Stack.Navigator>
      ) : (
        <Gate.Navigator screenOptions={{ headerShown: false }}>
          {mode === null ? <Gate.Screen name="Setup" component={SetupScreen} /> : <Gate.Screen name="FirstSync" component={FirstSyncScreen} />}
        </Gate.Navigator>
      )}
    </NavigationContainer>
  );
}

function App() {
  const isDarkMode = useColorScheme() === 'dark';

  return (
    <SafeAreaProvider>
      <StatusBar barStyle={isDarkMode ? 'light-content' : 'dark-content'} />
      <LockGate>
        <ErrorBoundary>
          <Routes />
        </ErrorBoundary>
      </LockGate>
    </SafeAreaProvider>
  );
}

export default App;
