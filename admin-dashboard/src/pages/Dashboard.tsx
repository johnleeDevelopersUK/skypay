'use client'

import React, { useState, useEffect } from 'react'
import {
  ShieldAlert,
  Users,
  DollarSign,
  Clock,
  AlertTriangle,
  CheckCircle,
  XCircle,
  Filter,
  Download,
} from 'lucide-react'
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts'
import { useQuery } from 'react-query'
import { toast } from 'react-hot-toast'

interface ComplianceAlert {
  id: string
  type: 'AML' | 'KYC' | 'FRAUD' | 'SANCTION'
  level: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL'
  user: {
    id: string
    name: string
    email: string
    country: string
  }
  amount?: number
  currency: string
  description: string
  timestamp: Date
  status: 'PENDING' | 'REVIEWED' | 'RESOLVED' | 'ESCALATED'
}

interface KYCStatus {
  total: number
  verified: number
  pending: number
  rejected: number
  expired: number
}

interface TransactionMetrics {
  totalVolume: number
  suspiciousVolume: number
  avgTransaction: number
  flaggedTransactions: number
}

export default function AdminDashboard() {
  const [dateRange, setDateRange] = useState('7d')
  const [activeTab, setActiveTab] = useState('overview')
  const [selectedAlert, setSelectedAlert] = useState<ComplianceAlert | null>(null)

  // Fetch compliance data
  const { data: alerts, isLoading: alertsLoading } = useQuery(
    ['compliance-alerts', dateRange],
    async () => {
      const response = await fetch(`/api/admin/compliance/alerts?range=${dateRange}`)
      return response.json()
    },
    { refetchInterval: 30000 }
  )

  const { data: kycStatus, isLoading: kycLoading } = useQuery(
    'kyc-status',
    async () => {
      const response = await fetch('/api/admin/kyc/status')
      return response.json()
    }
  )

  const { data: transactionMetrics, isLoading: metricsLoading } = useQuery(
    ['transaction-metrics', dateRange],
    async () => {
      const response = await fetch(`/api/admin/transactions/metrics?range=${dateRange}`)
      return response.json()
    }
  )

  const { data: riskScores, isLoading: riskLoading } = useQuery(
    ['risk-scores', dateRange],
    async () => {
      const response = await fetch(`/api/admin/risk/scores?range=${dateRange}`)
      return response.json()
    }
  )

  const handleResolveAlert = async (alertId: string) => {
    try {
      await fetch(`/api/admin/compliance/alerts/${alertId}/resolve`, {
        method: 'POST',
      })
      toast.success('Alert resolved successfully')
    } catch (error) {
      toast.error('Failed to resolve alert')
    }
  }

  const handleEscalateAlert = async (alertId: string) => {
    try {
      await fetch(`/api/admin/compliance/alerts/${alertId}/escalate`, {
        method: 'POST',
      })
      toast.success('Alert escalated to compliance officer')
    } catch (error) {
      toast.error('Failed to escalate alert')
    }
  }

  const exportReport = async (format: 'csv' | 'pdf') => {
    try {
      const response = await fetch(`/api/admin/reports/export?format=${format}`)
      const blob = await response.blob()
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `compliance-report-${new Date().toISOString()}.${format}`
      a.click()
      toast.success(`Report exported as ${format.toUpperCase()}`)
    } catch (error) {
      toast.error('Failed to export report')
    }
  }

  const getAlertColor = (level: ComplianceAlert['level']) => {
    switch (level) {
      case 'LOW': return 'bg-yellow-50 border-yellow-200 text-yellow-800'
      case 'MEDIUM': return 'bg-orange-50 border-orange-200 text-orange-800'
      case 'HIGH': return 'bg-red-50 border-red-200 text-red-800'
      case 'CRITICAL': return 'bg-purple-50 border-purple-200 text-purple-800'
    }
  }

  const getAlertIcon = (level: ComplianceAlert['level']) => {
    switch (level) {
      case 'LOW': return <AlertTriangle className="w-5 h-5" />
      case 'MEDIUM': return <AlertTriangle className="w-5 h-5" />
      case 'HIGH': return <ShieldAlert className="w-5 h-5" />
      case 'CRITICAL': return <ShieldAlert className="w-5 h-5" />
    }
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      {/* Header */}
      <header className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
        <div className="container mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">
                Compliance Dashboard
              </h1>
              <p className="text-gray-600 dark:text-gray-400 mt-1">
                Real-time monitoring and risk management
              </p>
            </div>
            <div className="flex items-center space-x-4">
              <button
                onClick={() => exportReport('csv')}
                className="flex items-center space-x-2 px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700"
              >
                <Download className="w-4 h-4" />
                <span>Export</span>
              </button>
              <select
                value={dateRange}
                onChange={(e) => setDateRange(e.target.value)}
                className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700"
              >
                <option value="24h">Last 24 hours</option>
                <option value="7d">Last 7 days</option>
                <option value="30d">Last 30 days</option>
                <option value="90d">Last 90 days</option>
              </select>
            </div>
          </div>
        </div>
      </header>

      {/* Tabs */}
      <div className="border-b border-gray-200 dark:border-gray-700">
        <div className="container mx-auto px-6">
          <nav className="flex space-x-8">
            {['overview', 'alerts', 'kyc', 'transactions', 'risk', 'reports'].map((tab) => (
              <button
                key={tab}
                className={`py-4 px-1 font-medium border-b-2 transition-colors ${
                  activeTab === tab
                    ? 'border-primary text-primary'
                    : 'border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300'
                }`}
                onClick={() => setActiveTab(tab)}
              >
                {tab.charAt(0).toUpperCase() + tab.slice(1)}
              </button>
            ))}
          </nav>
        </div>
      </div>

      <main className="container mx-auto px-6 py-8">
        {/* Overview Tab */}
        {activeTab === 'overview' && (
          <div className="space-y-8">
            {/* Stats Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-gray-500 dark:text-gray-400">Total Users</p>
                    <p className="text-3xl font-bold text-gray-900 dark:text-gray-100 mt-2">
                      {kycStatus?.total || 0}
                    </p>
                  </div>
                  <div className="w-12 h-12 bg-blue-100 dark:bg-blue-900/20 rounded-full flex items-center justify-center">
                    <Users className="w-6 h-6 text-blue-600 dark:text-blue-400" />
                  </div>
                </div>
                <div className="mt-4 flex items-center text-sm">
                  <span className="text-green-600 dark:text-green-400 font-medium">
                    +12.5%
                  </span>
                  <span className="text-gray-500 dark:text-gray-400 ml-2">from last month</span>
                </div>
              </div>

              <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-gray-500 dark:text-gray-400">Active Alerts</p>
                    <p className="text-3xl font-bold text-gray-900 dark:text-gray-100 mt-2">
                      {alerts?.filter((a: ComplianceAlert) => a.status === 'PENDING').length || 0}
                    </p>
                  </div>
                  <div className="w-12 h-12 bg-red-100 dark:bg-red-900/20 rounded-full flex items-center justify-center">
                    <ShieldAlert className="w-6 h-6 text-red-600 dark:text-red-400" />
                  </div>
                </div>
                <div className="mt-4">
                  <span className="text-sm text-gray-500 dark:text-gray-400">
                    {alerts?.filter((a: ComplianceAlert) => a.level === 'CRITICAL').length || 0} critical
                  </span>
                </div>
              </div>

              <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-gray-500 dark:text-gray-400">Transaction Volume</p>
                    <p className="text-3xl font-bold text-gray-900 dark:text-gray-100 mt-2">
                      ${(transactionMetrics?.totalVolume || 0).toLocaleString()}
                    </p>
                  </div>
                  <div className="w-12 h-12 bg-green-100 dark:bg-green-900/20 rounded-full flex items-center justify-center">
                    <DollarSign className="w-6 h-6 text-green-600 dark:text-green-400" />
                  </div>
                </div>
                <div className="mt-4">
                  <span className="text-sm text-red-600 dark:text-red-400">
                    ${(transactionMetrics?.suspiciousVolume || 0).toLocaleString()} flagged
                  </span>
                </div>
              </div>

              <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-gray-500 dark:text-gray-400">Avg Response Time</p>
                    <p className="text-3xl font-bold text-gray-900 dark:text-gray-100 mt-2">
                      2.4h
                    </p>
                  </div>
                  <div className="w-12 h-12 bg-purple-100 dark:bg-purple-900/20 rounded-full flex items-center justify-center">
                    <Clock className="w-6 h-6 text-purple-600 dark:text-purple-400" />
                  </div>
                </div>
                <div className="mt-4">
                  <span className="text-sm text-green-600 dark:text-green-400">
                    -15% from last week
                  </span>
                </div>
              </div>
            </div>

            {/* Charts */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Risk Score Trend */}
              <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-6">
                <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">
                  Risk Score Trend
                </h3>
                <div className="h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={riskScores || []}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                      <XAxis dataKey="date" stroke="#9CA3AF" />
                      <YAxis stroke="#9CA3AF" />
                      <Tooltip />
                      <Legend />
                      <Line
                        type="monotone"
                        dataKey="averageRisk"
                        stroke="#EF4444"
                        strokeWidth={2}
                        dot={{ r: 4 }}
                        activeDot={{ r: 6 }}
                      />
                      <Line
                        type="monotone"
                        dataKey="medianRisk"
                        stroke="#F59E0B"
                        strokeWidth={2}
                        dot={{ r: 4 }}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </div>

              {/* Alert Distribution */}
              <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-6">
                <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">
                  Alert Distribution by Type
                </h3>
                <div className="h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={[
                          { name: 'AML', value: 45 },
                          { name: 'KYC', value: 25 },
                          { name: 'FRAUD', value: 20 },
                          { name: 'SANCTION', value: 10 },
                        ]}
                        cx="50%"
                        cy="50%"
                        labelLine={false}
                        label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
                        outerRadius={80}
                        fill="#8884d8"
                        dataKey="value"
                      >
                        <Cell fill="#EF4444" />
                        <Cell fill="#F59E0B" />
                        <Cell fill="#108981" />
                        <Cell fill="#885CF6" />
                      </Pie>
                      <Tooltip />
                      <Legend />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </div>

            {/* Recent Alerts */}
            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-6">
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
                  Recent Compliance Alerts
                </h3>
                <button
                  onClick={() => setActiveTab('alerts')}
                  className="text-primary hover:text-primary-dark font-medium"
                >
                  View All →
                </button>
              </div>
              <div className="space-y-4">
                {alerts?.slice(0, 5).map((alert: ComplianceAlert) => (
                  <div
                    key={alert.id}
                    className={`p-4 border rounded-lg ${getAlertColor(alert.level)}`}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-3">
                        {getAlertIcon(alert.level)}
                        <div>
                          <p className="font-medium">{alert.type} Alert</p>
                          <p className="text-sm opacity-80">{alert.user.email}</p>
                        </div>
                      </div>
                      <div className="flex items-center space-x-3">
                        <span className="text-sm">
                          {alert.amount ? `$${alert.amount.toLocaleString()}` : 'No amount'}
                        </span>
                        <span className="text-sm">
                          {new Date(alert.timestamp).toLocaleTimeString()}
                        </span>
                        <div className="flex space-x-2">
                          <button
                            onClick={() => handleResolveAlert(alert.id)}
                            className="px-3 py-1 bg-green-500 text-white text-sm rounded hover:bg-green-600"
                          >
                            Resolve
                          </button>
                          <button
                            onClick={() => handleEscalateAlert(alert.id)}
                            className="px-3 py-1 bg-red-500 text-white text-sm rounded hover:bg-red-600"
                          >
                            Escalate
                          </button>
                        </div>
                      </div>
                    </div>
                    <p className="mt-2 text-sm">{alert.description}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Alerts Tab */}
        {activeTab === 'alerts' && (
          <div className="space-y-6">
            {/* Alert Filters */}
            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-6">
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Alert Type
                  </label>
                  <select className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg">
                    <option value="">All Types</option>
                    <option value="AML">AML</option>
                    <option value="KYC">KYC</option>
                    <option value="FRAUD">Fraud</option>
                    <option value="SANCTION">Sanction</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Risk Level
                  </label>
                  <select className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg">
                    <option value="">All Levels</option>
                    <option value="LOW">Low</option>
                    <option value="MEDIUM">Medium</option>
                    <option value="HIGH">High</option>
                    <option value="CRITICAL">Critical</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Status
                  </label>
                  <select className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg">
                    <option value="">All Status</option>
                    <option value="PENDING">Pending</option>
                    <option value="REVIEWED">Reviewed</option>
                    <option value="RESOLVED">Resolved</option>
                    <option value="ESCALATED">Escalated</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Date Range
                  </label>
                  <select className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg">
                    <option value="24h">Last 24 hours</option>
                    <option value="7d">Last 7 days</option>
                    <option value="30d">Last 30 days</option>
                    <option value="90d">Last 90 days</option>
                  </select>
                </div>
              </div>
            </div>

            {/* Alerts Table */}
            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden">
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                  <thead className="bg-gray-50 dark:bg-gray-700">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                        Alert
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                        User
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                        Amount
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                        Time
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                        Status
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                        Actions
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                    {alerts?.map((alert: ComplianceAlert) => (
                      <tr key={alert.id} className="hover:bg-gray-50 dark:hover:bg-gray-700">
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="flex items-center">
                            <div className={`w-3 h-3 rounded-full mr-3 ${
                              alert.level === 'CRITICAL' ? 'bg-red-500' :
                              alert.level === 'HIGH' ? 'bg-orange-500' :
                              alert.level === 'MEDIUM' ? 'bg-yellow-500' : 'bg-green-500'
                            }`} />
                            <div>
                              <div className="font-medium text-gray-900 dark:text-gray-100">
                                {alert.type}
                              </div>
                              <div className="text-sm text-gray-500 dark:text-gray-400">
                                {alert.level} risk
                              </div>
                            </div>
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div>
                            <div className="font-medium text-gray-900 dark:text-gray-100">
                              {alert.user.name}
                            </div>
                            <div className="text-sm text-gray-500 dark:text-gray-400">
                              {alert.user.email}
                            </div>
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="font-medium">
                            {alert.amount ? `$${alert.amount.toLocaleString()}` : '-'}
                          </div>
                          <div className="text-sm text-gray-500 dark:text-gray-400">
                            {alert.currency}
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div>
                            <div>{new Date(alert.timestamp).toLocaleDateString()}</div>
                            <div className="text-sm text-gray-500 dark:text-gray-400">
                              {new Date(alert.timestamp).toLocaleTimeString()}
                            </div>
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                            alert.status === 'PENDING' ? 'bg-yellow-100 text-yellow-800' :
                            alert.status === 'REVIEWED' ? 'bg-blue-100 text-blue-800' :
                            alert.status === 'RESOLVED' ? 'bg-green-100 text-green-800' :
                            'bg-red-100 text-red-800'
                          }`}>
                            {alert.status}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                          <div className="flex space-x-2">
                            <button
                              onClick={() => setSelectedAlert(alert)}
                              className="text-primary hover:text-primary-dark"
                            >
                              View
                            </button>
                            {alert.status === 'PENDING' && (
                              <>
                                <button
                                  onClick={() => handleResolveAlert(alert.id)}
                                  className="text-green-600 hover:text-green-900"
                                >
                                  Resolve
                                </button>
                                <button
                                  onClick={() => handleEscalateAlert(alert.id)}
                                  className="text-red-600 hover:text-red-900"
                                >
                                  Escalate
                                </button>
                              </>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* KYC Tab */}
        {activeTab === 'kyc' && (
          <div className="space-y-6">
            {/* KYC Stats */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-6">
                <div className="flex items-center">
                  <div className="w-12 h-12 bg-green-100 dark:bg-green-900/20 rounded-full flex items-center justify-center mr-4">
                    <CheckCircle className="w-6 h-6 text-green-600 dark:text-green-400" />
                  </div>
                  <div>
                    <p className="text-sm text-gray-500 dark:text-gray-400">Verified</p>
                    <p className="text-2xl font-bold text-gray-900 dark:text-gray-100">
                      {kycStatus?.verified || 0}
                    </p>
                    <p className="text-sm text-gray-500 dark:text-gray-400">
                      {((kycStatus?.verified / kycStatus?.total) * 100 || 0).toFixed(1)}%
                    </p>
                  </div>
                </div>
              </div>

              <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-6">
                <div className="flex items-center">
                  <div className="w-12 h-12 bg-yellow-100 dark:bg-yellow-900/20 rounded-full flex items-center justify-center mr-4">
                    <Clock className="w-6 h-6 text-yellow-600 dark:text-yellow-400" />
                  </div>
                  <div>
                    <p className="text-sm text-gray-500 dark:text-gray-400">Pending</p>
                    <p className="text-2xl font-bold text-gray-900 dark:text-gray-100">
                      {kycStatus?.pending || 0}
                    </p>
                    <p className="text-sm text-gray-500 dark:text-gray-400">
                      {((kycStatus?.pending / kycStatus?.total) * 100 || 0).toFixed(1)}%
                    </p>
                  </div>
                </div>
              </div>

              <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-6">
                <div className="flex items-center">
                  <div className="w-12 h-12 bg-red-100 dark:bg-red-900/20 rounded-full flex items-center justify-center mr-4">
                    <XCircle className="w-6 h-6 text-red-600 dark:text-red-400" />
                  </div>
                  <div>
                    <p className="text-sm text-gray-500 dark:text-gray-400">Rejected</p>
                    <p className="text-2xl font-bold text-gray-900 dark:text-gray-100">
                      {kycStatus?.rejected || 0}
                    </p>
                    <p className="text-sm text-gray-500 dark:text-gray-400">
                      {((kycStatus?.rejected / kycStatus?.total) * 100 || 0).toFixed(1)}%
                    </p>
                  </div>
                </div>
              </div>

              <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-6">
                <div className="flex items-center">
                  <div className="w-12 h-12 bg-gray-100 dark:bg-gray-700 rounded-full flex items-center justify-center mr-4">
                    <AlertTriangle className="w-6 h-6 text-gray-600 dark:text-gray-400" />
                  </div>
                  <div>
                    <p className="text-sm text-gray-500 dark:text-gray-400">Expired</p>
                    <p className="text-2xl font-bold text-gray-900 dark:text-gray-100">
                      {kycStatus?.expired || 0}
                    </p>
                    <p className="text-sm text-gray-500 dark:text-gray-400">
                      {((kycStatus?.expired / kycStatus?.total) * 100 || 0).toFixed(1)}%
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {/* KYC Verification Queue */}
            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-6">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-6">
                KYC Verification Queue
              </h3>
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                  <thead className="bg-gray-50 dark:bg-gray-700">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                        User
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                        Submitted
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                        Documents
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                        Risk Score
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                        Actions
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                    {/* KYC queue data would go here */}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}
      </main>

      {/* Alert Detail Modal */}
      {selectedAlert && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-xl font-bold text-gray-900 dark:text-gray-100">
                  Alert Details
                </h3>
                <button
                  onClick={() => setSelectedAlert(null)}
                  className="text-gray-400 hover:text-gray-500"
                >
                  ✕
                </button>
              </div>

              <div className="space-y-6">
                {/* Alert info */}
                <div>
                  <h4 className="font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Alert Information
                  </h4>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <p className="text-sm text-gray-500 dark:text-gray-400">Type</p>
                      <p className="font-medium">{selectedAlert.type}</p>
                    </div>
                    <div>
                      <p className="text-sm text-gray-500 dark:text-gray-400">Level</p>
                      <p className={`font-medium ${
                        selectedAlert.level === 'CRITICAL' ? 'text-red-600' :
                        selectedAlert.level === 'HIGH' ? 'text-orange-600' :
                        selectedAlert.level === 'MEDIUM' ? 'text-yellow-600' : 'text-green-600'
                      }`}>
                        {selectedAlert.level}
                      </p>
                    </div>
                    <div>
                      <p className="text-sm text-gray-500 dark:text-gray-400">Status</p>
                      <p className="font-medium">{selectedAlert.status}</p>
                    </div>
                    <div>
                      <p className="text-sm text-gray-500 dark:text-gray-400">Timestamp</p>
                      <p className="font-medium">
                        {new Date(selectedAlert.timestamp).toLocaleString()}
                      </p>
                    </div>
                  </div>
                </div>

                {/* User info */}
                <div>
                  <h4 className="font-medium text-gray-700 dark:text-gray-300 mb-2">
                    User Information
                  </h4>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <p className="text-sm text-gray-500 dark:text-gray-400">Name</p>
                      <p className="font-medium">{selectedAlert.user.name}</p>
                    </div>
                    <div>
                      <p className="text-sm text-gray-500 dark:text-gray-400">Email</p>
                      <p className="font-medium">{selectedAlert.user.email}</p>
                    </div>
                    <div>
                      <p className="text-sm text-gray-500 dark:text-gray-400">Country</p>
                      <p className="font-medium">{selectedAlert.user.country}</p>
                    </div>
                    <div>
                      <p className="text-sm text-gray500 dark:text-gray-400">User ID</p>
                      <p className="font-medium font-mono">{selectedAlert.user.id}</p>
                    </div>
                  </div>
                </div>

                {/* Transaction info */}
                {selectedAlert.amount && (
                  <div>
                    <h4 className="font-medium text-gray-700 dark:text-gray-300 mb-2">
                      Transaction Details
                    </h4>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <p className="text-sm text-gray-500 dark:text-gray-400">Amount</p>
                        <p className="font-medium">
                          ${selectedAlert.amount.toLocaleString()} {selectedAlert.currency}
                        </p>
                      </div>
                    </div>
                  </div>
                )}

                {/* Description */}
                <div>
                  <h4 className="font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Description
                  </h4>
                  <p className="text-gray-700 dark:text-gray-300 bg-gray-50 dark:bg-gray-700 p-4 rounded-lg">
                    {selectedAlert.description}
                  </p>
                </div>

                {/* Actions */}
                <div className="flex justify-end space-x-3 pt-6 border-t border-gray-200 dark:border-gray-700">
                  <button
                    onClick={() => setSelectedAlert(null)}
                    className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700"
                  >
                    Close
                  </button>
                  {selectedAlert.status === 'PENDING' && (
                    <>
                      <button
                        onClick={() => {
                          handleResolveAlert(selectedAlert.id)
                          setSelectedAlert(null)
                        }}
                        className="px-4 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600"
                      >
                        Mark as Resolved
                      </button>
                      <button
                        onClick={() => {
                          handleEscalateAlert(selectedAlert.id)
                          setSelectedAlert(null)
                        }}
                        className="px-4 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600"
                      >
                        Escalate to Officer
                      </button>
                    </>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
