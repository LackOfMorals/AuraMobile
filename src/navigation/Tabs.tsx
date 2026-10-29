import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { AccountScreen } from '../screens/AccountScreen';
import { HomeScreen } from '../screens/HomeScreen';
import { InstancesScreen } from '../screens/InstancesScreen';
import { OperationsScreen } from '../screens/OperationsScreen';
import { useColors } from '../theme/colors';
import { Icon, IconName } from '../ui/Icon';
import type { TabParamList } from './types';

const Tab = createBottomTabNavigator<TabParamList>();

const ICONS: Record<keyof TabParamList, IconName> = { Home: 'home', Instances: 'list', Operations: 'history', Account: 'person' };

export function Tabs() {
  const c = useColors();
  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarActiveTintColor: c.primary,
        tabBarInactiveTintColor: c.muted,
        tabBarStyle: { backgroundColor: c.card, borderTopColor: c.border },
        tabBarIcon: ({ color, size }) => <Icon name={ICONS[route.name]} size={size} color={color} />,
      })}>
      <Tab.Screen name="Home" component={HomeScreen} />
      <Tab.Screen name="Instances" component={InstancesScreen} />
      <Tab.Screen name="Operations" component={OperationsScreen} />
      <Tab.Screen name="Account" component={AccountScreen} />
    </Tab.Navigator>
  );
}
