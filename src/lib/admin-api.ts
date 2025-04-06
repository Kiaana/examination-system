import api from './api-client';

// 管理员相关API
export const adminAPI = {
  // 题目管理
  questions: {
    // 获取题目列表
    getQuestions: async (page = 1, limit = 10, filters = {}) => {
      try {
        const response = await api.get('/admin/questions', {
          params: { page, limit, ...filters }
        });
        return response.data;
      } catch (error: any) {
        throw new Error(error.response?.data?.message || '获取题目列表失败');
      }
    },

    // 获取题目详情
    getQuestion: async (questionId: number) => {
      try {
        const response = await api.get(`/admin/questions/${questionId}`);
        return response.data;
      } catch (error: any) {
        throw new Error(error.response?.data?.message || '获取题目详情失败');
      }
    },

    // 创建题目
    createQuestion: async (questionData: any) => {
      try {
        const response = await api.post('/admin/questions', questionData);
        return response.data;
      } catch (error: any) {
        throw new Error(error.response?.data?.message || '创建题目失败');
      }
    },

    // 更新题目
    updateQuestion: async (questionId: number, questionData: any) => {
      try {
        const response = await api.put(`/admin/questions/${questionId}`, questionData);
        return response.data;
      } catch (error: any) {
        throw new Error(error.response?.data?.message || '更新题目失败');
      }
    },

    // 删除题目
    deleteQuestion: async (questionId: number) => {
      try {
        const response = await api.delete(`/admin/questions/${questionId}`);
        return response.data;
      } catch (error: any) {
        throw new Error(error.response?.data?.message || '删除题目失败');
      }
    },
  },

  // 试卷模板管理
  templates: {
    // 获取所有模板列表
    getTemplates: async () => {
      try {
        const response = await api.get('/admin/templates');
        return response.data;
      } catch (error: any) {
        throw new Error(error.response?.data?.message || '获取模板列表失败');
      }
    },

    // 获取模板详情
    getTemplate: async (templateId: number) => {
      try {
        const response = await api.get(`/admin/templates/${templateId}`);
        return response.data;
      } catch (error: any) {
        throw new Error(error.response?.data?.message || '获取模板详情失败');
      }
    },

    // 创建模板
    createTemplate: async (templateData: any) => {
      try {
        const response = await api.post('/admin/templates', templateData);
        return response.data;
      } catch (error: any) {
        throw new Error(error.response?.data?.message || '创建模板失败');
      }
    },

    // 更新模板
    updateTemplate: async (templateId: number, templateData: any) => {
      try {
        const response = await api.put(`/admin/templates/${templateId}`, templateData);
        return response.data;
      } catch (error: any) {
        throw new Error(error.response?.data?.message || '更新模板失败');
      }
    },

    // 删除模板
    deleteTemplate: async (templateId: number) => {
      try {
        const response = await api.delete(`/admin/templates/${templateId}`);
        return response.data;
      } catch (error: any) {
        throw new Error(error.response?.data?.message || '删除模板失败');
      }
    },

    // 激活模板
    activateTemplate: async (templateId: number) => {
      try {
        const response = await api.patch(`/admin/templates/${templateId}/activate`);
        return response.data;
      } catch (error: any) {
        throw new Error(error.response?.data?.message || '激活模板失败');
      }
    },

    // 禁用模板
    deactivateTemplate: async (templateId: number) => {
      try {
        const response = await api.patch(`/admin/templates/${templateId}/deactivate`);
        return response.data;
      } catch (error: any) {
        throw new Error(error.response?.data?.message || '禁用模板失败');
      }
    },
  },

  // 答题记录管理
  attempts: {
    // 获取所有用户的答题记录
    getAttempts: async (page = 1, limit = 10, filters = {}) => {
      try {
        const response = await api.get('/admin/attempts', {
          params: { page, limit, ...filters }
        });
        return response.data;
      } catch (error: any) {
        throw new Error(error.response?.data?.message || '获取答题记录失败');
      }
    },

    // 获取答题记录详情
    getAttempt: async (attemptId: number) => {
      try {
        const response = await api.get(`/admin/attempts/${attemptId}`);
        return response.data;
      } catch (error: any) {
        throw new Error(error.response?.data?.message || '获取答题记录详情失败');
      }
    },
  },

  // 用户管理
  users: {
    // 获取用户列表
    getUsers: async (page = 1, limit = 10) => {
      try {
        const response = await api.get('/admin/users', {
          params: { page, limit }
        });
        return response.data;
      } catch (error: any) {
        throw new Error(error.response?.data?.message || '获取用户列表失败');
      }
    },

    // 获取用户详情
    getUser: async (userId: number) => {
      try {
        const response = await api.get(`/admin/users/${userId}`);
        return response.data;
      } catch (error: any) {
        throw new Error(error.response?.data?.message || '获取用户详情失败');
      }
    },

    // 更新用户信息
    updateUser: async (userId: number, userData: any) => {
      try {
        const response = await api.put(`/admin/users/${userId}`, userData);
        return response.data;
      } catch (error: any) {
        throw new Error(error.response?.data?.message || '更新用户信息失败');
      }
    },
  },
};