// skypay-web-app/src/components/dashboard/BalanceCard.tsx
import { motion } from 'framer-motion';
import { CreditCard, Wallet, TrendingUp, TrendingDown } from 'lucide-react';
import { formatCurrency } from '@/utils/format';
import { cn } from '@/utils/cn';

interface BalanceCardProps {
  type: 'fiat' | 'token' | 'total';
  currency: string;
  balance: number;
  available: number;
  pending?: number;
  change?: number;
  className?: string;
}

export function BalanceCard({
  type,
  currency,
  balance,
  available,
  pending = 0,
  change = 0,
  className,
}: BalanceCardProps) {
  const icons = {
    fiat: CreditCard,
    token: Wallet,
    total: Wallet,
  };

  const titles = {
    fiat: 'Fiat Balance',
    token: 'Token Balance',
    total: 'Total Balance',
  };

  const Icon = icons[type];
  const isPositive = change >= 0;
  const ChangeIcon = isPositive ? TrendingUp : TrendingDown;

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className={cn(
        'relative overflow-hidden rounded-2xl border bg-card p-6 shadow-lg',
        className
      )}
    >
      <div className="absolute right-0 top-0 h-32 w-32 -translate-y-16 translate-x-16 rounded-full bg-gradient-to-br from-primary/10 to-transparent" />
      
      <div className="relative z-10">
        <div className="mb-4 flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="rounded-lg bg-primary/10 p-2">
              <Icon className="h-5 w-5 text-primary" />
            </div>
            <div>
              <h3 className="text-sm font-medium text-muted-foreground">
                {titles[type]}
              </h3>
              <p className="text-2xl font-bold">
                {formatCurrency(balance, currency)}
              </p>
            </div>
          </div>
          
          {change !== 0 && (
            <div className={cn(
              'flex items-center space-x-1 rounded-full px-3 py-1 text-sm',
              isPositive
                ? 'bg-green-500/10 text-green-500'
                : 'bg-red-500/10 text-red-500'
            )}>
              <ChangeIcon className="h-3 w-3" />
              <span>{isPositive ? '+' : ''}{change}%</span>
            </div>
          )}
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <p className="text-xs text-muted-foreground">Available</p>
            <p className="text-lg font-semibold">
              {formatCurrency(available, currency)}
            </p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Pending</p>
            <p className="text-lg font-semibold">
              {formatCurrency(pending, currency)}
            </p>
          </div>
        </div>

        <div className="mt-4">
          <div className="mb-1 flex justify-between text-xs">
            <span className="text-muted-foreground">Available</span>
            <span className="font-medium">
              {((available / balance) * 100 || 0).toFixed(1)}%
            </span>
          </div>
          <div className="h-2 overflow-hidden rounded-full bg-muted">
            <motion.div
              initial={{ width: 0 }}
              animate={{ width: `${(available / balance) * 100 || 0}%` }}
              transition={{ duration: 1, ease: 'easeOut' }}
              className="h-full rounded-full bg-gradient-to-r from-primary to-primary/60"
            />
          </div>
        </div>
      </div>
    </motion.div>
  );
}
