import { useQuery } from '@tanstack/react-query';
import { useAuth } from '../contexts/AuthContext';
import api from '../services/api';
import {
  StarIcon,
  FaceSmileIcon,
  FaceFrownIcon,
  MinusCircleIcon,
} from '@heroicons/react/24/outline';
import { StarIcon as StarSolidIcon } from '@heroicons/react/24/solid';
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

const SENTIMENT_COLORS = {
  positive: '#22c55e',
  neutral: '#eab308',
  negative: '#ef4444',
};

export default function Reviews() {
  const { user } = useAuth();
  const restaurantId = user?.restaurant?.id || '';

  const { data: reviewsData, isLoading } = useQuery({
    queryKey: ['reviews', restaurantId],
    queryFn: () => api.get(`/analytics/${restaurantId}/reviews`),
    enabled: !!restaurantId,
  });

  const data = reviewsData?.data?.data || {
    reviews: [],
    summary: {},
    sentimentAnalysis: {},
  };

  const reviews = data.reviews || [];
  const summary = data.summary || {};
  const sentiment = data.sentimentAnalysis || {};

  // Rating distribution data
  const ratingDistribution = [5, 4, 3, 2, 1].map((rating) => ({
    rating: `${rating} Star`,
    count: reviews.filter((r: any) => r.overallRating === rating).length,
  }));

  // Sentiment distribution
  const sentimentDistribution = [
    { name: 'Positive', value: sentiment.positive || 0 },
    { name: 'Neutral', value: sentiment.neutral || 0 },
    { name: 'Negative', value: sentiment.negative || 0 },
  ];

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
        <h1 className="text-2xl font-bold text-white">Customer Reviews</h1>
        <p className="text-gray-400">
          Sentiment analysis and review insights
        </p>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-gray-800 rounded-xl p-5 border border-gray-700">
          <div className="flex items-center">
            <div className="p-3 bg-yellow-500/10 rounded-lg">
              <StarIcon className="h-6 w-6 text-yellow-500" />
            </div>
            <div className="ml-4">
              <p className="text-gray-400 text-sm">Average Rating</p>
              <p className="text-2xl font-bold text-white">
                {summary.averageRating?.toFixed(1) || '0.0'}
              </p>
            </div>
          </div>
        </div>

        <div className="bg-gray-800 rounded-xl p-5 border border-gray-700">
          <div className="flex items-center">
            <div className="p-3 bg-green-500/10 rounded-lg">
              <FaceSmileIcon className="h-6 w-6 text-green-500" />
            </div>
            <div className="ml-4">
              <p className="text-gray-400 text-sm">Positive</p>
              <p className="text-2xl font-bold text-white">
                {sentiment.positivePercent?.toFixed(0) || 0}%
              </p>
            </div>
          </div>
        </div>

        <div className="bg-gray-800 rounded-xl p-5 border border-gray-700">
          <div className="flex items-center">
            <div className="p-3 bg-yellow-500/10 rounded-lg">
              <MinusCircleIcon className="h-6 w-6 text-yellow-500" />
            </div>
            <div className="ml-4">
              <p className="text-gray-400 text-sm">Neutral</p>
              <p className="text-2xl font-bold text-white">
                {sentiment.neutralPercent?.toFixed(0) || 0}%
              </p>
            </div>
          </div>
        </div>

        <div className="bg-gray-800 rounded-xl p-5 border border-gray-700">
          <div className="flex items-center">
            <div className="p-3 bg-red-500/10 rounded-lg">
              <FaceFrownIcon className="h-6 w-6 text-red-500" />
            </div>
            <div className="ml-4">
              <p className="text-gray-400 text-sm">Negative</p>
              <p className="text-2xl font-bold text-white">
                {sentiment.negativePercent?.toFixed(0) || 0}%
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Rating Distribution */}
        <div className="bg-gray-800 rounded-xl p-6 border border-gray-700">
          <h3 className="text-lg font-semibold text-white mb-4">Rating Distribution</h3>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={ratingDistribution} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                <XAxis type="number" stroke="#9ca3af" fontSize={12} />
                <YAxis
                  type="category"
                  dataKey="rating"
                  stroke="#9ca3af"
                  fontSize={12}
                  width={60}
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: '#1f2937',
                    border: 'none',
                    borderRadius: '8px',
                  }}
                />
                <Bar dataKey="count" fill="#eab308" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Sentiment Distribution */}
        <div className="bg-gray-800 rounded-xl p-6 border border-gray-700">
          <h3 className="text-lg font-semibold text-white mb-4">Sentiment Analysis</h3>
          <div className="h-64 flex items-center">
            <ResponsiveContainer width="60%" height="100%">
              <PieChart>
                <Pie
                  data={sentimentDistribution}
                  cx="50%"
                  cy="50%"
                  innerRadius={50}
                  outerRadius={80}
                  paddingAngle={3}
                  dataKey="value"
                >
                  <Cell fill={SENTIMENT_COLORS.positive} />
                  <Cell fill={SENTIMENT_COLORS.neutral} />
                  <Cell fill={SENTIMENT_COLORS.negative} />
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
            <div className="flex-1 space-y-3">
              {sentimentDistribution.map((item) => (
                <div key={item.name} className="flex items-center justify-between">
                  <div className="flex items-center">
                    <div
                      className="w-3 h-3 rounded-full mr-2"
                      style={{
                        backgroundColor:
                          SENTIMENT_COLORS[
                            item.name.toLowerCase() as keyof typeof SENTIMENT_COLORS
                          ],
                      }}
                    />
                    <span className="text-gray-400">{item.name}</span>
                  </div>
                  <span className="text-white font-medium">{item.value}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Key Themes */}
      {sentiment.themes && sentiment.themes.length > 0 && (
        <div className="bg-gray-800 rounded-xl p-6 border border-gray-700">
          <h3 className="text-lg font-semibold text-white mb-4">Key Themes</h3>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
            {sentiment.themes.map((theme: any) => (
              <div
                key={theme.aspect}
                className="bg-gray-700/50 rounded-lg p-4 text-center"
              >
                <p className="text-white font-medium capitalize">{theme.aspect}</p>
                <p className="text-2xl font-bold mt-1" style={{
                  color: theme.avgSentiment >= 0.05
                    ? SENTIMENT_COLORS.positive
                    : theme.avgSentiment <= -0.05
                    ? SENTIMENT_COLORS.negative
                    : SENTIMENT_COLORS.neutral
                }}>
                  {theme.avgSentiment >= 0 ? '+' : ''}{(theme.avgSentiment * 100).toFixed(0)}%
                </p>
                <p className="text-gray-400 text-sm mt-1">{theme.mentions} mentions</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Reviews List */}
      <div className="bg-gray-800 rounded-xl border border-gray-700 overflow-hidden">
        <div className="p-6 border-b border-gray-700">
          <h3 className="text-lg font-semibold text-white">Recent Reviews</h3>
        </div>
        <div className="divide-y divide-gray-700">
          {reviews.length > 0 ? (
            reviews.map((review: any) => (
              <div key={review.id} className="p-6">
                <div className="flex items-start justify-between">
                  <div className="flex items-center">
                    <div className="h-10 w-10 rounded-full bg-gray-700 flex items-center justify-center text-white font-medium">
                      {review.customer?.firstName?.[0] || 'G'}
                      {review.customer?.lastName?.[0] || ''}
                    </div>
                    <div className="ml-3">
                      <p className="text-white font-medium">
                        {review.customer?.firstName
                          ? `${review.customer.firstName} ${review.customer.lastName}`
                          : 'Guest'}
                      </p>
                      <p className="text-gray-400 text-sm">
                        {format(new Date(review.createdAt), 'MMM d, yyyy')}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-4">
                    {/* Rating Stars */}
                    <div className="flex">
                      {[1, 2, 3, 4, 5].map((star) => (
                        <StarSolidIcon
                          key={star}
                          className={clsx(
                            'h-5 w-5',
                            star <= review.overallRating
                              ? 'text-yellow-500'
                              : 'text-gray-600'
                          )}
                        />
                      ))}
                    </div>
                    {/* Sentiment Badge */}
                    <span
                      className={clsx(
                        'px-2.5 py-0.5 rounded-full text-xs font-medium',
                        review.sentiment === 'positive'
                          ? 'bg-green-500/10 text-green-500'
                          : review.sentiment === 'negative'
                          ? 'bg-red-500/10 text-red-500'
                          : 'bg-yellow-500/10 text-yellow-500'
                      )}
                    >
                      {review.sentiment || 'neutral'}
                    </span>
                  </div>
                </div>

                {review.comment && (
                  <p className="text-gray-300 mt-4">{review.comment}</p>
                )}

                {/* Rating Breakdown */}
                <div className="flex gap-6 mt-4 text-sm">
                  {review.foodRating && (
                    <div className="flex items-center text-gray-400">
                      <span>Food:</span>
                      <span className="text-white ml-1">{review.foodRating}/5</span>
                    </div>
                  )}
                  {review.serviceRating && (
                    <div className="flex items-center text-gray-400">
                      <span>Service:</span>
                      <span className="text-white ml-1">{review.serviceRating}/5</span>
                    </div>
                  )}
                  {review.ambianceRating && (
                    <div className="flex items-center text-gray-400">
                      <span>Ambiance:</span>
                      <span className="text-white ml-1">{review.ambianceRating}/5</span>
                    </div>
                  )}
                  {review.valueRating && (
                    <div className="flex items-center text-gray-400">
                      <span>Value:</span>
                      <span className="text-white ml-1">{review.valueRating}/5</span>
                    </div>
                  )}
                </div>

                {/* Staff Response */}
                {review.staffResponse && (
                  <div className="mt-4 p-4 bg-gray-700/50 rounded-lg">
                    <p className="text-orange-500 text-sm font-medium mb-1">
                      Response from management
                    </p>
                    <p className="text-gray-300 text-sm">{review.staffResponse}</p>
                  </div>
                )}
              </div>
            ))
          ) : (
            <div className="p-8 text-center text-gray-400">
              No reviews yet
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
