import axios from 'axios';

interface ApiUser {
  id: number;
  username: string;
  role: 'user' | 'admin';
}

interface ApiAuthResponse {
  message: string;
  user?: ApiUser;
}

export interface ApiTemplateSummary {
  id: number;
  name: string;
  base_type: 'intelligence' | 'communication';
  description: string | null;
  time_limit_seconds: number;
  question_count: number;
}

const api = axios.create({
  baseURL: process.env.NEXT_PUBLIC_API_URL || 'http://localhost:7575/api',
  withCredentials: true,
  headers: {
    'Content-Type': 'application/json',
  },
});

export const authAPI = {
  checkAuth: async (): Promise<ApiUser> => {
    try {
      const response = await api.get<ApiUser>('/auth/me');
      return response.data;
    } catch (error: any) {
      return Promise.reject(new Error('用户未登录或登录已过期'));
    }
  },
  login: async (username: string, password: string): Promise<ApiAuthResponse> => {
    try {
      const response = await api.post<ApiAuthResponse>('/auth/login', { username, password });
      return response.data;
    } catch (error: any) {
      throw new Error(error.response?.data?.message || '登录失败，请检查用户名和密码');
    }
  },
  register: async (username: string, password: string, role: string = 'user'): Promise<ApiAuthResponse> => {
    try {
      const response = await api.post<ApiAuthResponse>('/auth/register', { username, password, role });
      return response.data;
    } catch (error: any) {
      throw new Error(error.response?.data?.message || '注册失败，用户名可能已被占用');
    }
  },
  logout: async (): Promise<{ message: string }> => {
    try {
      const response = await api.post<{ message: string }>('/auth/logout');
      return response.data;
    } catch (error: any) {
      throw new Error(error.response?.data?.message || '登出操作失败');
    }
  },
};

export const templatesAPI = {
  getActiveTemplates: async (): Promise<ApiTemplateSummary[]> => {
    try {
      const response = await api.get<ApiTemplateSummary[]>('/templates');
      return response.data || [];
    } catch (error: any) {
      console.error("获取试卷模板失败:", error);
      throw new Error(error.response?.data?.message || '无法加载试卷模板，请稍后重试');
    }
  },
};

export const attemptsAPI = {
  startAttempt: async (templateId: number, role?: 'sender' | 'receiver'): Promise<any> => {
    try {
      const payload: { templateId: number; role?: 'sender' | 'receiver' } = { templateId };
      if (role) {
        payload.role = role;
      }
      const response = await api.post('/attempts/start', payload);
      return response.data;
    } catch (error: any) {
      console.error("开始答题尝试失败:", error);
      throw new Error(error.response?.data?.message || '无法开始答题，请稍后重试');
    }
  },

  // 新增：获取进行中的尝试详情
  getActiveAttemptDetails: async (attemptId: number): Promise<any> => { // 稍后定义返回类型
    try {
      const response = await api.get(`/attempts/${attemptId}/active`);
      return response.data;
    } catch (error: any) {
      console.error(`获取活动答题详情失败 (Attempt ${attemptId}):`, error);
      // 检查是否是 409 Conflict (表示已完成)
      if (error.response && error.response.status === 409) {
        // 可以将状态信息附加到错误中，方便前端处理重定向
        const errorData = error.response.data;
        const customError = new Error(errorData.message || '该答题已结束。');
        (customError as any).status = errorData.status; // 附加状态
        throw customError;
      }
      throw new Error(error.response?.data?.message || '无法加载答题数据');
    }
  },

  submitAttempt: async (attemptId: number, answers: any[]): Promise<any> => {
    try {
      const response = await api.post(`/attempts/${attemptId}/submit`, { answers });
      return response.data;
    } catch (error: any) {
      console.error("提交答案失败:", error);
      throw new Error(error.response?.data?.message || '提交答案时发生错误');
    }
  },
  getHistory: async (page: number = 1, perPage: number = 10): Promise<any> => {
    try {
      const response = await api.get('/attempts', {
        params: { page, per_page: perPage }
      });
      return response.data;
    } catch (error: any) {
      console.error("获取历史记录失败:", error);
      throw new Error(error.response?.data?.message || '无法加载历史记录');
    }
  },
  getHistoryAttemptDetails: async (attemptId: number): Promise<any> => {
    try {
      const response = await api.get(`/attempts/${attemptId}`);
      return response.data;
    } catch (error: any) {
      console.error("获取答题详情失败:", error);
      throw new Error(error.response?.data?.message || '无法加载答题详情');
    }
  },
  joinPairing: async (pairingCode: string, templateId: number): Promise<any> => {
    try {
      const response = await api.post('/attempts/join_pairing', {
        pairingCode: pairingCode,
        templateId: templateId
      });
      return response.data;
    } catch (error: any) {
      console.error("配对失败:", error);
      throw new Error(error.response?.data?.message || '配对失败，请检查配对码或稍后重试');
    }
  },
};

export { adminAPI } from './admin-api';

export default api;