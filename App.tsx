import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { useEffect } from 'react';
import { ActivityIndicator, AppState, StatusBar, useColorScheme, View } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { FirstSyncScreen } from './src/screens/FirstSyncScreen';
import { DetailScreen } from './src/screens/DetailScreen';
import { CreateScreen } from './src/screens/CreateScreen';
import { EditScreen } from './src/screens/EditScreen';
import { LicensesScreen } from './src/screens/LicensesScreen';
import { OperationScreen } from './src/screens/OperationScreen';
import { Tabs } from './src/navigation/Tabs';
import type { RootStackParamList } from './src/navigation/types';
import { SetupScreen } from './src/screens/SetupScreen';
import { LockGate } from './src/security/LockGate';
import { ErrorBoundary } from './src/ui/ErrorBoundary';
import { operations, useSession } from './src/state/session';

const Stack = createNativeStackNavigator<RootStackParamList>();
const Gate = createNativeStackNavigator();

function Routes() {
  const { ready, mode, synced, init, bump } = useSession();

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

  if (!ready) {
    return (
      <View style={{ flex: 1, justifyContent: 'center' }}>
        <ActivityIndicator />
      </View>
    );
  }

  // The screen follows the session, so connecting or disconnecting moves the person without navigating by hand.
  return (
    <NavigationContainer>
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
