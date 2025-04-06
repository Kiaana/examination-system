'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/components/providers/auth-provider';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Navbar } from '@/components/navbar';
import { adminAPI } from '@/lib/admin-api';

interface User {
  id: number;
  username: string;
  role: string;
  createdAt: string;
}

export default function AdminUsersPage() {
  const { user, isLoading } = useAuth();
  const router = useRouter();
  const [users, setUsers] = useState<User[]>([]);
  const [isUsersLoading, setIsUsersLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  // 分页
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  useEffect(() => {
    // 如果用户未登录且加载完成，重定向到登录页面
    if (!isLoading && !user) {
      router.push('/login');
    }
    // 如果用户不是管理员，重定向到仪表盘
    if (!isLoading && user && user.role !== 'admin') {
      router.push('/dashboard');
    }
  }, [user, isLoading, router]);

  useEffect(() => {
    // 获取用户列表
    const fetchUsers = async () => {
      try {
        setIsUsersLoading(true);
        
        // 调用API获取用户列表，带上分页参数
        const response = await adminAPI.users.getUsers(currentPage, 10);
        
        // 将API返回的数据映射到组件状态
        const formattedUsers = response.users.map((user: any) => ({
          id: user.id,
          username: user.username,
          role: user.role,
          createdAt: user.created_at,
        }));
        
        setUsers(formattedUsers);
        setTotalPages(response.total_pages || 1);
        setError(null);
      } catch (err: any) {
        setError(err.message || '获取用户列表失败');
        console.error('Failed to fetch users:', err);
      } finally {
        setIsUsersLoading(false);
      }
    };

    if (user && user.role === 'admin') {
      fetchUsers();
    }
  }, [user, currentPage]);

  // 格式化日期
  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('zh-CN', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  };

  // 更新用户角色
  const updateUserRole = async (userId: number, newRole: string) => {
    if (!confirm(`确定要将此用户角色更改为 ${newRole === 'admin' ? '管理员' : '普通用户'} 吗？`)) {
      return;
    }
    
    try {
      // 调用API更新用户角色
      await adminAPI.users.updateUser(userId, { role: newRole });
      
      // 更新本地状态
      setUsers(prev => 
        prev.map(user => 
          user.id === userId 
            ? { ...user, role: newRole } 
            : user
        )
      );
    } catch (err: any) {
      setError(err.message || '更新用户角色失败');
      console.error('Failed to update user role:', err);
    }
  };

  // 切换页面
  const changePage = (page: number) => {
    if (page < 1 || page > totalPages) return;
    setCurrentPage(page);
  };

  // 如果正在加载用户信息，显示加载状态
  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <p className="text-lg">加载中...</p>
      </div>
    );
  }

  // 如果用户未登录或不是管理员，不渲染内容（会被重定向）
  if (!user || user.role !== 'admin') {
    return null;
  }

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      
      <main className="container mx-auto py-8 px-4">
        <h1 className="text-3xl font-bold mb-6">用户管理</h1>
        
        {error && (
          <div className="bg-destructive/10 text-destructive text-sm p-3 rounded-md mb-6">
            {error}
          </div>
        )}

        {isUsersLoading ? (
          <p>加载用户中...</p>
        ) : users.length > 0 ? (
          <div className="space-y-4">
            {users.map((userItem) => (
              <Card key={userItem.id} className="p-6">
                <div className="flex justify-between items-start">
                  <div>
                    <div className="flex items-center gap-2 mb-2">
                      <h2 className="text-xl font-semibold">{userItem.username}</h2>
                      <span className={`px-2 py-0.5 text-xs rounded-full ${userItem.role === 'admin' ? 'bg-purple-100 text-purple-800' : 'bg-blue-100 text-blue-800'}`}>
                        {userItem.role === 'admin' ? '管理员' : '普通用户'}
                      </span>
                    </div>
                    <p className="text-sm text-muted-foreground">注册时间: {formatDate(userItem.createdAt)}</p>
                  </div>
                  <div className="flex gap-2">
                    <Button 
                      variant="outline" 
                      size="sm"
                      onClick={() => router.push(`/admin/users/${userItem.id}`)}
                    >
                      查看详情
                    </Button>
                    {userItem.id !== user.id && (
                      <Button 
                        variant="outline" 
                        size="sm"
                        onClick={() => updateUserRole(userItem.id, userItem.role === 'admin' ? 'user' : 'admin')}
                      >
                        {userItem.role === 'admin' ? '降为普通用户' : '升为管理员'}
                      </Button>
                    )}
                  </div>
                </div>
              </Card>
            ))}
            
            {/* 分页控件 */}
            {totalPages > 1 && (
              <div className="flex justify-center items-center gap-2 mt-6">
                <Button 
                  variant="outline" 
                  size="sm" 
                  onClick={() => changePage(currentPage - 1)}
                  disabled={currentPage === 1}
                >
                  上一页
                </Button>
                <span className="text-sm">
                  第 {currentPage} 页，共 {totalPages} 页
                </span>
                <Button 
                  variant="outline" 
                  size="sm" 
                  onClick={() => changePage(currentPage + 1)}
                  disabled={currentPage === totalPages}
                >
                  下一页
                </Button>
              </div>
            )}
          </div>
        ) : (
          <p className="text-muted-foreground">暂无用户</p>
        )}
      </main>
    </div>
  );
}