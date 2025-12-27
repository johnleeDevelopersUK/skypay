// skypay-web-app/src/app/providers.tsx
'use client';

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { WagmiConfig, createConfig, configureChains } from 'wagmi';
import { polygon, polygonMumbai } from 'wagmi/chains';
import { publicProvider } from 'wagmi/providers/public';
import { RainbowKitProvider, darkTheme } from '@rainbow-me/rainbowkit';
import { SkyPayProvider } from '@/contexts/SkyPayContext';
import { Toaster } from 'react-hot-toast';

const { chains, publicClient, webSocketPublicClient } = configureChains(
  [
    ...(process.env.NEXT_PUBLIC_ENVIRONMENT === 'production'
      ? [polygon]
      : [polygonMumbai]),
  ],
  [publicProvider()]
);

const config = createConfig({
  autoConnect: true,
  publicClient,
  webSocketPublicClient,
});

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      retry: 1,
      staleTime: 10000,
    },
  },
});

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <QueryClientProvider client={queryClient}>
      <WagmiConfig config={config}>
        <RainbowKitProvider
          chains={chains}
          theme={darkTheme({
            accentColor: '#0066FF',
            accentColorForeground: 'white',
            borderRadius: 'medium',
          })}
        >
          <SkyPayProvider>
            {children}
            <Toaster
              position="bottom-right"
              toastOptions={{
                duration: 4000,
                style: {
                  background: '#1A1A1A',
                  color: '#FFFFFF',
                  border: '1px solid #333333',
                },
              }}
            />
          </SkyPayProvider>
        </RainbowKitProvider>
      </WagmiConfig>
    </QueryClientProvider>
  );
}
