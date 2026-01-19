import { useQuery } from '@tanstack/react-query';
import { useAuth } from '../contexts/AuthContext';
import { customerApi } from '../services/api';
import {
  UserGroupIcon,
  ExclamationTriangleIcon,
  SparklesIcon,
  HeartIcon,
} from '@heroicons/react/24/outline';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
} from 'recharts';
import clsx from 'clsx';

const SEGMENT_COLORS: Record<string, string> = {
  CHAMPION: '#22c55e',
  VIP: '#3b82f6',
  REGULAR: '#8b5cf6',
  NEW: '#eab308',
  AT_RISK: '#f97316',
  LOST: '#ef4444',
};

const SEGMENT_DESCRIPTIONS: Record<string, string> = {
  CHAMPION: 'Top spenders with frequent visits',
  VIP: 'High value, loyal customers',
  REGULAR: 'Consistent, reliable customers',
  NEW: 'Recently acquired customers',
  AT_RISK: 'Previously active, now declining',
  LOST: 'Inactive for extended period',
};

export default function CustomerInsights() {
  const { user } = useAuth();
  const restaurantId = user?.restaurant?.id || '';

  const { data: segmentationData, isLoading: segmentsLoading } = useQuery({
    queryKey: ['customer-segmentation', restaurantId],
    queryFn: () => customerApi.getSegmentation(restaurantId),
    enabled: !!restaurantId,
  });

  const { data: churnData, isLoading: churnLoading } = useQuery({
    queryKey: ['churn-risk', restaurantId],
    queryFn: () => customerApi.getChurnRisk(restaurantId),
    enabled: !!restaurantId,
  });

  const segments = segmentationData?.data?.data?.segments || [];
  const rfmDistribution = segmentationData?.data?.data?.rfmDistribution || [];
  const churnRisk = churnData?.data?.data || { atRisk: [], summary: {} };

  const isLoading = segmentsLoading || churnLoading;

  // Calculate totals
  const totalCustomers = segments.reduce((sum: number, s: any) => sum + s.count, 0);
  const totalRevenue = segments.reduce((sum: number, s: any) => sum + Number(s.totalRevenue || 0), 0);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-orange-500"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-white">Customer Insights</h1>
        <p className="text-gray-400">
          RFM segmentation and churn risk analysis
        </p>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-gray-800 rounded-xl p-5 border border-gray-700">
          <div className="flex items-center">
            <div className="p-3 bg-blue-500/10 rounded-lg">
              <UserGroupIcon className="h-6 w-6 text-blue-500" />
            </div>
            <div className="ml-4">
              <p className="text-gray-400 text-sm">Total Customers</p>
              <p className="text-2xl font-bold text-white">{totalCustomers.toLocaleString()}</p>
            </div>
          </div>
        </div>

        <div className="bg-gray-800 rounded-xl p-5 border border-gray-700">
          <div className="flex items-center">
            <div className="p-3 bg-green-500/10 rounded-lg">
              <SparklesIcon className="h-6 w-6 text-green-500" />
            </div>
            <div className="ml-4">
              <p className="text-gray-400 text-sm">Champions</p>
              <p className="text-2xl font-bold text-white">
                {segments.find((s: any) => s.segment === 'CHAMPION')?.count || 0}
              </p>
            </div>
          </div>
        </div>

        <div className="bg-gray-800 rounded-xl p-5 border border-gray-700">
          <div className="flex items-center">
            <div className="p-3 bg-orange-500/10 rounded-lg">
              <ExclamationTriangleIcon className="h-6 w-6 text-orange-500" />
            </div>
            <div className="ml-4">
              <p className="text-gray-400 text-sm">At Risk</p>
              <p className="text-2xl font-bold text-white">
                {churnRisk.summary?.high || 0}
              </p>
            </div>
          </div>
        </div>

        <div className="bg-gray-800 rounded-xl p-5 border border-gray-700">
          <div className="flex items-center">
            <div className="p-3 bg-purple-500/10 rounded-lg">
              <HeartIcon className="h-6 w-6 text-purple-500" />
            </div>
            <div className="ml-4">
              <p className="text-gray-400 text-sm">Avg. Lifetime Value</p>
              <p className="text-2xl font-bold text-white">
                ${Math.round(totalRevenue / Math.max(totalCustomers, 1)).toLocaleString()}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Segment Distribution */}
        <div className="bg-gray-800 rounded-xl p-6 border border-gray-700">
          <h3 className="text-lg font-semibold text-white mb-4">Customer Segments</h3>
          <div className="h-64 flex items-center">
            <ResponsiveContainer width="60%" height="100%">
              <PieChart>
                <Pie
                  data={segments.map((s: any) => ({
                    name: s.segment,
                    value: s.count,
                  }))}
                  cx="50%"
                  cy="50%"
                  innerRadius={50}
                  outerRadius={80}
                  paddingAngle={3}
                  dataKey="value"
                >
                  {segments.map((s: any, index: number) => (
                    <Cell
                      key={`cell-${index}`}
                      fill={SEGMENT_COLORS[s.segment] || '#6b7280'}
                    />
                  ))}
                </Pie>
                <Tooltip
                  contentStyle={{
                    backgroundColor: '#1f2937',
                    border: 'none',
                    borderRadius: '8px',
                  }}
                />
              </PieChart>
            </ResponsiveContainer>
            <div className="flex-1 space-y-2">
              {segments.map((s: any) => (
                <div key={s.segment} className="flex items-center justify-between">
                  <div className="flex items-center">
                    <div
                      className="w-3 h-3 rounded-full mr-2"
                      style={{ backgroundColor: SEGMENT_COLORS[s.segment] }}
                    />
                    <span className="text-gray-400 text-sm">{s.segment}</span>
                  </div>
                  <span className="text-white text-sm font-medium">{s.count}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Revenue by Segment */}
        <div className="bg-gray-800 rounded-xl p-6 border border-gray-700">
          <h3 className="text-lg font-semibold text-white mb-4">Revenue by Segment</h3>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={segments.map((s: any) => ({
                  segment: s.segment,
                  revenue: Number(s.totalRevenue || 0),
                }))}
                layout="vertical"
              >
                <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                <XAxis type="number" stroke="#9ca3af" fontSize={12} />
                <YAxis
                  type="category"
                  dataKey="segment"
                  stroke="#9ca3af"
                  fontSize={12}
                  width={80}
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: '#1f2937',
                    border: 'none',
                    borderRadius: '8px',
                  }}
                  formatter={(value: number) => [`$${value.toLocaleString()}`, 'Revenue']}
                />
                <Bar dataKey="revenue" radius={[0, 4, 4, 0]}>
                  {segments.map((s: any, index: number) => (
                    <Cell
                      key={`cell-${index}`}
                      fill={SEGMENT_COLORS[s.segment] || '#6b7280'}
                    />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Segment Details */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {segments.map((segment: any) => (
          <div
            key={segment.segment}
            className="bg-gray-800 rounded-xl p-5 border border-gray-700"
          >
            <div className="flex items-center justify-between mb-3">
              <h4
                className="font-semibold"
                style={{ color: SEGMENT_COLORS[segment.segment] }}
              >
                {segment.segment}
              </h4>
              <span className="text-2xl font-bold text-white">{segment.count}</span>
            </div>
            <p className="text-gray-400 text-sm mb-4">
              {SEGMENT_DESCRIPTIONS[segment.segment]}
            </p>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-500">Total Revenue</span>
                <span className="text-white">
                  ${Number(segment.totalRevenue || 0).toLocaleString()}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">Avg. Visits</span>
                <span className="text-white">{segment.avgVisits?.toFixed(1) || 0}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">Avg. Spend</span>
                <span className="text-white">
                  ${Number(segment.avgSpend || 0).toFixed(2)}
                </span>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* At-Risk Customers */}
      <div className="bg-gray-800 rounded-xl border border-gray-700 overflow-hidden">
        <div className="p-6 border-b border-gray-700">
          <h3 className="text-lg font-semibold text-white">High Churn Risk Customers</h3>
          <p className="text-gray-400 text-sm">Customers who need immediate attention</p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-700/50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase">
                  Customer
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase">
                  Segment
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-400 uppercase">
                  Last Visit
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-400 uppercase">
                  Total Spent
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-400 uppercase">
                  Churn Risk
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase">
                  Suggested Action
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-700">
              {(churnRisk.atRisk || []).slice(0, 10).map((customer: any) => (
                <tr key={customer.id} className="hover:bg-gray-700/30">
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div>
                      <p className="text-white font-medium">
                        {customer.firstName} {customer.lastName}
                      </p>
                      <p className="text-gray-400 text-sm">{customer.email}</p>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span
                      className="px-2.5 py-0.5 rounded-full text-xs font-medium"
                      style={{
                        backgroundColor: `${SEGMENT_COLORS[customer.segment]}20`,
                        color: SEGMENT_COLORS[customer.segment],
                      }}
                    >
                      {customer.segment}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-right text-gray-400">
                    {customer.daysSinceLastVisit} days ago
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-right text-white">
                    ${Number(customer.totalSpent || 0).toFixed(2)}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-right">
                    <span
                      className={clsx(
                        'px-2.5 py-0.5 rounded-full text-xs font-medium',
                        customer.churnRisk >= 0.7
                          ? 'bg-red-500/10 text-red-500'
                          : customer.churnRisk >= 0.4
                          ? 'bg-yellow-500/10 text-yellow-500'
                          : 'bg-green-500/10 text-green-500'
                      )}
                    >
                      {(customer.churnRisk * 100).toFixed(0)}%
                    </span>
                  </td>
                  <td className="px-6 py-4 text-gray-400 text-sm">
                    {customer.suggestedAction || 'Send personalized offer'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
