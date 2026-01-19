import { useQuery } from '@tanstack/react-query';
import { useAuth } from '../contexts/AuthContext';
import { menuApi } from '../services/api';
import {
  StarIcon,
  PuzzlePieceIcon,
  TruckIcon,
  XCircleIcon,
  ArrowTrendingUpIcon,
  ArrowTrendingDownIcon,
} from '@heroicons/react/24/outline';
import {
  ScatterChart,
  Scatter,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from 'recharts';
import clsx from 'clsx';

const CLASSIFICATION_COLORS: Record<string, string> = {
  Star: '#22c55e',
  Plowhorse: '#3b82f6',
  Puzzle: '#eab308',
  Dog: '#ef4444',
};

const CLASSIFICATION_ICONS: Record<string, any> = {
  Star: StarIcon,
  Plowhorse: TruckIcon,
  Puzzle: PuzzlePieceIcon,
  Dog: XCircleIcon,
};

export default function MenuEngineering() {
  const { user } = useAuth();
  const restaurantId = user?.restaurant?.id || '';

  const { data: engineeringData, isLoading } = useQuery({
    queryKey: ['menu-engineering', restaurantId],
    queryFn: () => menuApi.getEngineering(restaurantId),
    enabled: !!restaurantId,
  });

  const items = engineeringData?.data?.data?.items || [];
  const summary = engineeringData?.data?.data?.summary || {
    stars: [],
    plowhorses: [],
    puzzles: [],
    dogs: [],
  };

  // Prepare scatter chart data
  const scatterData = items.map((item: any) => ({
    x: item.popularityIndex,
    y: item.profitabilityIndex,
    name: item.name,
    classification: item.classification,
    profitMargin: item.profitMargin,
    orderCount: item.orderCount,
  }));

  const classificationCounts = {
    Star: summary.stars?.length || 0,
    Plowhorse: summary.plowhorses?.length || 0,
    Puzzle: summary.puzzles?.length || 0,
    Dog: summary.dogs?.length || 0,
  };

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
        <h1 className="text-2xl font-bold text-white">Menu Engineering</h1>
        <p className="text-gray-400">
          Analyze menu performance using the BCG matrix approach
        </p>
      </div>

      {/* Classification Summary */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {Object.entries(classificationCounts).map(([classification, count]) => {
          const Icon = CLASSIFICATION_ICONS[classification];
          return (
            <div
              key={classification}
              className="bg-gray-800 rounded-xl p-5 border border-gray-700"
            >
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-gray-400 text-sm">{classification}s</p>
                  <p className="text-3xl font-bold text-white mt-1">{count}</p>
                </div>
                <div
                  className="p-3 rounded-lg"
                  style={{ backgroundColor: `${CLASSIFICATION_COLORS[classification]}20` }}
                >
                  <Icon
                    className="h-6 w-6"
                    style={{ color: CLASSIFICATION_COLORS[classification] }}
                  />
                </div>
              </div>
              <p className="text-gray-500 text-sm mt-2">
                {classification === 'Star' && 'High popularity, high profit'}
                {classification === 'Plowhorse' && 'High popularity, low profit'}
                {classification === 'Puzzle' && 'Low popularity, high profit'}
                {classification === 'Dog' && 'Low popularity, low profit'}
              </p>
            </div>
          );
        })}
      </div>

      {/* BCG Matrix Chart */}
      <div className="bg-gray-800 rounded-xl p-6 border border-gray-700">
        <h3 className="text-lg font-semibold text-white mb-4">Menu Matrix</h3>
        <div className="h-96">
          <ResponsiveContainer width="100%" height="100%">
            <ScatterChart margin={{ top: 20, right: 20, bottom: 40, left: 40 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
              <XAxis
                type="number"
                dataKey="x"
                name="Popularity"
                stroke="#9ca3af"
                domain={[0, 'auto']}
                label={{
                  value: 'Popularity Index',
                  position: 'bottom',
                  fill: '#9ca3af',
                }}
              />
              <YAxis
                type="number"
                dataKey="y"
                name="Profitability"
                stroke="#9ca3af"
                domain={[0, 'auto']}
                label={{
                  value: 'Profitability Index',
                  angle: -90,
                  position: 'left',
                  fill: '#9ca3af',
                }}
              />
              <Tooltip
                cursor={{ strokeDasharray: '3 3' }}
                content={({ payload }) => {
                  if (!payload?.[0]) return null;
                  const data = payload[0].payload;
                  return (
                    <div className="bg-gray-900 border border-gray-700 rounded-lg p-3 shadow-lg">
                      <p className="text-white font-medium">{data.name}</p>
                      <p className="text-gray-400 text-sm">
                        Classification:{' '}
                        <span style={{ color: CLASSIFICATION_COLORS[data.classification] }}>
                          {data.classification}
                        </span>
                      </p>
                      <p className="text-gray-400 text-sm">
                        Profit Margin: {data.profitMargin?.toFixed(1)}%
                      </p>
                      <p className="text-gray-400 text-sm">
                        Orders: {data.orderCount}
                      </p>
                    </div>
                  );
                }}
              />
              {/* Reference lines at 1.0 */}
              <Scatter data={scatterData} shape="circle">
                {scatterData.map((entry: any, index: number) => (
                  <Cell
                    key={`cell-${index}`}
                    fill={CLASSIFICATION_COLORS[entry.classification] || '#9ca3af'}
                  />
                ))}
              </Scatter>
            </ScatterChart>
          </ResponsiveContainer>
        </div>
        <div className="flex justify-center gap-6 mt-4">
          {Object.entries(CLASSIFICATION_COLORS).map(([name, color]) => (
            <div key={name} className="flex items-center">
              <div
                className="w-3 h-3 rounded-full mr-2"
                style={{ backgroundColor: color }}
              />
              <span className="text-gray-400 text-sm">{name}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Menu Items Table */}
      <div className="bg-gray-800 rounded-xl border border-gray-700 overflow-hidden">
        <div className="p-6 border-b border-gray-700">
          <h3 className="text-lg font-semibold text-white">Item Analysis</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-700/50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">
                  Item
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">
                  Category
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">
                  Classification
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-400 uppercase tracking-wider">
                  Price
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-400 uppercase tracking-wider">
                  Margin
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-400 uppercase tracking-wider">
                  Orders
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">
                  Recommendation
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-700">
              {items.map((item: any) => {
                const Icon = CLASSIFICATION_ICONS[item.classification];
                return (
                  <tr key={item.id} className="hover:bg-gray-700/30">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <p className="text-white font-medium">{item.name}</p>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-gray-400">
                      {item.category}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span
                        className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium"
                        style={{
                          backgroundColor: `${CLASSIFICATION_COLORS[item.classification]}20`,
                          color: CLASSIFICATION_COLORS[item.classification],
                        }}
                      >
                        <Icon className="h-3.5 w-3.5 mr-1" />
                        {item.classification}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-white">
                      ${Number(item.price).toFixed(2)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right">
                      <span
                        className={clsx(
                          item.profitMargin >= 60
                            ? 'text-green-500'
                            : item.profitMargin >= 40
                            ? 'text-yellow-500'
                            : 'text-red-500'
                        )}
                      >
                        {item.profitMargin?.toFixed(1)}%
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-white">
                      {item.orderCount}
                    </td>
                    <td className="px-6 py-4">
                      <p className="text-gray-400 text-sm max-w-xs">
                        {item.recommendation || getRecommendation(item.classification)}
                      </p>
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

function getRecommendation(classification: string): string {
  switch (classification) {
    case 'Star':
      return 'Maintain position, consider slight price increase';
    case 'Plowhorse':
      return 'Reduce portion or increase price to improve margin';
    case 'Puzzle':
      return 'Increase visibility, train staff to recommend';
    case 'Dog':
      return 'Consider removing or complete redesign';
    default:
      return '';
  }
}
