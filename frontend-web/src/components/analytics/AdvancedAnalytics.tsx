'use client'

import React, { useState, useEffect } from 'react'
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  AreaChart,
  Area,
  PieChart,
  Pie,
  Cell,
  ScatterChart,
  Scatter,
  XAxis,
  YAxis,
  ZAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  Radar,
  Treemap,
} from 'recharts'
import {
  TrendingUp,
  TrendingDown,
  Users,
  DollarSign,
  Clock,
  Activity,
  PieChart as PieChartIcon,
  BarChart3,
  LineChart as LineChartIcon,
  Download,
  Filter,
  Calendar,
} from 'lucide-react'
import { useQuery } from 'react-query'
import DatePicker from 'react-datepicker'
import 'react-datepicker/dist/react-datepicker.css'
import { formatCurrency, formatNumber } from '@/utils/formatters'

const CHART_COLORS = [
  '#0066FF', '#885CF6', '#108981', '#F59E0B', '#EF4444',
  '#8B5CF6', '#10B981', '#F97316', '#84CC16', '#06B6D4'
]

interface AnalyticsData {
  overview: {
    totalVolume: number
    totalUsers: number
    activeUsers: number
    avgTransaction: number
    conversionRate: number
    growthRate: number
  }
  volumeTrend: Array<{
    date: string
    volume: number
    transactions: number
    users: number
  }>
  userGrowth: Array<{
    date: string
    newUsers: number
    activeUsers: number
    churnedUsers: number
  }>
  transactionDistribution: Array<{
    type: string
    count: number
    volume: number
    percentage: number
  }>
  geographicDistribution: Array<{
    country: string
    code: string
    users: number
    volume: number
    growth: number
  }>
  riskMetrics: Array<{
    date: string
    riskScore: number
    flaggedTransactions: number
    complianceAlerts: number
  }>
  deviceBreakdown: Array<{
    device: string
    users: number
    percentage: number
  }>
  timeAnalysis: Array<{
    hour: number
    transactions: number
    volume: number
    avgAmount: number
  }>
  walletMetrics: Array<{
    currency: string
    totalBalance: number
    activeWallets: number
    avgBalance: number
    growth: number
  }>
}

