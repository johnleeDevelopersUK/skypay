// skypay-web-app/src/components/transactions/DepositFlow.tsx
'use client';

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { motion } from 'framer-motion';
import { ArrowRight, Banknote, CreditCard, Loader2 } from 'lucide-react';
import { useSkyPay } from '@skypay/sdk';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { useToast } from '@/hooks/useToast';
import { formatCurrency } from '@/utils/format';

const depositSchema = z.object({
  amount: z.number().min(1, 'Amount must be at least 1').max(10000, 'Maximum deposit is 10,000'),
  currency: z.enum(['USD', 'NGN', 'EUR']),
  bankCode: z.string().min(1, 'Bank is required'),
  accountNumber: z.string().min(1, 'Account number is required'),
});

type DepositFormData = z.infer<typeof depositSchema>;

interface DepositFlowProps {
  onComplete?: (settlementId: string) => void;
}

export function DepositFlow({ onComplete }: DepositFlowProps) {
  const [step, setStep] = useState<'amount' | 'bank' | 'confirm'>('amount');
  const [loading, setLoading] = useState(false);
  const [banks, setBanks] = useState<any[]>([]);
  const [accountInfo, setAccountInfo] = useState<any>(null);
  
  const { client } = useSkyPay();
  const { toast } = useToast();
  
  const {
    register,
    handleSubmit,
    watch,
    setValue,
    formState: { errors },
  } = useForm<DepositFormData>({
    resolver: zodResolver(depositSchema),
    defaultValues: {
      currency: 'USD',
    },
  });

  const amount = watch('amount');
  const currency = watch('currency');
  const bankCode = watch('bankCode');

  const loadBanks = async (countryCode: string, currency: string) => {
    try {
      const banks = await client.getSupportedBanks(countryCode, currency);
      setBanks(banks);
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to load banks',
        variant: 'destructive',
      });
    }
  };

  const validateAccount = async (bankCode: string, accountNumber: string) => {
    try {
      const info = await client.validateBankAccount(bankCode, accountNumber);
      setAccountInfo(info);
      toast({
        title: 'Success',
        description: 'Account validated successfully',
      });
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Invalid account number',
        variant: 'destructive',
      });
    }
  };

  const onSubmit = async (data: DepositFormData) => {
    setLoading(true);
    try {
      const settlement = await client.createFiatDeposit({
        amount: data.amount,
        currency: data.currency,
        bankDetails: {
          bankCode: data.bankCode,
          accountNumber: data.accountNumber,
          accountName: accountInfo?.account_name,
        },
      });

      toast({
        title: 'Deposit Initiated',
        description: 'Please send funds to the provided account details',
      });

      onComplete?.(settlement.id);
    } catch (error: any) {
      toast({
        title: 'Deposit Failed',
        description: error.message || 'Please try again',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto">
      {/* Progress Steps */}
      <div className="mb-8">
        <div className="flex items-center justify-between">
          {['amount', 'bank', 'confirm'].map((s, index) => (
            <div key={s} className="flex flex-col items-center">
              <div
                className={`
                  w-10 h-10 rounded-full flex items-center justify-center
                  ${step === s ? 'bg-primary text-primary-foreground' : 
                    index < ['amount', 'bank', 'confirm'].indexOf(step) 
                      ? 'bg-primary/20 text-primary' 
                      : 'bg-muted text-muted-foreground'}
                `}
              >
                {index + 1}
              </div>
              <span className="mt-2 text-sm capitalize">{s}</span>
            </div>
          ))}
        </div>
      </div>

      <form onSubmit={handleSubmit(onSubmit)}>
        {step === 'amount' && (
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            className="space-y-6"
          >
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center space-x-2">
                  <Banknote className="h-5 w-5" />
                  <span>Deposit Amount</span>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div>
                    <label className="text-sm font-medium mb-2 block">
                      Amount
                    </label>
                    <Input
                      type="number"
                      placeholder="0.00"
                      step="0.01"
                      {...register('amount', { valueAsNumber: true })}
                      error={errors.amount?.message}
                    />
                  </div>

                  <div>
                    <label className="text-sm font-medium mb-2 block">
                      Currency
                    </label>
                    <Select
                      value={currency}
                      onValueChange={(value) => {
                        setValue('currency', value as any);
                        loadBanks('NG', value); // Default to Nigeria
                      }}
                      options={[
                        { value: 'USD', label: 'US Dollar (USD)' },
                        { value: 'NGN', label: 'Nigerian Naira (NGN)' },
                        { value: 'EUR', label: 'Euro (EUR)' },
                      ]}
                    />
                  </div>

                  <div className="p-4 bg-muted rounded-lg">
                    <p className="text-sm text-muted-foreground mb-2">
                      You will receive:
                    </p>
                    <p className="text-2xl font-bold">
                      {formatCurrency(amount || 0, `${currency}X`)}
                    </p>
                    <p className="text-sm text-muted-foreground mt-2">
                      1 {currency} = 1 {currency}X
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Button
              type="button"
              onClick={() => {
                if (amount && amount > 0) {
                  setStep('bank');
                }
              }}
              disabled={!amount || amount <= 0}
              className="w-full"
            >
              Continue
              <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
          </motion.div>
        )}

        {step === 'bank' && (
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            className="space-y-6"
          >
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center space-x-2">
                  <CreditCard className="h-5 w-5" />
                  <span>Bank Details</span>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div>
                    <label className="text-sm font-medium mb-2 block">
                      Select Bank
                    </label>
                    <Select
                      value={bankCode}
                      onValueChange={(value) => setValue('bankCode', value)}
                      options={banks.map(bank => ({
                        value: bank.code,
                        label: bank.name,
                      }))}
                      placeholder="Choose your bank"
                      error={errors.bankCode?.message}
                    />
                  </div>

                  <div>
                    <label className="text-sm font-medium mb-2 block">
                      Account Number
                    </label>
                    <Input
                      {...register('accountNumber')}
                      placeholder="1234567890"
                      error={errors.accountNumber?.message}
                      onChange={(e) => {
                        setValue('accountNumber', e.target.value);
                        if (bankCode && e.target.value.length >= 10) {
                          validateAccount(bankCode, e.target.value);
                        }
                      }}
                    />
                  </div>

                  {accountInfo && (
                    <div className="p-4 bg-green-500/10 border border-green-500/20 rounded-lg">
                      <p className="text-green-500 font-medium">
                        Account Verified
                      </p>
                      <p className="text-sm mt-1">
                        {accountInfo.account_name}
                      </p>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>

            <div className="flex space-x-4">
              <Button
                type="button"
                variant="outline"
                onClick={() => setStep('amount')}
                className="flex-1"
              >
                Back
              </Button>
              <Button
                type="button"
                onClick={() => {
                  if (bankCode && accountInfo) {
                    setStep('confirm');
                  }
                }}
                disabled={!bankCode || !accountInfo}
                className="flex-1"
              >
                Continue
                <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </div>
          </motion.div>
        )}

        {step === 'confirm' && (
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            className="space-y-6"
          >
            <Card>
              <CardHeader>
                <CardTitle>Confirm Deposit</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <p className="text-sm text-muted-foreground">Amount</p>
                      <p className="text-lg font-semibold">
                        {formatCurrency(amount || 0, currency)}
                      </p>
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">
                        You'll Receive
                      </p>
                      <p className="text-lg font-semibold">
                        {formatCurrency(amount || 0, `${currency}X`)}
                      </p>
                    </div>
                  </div>

                  <div className="border-t pt-4">
                    <p className="text-sm text-muted-foreground mb-2">
                      Bank Details
                    </p>
                    <div className="space-y-2">
                      <p className="font-medium">{accountInfo?.account_name}</p>
                      <p className="text-sm">
                        {banks.find(b => b.code === bankCode)?.name} ••••{
                          watch('accountNumber')?.slice(-4)
                        }
                      </p>
                    </div>
                  </div>

                  <div className="p-4 bg-blue-500/10 border border-blue-500/20 rounded-lg">
                    <p className="text-sm text-muted-foreground">
                      Please send the exact amount to the account details that
                      will be shown after confirmation. The funds will be
                      credited within 1-2 business days.
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <div className="flex space-x-4">
              <Button
                type="button"
                variant="outline"
                onClick={() => setStep('bank')}
                className="flex-1"
              >
                Back
              </Button>
              <Button
                type="submit"
                disabled={loading}
                className="flex-1"
              >
                {loading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Processing...
                  </>
                ) : (
                  'Confirm Deposit'
                )}
              </Button>
            </div>
          </motion.div>
        )}
      </form>
    </div>
  );
}
