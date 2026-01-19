import { useQuery } from '@tanstack/react-query';
import { useAuth } from '../contexts/AuthContext';
import { forecastApi } from '../services/api';
import {
  CalendarDaysIcon,
  UserGroupIcon,
  CurrencyDollarIcon,
  ArrowTrendingUpIcon,
} from '@heroicons/react/24/outline';
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  BarChart,
  Bar,
  Cell,
} from 'recharts';
import clsx from 'clsx';
import { format, parseISO, addDays } from 'date-fns';

const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const DAY_COLORS: Record<number, string> = {
  0: '#8b5cf6', // Sunday
  1: '#6b7280', // Monday
  2: '#6b7280', // Tuesday
  3: '#6b7280', // Wednesday
  4: '#6b7280', // Thursday
  5: '#f97316', // Friday
  6: '#22c55e', // Saturday
};

export default function DemandForecast() {
  const { user } = useAuth();
  const restaurantId = user?.restaurant?.id || '';

  const { data: forecastData, isLoading } = useQuery({
    queryKey: ['demand-forecast', restaurantId],
    queryFn: () => forecastApi.getDemandForecast(restaurantId, 14),
    enabled: !!restaurantId,
  });

  const { data: itemForecastData } = useQuery({
    queryKey: ['item-forecast', restaurantId],
    queryFn: () => forecastApi.getItemForecast(restaurantId, 7),
    enabled: !!restaurantId,
  });

  const forecasts = forecastData?.data?.data?.forecasts || [];
  const summary = forecastData?.data?.data?.summary || {};
  const itemForecasts = itemForecastData?.data?.data?.items || [];

  // Group by week
  const thisWeek = forecasts.slice(0, 7);
  const nextWeek = forecasts.slice(7, 14);

  // Calculate totals
  const totalExpectedCovers = forecasts.reduce((sum: number, f: any) => sum + f.expectedCovers, 0);
  const totalExpectedRevenue = forecasts.reduce(
    (sum: number, f: any) => sum + f.expectedCovers * 45, // Assume $45 avg ticket
    0
  );

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
        <h1 className="text-2xl font-bold text-white">Demand Forecast</h1>
        <p className="text-gray-400">
          AI-powered predictions for customer demand
        </p>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-gray-800 rounded-xl p-5 border border-gray-700">
          <div className="flex items-center">
            <div className="p-3 bg-orange-500/10 rounded-lg">
              <CalendarDaysIcon className="h-6 w-6 text-orange-500" />
            </div>
            <div className="ml-4">
              <p className="text-gray-400 text-sm">Forecast Period</p>
              <p className="text-xl font-bold text-white">14 Days</p>
            </div>
          </div>
        </div>

        <div className="bg-gray-800 rounded-xl p-5 border border-gray-700">
          <div className="flex items-center">
            <div className="p-3 bg-blue-500/10 rounded-lg">
              <UserGroupIcon className="h-6 w-6 text-blue-500" />
            </div>
            <div className="ml-4">
              <p className="text-gray-400 text-sm">Expected Covers</p>
              <p className="text-xl font-bold text-white">
                {totalExpectedCovers.toLocaleString()}
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
              <p className="text-gray-400 text-sm">Expected Revenue</p>
              <p className="text-xl font-bold text-white">
                ${totalExpectedRevenue.toLocaleString()}
              </p>
            </div>
          </div>
        </div>

        <div className="bg-gray-800 rounded-xl p-5 border border-gray-700">
          <div className="flex items-center">
            <div className="p-3 bg-purple-500/10 rounded-lg">
              <ArrowTrendingUpIcon className="h-6 w-6 text-purple-500" />
            </div>
            <div className="ml-4">
              <p className="text-gray-400 text-sm">Peak Day</p>
              <p className="text-xl font-bold text-white">
                {forecasts.length > 0
                  ? DAY_NAMES[
                      forecasts.reduce((max: any, f: any) =>
                        f.expectedCovers > max.expectedCovers ? f : max
                      ).dayOfWeek
                    ]
                  : '-'}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Forecast Chart */}
      <div className="bg-gray-800 rounded-xl p-6 border border-gray-700">
        <h3 className="text-lg font-semibold text-white mb-4">14-Day Demand Forecast</h3>
        <div className="h-80">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={forecasts}>
              <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
              <XAxis
                dataKey="date"
                stroke="#9ca3af"
                fontSize={12}
                tickFormatter={(date) => format(parseISO(date), 'MMM d')}
              />
              <YAxis stroke="#9ca3af" fontSize={12} />
              <Tooltip
                contentStyle={{
                  backgroundColor: '#1f2937',
                  border: 'none',
                  borderRadius: '8px',
                }}
                labelFormatter={(date) => format(parseISO(date as string), 'EEEE, MMM d')}
                formatter={(value: number, name: string) => {
                  if (name === 'expectedCovers') return [value, 'Expected Covers'];
                  if (name === 'confidenceLow') return [value, 'Low Estimate'];
                  if (name === 'confidenceHigh') return [value, 'High Estimate'];
                  return [value, name];
                }}
              />
              <Area
                type="monotone"
                dataKey="confidenceHigh"
                stroke="transparent"
                fill="#f97316"
                fillOpacity={0.1}
              />
              <Area
                type="monotone"
                dataKey="expectedCovers"
                stroke="#f97316"
                fill="#f97316"
                fillOpacity={0.3}
              />
              <Area
                type="monotone"
                dataKey="confidenceLow"
                stroke="transparent"
                fill="#1f2937"
                fillOpacity={1}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Weekly Breakdown */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* This Week */}
        <div className="bg-gray-800 rounded-xl p-6 border border-gray-700">
          <h3 className="text-lg font-semibold text-white mb-4">This Week</h3>
          <div className="h-48">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={thisWeek}>
                <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                <XAxis
                  dataKey="dayOfWeek"
                  stroke="#9ca3af"
                  fontSize={12}
                  tickFormatter={(day) => DAY_NAMES[day]}
                />
                <YAxis stroke="#9ca3af" fontSize={12} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: '#1f2937',
                    border: 'none',
                    borderRadius: '8px',
                  }}
                  labelFormatter={(day) => DAY_NAMES[day as number]}
                />
                <Bar dataKey="expectedCovers" radius={[4, 4, 0, 0]}>
                  {thisWeek.map((entry: any, index: number) => (
                    <Cell
                      key={`cell-${index}`}
                      fill={DAY_COLORS[entry.dayOfWeek] || '#6b7280'}
                    />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Next Week */}
        <div className="bg-gray-800 rounded-xl p-6 border border-gray-700">
          <h3 className="text-lg font-semibold text-white mb-4">Next Week</h3>
          <div className="h-48">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={nextWeek}>
                <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                <XAxis
                  dataKey="dayOfWeek"
                  stroke="#9ca3af"
                  fontSize={12}
                  tickFormatter={(day) => DAY_NAMES[day]}
                />
                <YAxis stroke="#9ca3af" fontSize={12} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: '#1f2937',
                    border: 'none',
                    borderRadius: '8px',
                  }}
                  labelFormatter={(day) => DAY_NAMES[day as number]}
                />
                <Bar dataKey="expectedCovers" radius={[4, 4, 0, 0]}>
                  {nextWeek.map((entry: any, index: number) => (
                    <Cell
                      key={`cell-${index}`}
                      fill={DAY_COLORS[entry.dayOfWeek] || '#6b7280'}
                    />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Daily Details */}
      <div className="bg-gray-800 rounded-xl border border-gray-700 overflow-hidden">
        <div className="p-6 border-b border-gray-700">
          <h3 className="text-lg font-semibold text-white">Daily Forecast Details</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-700/50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase">
                  Date
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase">
                  Day
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-400 uppercase">
                  Expected Covers
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-400 uppercase">
                  Confidence Range
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-400 uppercase">
                  Est. Revenue
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase">
                  Demand Level
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-700">
              {forecasts.map((forecast: any) => (
                <tr key={forecast.date} className="hover:bg-gray-700/30">
                  <td className="px-6 py-4 whitespace-nowrap text-white">
                    {format(parseISO(forecast.date), 'MMM d, yyyy')}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-gray-400">
                    {format(parseISO(forecast.date), 'EEEE')}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-right text-white font-medium">
                    {forecast.expectedCovers}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-right text-gray-400">
                    {forecast.confidenceLow} - {forecast.confidenceHigh}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-right text-white">
                    ${(forecast.expectedCovers * 45).toLocaleString()}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span
                      className={clsx(
                        'px-2.5 py-0.5 rounded-full text-xs font-medium',
                        forecast.expectedCovers >= 100
                          ? 'bg-red-500/10 text-red-500'
                          : forecast.expectedCovers >= 70
                          ? 'bg-yellow-500/10 text-yellow-500'
                          : 'bg-green-500/10 text-green-500'
                      )}
                    >
                      {forecast.expectedCovers >= 100
                        ? 'High'
                        : forecast.expectedCovers >= 70
                        ? 'Medium'
                        : 'Low'}
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
