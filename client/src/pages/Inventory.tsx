import { useQuery } from '@tanstack/react-query';
import { useAuth } from '../contexts/AuthContext';
import { inventoryApi } from '../services/api';
import {
  ArchiveBoxIcon,
  ExclamationTriangleIcon,
  TrashIcon,
  CurrencyDollarIcon,
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
import { format } from 'date-fns';

const CATEGORY_COLORS = ['#f97316', '#22c55e', '#3b82f6', '#8b5cf6', '#eab308', '#ef4444'];

export default function Inventory() {
  const { user } = useAuth();
  const restaurantId = user?.restaurant?.id || '';

  const { data: inventoryData, isLoading: inventoryLoading } = useQuery({
    queryKey: ['inventory', restaurantId],
    queryFn: () => inventoryApi.getInventory(restaurantId),
    enabled: !!restaurantId,
  });

  const { data: alertsData } = useQuery({
    queryKey: ['inventory-alerts', restaurantId],
    queryFn: () => inventoryApi.getAlerts(restaurantId),
    enabled: !!restaurantId,
  });

  const { data: wasteData } = useQuery({
    queryKey: ['waste-log', restaurantId],
    queryFn: () => inventoryApi.getWaste(restaurantId),
    enabled: !!restaurantId,
  });

  const inventory = inventoryData?.data?.data || { items: [], summary: {} };
  const alerts = alertsData?.data?.data || { alerts: [], summary: {} };
  const waste = wasteData?.data?.data || { waste: [], summary: {} };

  const isLoading = inventoryLoading;

  // Group inventory by category
  const categoryData = inventory.items?.reduce((acc: any[], item: any) => {
    const existing = acc.find((c) => c.category === item.category);
    if (existing) {
      existing.value += Number(item.currentQuantity) * Number(item.unitCost || 0);
      existing.count += 1;
    } else {
      acc.push({
        category: item.category,
        value: Number(item.currentQuantity) * Number(item.unitCost || 0),
        count: 1,
      });
    }
    return acc;
  }, []) || [];

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
        <h1 className="text-2xl font-bold text-white">Inventory Management</h1>
        <p className="text-gray-400">
          Track stock levels, alerts, and waste
        </p>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-gray-800 rounded-xl p-5 border border-gray-700">
          <div className="flex items-center">
            <div className="p-3 bg-blue-500/10 rounded-lg">
              <ArchiveBoxIcon className="h-6 w-6 text-blue-500" />
            </div>
            <div className="ml-4">
              <p className="text-gray-400 text-sm">Total Items</p>
              <p className="text-2xl font-bold text-white">
                {inventory.summary?.totalItems || 0}
              </p>
            </div>
          </div>
        </div>

        <div className="bg-gray-800 rounded-xl p-5 border border-gray-700">
          <div className="flex items-center">
            <div className="p-3 bg-green-500/10 rounded-lg">
              <CurrencyDollarIcon className="h-6 w-6 text-green-500" />
            </div>
            <div className="ml-4">
              <p className="text-gray-400 text-sm">Inventory Value</p>
              <p className="text-2xl font-bold text-white">
                ${inventory.summary?.totalValue?.toLocaleString() || 0}
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
              <p className="text-gray-400 text-sm">Low Stock Alerts</p>
              <p className="text-2xl font-bold text-white">
                {inventory.summary?.lowStockCount || 0}
              </p>
            </div>
          </div>
        </div>

        <div className="bg-gray-800 rounded-xl p-5 border border-gray-700">
          <div className="flex items-center">
            <div className="p-3 bg-red-500/10 rounded-lg">
              <TrashIcon className="h-6 w-6 text-red-500" />
            </div>
            <div className="ml-4">
              <p className="text-gray-400 text-sm">Waste This Period</p>
              <p className="text-2xl font-bold text-white">
                ${waste.summary?.totalCost?.toLocaleString() || 0}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Value by Category */}
        <div className="bg-gray-800 rounded-xl p-6 border border-gray-700">
          <h3 className="text-lg font-semibold text-white mb-4">Value by Category</h3>
          <div className="h-64 flex items-center">
            <ResponsiveContainer width="60%" height="100%">
              <PieChart>
                <Pie
                  data={categoryData}
                  cx="50%"
                  cy="50%"
                  innerRadius={50}
                  outerRadius={80}
                  paddingAngle={3}
                  dataKey="value"
                >
                  {categoryData.map((_: any, index: number) => (
                    <Cell
                      key={`cell-${index}`}
                      fill={CATEGORY_COLORS[index % CATEGORY_COLORS.length]}
                    />
                  ))}
                </Pie>
                <Tooltip
                  contentStyle={{
                    backgroundColor: '#1f2937',
                    border: 'none',
                    borderRadius: '8px',
                  }}
                  formatter={(value: number) => [`$${value.toFixed(2)}`, 'Value']}
                />
              </PieChart>
            </ResponsiveContainer>
            <div className="flex-1 space-y-2">
              {categoryData.map((cat: any, index: number) => (
                <div key={cat.category} className="flex items-center justify-between">
                  <div className="flex items-center">
                    <div
                      className="w-3 h-3 rounded-full mr-2"
                      style={{
                        backgroundColor: CATEGORY_COLORS[index % CATEGORY_COLORS.length],
                      }}
                    />
                    <span className="text-gray-400 text-sm">{cat.category}</span>
                  </div>
                  <span className="text-white text-sm">${cat.value.toFixed(0)}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Waste by Reason */}
        <div className="bg-gray-800 rounded-xl p-6 border border-gray-700">
          <h3 className="text-lg font-semibold text-white mb-4">Waste by Reason</h3>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={waste.summary?.byReason || []}
                layout="vertical"
              >
                <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                <XAxis type="number" stroke="#9ca3af" fontSize={12} />
                <YAxis
                  type="category"
                  dataKey="reason"
                  stroke="#9ca3af"
                  fontSize={12}
                  width={100}
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: '#1f2937',
                    border: 'none',
                    borderRadius: '8px',
                  }}
                  formatter={(value: number) => [`$${value.toFixed(2)}`, 'Cost']}
                />
                <Bar dataKey="cost" fill="#ef4444" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Alerts Section */}
      <div className="bg-gray-800 rounded-xl border border-gray-700 overflow-hidden">
        <div className="p-6 border-b border-gray-700 flex items-center justify-between">
          <div>
            <h3 className="text-lg font-semibold text-white">Low Stock Alerts</h3>
            <p className="text-gray-400 text-sm">Items below reorder point</p>
          </div>
          <div className="flex gap-2">
            <span className="px-2.5 py-1 bg-red-500/10 text-red-500 rounded-full text-xs font-medium">
              {alerts.summary?.critical || 0} Critical
            </span>
            <span className="px-2.5 py-1 bg-yellow-500/10 text-yellow-500 rounded-full text-xs font-medium">
              {alerts.summary?.high || 0} High
            </span>
            <span className="px-2.5 py-1 bg-blue-500/10 text-blue-500 rounded-full text-xs font-medium">
              {alerts.summary?.medium || 0} Medium
            </span>
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-700/50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase">
                  Item
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase">
                  Category
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-400 uppercase">
                  Current
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-400 uppercase">
                  Reorder Point
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-400 uppercase">
                  Order Qty
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-400 uppercase">
                  Est. Cost
                </th>
                <th className="px-6 py-3 text-center text-xs font-medium text-gray-400 uppercase">
                  Urgency
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-700">
              {(alerts.alerts || []).map((alert: any) => (
                <tr key={alert.id} className="hover:bg-gray-700/30">
                  <td className="px-6 py-4 whitespace-nowrap">
                    <p className="text-white font-medium">{alert.name}</p>
                    <p className="text-gray-400 text-sm">{alert.vendor}</p>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-gray-400">
                    {alert.category}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-right text-white">
                    {alert.currentQuantity} {alert.unit}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-right text-gray-400">
                    {alert.reorderPoint} {alert.unit}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-right text-white font-medium">
                    {alert.orderQuantity} {alert.unit}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-right text-white">
                    ${alert.estimatedCost?.toFixed(2)}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-center">
                    <span
                      className={clsx(
                        'px-2.5 py-0.5 rounded-full text-xs font-medium',
                        alert.urgency === 'critical'
                          ? 'bg-red-500/10 text-red-500'
                          : alert.urgency === 'high'
                          ? 'bg-yellow-500/10 text-yellow-500'
                          : 'bg-blue-500/10 text-blue-500'
                      )}
                    >
                      {alert.urgency}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Inventory Table */}
      <div className="bg-gray-800 rounded-xl border border-gray-700 overflow-hidden">
        <div className="p-6 border-b border-gray-700">
          <h3 className="text-lg font-semibold text-white">All Inventory Items</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-700/50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase">
                  Item
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase">
                  Category
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-400 uppercase">
                  Quantity
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-400 uppercase">
                  Unit Cost
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-400 uppercase">
                  Value
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase">
                  Storage
                </th>
                <th className="px-6 py-3 text-center text-xs font-medium text-gray-400 uppercase">
                  Status
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-700">
              {(inventory.items || []).map((item: any) => {
                const isLow =
                  Number(item.currentQuantity) <= Number(item.reorderPoint || 0);
                const value =
                  Number(item.currentQuantity) * Number(item.unitCost || 0);
                return (
                  <tr key={item.id} className="hover:bg-gray-700/30">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <p className="text-white font-medium">{item.name}</p>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-gray-400">
                      {item.category}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-white">
                      {Number(item.currentQuantity).toFixed(1)} {item.unit}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-gray-400">
                      ${Number(item.unitCost || 0).toFixed(2)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-white">
                      ${value.toFixed(2)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-gray-400">
                      {item.storageLocation || '-'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-center">
                      <span
                        className={clsx(
                          'px-2.5 py-0.5 rounded-full text-xs font-medium',
                          isLow
                            ? 'bg-red-500/10 text-red-500'
                            : 'bg-green-500/10 text-green-500'
                        )}
                      >
                        {isLow ? 'Low Stock' : 'In Stock'}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
