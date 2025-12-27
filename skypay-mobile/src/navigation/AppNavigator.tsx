// skypay-mobile/src/navigation/AppNavigator.tsx
import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createStackNavigator } from '@react-navigation/stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Ionicons, MaterialIcons } from '@expo/vector-icons';

// Screens
import { HomeScreen } from '../screens/HomeScreen';
import { CardDetailScreen } from '../screens/CardDetailScreen';
import { AccountDetailScreen } from '../screens/AccountDetailScreen';
import { DepositScreen } from '../screens/DepositScreen';
import { WithdrawScreen } from '../screens/WithdrawScreen';
import { TransferScreen } from '../screens/TransferScreen';
import { SwapScreen } from '../screens/SwapScreen';
import { ProfileScreen } from '../screens/ProfileScreen';
import { ActivityScreen } from '../screens/ActivityScreen';
import { colors } from '../theme';

const Stack = createStackNavigator();
const Tab = createBottomTabNavigator();

function HomeTabs() {
  return (
    <Tab.Navigator
      screenOptions={{
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.textSecondary,
        tabBarStyle: {
          backgroundColor: colors.background,
          borderTopColor: colors.border,
          paddingTop: 8,
          paddingBottom: 8,
          height: 60,
        },
        tabBarLabelStyle: {
          fontSize: 11,
          fontFamily: 'Inter-Medium',
          marginTop: 2,
        },
        headerShown: false,
      }}
    >
      <Tab.Screen
        name="Home"
        component={HomeScreen}
        options={{
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="home-outline" size={size} color={color} />
          ),
        }}
      />
      <Tab.Screen
        name="Cards"
        component={CardDetailScreen}
        options={{
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="card-outline" size={size} color={color} />
          ),
        }}
      />
      <Tab.Screen
        name="Transfer"
        component={TransferScreen}
        options={{
          tabBarIcon: ({ color, size }) => (
            <MaterialIcons name="swap-horiz" size={size} color={color} />
          ),
        }}
      />
      <Tab.Screen
        name="Activity"
        component={ActivityScreen}
        options={{
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="time-outline" size={size} color={color} />
          ),
        }}
      />
      <Tab.Screen
        name="Profile"
        component={ProfileScreen}
        options={{
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="person-outline" size={size} color={color} />
          ),
        }}
      />
    </Tab.Navigator>
  );
}

export function AppNavigator() {
  return (
    <NavigationContainer>
      <Stack.Navigator
        screenOptions={{
          headerShown: false,
          cardStyle: { backgroundColor: colors.background },
        }}
      >
        <Stack.Screen name="Main" component={HomeTabs} />
        <Stack.Screen name="AccountDetail" component={AccountDetailScreen} />
        <Stack.Screen name="CardDetail" component={CardDetailScreen} />
        <Stack.Screen name="Deposit" component={DepositScreen} />
        <Stack.Screen name="Withdraw" component={WithdrawScreen} />
        <Stack.Screen name="Swap" component={SwapScreen} />
      </Stack.Navigator>
    </NavigationContainer>
  );
}