export function AdvancedAnalytics() {
  const [dateRange, setDateRange] = useState({
    startDate: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
    endDate: new Date(),
  })
  const [activeTab, setActiveTab] = useState('overview')
  const [chartType, setChartType] = useState('line')

  const { data: analyticsData, isLoading } = useQuery(
    ['analytics', dateRange],
    async () => {
      const response = await fetch(
        `/api/analytics?start=${dateRange.startDate.toISOString()}&end=${dateRange.endDate.toISOString()}`
      )
      return response.json()
    },
    { refetchInterval: 30000 }
  )

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-white dark:bg-gray-800 p-4 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg">
          <p className="font-medium text-gray-900 dark:text-gray-100">{label}</p>
          {payload.map((entry: any, index: number) => (
            <p key={index} className="text-sm" style={{ color: entry.color }}>
              {entry.name}: {formatNumber(entry.value)}
              {entry.dataKey === 'volume' && ' USD'}
              {entry.dataKey === 'percentage' && '%'}
            </p>
          ))}
        </div>
      )
    }
    return null
  }

  const renderChart = () => {
    if (!analyticsData) return null

    switch (activeTab) {
      case 'volume':
        return (
          <div className="space-y-6">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-6">
                <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">
                  Volume Trend
                </h3>
                <div className="h-80">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={analyticsData.volumeTrend}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                      <XAxis dataKey="date" stroke="#9CA3AF" />
                      <YAxis stroke="#9CA3AF" />
                      <Tooltip content={<CustomTooltip />} />
                      <Legend />
                      <Area
                        type="monotone"
                        dataKey="volume"
                        stroke="#0066FF"
                        fill="#0066FF"
                        fillOpacity={0.1}
                        strokeWidth={2}
                      />
                      <Area
                        type="monotone"
                        dataKey="transactions"
                        stroke="#885CF6"
                        fill="#885CF6"
                        fillOpacity={0.1}
                        strokeWidth={2}
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              </div>

              <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-6">
                <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">
                  Transaction Distribution
                </h3>
                <div className="h-80">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={analyticsData.transactionDistribution}
                        cx="50%"
                        cy="50%"
                        labelLine={false}
                        label={(entry) => `${entry.type}: ${entry.percentage}%`}
                        outerRadius={80}
                        fill="#8884d8"
                        dataKey="volume"
                      >
                        {analyticsData.transactionDistribution.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={CHART_COLORS[index % CHART_COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip content={<CustomTooltip />} />
                      <Legend />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </div>

            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-6">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">
                Time Analysis (24h)
              </h3>
              <div className="h-80">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={analyticsData.timeAnalysis}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                    <XAxis dataKey="hour" stroke="#9CA3AF" />
                    <YAxis stroke="#9CA3AF" />
                    <Tooltip content={<CustomTooltip />} />
                    <Legend />
                    <Bar dataKey="transactions" fill="#0066FF" radius={[4, 4, 0, 0]} />
                    <Bar dataKey="volume" fill="#885CF6" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>
        )

      case 'users':
        return (
          <div className="space-y-6">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-6">
                <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">
                  User Growth
                </h3>
                <div className="h-80">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={analyticsData.userGrowth}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                      <XAxis dataKey="date" stroke="#9CA3AF" />
                      <YAxis stroke="#9CA3AF" />
                      <Tooltip content={<CustomTooltip />} />
                      <Legend />
                      <Line
                        type="monotone"
                        dataKey="newUsers"
                        stroke="#10B981"
                        strokeWidth={2}
                        dot={{ r: 4 }}
                        activeDot={{ r: 6 }}
                      />
                      <Line
                        type="monotone"
                        dataKey="activeUsers"
                        stroke="#0066FF"
                        strokeWidth={2}
                        dot={{ r: 4 }}
                      />
                      <Line
                        type="monotone"
                        dataKey="churnedUsers"
                        stroke="#EF4444"
                        strokeWidth={2}
                        dot={{ r: 4 }}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </div>

              <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-6">
                <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">
                  Device Breakdown
                </h3>
                <div className="h-80">
                  <ResponsiveContainer width="100%" height="100%">
                    <RadarChart data={analyticsData.deviceBreakdown}>
                      <PolarGrid />
                      <PolarAngleAxis dataKey="device" />
                      <PolarRadiusAxis />
                      <Radar
                        name="Users"
                        dataKey="users"
                        stroke="#0066FF"
                        fill="#0066FF"
                        fillOpacity={0.3}
                      />
                      <Legend />
                      <Tooltip content={<CustomTooltip />} />
                    </RadarChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </div>

            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-6">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">
                Geographic Distribution
              </h3>
              <div className="h-96">
                <ResponsiveContainer width="100%" height="100%">
                  <ScatterChart>
                    <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                    <XAxis
                      dataKey="users"
                      type="number"
                      name="Users"
                      stroke="#9CA3AF"
                    />
                    <YAxis
                      dataKey="volume"
                      type="number"
                      name="Volume"
                      stroke="#9CA3AF"
                    />
                    <ZAxis
                      dataKey="growth"
                      type="number"
                      range={[50, 400]}
                      name="Growth"
                    />
                    <Tooltip
                      cursor={{ strokeDasharray: '3 3' }}
                      content={<CustomTooltip />}
                    />
                    <Legend />
                    <Scatter
                      name="Countries"
                      data={analyticsData.geographicDistribution}
                      fill="#0066FF"
                      shape="circle"
                    />
                  </ScatterChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>
        )

      case 'risk':
        return (
          <div className="space-y-6">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-6">
                <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">
                  Risk Metrics Trend
                </h3>
                <div className="h-80">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={analyticsData.riskMetrics}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                      <XAxis dataKey="date" stroke="#9CA3AF" />
                      <YAxis stroke="#9CA3AF" />
                      <Tooltip content={<CustomTooltip />} />
                      <Legend />
                      <Line
                        type="monotone"
                        dataKey="riskScore"
                        stroke="#F59E0B"
                        strokeWidth={2}
                        dot={{ r: 4 }}
                        activeDot={{ r: 6 }}
                      />
                      <Line
                        type="monotone"
                        dataKey="flaggedTransactions"
                        stroke="#EF4444"
                        strokeWidth={2}
                        dot={{ r: 4 }}
                      />
                      <Line
                        type="monotone"
                        dataKey="complianceAlerts"
                        stroke="#8B5CF6"
                        strokeWidth={2}
                        dot={{ r: 4 }}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </div>

              <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-6">
                <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">
                  Risk Score Distribution
                </h3>
                <div className="h-80">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={analyticsData.riskMetrics}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                      <XAxis dataKey="date" stroke="#9CA3AF" />
                      <YAxis stroke="#9CA3AF" />
                      <Tooltip content={<CustomTooltip />} />
                      <Legend />
                      <Bar
                        dataKey="riskScore"
                        fill="#F59E0B"
                        radius={[4, 4, 0, 0]}
                      />
                      <Bar
                        dataKey="flaggedTransactions"
                        fill="#EF4444"
                        radius={[4, 4, 0, 0]}
                      />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </div>

            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-6">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">
                Risk Heatmap
              </h3>
              <div className="h-80">
                <ResponsiveContainer width="100%" height="100%">
                  <Treemap
                    data={analyticsData.geographicDistribution}
                    dataKey="volume"
                    aspectRatio={4 / 3}
                    stroke="#fff"
                    fill="#8884d8"
                  >
                    <Tooltip content={<CustomTooltip />} />
                  </Treemap>
                </ResponsiveContainer>
              </div>
            </div>
          </div>
        )

      case 'wallets':
        return (
          <div className="space-y-6">
            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-6">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">
                Wallet Metrics by Currency
              </h3>
              <div className="h-80">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={analyticsData.walletMetrics}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                    <XAxis dataKey="currency" stroke="#9CA3AF" />
                    <YAxis stroke="#9CA3AF" />
                    <Tooltip content={<CustomTooltip />} />
                    <Legend />
                    <Bar
                      dataKey="totalBalance"
                      fill="#0066FF"
                      radius={[4, 4, 0, 0]}
                      name="Total Balance"
                    />
                    <Bar
                      dataKey="activeWallets"
                      fill="#10B981"
                      radius={[4, 4, 0, 0]}
                      name="Active Wallets"
                    />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {analyticsData.walletMetrics.map((wallet, index) => (
                <div
                  key={wallet.currency}
                  className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-6"
                >
                  <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">
                    {wallet.currency} Wallet Analytics
                  </h3>
                  <div className="space-y-4">
                    <div className="flex justify-between items-center">
                      <span className="text-gray-600 dark:text-gray-400">Total Balance</span>
                      <span className="font-semibold">
                        {formatCurrency(wallet.totalBalance, wallet.currency)}
                      </span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-gray-600 dark:text-gray-400">Active Wallets</span>
                      <span className="font-semibold">{wallet.activeWallets}</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-gray-600 dark:text-gray-400">Average Balance</span>
                      <span className="font-semibold">
                        {formatCurrency(wallet.avgBalance, wallet.currency)}
                      </span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-gray-600 dark:text-gray-400">Growth</span>
                      <span className={`font-semibold ${wallet.growth >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                        {wallet.growth >= 0 ? '+' : ''}{wallet.growth}%
                      </span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )

      default: // overview
        return (
          <div className="space-y-6">
            {/* Overview Stats */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-gray-500 dark:text-gray-400">Total Volume</p>
                    <p className="text-2xl font-bold text-gray-900 dark:text-gray-100 mt-2">
                      {formatCurrency(analyticsData?.overview.totalVolume || 0, 'USD')}
                    </p>
                  </div>
                  <div className="w-12 h-12 bg-blue-100 dark:bg-blue-900/20 rounded-full flex items-center justify-center">
                    <DollarSign className="w-6 h-6 text-blue-600 dark:text-blue-400" />
                  </div>
                </div>
                <div className="mt-4 flex items-center text-sm">
                  <TrendingUp className="w-4 h-4 text-green-600 mr-1" />
                  <span className="text-green-600 dark:text-green-400 font-medium">
                    +{analyticsData?.overview.growthRate || 0}%
                  </span>
                  <span className="text-gray-500 dark:text-gray-400 ml-2">from last period</span>
                </div>
              </div>

              <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-gray-500 dark:text-gray-400">Total Users</p>
                    <p className="text-2xl font-bold text-gray-900 dark:text-gray-100 mt-2">
                      {formatNumber(analyticsData?.overview.totalUsers || 0)}
                    </p>
                  </div>
                  <div className="w-12 h-12 bg-green-100 dark:bg-green-900/20 rounded-full flex items-center justify-center">
                    <Users className="w-6 h-6 text-green-600 dark:text-green-400" />
                  </div>
                </div>
                <div className="mt-4">
                  <span className="text-sm text-gray-500 dark:text-gray-400">
                    {analyticsData?.overview.activeUsers || 0} active
                  </span>
                </div>
              </div>

              <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-gray-500 dark:text-gray-400">Avg Transaction</p>
                    <p className="text-2xl font-bold text-gray-900 dark:text-gray-100 mt-2">
                      {formatCurrency(analyticsData?.overview.avgTransaction || 0, 'USD')}
                    </p>
                  </div>
                  <div className="w-12 h-12 bg-purple-100 dark:bg-purple-900/20 rounded-full flex items-center justify-center">
                    <Activity className="w-6 h-6 text-purple-600 dark:text-purple-400" />
                  </div>
                </div>
                <div className="mt-4">
                  <span className="text-sm text-gray-500 dark:text-gray-400">
                    Conversion: {analyticsData?.overview.conversionRate || 0}%
                  </span>
                </div>
              </div>

              <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-gray-500 dark:text-gray-400">Response Time</p>
                    <p className="text-2xl font-bold text-gray-900 dark:text-gray-100 mt-2">
                      2.4s
                    </p>
                  </div>
                  <div className="w-12 h-12 bg-yellow-100 dark:bg-yellow-900/20 rounded-full flex items-center justify-center">
                    <Clock className="w-6 h-6 text-yellow-600 dark:text-yellow-400" />
                  </div>
                </div>
                <div className="mt-4">
                  <span className="text-sm text-green-600 dark:text-green-400">
                    -15% from last week
                  </span>
                </div>
              </div>
            </div>

            {/* Main Charts */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-6">
                <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">
                  Volume & Transactions
                </h3>
                <div className="h-80">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={analyticsData?.volumeTrend || []}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                      <XAxis dataKey="date" stroke="#9CA3AF" />
                      <YAxis stroke="#9CA3AF" />
                      <Tooltip content={<CustomTooltip />} />
                      <Legend />
                      <Line
                        type="monotone"
                        dataKey="volume"
                        stroke="#0066FF"
                        strokeWidth={2}
                        dot={{ r: 4 }}
                        activeDot={{ r: 6 }}
                      />
                      <Line
                        type="monotone"
                        dataKey="transactions"
                        stroke="#885CF6"
                        strokeWidth={2}
                        dot={{ r: 4 }}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </div>

              <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-6">
                <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">
                  User Growth
                </h3>
                <div className="h-80">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={analyticsData?.userGrowth || []}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                      <XAxis dataKey="date" stroke="#9CA3AF" />
                      <YAxis stroke="#9CA3AF" />
                      <Tooltip content={<CustomTooltip />} />
                      <Legend />
                      <Area
                        type="monotone"
                        dataKey="newUsers"
                        stroke="#10B981"
                        fill="#10B981"
                        fillOpacity={0.1}
                        strokeWidth={2}
                      />
                      <Area
                        type="monotone"
                        dataKey="activeUsers"
                        stroke="#0066FF"
                        fill="#0066FF"
                        fillOpacity={0.1}
                        strokeWidth={2}
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </div>

            {/* Distribution Charts */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-6">
                <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">
                  Transaction Distribution
                </h3>
                <div className="h-80">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={analyticsData?.transactionDistribution || []}
                        cx="50%"
                        cy="50%"
                        labelLine={false}
                        label={(entry) => `${entry.type}: ${entry.percentage}%`}
                        outerRadius={80}
                        fill="#8884d8"
                        dataKey="volume"
                      >
                        {analyticsData?.transactionDistribution.map((entry, index) => (
                          <Cell
                            key={`cell-${index}`}
                            fill={CHART_COLORS[index % CHART_COLORS.length]}
                          />
                        ))}
                      </Pie>
                      <Tooltip content={<CustomTooltip />} />
                      <Legend />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              </div>

              <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-6">
                <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">
                  Geographic Distribution
                </h3>
                <div className="h-80">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={analyticsData?.geographicDistribution || []}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                      <XAxis dataKey="code" stroke="#9CA3AF" />
                      <YAxis stroke="#9CA3AF" />
                      <Tooltip content={<CustomTooltip />} />
                      <Legend />
                      <Bar
                        dataKey="users"
                        fill="#0066FF"
                        radius={[4, 4, 0, 0]}
                        name="Users"
                      />
                      <Bar
                        dataKey="volume"
                        fill="#885CF6"
                        radius={[4, 4, 0, 0]}
                        name="Volume"
                      />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </div>
          </div>
        )
    }
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">
            Advanced Analytics
          </h1>
          <p className="text-gray-600 dark:text-gray-400 mt-1">
            Real-time analytics and insights
          </p>
        </div>
        <div className="flex items-center space-x-4">
          <div className="flex items-center space-x-2">
            <Calendar className="w-4 h-4 text-gray-400" />
            <DatePicker
              selected={dateRange.startDate}
              onChange={(date) => setDateRange({ ...dateRange, startDate: date! })}
              selectsStart
              startDate={dateRange.startDate}
              endDate={dateRange.endDate}
              className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700"
            />
            <span className="text-gray-400">to</span>
            <DatePicker
              selected={dateRange.endDate}
              onChange={(date) => setDateRange({ ...dateRange, endDate: date! })}
              selectsEnd
              startDate={dateRange.startDate}
              endDate={dateRange.endDate}
              minDate={dateRange.startDate}
              className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700"
            />
          </div>
          <button
            onClick={() => {
              // Export functionality
            }}
            className="flex items-center space-x-2 px-4 py-2 bg-primary hover:bg-primary-dark text-white rounded-lg transition-colors"
          >
            <Download className="w-4 h-4" />
            <span>Export</span>
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="border-b border-gray-200 dark:border-gray-700">
        <nav className="flex space-x-8">
          {[
            { id: 'overview', label: 'Overview', icon: Activity },
            { id: 'volume', label: 'Volume', icon: DollarSign },
            { id: 'users', label: 'Users', icon: Users },
            { id: 'risk', label: 'Risk', icon: PieChartIcon },
            { id: 'wallets', label: 'Wallets', icon: BarChart3 },
          ].map((tab) => (
            <button
              key={tab.id}
              className={`py-3 px-1 font-medium border-b-2 flex items-center space-x-2 transition-colors ${
                activeTab === tab.id
                  ? 'border-primary text-primary'
                  : 'border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300'
              }`}
              onClick={() => setActiveTab(tab.id)}
            >
              <tab.icon className="w-4 h-4" />
              <span>{tab.label}</span>
            </button>
          ))}
        </nav>
      </div>

      {/* Chart Type Selector */}
      <div className="flex items-center justify-end space-x-4">
        <div className="flex items-center space-x-2">
          <span className="text-sm text-gray-600 dark:text-gray-400">Chart Type:</span>
          <select
            value={chartType}
            onChange={(e) => setChartType(e.target.value)}
            className="px-3 py-1 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-sm"
          >
            <option value="line">Line Chart</option>
            <option value="bar">Bar Chart</option>
            <option value="area">Area Chart</option>
            <option value="pie">Pie Chart</option>
          </select>
        </div>
        <button
          onClick={() => {
            // Refresh data
          }}
          className="flex items-center space-x-2 px-3 py-1 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 text-sm"
        >
          <Filter className="w-4 h-4" />
          <span>Filters</span>
        </button>
      </div>

      {/* Loading State */}
      {isLoading ? (
        <div className="flex items-center justify-center h-96">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
        </div>
      ) : (
        renderChart()
      )}
    </div>
  )
}
