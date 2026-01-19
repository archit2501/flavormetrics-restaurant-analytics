import axios from 'axios';

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || 'http://localhost:4000/api',
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request interceptor to add auth token
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Response interceptor for error handling
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem('token');
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);

export default api;

// API endpoints
export const menuApi = {
  getItems: (restaurantId: string) =>
    api.get(`/menu/${restaurantId}`),
  getEngineering: (restaurantId: string, startDate?: string, endDate?: string) =>
    api.get(`/menu/${restaurantId}/engineering`, { params: { startDate, endDate } }),
  createItem: (data: any) =>
    api.post('/menu', data),
  updateItem: (id: string, data: any) =>
    api.put(`/menu/${id}`, data),
  deleteItem: (id: string) =>
    api.delete(`/menu/${id}`),
};

export const customerApi = {
  getCustomers: (restaurantId: string) =>
    api.get(`/customers/${restaurantId}`),
  getSegmentation: (restaurantId: string) =>
    api.get(`/customers/${restaurantId}/segmentation`),
  getChurnRisk: (restaurantId: string) =>
    api.get(`/customers/${restaurantId}/churn-risk`),
  getCustomer: (id: string) =>
    api.get(`/customers/profile/${id}`),
};

export const orderApi = {
  getOrders: (restaurantId: string, params?: any) =>
    api.get(`/orders/${restaurantId}`, { params }),
  getOrder: (id: string) =>
    api.get(`/orders/detail/${id}`),
  createOrder: (data: any) =>
    api.post('/orders', data),
  updateStatus: (id: string, status: string) =>
    api.patch(`/orders/${id}/status`, { status }),
};

export const analyticsApi = {
  getSummary: (restaurantId: string, period?: string) =>
    api.get(`/analytics/${restaurantId}/summary`, { params: { period } }),
  getHourly: (restaurantId: string, date?: string) =>
    api.get(`/analytics/${restaurantId}/hourly`, { params: { date } }),
  getTrends: (restaurantId: string, metric: string, days?: number) =>
    api.get(`/analytics/${restaurantId}/trends/${metric}`, { params: { days } }),
};

export const forecastApi = {
  getDemandForecast: (restaurantId: string, days?: number) =>
    api.get(`/forecast/${restaurantId}/demand`, { params: { days } }),
  getItemForecast: (restaurantId: string, days?: number) =>
    api.get(`/forecast/${restaurantId}/items`, { params: { days } }),
  refreshForecast: (restaurantId: string) =>
    api.post(`/forecast/${restaurantId}/refresh`),
};

export const staffApi = {
  getStaff: (restaurantId: string) =>
    api.get(`/staff/${restaurantId}`),
  getShifts: (restaurantId: string, date: string) =>
    api.get(`/staff/${restaurantId}/shifts`, { params: { date } }),
  getOptimalSchedule: (restaurantId: string, date: string) =>
    api.get(`/staff/${restaurantId}/optimal-schedule`, { params: { date } }),
  createShift: (data: any) =>
    api.post('/staff/shifts', data),
};

export const inventoryApi = {
  getInventory: (restaurantId: string) =>
    api.get('/inventory', { params: { restaurantId } }),
  getAlerts: (restaurantId: string) =>
    api.get(`/inventory/alerts/${restaurantId}`),
  getWaste: (restaurantId: string) =>
    api.get(`/inventory/waste/${restaurantId}`),
  logWaste: (data: any) =>
    api.post('/inventory/waste', data),
  updateCount: (items: any[]) =>
    api.post('/inventory/count', { items }),
};
