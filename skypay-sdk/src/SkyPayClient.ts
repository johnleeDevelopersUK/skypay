// skypay-sdk/src/SkyPayClient.ts
import axios, { AxiosInstance, AxiosResponse } from 'axios';
import { ethers } from 'ethers';
import {
  SkyPayConfig,
  User,
  Settlement,
  Account,
  Transaction,
  BridgeDepositParams,
  BridgeWithdrawalParams,
  CreateSettlementRequest,
  ApiResponse,
  PaginatedResponse
} from './types';

export class SkyPayClient {
  private api: AxiosInstance;
  private config: SkyPayConfig;
  private web3Provider: ethers.providers.Provider | null = null;
  private signer: ethers.Signer | null = null;

  constructor(config: SkyPayConfig) {
    this.config = config;

    this.api = axios.create({
      baseURL: config.apiUrl,
      timeout: 30000,
      headers: {
        'Content-Type': 'application/json',
        'X-Client-Version': config.version || '1.0.0',
      },
    });

    // Add auth interceptor
    this.api.interceptors.request.use((config) => {
      const token = this.getAuthToken();
      if (token) {
        config.headers.Authorization = `Bearer ${token}`;
      }
      return config;
    });

    // Add response interceptor
    this.api.interceptors.response.use(
      (response) => response,
      (error) => {
        if (error.response?.status === 401) {
          this.clearAuthToken();
          // Trigger auth refresh or redirect
        }
        return Promise.reject(error);
      }
    );
  }

  /**
   * Authentication
   */
  async login(email: string, password: string): Promise<User> {
    const response = await this.api.post<ApiResponse<User>>('/auth/login', {
      email,
      password,
    });
    
    const { data } = response.data;
    this.setAuthToken(data.token);
    return data;
  }

  async register(userData: any): Promise<User> {
    const response = await this.api.post<ApiResponse<User>>('/auth/register', userData);
    return response.data.data;
  }

  async logout(): Promise<void> {
    await this.api.post('/auth/logout');
    this.clearAuthToken();
  }

  async getCurrentUser(): Promise<User> {
    const response = await this.api.get<ApiResponse<User>>('/users/me');
    return response.data.data;
  }

  /**
   * Settlements
   */
  async createFiatDeposit(params: BridgeDepositParams): Promise<Settlement> {
    const response = await this.api.post<ApiResponse<Settlement>>(
      '/settlements/fiat/deposit',
      params
    );
    return response.data.data;
  }

  async createFiatWithdrawal(params: BridgeWithdrawalParams): Promise<Settlement> {
    const response = await this.api.post<ApiResponse<Settlement>>(
      '/settlements/fiat/withdraw',
      params
    );
    return response.data.data;
  }

  async getSettlement(id: string): Promise<Settlement> {
    const response = await this.api.get<ApiResponse<Settlement>>(
      `/settlements/${id}`
    );
    return response.data.data;
  }

  async getSettlements(params?: {
    type?: string;
    status?: string;
    limit?: number;
    offset?: number;
  }): Promise<PaginatedResponse<Settlement>> {
    const response = await this.api.get<ApiResponse<PaginatedResponse<Settlement>>>(
      '/settlements',
      { params }
    );
    return response.data.data;
  }

  async cancelSettlement(id: string, reason?: string): Promise<void> {
    await this.api.post(`/settlements/${id}/cancel`, { reason });
  }

  /**
   * Accounts & Balances
   */
  async getAccounts(): Promise<Account[]> {
    const response = await this.api.get<ApiResponse<Account[]>>('/accounts');
    return response.data.data;
  }

  async getBalances(): Promise<any[]> {
    const response = await this.api.get<ApiResponse<any[]>>('/accounts/balances');
    return response.data.data;
  }

  async getAccountStatement(
    accountId: string,
    params?: {
      startDate?: Date;
      endDate?: Date;
      limit?: number;
      offset?: number;
    }
  ): Promise<any> {
    const response = await this.api.get<ApiResponse<any>>(
      `/accounts/${accountId}/statement`,
      { params }
    );
    return response.data.data;
  }

