import { useQuery } from '@tanstack/react-query';
import { useAuth } from '../contexts/AuthContext';
import { analyticsApi, orderApi, inventoryApi } from '../services/api';
import {
  CurrencyDollarIcon,
  UserGroupIcon,
  ShoppingCartIcon,
  ClockIcon,
  ArrowUpIcon,
  ArrowDownIcon,
  ExclamationTriangleIcon,
} from '@heroicons/react/24/outline';
import {
  LineChart,
  Line,
  AreaChart,
  Area,
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

const COLORS = ['#f97316', '#22c55e', '#3b82f6', '#eab308', '#ef4444'];

export default function Dashboard() {
  const { user } = useAuth();
  const restaurantId = user?.restaurant?.id || '';

  const { data: summary } = useQuery({
    queryKey: ['analytics-summary', restaurantId],
    queryFn: () => analyticsApi.getSummary(restaurantId, 'today'),
    enabled: !!restaurantId,
  });

  const { data: hourlyData } = useQuery({
    queryKey: ['analytics-hourly', restaurantId],
    queryFn: () => analyticsApi.getHourly(restaurantId),
    enabled: !!restaurantId,
  });

  const { data: recentOrders } = useQuery({
    queryKey: ['recent-orders', restaurantId],
    queryFn: () => orderApi.getOrders(restaurantId, { limit: 5, status: 'COMPLETED' }),
    enabled: !!restaurantId,
  });

  const { data: inventoryAlerts } = useQuery({
    queryKey: ['inventory-alerts', restaurantId],
    queryFn: () => inventoryApi.getAlerts(restaurantId),
    enabled: !!restaurantId,
  });

  const stats = summary?.data?.data || {
    revenue: 0,
    orders: 0,
    covers: 0,
    avgTicket: 0,
    revenueChange: 0,
    ordersChange: 0,
    coversChange: 0,
  };

  const hourly = hourlyData?.data?.data?.hourly || [];
  const categoryBreakdown = summary?.data?.data?.categoryBreakdown || [];
  const alerts = inventoryAlerts?.data?.data?.alerts || [];
  const orders = recentOrders?.data?.data?.orders || [];

  const statCards = [
    {
      name: "Today's Revenue",
      value: `$${stats.revenue?.toLocaleString() || '0'}`,
      change: stats.revenueChange || 0,
      icon: CurrencyDollarIcon,
      color: 'orange',
    },
    {
      name: 'Orders',
      value: stats.orders || 0,
      change: stats.ordersChange || 0,
      icon: ShoppingCartIcon,
      color: 'blue',
    },
    {
      name: 'Covers',
      value: stats.covers || 0,
      change: stats.coversChange || 0,
      icon: UserGroupIcon,
      color: 'green',
    },
    {
      name: 'Avg Ticket',
      value: `$${stats.avgTicket?.toFixed(2) || '0.00'}`,
      change: stats.ticketChange || 0,
      icon: ClockIcon,
      color: 'purple',
    },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-white">Dashboard</h1>
        <p className="text-gray-400">
          Welcome back, {user?.firstName}! Here's what's happening at {user?.restaurant?.name}.
        </p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {statCards.map((stat) => (
          <div
            key={stat.name}
            className="bg-gray-800 rounded-xl p-5 border border-gray-700"
          >
            <div className="flex items-center justify-between">
              <div>
                <p className="text-gray-400 text-sm">{stat.name}</p>
                <p className="text-2xl font-bold text-white mt-1">{stat.value}</p>
              </div>
              <div
                className={clsx(
                  'p-3 rounded-lg',
                  stat.color === 'orange' && 'bg-orange-500/10',
                  stat.color === 'blue' && 'bg-blue-500/10',
                  stat.color === 'green' && 'bg-green-500/10',
                  stat.color === 'purple' && 'bg-purple-500/10'
                )}
              >
                <stat.icon
                  className={clsx(
                    'h-6 w-6',
                    stat.color === 'orange' && 'text-orange-500',
                    stat.color === 'blue' && 'text-blue-500',
                    stat.color === 'green' && 'text-green-500',
                    stat.color === 'purple' && 'text-purple-500'
                  )}
                />
              </div>
            </div>
            <div className="flex items-center mt-3">
              {stat.change >= 0 ? (
                <ArrowUpIcon className="h-4 w-4 text-green-500" />
              ) : (
                <ArrowDownIcon className="h-4 w-4 text-red-500" />
              )}
              <span
                className={clsx(
                  'text-sm ml-1',
                  stat.change >= 0 ? 'text-green-500' : 'text-red-500'
                )}
              >
                {Math.abs(stat.change)}%
              </span>
              <span className="text-gray-500 text-sm ml-2">vs yesterday</span>
            </div>
          </div>
        ))}
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Hourly Revenue */}
        <div className="bg-gray-800 rounded-xl p-6 border border-gray-700">
          <h3 className="text-lg font-semibold text-white mb-4">Hourly Performance</h3>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={hourly}>
                <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                <XAxis dataKey="hour" stroke="#9ca3af" fontSize={12} />
                <YAxis stroke="#9ca3af" fontSize={12} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: '#1f2937',
                    border: 'none',
                    borderRadius: '8px',
                  }}
                />
                <Area
                  type="monotone"
                  dataKey="revenue"
                  stroke="#f97316"
                  fill="#f97316"
                  fillOpacity={0.2}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Category Breakdown */}
        <div className="bg-gray-800 rounded-xl p-6 border border-gray-700">
          <h3 className="text-lg font-semibold text-white mb-4">Sales by Category</h3>
          <div className="h-64 flex items-center">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={categoryBreakdown.length > 0 ? categoryBreakdown : [
                    { name: 'Main Courses', value: 45 },
                    { name: 'Appetizers', value: 25 },
                    { name: 'Beverages', value: 18 },
                    { name: 'Desserts', value: 12 },
                  ]}
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={80}
                  paddingAngle={5}
                  dataKey="value"
                >
                  {(categoryBreakdown.length > 0 ? categoryBreakdown : [
                    { name: 'Main Courses', value: 45 },
                    { name: 'Appetizers', value: 25 },
                    { name: 'Beverages', value: 18 },
                    { name: 'Desserts', value: 12 },
                  ]).map((_, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
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
            <div className="space-y-2">
              {(categoryBreakdown.length > 0 ? categoryBreakdown : [
                { name: 'Main Courses', value: 45 },
                { name: 'Appetizers', value: 25 },
                { name: 'Beverages', value: 18 },
                { name: 'Desserts', value: 12 },
              ]).map((item, index) => (
                <div key={item.name} className="flex items-center text-sm">
                  <div
                    className="w-3 h-3 rounded-full mr-2"
                    style={{ backgroundColor: COLORS[index % COLORS.length] }}
                  />
                  <span className="text-gray-400">{item.name}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Bottom Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Recent Orders */}
        <div className="bg-gray-800 rounded-xl p-6 border border-gray-700">
          <h3 className="text-lg font-semibold text-white mb-4">Recent Orders</h3>
          <div className="space-y-3">
            {orders.length > 0 ? (
              orders.map((order: any) => (
                <div
                  key={order.id}
                  className="flex items-center justify-between p-3 bg-gray-700/50 rounded-lg"
                >
                  <div>
                    <p className="text-white font-medium">#{order.orderNumber}</p>
                    <p className="text-gray-400 text-sm">
                      {order.orderType} • Table {order.tableNumber || 'N/A'}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-white font-medium">${Number(order.total).toFixed(2)}</p>
                    <p className="text-gray-400 text-sm">{order.items?.length || 0} items</p>
                  </div>
                </div>
              ))
            ) : (
              <p className="text-gray-400 text-center py-8">No recent orders</p>
            )}
          </div>
        </div>

        {/* Inventory Alerts */}
        <div className="bg-gray-800 rounded-xl p-6 border border-gray-700">
          <h3 className="text-lg font-semibold text-white mb-4">Inventory Alerts</h3>
          <div className="space-y-3">
            {alerts.length > 0 ? (
              alerts.slice(0, 5).map((alert: any) => (
                <div
                  key={alert.id}
                  className="flex items-center justify-between p-3 bg-gray-700/50 rounded-lg"
                >
                  <div className="flex items-center">
                    <div
                      className={clsx(
                        'p-2 rounded-lg mr-3',
                        alert.urgency === 'critical'
                          ? 'bg-red-500/10'
                          : alert.urgency === 'high'
                          ? 'bg-yellow-500/10'
                          : 'bg-blue-500/10'
                      )}
                    >
                      <ExclamationTriangleIcon
                        className={clsx(
                          'h-5 w-5',
                          alert.urgency === 'critical'
                            ? 'text-red-500'
                            : alert.urgency === 'high'
                            ? 'text-yellow-500'
                            : 'text-blue-500'
                        )}
                      />
                    </div>
                    <div>
                      <p className="text-white font-medium">{alert.name}</p>
                      <p className="text-gray-400 text-sm">
                        {alert.currentQuantity} {alert.unit} remaining
                      </p>
                    </div>
                  </div>
                  <span
                    className={clsx(
                      'px-2 py-1 text-xs font-medium rounded',
                      alert.urgency === 'critical'
                        ? 'bg-red-500/10 text-red-500'
                        : alert.urgency === 'high'
                        ? 'bg-yellow-500/10 text-yellow-500'
                        : 'bg-blue-500/10 text-blue-500'
                    )}
                  >
                    {alert.urgency}
                  </span>
                </div>
              ))
            ) : (
              <p className="text-gray-400 text-center py-8">No inventory alerts</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
