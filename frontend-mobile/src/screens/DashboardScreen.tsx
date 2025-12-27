import React, { useState, useEffect } from 'react'
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  SafeAreaView,
  StatusBar,
} from 'react-native'
import {
  Wallet,
  ArrowUpRight,
  ArrowDownLeft,
  RefreshCw,
  QrCode,
  Bell,
  Settings,
  ChevronRight,
  TrendingUp,
  Shield,
} from 'lucide-react-native'
import { useNavigation } from '@react-navigation/native'
import { useQuery } from 'react-query'
import { useWalletStore } from '../stores/walletStore'
import { formatCurrency } from '../utils/formatters'
import { BalanceCard } from '../components/BalanceCard'
import { TransactionList } from '../components/TransactionList'
import { QuickActions } from '../components/QuickActions'
import { useTheme } from '../theme/ThemeContext'

export default function DashboardScreen() {
  const navigation = useNavigation()
  const { theme, isDark } = useTheme()
  const { totalBalance, fetchBalances } = useWalletStore()
  const [refreshing, setRefreshing] = useState(false)

  const { data: balances, isLoading: balancesLoading } = useQuery(
    'wallet-balances',
    fetchBalances,
    { refetchInterval: 30000 }
  )

  const { data: transactions, isLoading: transactionsLoading } = useQuery(
    'recent-transactions',
    async () => {
      const response = await fetch('/api/transactions/recent')
      return response.json()
    }
  )

  const onRefresh = async () => {
    setRefreshing(true)
    await Promise.all([
      fetchBalances(),
      // Refetch other data
    ])
    setRefreshing(false)
  }

  const handleSend = () => {
    navigation.navigate('Send')
  }

  const handleReceive = () => {
    navigation.navigate('Receive')
  }

  const handleSwap = () => {
    navigation.navigate('Swap')
  }

  const handleBridge = () => {
    navigation.navigate('Bridge')
  }

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.background }]}>
      <StatusBar
        barStyle={isDark ? 'light-content' : 'dark-content'}
        backgroundColor={theme.background}
      />

      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <View style={[styles.logoContainer, { backgroundColor: theme.primary + '20' }]}>
            <Wallet size={24} color={theme.primary} />
          </View>
          <View>
            <Text style={[styles.welcomeText, { color: theme.textSecondary }]}>
              Welcome back
            </Text>
            <Text style={[styles.userName, { color: theme.text }]}>
              John Doe
            </Text>
          </View>
        </View>
        <View style={styles.headerRight}>
          <TouchableOpacity
            style={[styles.iconButton, { backgroundColor: theme.surface }]}
            onPress={() => navigation.navigate('Notifications')}
          >
            <Bell size={22} color={theme.text} />
            <View style={[styles.badge, { backgroundColor: theme.error }]}>
              <Text style={styles.badgeText}>3</Text>
            </View>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.iconButton, { backgroundColor: theme.surface }]}
            onPress={() => navigation.navigate('Settings')}
          >
            <Settings size={22} color={theme.text} />
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView
        style={styles.scrollView}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={theme.primary}
          />
        }
        showsVerticalScrollIndicator={false}
      >
        {/* Total Balance Card */}
        <View style={[styles.totalBalanceCard, { backgroundColor: theme.primary }]}>
          <View style={styles.totalBalanceHeader}>
            <Text style={styles.totalBalanceLabel}>Total Balance</Text>
            <View style={styles.securityBadge}>
              <Shield size={14} color="#fff" />
              <Text style={styles.securityText}>Secure</Text>
            </View>
          </View>
          <Text style={styles.totalBalanceAmount}>
            {formatCurrency(totalBalance, 'USD')}
          </Text>
          <View style={styles.balanceTrend}>
            <TrendingUp size={16} color="#fff" />
            <Text style={styles.trendText}>+2.4% this week</Text>
          </View>
        </View>

        {/* Quick Actions */}
        <QuickActions
          onSend={handleSend}
          onReceive={handleReceive}
          onSwap={handleSwap}
          onBridge={handleBridge}
        />

        {/* Balance Cards */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={[styles.sectionTitle, { color: theme.text }]}>
              Your Wallets
            </Text>
            <TouchableOpacity onPress={() => navigation.navigate('Wallets')}>
              <Text style={[styles.seeAll, { color: theme.primary }]}>See All</Text>
            </TouchableOpacity>
          </View>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            style={styles.balancesScroll}
          >
            {balances?.slice(0, 5).map((balance: any, index: number) => (
              <BalanceCard
                key={index}
                balance={balance}
                onPress={() => navigation.navigate('WalletDetail', { currency: balance.currency })}
              />
            ))}
          </ScrollView>
        </View>

        {/* Recent Transactions */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={[styles.sectionTitle, { color: theme.text }]}>
              Recent Activity
            </Text>
            <TouchableOpacity onPress={() => navigation.navigate('Transactions')}>
              <Text style={[styles.seeAll, { color: theme.primary }]}>See All</Text>
            </TouchableOpacity>
          </View>
          <TransactionList
            transactions={transactions || []}
            onTransactionPress={(transaction) => {
              navigation.navigate('TransactionDetail', { transaction })
            }}
          />
        </View>

        {/* Crypto Prices */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={[styles.sectionTitle, { color: theme.text }]}>
              Market Overview
            </Text>
            <TouchableOpacity>
              <RefreshCw size={18} color={theme.textSecondary} />
            </TouchableOpacity>
          </View>
          {/* Market data would go here */}
        </View>
      </ScrollView>

      {/* Quick Access Buttons */}
      <View style={[styles.bottomButtons, { backgroundColor: theme.surface }]}>
        <TouchableOpacity
          style={[styles.bottomButton, { backgroundColor: theme.primary }]}
          onPress={handleSend}
        >
          <ArrowUpRight size={24} color="#fff" />
          <Text style={styles.bottomButtonText}>Send</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.bottomButton, { backgroundColor: theme.secondary }]}
          onPress={handleReceive}
        >
          <ArrowDownLeft size={24} color="#fff" />
          <Text style={styles.bottomButtonText}>Receive</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.bottomButton, { backgroundColor: theme.surface }]}
          onPress={() => navigation.navigate('Scan')}
        >
          <QrCode size={24} color={theme.text} />
          <Text style={[styles.bottomButtonText, { color: theme.text }]}>
            Scan
          </Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 16,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  logoContainer: {
    width: 40,
    height: 40,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  welcomeText: {
    fontSize: 12,
    fontWeight: '500',
  },
  userName: {
    fontSize: 18,
    fontWeight: '600',
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  iconButton: {
    width: 44,
    height: 44,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 8,
  },
  badge: {
    position: 'absolute',
    top: -4,
    right: -4,
    width: 18,
    height: 18,
    borderRadius: 9,
    justifyContent: 'center',
    alignItems: 'center',
  },
  badgeText: {
    color: '#fff',
    fontSize: 10,
    fontWeight: 'bold',
  },
  scrollView: {
    flex: 1,
  },
  totalBalanceCard: {
    marginHorizontal: 20,
    marginTop: 8,
    marginBottom: 24,
    borderRadius: 20,
    padding: 24,
  },
  totalBalanceHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  totalBalanceLabel: {
    color: '#fff',
    fontSize: 14,
    opacity: 0.9,
  },
  securityBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  securityText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
    marginLeft: 4,
  },
  totalBalanceAmount: {
    color: '#fff',
    fontSize: 36,
    fontWeight: '700',
    marginBottom: 8,
  },
  balanceTrend: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  trendText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '500',
    marginLeft: 6,
  },
  section: {
    marginBottom: 24,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
  },
  seeAll: {
    fontSize: 14,
    fontWeight: '500',
  },
  balancesScroll: {
    paddingLeft: 20,
    paddingRight: 10,
  },
  bottomButtons: {
    flexDirection: 'row',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderTopWidth: 1,
    borderTopColor: 'rgba(0,0,0,0.1)',
  },
  bottomButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginHorizontal: 6,
    paddingVertical: 12,
    borderRadius: 12,
  },
  bottomButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
    marginLeft: 6,
  },
})
