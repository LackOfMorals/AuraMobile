import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { useEffect } from 'react';
import { ActivityIndicator, StatusBar, useColorScheme, View } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { FirstSyncScreen } from './src/screens/FirstSyncScreen';
import { HomeScreen } from './src/screens/HomeScreen';
import { SetupScreen } from './src/screens/SetupScreen';
import { LockGate } from './src/security/LockGate';
import { useSession } from './src/state/session';

const Stack = createNativeStackNavigator();

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
      <Stack.Navigator screenOptions={{ headerShown: false }}>
        {mode === null ? (
          <Stack.Screen name="Setup" component={SetupScreen} />
        ) : !synced ? (
          <Stack.Screen name="FirstSync" component={FirstSyncScreen} />
        ) : (
          <Stack.Screen name="Home" component={HomeScreen} />
        )}
      </Stack.Navigator>
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
