// skypay-mobile/src/screens/AccountDetailScreen.tsx
import React, { useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  SafeAreaView,
  Clipboard,
  Alert,
} from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { useSkyPay } from '@skypay/sdk';
import { colors, spacing, typography } from '../theme';
import { formatCurrency } from '../utils/format';
import { Ionicons, MaterialIcons } from '@expo/vector-icons';

export function AccountDetailScreen({ route, navigation }: any) {
  const { currency = 'USD' } = route.params;
  const { client } = useSkyPay();
  const [accountNumberVisible, setAccountNumberVisible] = useState(false);

  const { data: account } = useQuery({
    queryKey: ['account', currency],
    queryFn: () => client.getAccountByCurrency(currency),
  });

  const { data: transactions } = useQuery({
    queryKey: ['transactions', currency],
    queryFn: () => client.getSettlements({ currency, limit: 20 }),
  });

  const accountInfo = {
    balance: 2800.75,
    currency: 'USD',
    accountNumber: 'K6-48',
    type: currency.includes('X') ? 'Token' : 'Fiat',
    available: 2750.50,
    pending: 50.25,
  };

  const copyToClipboard = (text: string) => {
    Clipboard.setString(text);
    Alert.alert('Copied!', 'Account number copied to clipboard');
  };

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView showsVerticalScrollIndicator={false}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity 
            style={styles.backButton}
            onPress={() => navigation.goBack()}
          >
            <Ionicons name="arrow-back" size={24} color={colors.text} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>
            {currency} Account
          </Text>
          <TouchableOpacity style={styles.menuButton}>
            <Ionicons name="ellipsis-vertical" size={20} color={colors.text} />
          </TouchableOpacity>
        </View>

        {/* Balance Display */}
        <View style={styles.balanceSection}>
          <Text style={styles.balanceAmount}>
            {formatCurrency(accountInfo.balance, accountInfo.currency)}
          </Text>
          <Text style={styles.balanceLabel}>Current Balance</Text>
          
          <View style={styles.balanceDetails}>
            <View style={styles.balanceDetail}>
              <Text style={styles.balanceDetailLabel}>Available</Text>
              <Text style={styles.balanceDetailValue}>
                {formatCurrency(accountInfo.available, accountInfo.currency)}
              </Text>
            </View>
            <View style={styles.balanceDetail}>
              <Text style={styles.balanceDetailLabel}>Pending</Text>
              <Text style={styles.balanceDetailValue}>
                {formatCurrency(accountInfo.pending, accountInfo.currency)}
              </Text>
            </View>
          </View>
        </View>

        {/* Account Information */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Account Information</Text>
          <View style={styles.infoCard}>
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>Account Number:</Text>
              <View style={styles.infoValueContainer}>
                <Text style={styles.infoValue}>
                  {accountNumberVisible ? accountInfo.accountNumber : '••••••'}
                </Text>
                <TouchableOpacity 
                  onPress={() => setAccountNumberVisible(!accountNumberVisible)}
                  style={styles.visibilityButton}
                >
                  <Ionicons 
                    name={accountNumberVisible ? 'eye-off-outline' : 'eye-outline'} 
                    size={20} 
                    color={colors.textSecondary} 
                  />
                </TouchableOpacity>
                <TouchableOpacity 
                  onPress={() => copyToClipboard(accountInfo.accountNumber)}
                  style={styles.copyButton}
                >
                  <Ionicons name="copy-outline" size={20} color={colors.primary} />
                </TouchableOpacity>
              </View>
            </View>
            
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>Account Type:</Text>
              <Text style={styles.infoValue}>{accountInfo.type}</Text>
            </View>
            
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>Currency:</Text>
              <Text style={styles.infoValue}>{accountInfo.currency}</Text>
            </View>
          </View>
        </View>

        {/* Quick Actions */}
        <View style={styles.quickActions}>
          <TouchableOpacity 
            style={styles.actionButton}
            onPress={() => navigation.navigate('Deposit', { currency })}
          >
            <View style={[styles.actionIcon, { backgroundColor: '#10B98120' }]}>
              <Ionicons name="arrow-down-circle" size={24} color="#10B981" />
            </View>
            <Text style={styles.actionText}>Deposit</Text>
          </TouchableOpacity>

          <TouchableOpacity 
            style={styles.actionButton}
            onPress={() => navigation.navigate('Withdraw', { currency })}
          >
            <View style={[styles.actionIcon, { backgroundColor: '#EF444420' }]}>
              <Ionicons name="arrow-up-circle" size={24} color="#EF4444" />
            </View>
            <Text style={styles.actionText}>Withdraw</Text>
          </TouchableOpacity>

          <TouchableOpacity 
            style={styles.actionButton}
            onPress={() => navigation.navigate('Swap', { currency })}
          >
            <View style={[styles.actionIcon, { backgroundColor: '#3B82F620' }]}>
              <MaterialIcons name="swap-horiz" size={24} color="#3B82F6" />
            </View>
            <Text style={styles.actionText}>Swap</Text>
          </TouchableOpacity>

          <TouchableOpacity 
            style={styles.actionButton}
            onPress={() => navigation.navigate('Transfer', { currency })}
          >
            <View style={[styles.actionIcon, { backgroundColor: '#8B5CF620' }]}>
              <MaterialIcons name="send" size={24} color="#8B5CF6" />
            </View>
            <Text style={styles.actionText}>Send</Text>
          </TouchableOpacity>
        </View>

        {/* Recent Activity */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Recent Activity</Text>
            <TouchableOpacity onPress={() => navigation.navigate('TransactionHistory', { currency })}>
              <Text style={styles.seeAll}>See All</Text>
            </TouchableOpacity>
          </View>
          
          {transactions?.data?.slice(0, 5).map((transaction: any) => (
            <TouchableOpacity 
              key={transaction.id}
              style={styles.transactionItem}
              onPress={() => navigation.navigate('TransactionDetail', { id: transaction.id })}
            >
              <View style={styles.transactionIcon}>
                {transaction.type === 'DEPOSIT' ? (
                  <Ionicons name="arrow-down-circle" size={24} color="#10B981" />
                ) : transaction.type === 'SWAP' ? (
                  <MaterialIcons name="swap-horiz" size={24} color="#3B82F6" />
                ) : (
                  <Ionicons name="arrow-up-circle" size={24} color="#EF4444" />
                )}
              </View>
              
              <View style={styles.transactionInfo}>
                <Text style={styles.transactionTitle}>
                  {transaction.type === 'DEPOSIT' ? 'Deposit' : 
                   transaction.type === 'SWAP' ? 'Swap' : 'Withdrawal'}
                </Text>
                <Text style={styles.transactionDate}>
                  {new Date(transaction.createdAt).toLocaleDateString()}
                </Text>
                {transaction.type === 'SWAP' && transaction.metadata?.swapDetails && (
                  <Text style={styles.transactionSubtitle}>
                    {transaction.metadata.swapDetails}
                  </Text>
                )}
              </View>
              
              <View style={styles.transactionAmount}>
                <Text style={[
                  styles.transactionAmountText,
                  transaction.type === 'DEPOSIT' ? styles.positiveAmount : styles.negativeAmount
                ]}>
                  {transaction.type === 'DEPOSIT' ? '+' : transaction.type === 'SWAP' ? '↔' : '-'}
                  {formatCurrency(transaction.amount, transaction.currency)}
                </Text>
                {transaction.type === 'SWAP' && (
                  <Text style={styles.swapResult}>
                    → {formatCurrency(transaction.targetAmount || transaction.amount * 0.994, 
                       transaction.targetCurrency || `${transaction.currency}X`)}
                  </Text>
                )}
              </View>
            </TouchableOpacity>
          ))}
        </View>

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
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.xl,
    paddingBottom: spacing.md,
  },
  backButton: {
    padding: spacing.xs,
  },
  headerTitle: {
    fontSize: 20,
    fontFamily: 'Inter-Bold',
    color: colors.text,
  },
  menuButton: {
    padding: spacing.xs,
  },
  balanceSection: {
    alignItems: 'center',
    paddingVertical: spacing.xl,
    paddingHorizontal: spacing.lg,
  },
  balanceAmount: {
    fontSize: 48,
    fontFamily: 'Inter-Bold',
    color: colors.text,
    marginBottom: spacing.xs,
  },
  balanceLabel: {
    fontSize: 14,
    fontFamily: 'Inter-Medium',
    color: colors.textSecondary,
    marginBottom: spacing.lg,
  },
  balanceDetails: {
    flexDirection: 'row',
    backgroundColor: colors.surface,
    borderRadius: 16,
    padding: spacing.lg,
    width: '100%',
  },
  balanceDetail: {
    flex: 1,
    alignItems: 'center',
  },
  balanceDetailLabel: {
    fontSize: 12,
    fontFamily: 'Inter-Medium',
    color: colors.textSecondary,
    marginBottom: spacing.xs,
  },
  balanceDetailValue: {
    fontSize: 18,
    fontFamily: 'Inter-SemiBold',
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
  infoCard: {
    backgroundColor: colors.surface,
    borderRadius: 16,
    padding: spacing.lg,
    borderWidth: 1,
    borderColor: colors.border,
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  infoLabel: {
    fontSize: 14,
    fontFamily: 'Inter-Medium',
    color: colors.textSecondary,
    flex: 1,
  },
  infoValueContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    justifyContent: 'flex-end',
  },
  infoValue: {
    fontSize: 16,
    fontFamily: 'Inter-SemiBold',
    color: colors.text,
    marginRight: spacing.sm,
  },
  visibilityButton: {
    padding: spacing.xs,
    marginRight: spacing.xs,
  },
  copyButton: {
    padding: spacing.xs,
  },
  quickActions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    marginBottom: spacing.xl,
  },
  actionButton: {
    alignItems: 'center',
    width: 80,
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
  transactionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: 12,
    padding: spacing.md,
    marginBottom: spacing.sm,
  },
  transactionIcon: {
    marginRight: spacing.md,
  },
  transactionInfo: {
    flex: 1,
  },
  transactionTitle: {
    fontSize: 16,
    fontFamily: 'Inter-Medium',
    color: colors.text,
    marginBottom: 2,
  },
  transactionDate: {
    fontSize: 12,
    fontFamily: 'Inter-Regular',
    color: colors.textSecondary,
  },
  transactionSubtitle: {
    fontSize: 12,
    fontFamily: 'Inter-Regular',
    color: colors.textSecondary,
    marginTop: 2,
  },
  transactionAmount: {
    alignItems: 'flex-end',
  },
  transactionAmountText: {
    fontSize: 16,
    fontFamily: 'Inter-SemiBold',
  },
  positiveAmount: {
    color: '#10B981',
  },
  negativeAmount: {
    color: '#EF4444',
  },
  swapResult: {
    fontSize: 12,
    fontFamily: 'Inter-Regular',
    color: colors.textSecondary,
    marginTop: 2,
  },
});
