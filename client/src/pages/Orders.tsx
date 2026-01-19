import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '../contexts/AuthContext';
import { orderApi } from '../services/api';
import {
  ShoppingCartIcon,
  ClockIcon,
  CheckCircleIcon,
  XCircleIcon,
} from '@heroicons/react/24/outline';
import clsx from 'clsx';
import { format } from 'date-fns';

const STATUS_COLORS: Record<string, string> = {
  PENDING: '#eab308',
  CONFIRMED: '#3b82f6',
  PREPARING: '#f97316',
  READY: '#8b5cf6',
  SERVED: '#22c55e',
  COMPLETED: '#22c55e',
  CANCELLED: '#ef4444',
};

const STATUS_ICONS: Record<string, any> = {
  PENDING: ClockIcon,
  CONFIRMED: CheckCircleIcon,
  PREPARING: ShoppingCartIcon,
  READY: CheckCircleIcon,
  SERVED: CheckCircleIcon,
  COMPLETED: CheckCircleIcon,
  CANCELLED: XCircleIcon,
};

export default function Orders() {
  const { user } = useAuth();
  const restaurantId = user?.restaurant?.id || '';
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [typeFilter, setTypeFilter] = useState<string>('all');

  const { data: ordersData, isLoading } = useQuery({
    queryKey: ['orders', restaurantId, statusFilter, typeFilter],
    queryFn: () =>
      orderApi.getOrders(restaurantId, {
        status: statusFilter !== 'all' ? statusFilter : undefined,
        orderType: typeFilter !== 'all' ? typeFilter : undefined,
        limit: 50,
      }),
    enabled: !!restaurantId,
  });

  const orders = ordersData?.data?.data?.orders || [];
  const summary = ordersData?.data?.data?.summary || {};

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
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Orders</h1>
          <p className="text-gray-400">
            View and manage restaurant orders
          </p>
        </div>
        <div className="flex gap-4">
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="bg-gray-700 border border-gray-600 text-white rounded-lg px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500"
          >
            <option value="all">All Status</option>
            <option value="PENDING">Pending</option>
            <option value="CONFIRMED">Confirmed</option>
            <option value="PREPARING">Preparing</option>
            <option value="READY">Ready</option>
            <option value="SERVED">Served</option>
            <option value="COMPLETED">Completed</option>
            <option value="CANCELLED">Cancelled</option>
          </select>
          <select
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value)}
            className="bg-gray-700 border border-gray-600 text-white rounded-lg px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500"
          >
            <option value="all">All Types</option>
            <option value="DINE_IN">Dine In</option>
            <option value="TAKEOUT">Takeout</option>
            <option value="DELIVERY">Delivery</option>
            <option value="CATERING">Catering</option>
          </select>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-gray-800 rounded-xl p-5 border border-gray-700">
          <p className="text-gray-400 text-sm">Total Orders</p>
          <p className="text-2xl font-bold text-white mt-1">
            {summary.total || orders.length}
          </p>
        </div>
        <div className="bg-gray-800 rounded-xl p-5 border border-gray-700">
          <p className="text-gray-400 text-sm">Active</p>
          <p className="text-2xl font-bold text-orange-500 mt-1">
            {summary.active || orders.filter((o: any) =>
              ['PENDING', 'CONFIRMED', 'PREPARING', 'READY'].includes(o.status)
            ).length}
          </p>
        </div>
        <div className="bg-gray-800 rounded-xl p-5 border border-gray-700">
          <p className="text-gray-400 text-sm">Completed</p>
          <p className="text-2xl font-bold text-green-500 mt-1">
            {summary.completed || orders.filter((o: any) =>
              o.status === 'COMPLETED'
            ).length}
          </p>
        </div>
        <div className="bg-gray-800 rounded-xl p-5 border border-gray-700">
          <p className="text-gray-400 text-sm">Total Revenue</p>
          <p className="text-2xl font-bold text-white mt-1">
            ${orders.reduce((sum: number, o: any) => sum + Number(o.total || 0), 0).toFixed(2)}
          </p>
        </div>
      </div>

      {/* Orders List */}
      <div className="bg-gray-800 rounded-xl border border-gray-700 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-700/50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase">
                  Order
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase">
                  Type
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase">
                  Table/Customer
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-400 uppercase">
                  Items
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-400 uppercase">
                  Total
                </th>
                <th className="px-6 py-3 text-center text-xs font-medium text-gray-400 uppercase">
                  Status
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase">
                  Time
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-700">
              {orders.length > 0 ? (
                orders.map((order: any) => {
                  const StatusIcon = STATUS_ICONS[order.status] || ClockIcon;
                  return (
                    <tr key={order.id} className="hover:bg-gray-700/30">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <p className="text-white font-medium">#{order.orderNumber}</p>
                        {order.staff && (
                          <p className="text-gray-400 text-sm">
                            Server: {order.staff.firstName}
                          </p>
                        )}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className="px-2.5 py-0.5 bg-gray-700 text-gray-300 rounded text-sm">
                          {order.orderType.replace('_', ' ')}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        {order.tableNumber ? (
                          <div>
                            <p className="text-white">Table {order.tableNumber}</p>
                            <p className="text-gray-400 text-sm">
                              {order.guestCount} guest{order.guestCount !== 1 ? 's' : ''}
                            </p>
                          </div>
                        ) : order.customer ? (
                          <div>
                            <p className="text-white">
                              {order.customer.firstName} {order.customer.lastName}
                            </p>
                            <p className="text-gray-400 text-sm">
                              {order.customer.phone || order.customer.email}
                            </p>
                          </div>
                        ) : (
                          <span className="text-gray-400">-</span>
                        )}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right text-white">
                        {order.items?.length || 0}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right">
                        <p className="text-white font-medium">
                          ${Number(order.total).toFixed(2)}
                        </p>
                        {Number(order.tip) > 0 && (
                          <p className="text-gray-400 text-sm">
                            +${Number(order.tip).toFixed(2)} tip
                          </p>
                        )}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-center">
                        <span
                          className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium"
                          style={{
                            backgroundColor: `${STATUS_COLORS[order.status]}20`,
                            color: STATUS_COLORS[order.status],
                          }}
                        >
                          <StatusIcon className="h-3.5 w-3.5 mr-1" />
                          {order.status}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-gray-400">
                        <p>{format(new Date(order.createdAt), 'h:mm a')}</p>
                        <p className="text-sm">
                          {format(new Date(order.createdAt), 'MMM d')}
                        </p>
                      </td>
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td colSpan={7} className="px-6 py-12 text-center text-gray-400">
                    No orders found
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
