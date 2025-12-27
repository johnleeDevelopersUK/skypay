// skypay-mobile/src/screens/HomeScreen.tsx (Updated)
import React, { useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  SafeAreaView,
  Image,
  RefreshControl,
} from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { useSkyPay } from '@skypay/sdk';
import { Card, BalanceCard, TransactionItem } from '../components';
import { colors, spacing, typography } from '../theme';
import { formatCurrency } from '../utils/format';
import { Ionicons, MaterialIcons } from '@expo/vector-icons';

export function HomeScreen({ navigation }: any) {
  const { client } = useSkyPay();
  const [refreshing, setRefreshing] = useState(false);

  const { data: balances, isLoading, refetch } = useQuery({
    queryKey: ['balances'],
    queryFn: () => client.getBalances(),
  });

  const { data: recentActivity } = useQuery({
    queryKey: ['recentActivity'],
    queryFn: () => client.getSettlements({ limit: 10 }),
  });

  const onRefresh = async () => {
    setRefreshing(true);
    await refetch();
    setRefreshing(false);
  };

  // Calculate total balance across all currencies
  const totalBalance = balances?.reduce(
    (sum, balance) => sum + balance.balance,
    0
  ) || 0;

  // Find specific balances
  const euroBalance = balances?.find(b => b.currency === 'EUR' || b.currency === 'EURX');
  const usdBalance = balances?.find(b => b.currency === 'USD' || b.currency === 'USDX');
  const ngnBalance = balances?.find(b => b.currency === 'NGN' || b.currency === 'NGNX');
  const cardBalance = { balance: 950.25, currency: 'EUR' }; // Example card balance

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <View style={styles.header}>
          <View style={styles.headerLeft}>
            <Text style={styles.appName}>SkyPay</Text>
            <Text style={styles.headerSubtitle}>Access your fiat & crypto accounts securely</Text>
          </View>
          <TouchableOpacity
            onPress={() => navigation.navigate('Profile')}
            style={styles.profileButton}
          >
            <Ionicons name="person-circle-outline" size={32} color={colors.primary} />
          </TouchableOpacity>
        </View>

        {/* Total Balance */}
        <View style={styles.totalBalanceCard}>
          <Text style={styles.totalBalanceLabel}>Total Balance</Text>
          <Text style={styles.totalBalanceAmount}>
            {formatCurrency(totalBalance, 'EUR')}
          </Text>
          
          <View style={styles.currencyBreakdown}>
            <View style={styles.currencyItem}>
              <Text style={styles.currencyCode}>USD</Text>
              <Text style={styles.currencyAmount}>$2,500.50</Text>
            </View>
            <View style={styles.currencyDivider} />
            <View style={styles.currencyItem}>
              <Text style={styles.currencyCode}>USD1</Text>
              <Text style={styles.currencyAmount}>$1,500.00</Text>
            </View>
          </View>
        </View>

        {/* Quick Actions */}
        <View style={styles.quickActions}>
          <TouchableOpacity 
            style={styles.actionButton}
            onPress={() => navigation.navigate('Deposit')}
          >
            <View style={[styles.actionIcon, { backgroundColor: '#10B98120' }]}>
              <MaterialIcons name="arrow-downward" size={24} color="#10B981" />
            </View>
            <Text style={styles.actionText}>Deposit</Text>
          </TouchableOpacity>

          <TouchableOpacity 
            style={styles.actionButton}
            onPress={() => navigation.navigate('Withdraw')}
          >
            <View style={[styles.actionIcon, { backgroundColor: '#EF444420' }]}>
              <MaterialIcons name="arrow-upward" size={24} color="#EF4444" />
            </View>
            <Text style={styles.actionText}>Withdraw</Text>
          </TouchableOpacity>

          <TouchableOpacity 
            style={styles.actionButton}
            onPress={() => navigation.navigate('Transfer')}
          >
            <View style={[styles.actionIcon, { backgroundColor: '#3B82F620' }]}>
              <MaterialIcons name="swap-horiz" size={24} color="#3B82F6" />
            </View>
            <Text style={styles.actionText}>Transfer</Text>
          </TouchableOpacity>

          <TouchableOpacity 
            style={styles.actionButton}
            onPress={() => navigation.navigate('Card')}
          >
            <View style={[styles.actionIcon, { backgroundColor: '#8B5CF620' }]}>
              <Ionicons name="card-outline" size={24} color="#8B5CF6" />
            </View>
            <Text style={styles.actionText}>Card</Text>
          </TouchableOpacity>
        </View>

        {/* Account Balances */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Your Accounts</Text>
          
          {/* EuroPal Balance */}
          <TouchableOpacity 
            style={styles.accountCard}
            onPress={() => navigation.navigate('AccountDetail', { currency: 'EUR' })}
          >
            <View style={styles.accountHeader}>
              <View style={styles.accountInfo}>
                <View style={[styles.currencyIcon, { backgroundColor: '#3B82F620' }]}>
                  <Text style={[styles.currencyIconText, { color: '#3B82F6' }]}>€</Text>
                </View>
                <View>
                  <Text style={styles.accountName}>EuroPal Balance</Text>
                  <Text style={styles.accountBalance}>
                    {formatCurrency(euroBalance?.balance || 8900.45, 'EUR')}
                  </Text>
                </View>
              </View>
              <View style={styles.changeBadge}>
                <Ionicons name="trending-up" size={16} color="#10B981" />
                <Text style={styles.changeText}>+1,000</Text>
              </View>
            </View>
          </TouchableOpacity>

          {/* USD Balance */}
          <TouchableOpacity 
            style={styles.accountCard}
            onPress={() => navigation.navigate('AccountDetail', { currency: 'USD' })}
          >
            <View style={styles.accountHeader}>
              <View style={styles.accountInfo}>
                <View style={[styles.currencyIcon, { backgroundColor: '#10B98120' }]}>
                  <Text style={[styles.currencyIconText, { color: '#10B981' }]}>$</Text>
                </View>
                <View>
                  <Text style={styles.accountName}>USD Balance</Text>
                  <Text style={styles.accountBalance}>
                    {formatCurrency(usdBalance?.balance || 2800.75, 'USD')}
                  </Text>
                </View>
              </View>
              <View style={styles.changeBadge}>
                <Ionicons name="trending-up" size={16} color="#10B981" />
                <Text style={styles.changeText}>+2,000</Text>
              </View>
            </View>
          </TouchableOpacity>

          {/* NairaX Balance */}
          <TouchableOpacity 
            style={styles.accountCard}
            onPress={() => navigation.navigate('AccountDetail', { currency: 'NGN' })}
          >
            <View style={styles.accountHeader}>
              <View style={styles.accountInfo}>
                <View style={[styles.currencyIcon, { backgroundColor: '#F59E0B20' }]}>
                  <Text style={[styles.currencyIconText, { color: '#F59E0B' }]}>₦</Text>
                </View>
                <View>
                  <Text style={styles.accountName}>NairaX Balance</Text>
                  <Text style={styles.accountBalance}>
                    {formatCurrency(ngnBalance?.balance || 820000, 'NGN')}
                  </Text>
                </View>
              </View>
              <View style={styles.changeBadge}>
                <Ionicons name="trending-up" size={16} color="#10B981" />
                <Text style={styles.changeText}>+280,000</Text>
              </View>
            </View>
          </TouchableOpacity>

          {/* Card Balance */}
          <TouchableOpacity 
            style={styles.accountCard}
            onPress={() => navigation.navigate('CardDetail')}
          >
            <View style={styles.accountHeader}>
              <View style={styles.accountInfo}>
                <View style={[styles.currencyIcon, { backgroundColor: '#8B5CF620' }]}>
                  <Ionicons name="card-outline" size={20} color="#8B5CF6" />
                </View>
                <View>
                  <Text style={styles.accountName}>Card Balance</Text>
                  <Text style={styles.accountBalance}>
                    {formatCurrency(cardBalance.balance, cardBalance.currency)}
                  </Text>
                </View>
              </View>
              <View style={styles.cardNumber}>
                <Text style={styles.cardNumberText}>**** 1234</Text>
              </View>
            </View>
          </TouchableOpacity>
        </View>

        {/* Recent Activity */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Recent Activity</Text>
            <TouchableOpacity onPress={() => navigation.navigate('Activity')}>
              <Text style={styles.seeAll}>See All</Text>
            </TouchableOpacity>
          </View>
          
          {recentActivity?.data?.slice(0, 3).map((activity: any) => (
            <TransactionItem
              key={activity.id}
              transaction={activity}
              onPress={() => navigation.navigate('TransactionDetail', { id: activity.id })}
            />
          ))}
        </View>

        {/* Empty space for scroll */}
        <View style={{ height: 100 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.xl,
    paddingBottom: spacing.md,
  },
  headerLeft: {
    flex: 1,
  },
  appName: {
    fontSize: 28,
    fontFamily: 'Inter-Bold',
    color: colors.text,
    marginBottom: spacing.xs,
  },
  headerSubtitle: {
    fontSize: 14,
    color: colors.textSecondary,
    fontFamily: 'Inter-Regular',
  },
  profileButton: {
    padding: spacing.xs,
  },
  totalBalanceCard: {
    backgroundColor: colors.surface,
    marginHorizontal: spacing.lg,
    marginBottom: spacing.lg,
    padding: spacing.xl,
    borderRadius: 20,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 3,
  },
  totalBalanceLabel: {
    fontSize: 14,
    color: colors.textSecondary,
    fontFamily: 'Inter-Medium',
    marginBottom: spacing.xs,
  },
  totalBalanceAmount: {
    fontSize: 36,
    fontFamily: 'Inter-Bold',
    color: colors.text,
    marginBottom: spacing.lg,
  },
  currencyBreakdown: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  currencyItem: {
    flex: 1,
  },
  currencyCode: {
    fontSize: 12,
    color: colors.textSecondary,
    fontFamily: 'Inter-Medium',
    marginBottom: 2,
  },
  currencyAmount: {
    fontSize: 16,
    fontFamily: 'Inter-SemiBold',
    color: colors.text,
  },
  currencyDivider: {
    width: 1,
    height: 20,
    backgroundColor: colors.border,
    marginHorizontal: spacing.md,
  },
  quickActions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    marginBottom: spacing.xl,
  },
  actionButton: {
    alignItems: 'center',
    width: 70,
  },
  actionIcon: {
    width: 56,
    height: 56,
    borderRadius: 28,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: spacing.xs,
  },
  actionText: {
    fontSize: 12,
    fontFamily: 'Inter-Medium',
    color: colors.text,
  },
  section: {
    paddingHorizontal: spacing.lg,
    marginBottom: spacing.xl,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  sectionTitle: {
    fontSize: 18,
    fontFamily: 'Inter-Bold',
    color: colors.text,
  },
  seeAll: {
    fontSize: 14,
    fontFamily: 'Inter-Medium',
    color: colors.primary,
  },
  accountCard: {
    backgroundColor: colors.surface,
    borderRadius: 16,
    padding: spacing.lg,
    marginBottom: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  accountHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  accountInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  currencyIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: spacing.md,
  },
  currencyIconText: {
    fontSize: 18,
    fontFamily: 'Inter-Bold',
  },
  accountName: {
    fontSize: 14,
    fontFamily: 'Inter-Medium',
    color: colors.textSecondary,
    marginBottom: 2,
  },
  accountBalance: {
    fontSize: 18,
    fontFamily: 'Inter-Bold',
    color: colors.text,
  },
  changeBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#10B98110',
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
    borderRadius: 12,
  },
  changeText: {
    fontSize: 12,
    fontFamily: 'Inter-SemiBold',
    color: '#10B981',
    marginLeft: 4,
  },
  cardNumber: {
    backgroundColor: '#8B5CF610',
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
    borderRadius: 8,
  },
  cardNumberText: {
    fontSize: 12,
    fontFamily: 'Inter-Medium',
    color: '#8B5CF6',
  },
});