  /**
   * Bridge Integration
   */
  async getSupportedBanks(country: string, currency: string): Promise<any[]> {
    const response = await this.api.get<ApiResponse<any[]>>(
      '/bridge/banks',
      { params: { country, currency } }
    );
    return response.data.data;
  }

  async validateBankAccount(
    bankCode: string,
    accountNumber: string
  ): Promise<any> {
    const response = await this.api.post<ApiResponse<any>>(
      '/bridge/validate-account',
      { bankCode, accountNumber }
    );
    return response.data.data;
  }

  async getTransactionLimits(
    fromCurrency: string,
    toCurrency: string
  ): Promise<any> {
    const response = await this.api.get<ApiResponse<any>>(
      '/bridge/limits',
      { params: { fromCurrency, toCurrency } }
    );
    return response.data.data;
  }

  /**
   * Compliance & KYC
   */
  async submitKyc(data: any): Promise<any> {
    const response = await this.api.post<ApiResponse<any>>('/compliance/kyc', data);
    return response.data.data;
  }

  async getKycStatus(): Promise<any> {
    const response = await this.api.get<ApiResponse<any>>('/compliance/kyc/status');
    return response.data.data;
  }

  /**
   * Blockchain Operations
   */
  async connectWallet(provider: any): Promise<void> {
    this.web3Provider = new ethers.providers.Web3Provider(provider);
    this.signer = this.web3Provider.getSigner();
  }

  async getTokenBalance(tokenAddress: string, userAddress?: string): Promise<string> {
    if (!this.web3Provider) throw new Error('Wallet not connected');
    
    const address = userAddress || (await this.signer?.getAddress());
    if (!address) throw new Error('No address available');

    const token = new ethers.Contract(
      tokenAddress,
      ['function balanceOf(address) view returns (uint256)'],
      this.web3Provider
    );

    const balance = await token.balanceOf(address);
    return ethers.utils.formatUnits(balance, 18);
  }

  async approveToken(
    tokenAddress: string,
    spender: string,
    amount: string
  ): Promise<ethers.ContractTransaction> {
    if (!this.signer) throw new Error('Wallet not connected');

    const token = new ethers.Contract(
      tokenAddress,
      [
        'function approve(address spender, uint256 amount) returns (bool)',
        'function allowance(address owner, address spender) view returns (uint256)',
      ],
      this.signer
    );

    return await token.approve(spender, ethers.utils.parseUnits(amount, 18));
  }

  /**
   * Utils
   */
  private getAuthToken(): string | null {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('skypay_token');
    }
    return null;
  }

  private setAuthToken(token: string): void {
    if (typeof window !== 'undefined') {
      localStorage.setItem('skypay_token', token);
    }
  }

  private clearAuthToken(): void {
    if (typeof window !== 'undefined') {
      localStorage.removeItem('skypay_token');
    }
  }

  /**
   * WebSocket/Real-time
   */
  connectWebSocket(): WebSocket {
    const token = this.getAuthToken();
    const wsUrl = this.config.wsUrl || this.config.apiUrl.replace('http', 'ws');
    
    const ws = new WebSocket(`${wsUrl}/ws?token=${token}`);
    
    ws.onopen = () => {
      console.log('SkyPay WebSocket connected');
    };
    
    ws.onmessage = (event) => {
      const data = JSON.parse(event.data);
      this.handleWebSocketMessage(data);
    };
    
    ws.onclose = () => {
      console.log('SkyPay WebSocket disconnected');
    };
    
    return ws;
  }

  private handleWebSocketMessage(data: any): void {
    // Handle real-time updates
    switch (data.type) {
      case 'settlement_update':
        // Emit event or update cache
        break;
      case 'transaction_update':
        // Emit event or update cache
        break;
      case 'balance_update':
        // Emit event or update cache
        break;
    }
  }
}

// Export singleton instance
let instance: SkyPayClient | null = null;

export function createSkyPayClient(config: SkyPayConfig): SkyPayClient {
  if (!instance) {
    instance = new SkyPayClient(config);
  }
  return instance;
}

export function getSkyPayClient(): SkyPayClient {
  if (!instance) {
    throw new Error('SkyPayClient not initialized. Call createSkyPayClient first.');
  }
  return instance;
}
