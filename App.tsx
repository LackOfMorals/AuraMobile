import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { useEffect } from 'react';
import { ActivityIndicator, StatusBar, useColorScheme, View } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { FirstSyncScreen } from './src/screens/FirstSyncScreen';
import { DetailScreen } from './src/screens/DetailScreen';
import { Tabs } from './src/navigation/Tabs';
import type { RootStackParamList } from './src/navigation/types';
import { SetupScreen } from './src/screens/SetupScreen';
import { LockGate } from './src/security/LockGate';
import { useSession } from './src/state/session';

const Stack = createNativeStackNavigator<RootStackParamList>();
const Gate = createNativeStackNavigator();

function Routes() {
  const { ready, mode, synced, init } = useSession();

  useEffect(() => {
    init();
  }, [init]);

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
        <Routes />
      </LockGate>
    </SafeAreaProvider>
  );
}

export default App;
