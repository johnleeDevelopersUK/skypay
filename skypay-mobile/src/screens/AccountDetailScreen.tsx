// skypay-mobile/src/screens/CardDetailScreen.tsx
import React, { useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  SafeAreaView,
  Image,
} from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { useSkyPay } from '@skypay/sdk';
import { colors, spacing, typography } from '../theme';
import { formatCurrency } from '../utils/format';
import { Ionicons, MaterialIcons } from '@expo/vector-icons';

export function CardDetailScreen({ navigation }: any) {
  const { client } = useSkyPay();
  const [cardNumberVisible, setCardNumberVisible] = useState(false);

  const { data: cardTransactions } = useQuery({
    queryKey: ['cardTransactions'],
    queryFn: () => client.getSettlements({ type: 'CARD', limit: 10 }),
  });

  const cardInfo = {
    name: 'SkyPay VISA',
    number: '**** 5678',
    lastFour: '5678',
    expiry: '12/25',
    cvv: '***',
    balance: 950.25,
    currency: 'EUR',
    status: 'ACTIVE',
    type: 'VISA',
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
          <Text style={styles.headerTitle}>Card Account</Text>
          <TouchableOpacity style={styles.menuButton}>
            <Ionicons name="ellipsis-vertical" size={20} color={colors.text} />
          </TouchableOpacity>
        </View>

        {/* Card Display */}
        <View style={styles.cardContainer}>
          <View style={styles.card}>
            <View style={styles.cardHeader}>
              <Text style={styles.cardName}>{cardInfo.name}</Text>
              <View style={styles.cardTypeBadge}>
                <Text style={styles.cardTypeText}>{cardInfo.type}</Text>
              </View>
            </View>
            
            <View style={styles.cardNumberContainer}>
              <Text style={styles.cardNumberLabel}>Card Number</Text>
              <View style={styles.cardNumberRow}>
                <Text style={styles.cardNumber}>
                  {cardNumberVisible ? '1234 5678 9012 3456' : cardInfo.number}
                </Text>
                <TouchableOpacity 
                  onPress={() => setCardNumberVisible(!cardNumberVisible)}
                  style={styles.visibilityButton}
                >
                  <Ionicons 
                    name={cardNumberVisible ? 'eye-off-outline' : 'eye-outline'} 
                    size={20} 
                    color={colors.textSecondary} 
                  />
                </TouchableOpacity>
              </View>
            </View>

            <View style={styles.cardDetailsRow}>
              <View style={styles.cardDetail}>
                <Text style={styles.cardDetailLabel}>Expiry</Text>
                <Text style={styles.cardDetailValue}>{cardInfo.expiry}</Text>
              </View>
              <View style={styles.cardDetail}>
                <Text style={styles.cardDetailLabel}>CVV</Text>
                <Text style={styles.cardDetailValue}>{cardInfo.cvv}</Text>
              </View>
            </View>

            <View style={styles.cardBalance}>
              <Text style={styles.cardBalanceLabel}>Card Balance</Text>
              <Text style={styles.cardBalanceAmount}>
                {formatCurrency(cardInfo.balance, cardInfo.currency)}
              </Text>
            </View>
          </View>
        </View>

        {/* Quick Actions */}
        <View style={styles.quickActions}>
          <TouchableOpacity style={styles.actionButton}>
            <View style={[styles.actionIcon, { backgroundColor: '#3B82F620' }]}>
              <Ionicons name="add-circle-outline" size={24} color="#3B82F6" />
            </View>
            <Text style={styles.actionText}>Top Up</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.actionButton}>
            <View style={[styles.actionIcon, { backgroundColor: '#10B98120' }]}>
              <MaterialIcons name="lock" size={24} color="#10B981" />
            </View>
            <Text style={styles.actionText}>Freeze</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.actionButton}>
            <View style={[styles.actionIcon, { backgroundColor: '#F59E0B20' }]}>
              <MaterialIcons name="history" size={24} color="#F59E0B" />
            </View>
            <Text style={styles.actionText}>History</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.actionButton}>
            <View style={[styles.actionIcon, { backgroundColor: '#8B5CF620' }]}>
              <Ionicons name="settings-outline" size={24} color="#8B5CF6" />
            </View>
            <Text style={styles.actionText}>Settings</Text>
          </TouchableOpacity>
        </View>

        {/* Top Up Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Top Up Card</Text>
          <View style={styles.topUpCard}>
            <Text style={styles.topUpLabel}>Card Account Number:</Text>
            <View style={styles.accountNumberContainer}>
              <Text style={styles.accountNumber}>K6-48</Text>
              <TouchableOpacity style={styles.copyButton}>
                <Ionicons name="copy-outline" size={18} color={colors.primary} />
              </TouchableOpacity>
            </View>
            <Text style={styles.topUpDescription}>
              Send funds to this account number to top up your card
            </Text>
          </View>
        </View>

        {/* Recent Activity */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Recent Activity</Text>
          
          {cardTransactions?.data?.slice(0, 5).map((transaction: any, index: number) => (
            <View key={transaction.id} style={styles.transactionItem}>
              <View style={styles.transactionIcon}>
                {transaction.type === 'DEPOSIT' ? (
                  <Ionicons name="arrow-down-circle" size={24} color="#10B981" />
                ) : (
                  <Ionicons name="arrow-up-circle" size={24} color="#EF4444" />
                )}
              </View>
              
              <View style={styles.transactionInfo}>
                <Text style={styles.transactionTitle}>
                  {transaction.type === 'DEPOSIT' ? 'Top Up' : 'Purchase'}
                </Text>
                <Text style={styles.transactionDate}>
                  {new Date(transaction.createdAt).toLocaleDateString()}
                </Text>
              </View>
              
              <View style={styles.transactionAmount}>
                <Text style={[
                  styles.transactionAmountText,
                  transaction.type === 'DEPOSIT' ? styles.positiveAmount : styles.negativeAmount
                ]}>
                  {transaction.type === 'DEPOSIT' ? '+' : '-'}
                  {formatCurrency(transaction.amount, transaction.currency)}
                </Text>
              </View>
            </View>
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
  cardContainer: {
    paddingHorizontal: spacing.lg,
    marginBottom: spacing.xl,
  },
  card: {
    backgroundColor: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
    borderRadius: 20,
    padding: spacing.xl,
    height: 220,
    justifyContent: 'space-between',
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  cardName: {
    fontSize: 18,
    fontFamily: 'Inter-Bold',
    color: '#FFFFFF',
  },
  cardTypeBadge: {
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
    borderRadius: 12,
  },
  cardTypeText: {
    fontSize: 12,
    fontFamily: 'Inter-SemiBold',
    color: '#FFFFFF',
  },
  cardNumberContainer: {
    marginVertical: spacing.md,
  },
  cardNumberLabel: {
    fontSize: 12,
    fontFamily: 'Inter-Medium',
    color: 'rgba(255, 255, 255, 0.7)',
    marginBottom: 4,
  },
  cardNumberRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  cardNumber: {
    fontSize: 24,
    fontFamily: 'Inter-SemiBold',
    color: '#FFFFFF',
    letterSpacing: 2,
  },
  visibilityButton: {
    padding: spacing.xs,
  },
  cardDetailsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: spacing.lg,
  },
  cardDetail: {
    flex: 1,
  },
  cardDetailLabel: {
    fontSize: 12,
    fontFamily: 'Inter-Medium',
    color: 'rgba(255, 255, 255, 0.7)',
    marginBottom: 4,
  },
  cardDetailValue: {
    fontSize: 16,
    fontFamily: 'Inter-SemiBold',
    color: '#FFFFFF',
  },
  cardBalance: {
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.2)',
    paddingTop: spacing.md,
  },
  cardBalanceLabel: {
    fontSize: 12,
    fontFamily: 'Inter-Medium',
    color: 'rgba(255, 255, 255, 0.7)',
    marginBottom: 4,
  },
  cardBalanceAmount: {
    fontSize: 24,
    fontFamily: 'Inter-Bold',
    color: '#FFFFFF',
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
  section: {
    paddingHorizontal: spacing.lg,
    marginBottom: spacing.xl,
  },
  sectionTitle: {
    fontSize: 18,
    fontFamily: 'Inter-Bold',
    color: colors.text,
    marginBottom: spacing.md,
  },
  topUpCard: {
    backgroundColor: colors.surface,
    borderRadius: 16,
    padding: spacing.lg,
    borderWidth: 1,
    borderColor: colors.border,
  },
  topUpLabel: {
    fontSize: 14,
    fontFamily: 'Inter-Medium',
    color: colors.textSecondary,
    marginBottom: spacing.sm,
  },
  accountNumberContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.sm,
  },
  accountNumber: {
    fontSize: 24,
    fontFamily: 'Inter-Bold',
    color: colors.text,
  },
  copyButton: {
    padding: spacing.xs,
  },
  topUpDescription: {
    fontSize: 12,
    fontFamily: 'Inter-Regular',
    color: colors.textSecondary,
    lineHeight: 18,
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
});
