// skypay-sdk/src/hooks/useSkyPay.ts
import { useContext } from 'react';
import { SkyPayContext } from '../context/SkyPayContext';

export const useSkyPay = () => {
  const context = useContext(SkyPayContext);
  
  if (!context) {
    throw new Error('useSkyPay must be used within a SkyPayProvider');
  }
  
  return context;
};

// skypay-sdk/src/hooks/useBalances.ts
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { SkyPayClient } from '../SkyPayClient';

export const useBalances = (client: SkyPayClient) => {
  return useQuery({
    queryKey: ['balances'],
    queryFn: () => client.getBalances(),
    staleTime: 10000, // 10 seconds
    refetchInterval: 30000, // 30 seconds
  });
};

// skypay-sdk/src/hooks/useSettlements.ts
import { useQuery, useMutation, useQueryClient, useInfiniteQuery } from '@tanstack/react-query';
import { SkyPayClient } from '../SkyPayClient';

export const useSettlements = (client: SkyPayClient, filters?: any) => {
  return useInfiniteQuery({
    queryKey: ['settlements', filters],
    queryFn: ({ pageParam = 0 }) => 
      client.getSettlements({ ...filters, offset: pageParam }),
    getNextPageParam: (lastPage, allPages) => {
      const loaded = allPages.flatMap(page => page.data).length;
      return loaded < lastPage.total ? loaded : undefined;
    },
  });
};

export const useCreateDeposit = (client: SkyPayClient) => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: (params: any) => client.createFiatDeposit(params),
    onSuccess: () => {
      queryClient.invalidateQueries(['settlements']);
      queryClient.invalidateQueries(['balances']);
    },
  });
};

export const useCreateWithdrawal = (client: SkyPayClient) => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: (params: any) => client.createFiatWithdrawal(params),
    onSuccess: () => {
      queryClient.invalidateQueries(['settlements']);
      queryClient.invalidateQueries(['balances']);
    },
  });
};
