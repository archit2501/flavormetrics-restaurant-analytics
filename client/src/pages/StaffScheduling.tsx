import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '../contexts/AuthContext';
import { staffApi } from '../services/api';
import {
  UsersIcon,
  ClockIcon,
  CurrencyDollarIcon,
  CalendarIcon,
} from '@heroicons/react/24/outline';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from 'recharts';
import clsx from 'clsx';
import { format, addDays } from 'date-fns';

const ROLE_COLORS: Record<string, string> = {
  MANAGER: '#8b5cf6',
  SERVER: '#3b82f6',
  BARTENDER: '#f97316',
  KITCHEN: '#22c55e',
  HOST: '#eab308',
  BUSSER: '#6b7280',
};

export default function StaffScheduling() {
  const { user } = useAuth();
  const restaurantId = user?.restaurant?.id || '';
  const [selectedDate, setSelectedDate] = useState(format(new Date(), 'yyyy-MM-dd'));

  const { data: staffData, isLoading: staffLoading } = useQuery({
    queryKey: ['staff', restaurantId],
    queryFn: () => staffApi.getStaff(restaurantId),
    enabled: !!restaurantId,
  });

  const { data: scheduleData, isLoading: scheduleLoading } = useQuery({
    queryKey: ['optimal-schedule', restaurantId, selectedDate],
    queryFn: () => staffApi.getOptimalSchedule(restaurantId, selectedDate),
    enabled: !!restaurantId,
  });

  const { data: shiftsData } = useQuery({
    queryKey: ['shifts', restaurantId, selectedDate],
    queryFn: () => staffApi.getShifts(restaurantId, selectedDate),
    enabled: !!restaurantId,
  });

  const staff = staffData?.data?.data?.staff || [];
  const schedule = scheduleData?.data?.data || { hourlyNeeds: [], summary: {} };
  const shifts = shiftsData?.data?.data?.shifts || [];

  const isLoading = staffLoading || scheduleLoading;

  // Generate date options for next 7 days
  const dateOptions = Array.from({ length: 7 }, (_, i) => {
    const date = addDays(new Date(), i);
    return {
      value: format(date, 'yyyy-MM-dd'),
      label: format(date, 'EEE, MMM d'),
    };
  });

  // Prepare hourly chart data
  const hourlyData = schedule.hourlyNeeds?.map((h: any) => ({
    hour: h.time || `${h.hour}:00`,
    servers: h.staff_needed?.SERVER || 0,
    kitchen: h.staff_needed?.KITCHEN || 0,
    bartenders: h.staff_needed?.BARTENDER || 0,
    demand: h.demand_level,
  })) || [];

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
          <h1 className="text-2xl font-bold text-white">Staff Scheduling</h1>
          <p className="text-gray-400">
            AI-optimized scheduling based on demand forecast
          </p>
        </div>
        <div>
          <select
            value={selectedDate}
            onChange={(e) => setSelectedDate(e.target.value)}
            className="bg-gray-700 border border-gray-600 text-white rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-orange-500"
          >
            {dateOptions.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-gray-800 rounded-xl p-5 border border-gray-700">
          <div className="flex items-center">
            <div className="p-3 bg-blue-500/10 rounded-lg">
              <UsersIcon className="h-6 w-6 text-blue-500" />
            </div>
            <div className="ml-4">
              <p className="text-gray-400 text-sm">Total Staff</p>
              <p className="text-2xl font-bold text-white">{staff.length}</p>
            </div>
          </div>
        </div>

        <div className="bg-gray-800 rounded-xl p-5 border border-gray-700">
          <div className="flex items-center">
            <div className="p-3 bg-green-500/10 rounded-lg">
              <CalendarIcon className="h-6 w-6 text-green-500" />
            </div>
            <div className="ml-4">
              <p className="text-gray-400 text-sm">Scheduled Shifts</p>
              <p className="text-2xl font-bold text-white">{shifts.length}</p>
            </div>
          </div>
        </div>

        <div className="bg-gray-800 rounded-xl p-5 border border-gray-700">
          <div className="flex items-center">
            <div className="p-3 bg-orange-500/10 rounded-lg">
              <ClockIcon className="h-6 w-6 text-orange-500" />
            </div>
            <div className="ml-4">
              <p className="text-gray-400 text-sm">Total Hours</p>
              <p className="text-2xl font-bold text-white">
                {schedule.summary?.totalHours || 0}
              </p>
            </div>
          </div>
        </div>

        <div className="bg-gray-800 rounded-xl p-5 border border-gray-700">
          <div className="flex items-center">
            <div className="p-3 bg-purple-500/10 rounded-lg">
              <CurrencyDollarIcon className="h-6 w-6 text-purple-500" />
            </div>
            <div className="ml-4">
              <p className="text-gray-400 text-sm">Est. Labor Cost</p>
              <p className="text-2xl font-bold text-white">
                ${schedule.summary?.estimatedCost?.toLocaleString() || 0}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Hourly Staffing Chart */}
      <div className="bg-gray-800 rounded-xl p-6 border border-gray-700">
        <h3 className="text-lg font-semibold text-white mb-4">Recommended Staffing Levels</h3>
        <div className="h-72">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={hourlyData} barCategoryGap="20%">
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
              <Bar dataKey="servers" name="Servers" fill="#3b82f6" stackId="a" />
              <Bar dataKey="kitchen" name="Kitchen" fill="#22c55e" stackId="a" />
              <Bar dataKey="bartenders" name="Bartenders" fill="#f97316" stackId="a" />
            </BarChart>
          </ResponsiveContainer>
        </div>
        <div className="flex justify-center gap-6 mt-4">
          <div className="flex items-center">
            <div className="w-3 h-3 rounded-full bg-blue-500 mr-2" />
            <span className="text-gray-400 text-sm">Servers</span>
          </div>
          <div className="flex items-center">
            <div className="w-3 h-3 rounded-full bg-green-500 mr-2" />
            <span className="text-gray-400 text-sm">Kitchen</span>
          </div>
          <div className="flex items-center">
            <div className="w-3 h-3 rounded-full bg-orange-500 mr-2" />
            <span className="text-gray-400 text-sm">Bartenders</span>
          </div>
        </div>
      </div>

      {/* Staff List and Schedule Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Staff Members */}
        <div className="bg-gray-800 rounded-xl border border-gray-700 overflow-hidden">
          <div className="p-6 border-b border-gray-700">
            <h3 className="text-lg font-semibold text-white">Staff Members</h3>
          </div>
          <div className="divide-y divide-gray-700">
            {staff.map((member: any) => (
              <div key={member.id} className="p-4 flex items-center justify-between">
                <div className="flex items-center">
                  <div
                    className="h-10 w-10 rounded-full flex items-center justify-center text-white font-medium"
                    style={{ backgroundColor: ROLE_COLORS[member.role] || '#6b7280' }}
                  >
                    {member.firstName?.[0]}
                    {member.lastName?.[0]}
                  </div>
                  <div className="ml-3">
                    <p className="text-white font-medium">
                      {member.firstName} {member.lastName}
                    </p>
                    <p className="text-gray-400 text-sm">{member.email}</p>
                  </div>
                </div>
                <div className="text-right">
                  <span
                    className="px-2.5 py-0.5 rounded-full text-xs font-medium"
                    style={{
                      backgroundColor: `${ROLE_COLORS[member.role]}20`,
                      color: ROLE_COLORS[member.role],
                    }}
                  >
                    {member.role}
                  </span>
                  <p className="text-gray-400 text-sm mt-1">
                    ${Number(member.hourlyRate).toFixed(2)}/hr
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Scheduled Shifts */}
        <div className="bg-gray-800 rounded-xl border border-gray-700 overflow-hidden">
          <div className="p-6 border-b border-gray-700">
            <h3 className="text-lg font-semibold text-white">
              Scheduled Shifts - {format(new Date(selectedDate), 'MMM d')}
            </h3>
          </div>
          <div className="divide-y divide-gray-700">
            {shifts.length > 0 ? (
              shifts.map((shift: any) => (
                <div key={shift.id} className="p-4 flex items-center justify-between">
                  <div className="flex items-center">
                    <div
                      className="h-10 w-10 rounded-full flex items-center justify-center text-white font-medium"
                      style={{
                        backgroundColor: ROLE_COLORS[shift.staff?.role] || '#6b7280',
                      }}
                    >
                      {shift.staff?.firstName?.[0]}
                      {shift.staff?.lastName?.[0]}
                    </div>
                    <div className="ml-3">
                      <p className="text-white font-medium">
                        {shift.staff?.firstName} {shift.staff?.lastName}
                      </p>
                      <p className="text-gray-400 text-sm">{shift.staff?.role}</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-white">
                      {format(new Date(shift.scheduledStart), 'h:mm a')} -{' '}
                      {format(new Date(shift.scheduledEnd), 'h:mm a')}
                    </p>
                    <p className="text-gray-400 text-sm">
                      {Math.round(
                        (new Date(shift.scheduledEnd).getTime() -
                          new Date(shift.scheduledStart).getTime()) /
                          (1000 * 60 * 60)
                      )}{' '}
                      hours
                    </p>
                  </div>
                </div>
              ))
            ) : (
              <div className="p-8 text-center text-gray-400">
                No shifts scheduled for this date
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Hourly Schedule Table */}
      <div className="bg-gray-800 rounded-xl border border-gray-700 overflow-hidden">
        <div className="p-6 border-b border-gray-700">
          <h3 className="text-lg font-semibold text-white">Hourly Staffing Requirements</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-700/50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase">
                  Time
                </th>
                <th className="px-6 py-3 text-center text-xs font-medium text-gray-400 uppercase">
                  Expected Covers
                </th>
                <th className="px-6 py-3 text-center text-xs font-medium text-gray-400 uppercase">
                  Servers
                </th>
                <th className="px-6 py-3 text-center text-xs font-medium text-gray-400 uppercase">
                  Kitchen
                </th>
                <th className="px-6 py-3 text-center text-xs font-medium text-gray-400 uppercase">
                  Bartenders
                </th>
                <th className="px-6 py-3 text-center text-xs font-medium text-gray-400 uppercase">
                  Host
                </th>
                <th className="px-6 py-3 text-center text-xs font-medium text-gray-400 uppercase">
                  Demand
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-700">
              {(schedule.hourlyNeeds || []).map((hour: any, index: number) => (
                <tr key={index} className="hover:bg-gray-700/30">
                  <td className="px-6 py-4 whitespace-nowrap text-white font-medium">
                    {hour.time || `${hour.hour}:00`}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-center text-gray-400">
                    {hour.expected_covers || 0}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-center text-blue-400">
                    {hour.staff_needed?.SERVER || 0}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-center text-green-400">
                    {hour.staff_needed?.KITCHEN || 0}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-center text-orange-400">
                    {hour.staff_needed?.BARTENDER || 0}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-center text-yellow-400">
                    {hour.staff_needed?.HOST || 0}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-center">
                    <span
                      className={clsx(
                        'px-2.5 py-0.5 rounded-full text-xs font-medium',
                        hour.demand_level === 'high'
                          ? 'bg-red-500/10 text-red-500'
                          : hour.demand_level === 'medium'
                          ? 'bg-yellow-500/10 text-yellow-500'
                          : 'bg-green-500/10 text-green-500'
                      )}
                    >
                      {hour.demand_level || 'low'}
                    </span>
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
