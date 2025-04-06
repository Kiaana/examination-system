// src/app/admin/templates/page.tsx
'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/components/providers/auth-provider';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardFooter, CardDescription } from '@/components/ui/card';
import { Navbar } from '@/components/navbar';
import { ProtectedRoute } from '@/components/protected-route'; // 引入路由保护
import { adminAPI } from '@/lib/admin-api';
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { AlertCircle, Loader2, Trash2, Pencil, PlusCircle, ToggleLeft, ToggleRight } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { toast } from "sonner";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Switch } from "@/components/ui/switch"; // 引入 Switch 组件
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"; // 引入 Tooltip


// --- 类型定义 (匹配后端 adminAPI.templates.getTemplates 返回的单条 template 结构) ---
// 参考后端 /api/admin/templates GET 路由的返回 (templates_list)
interface AdminTemplateSummary {
  id: number;
  name: string;
  base_type: 'intelligence' | 'communication';
  time_limit_seconds: number;
  is_active: boolean;
  slot_count: number; // 后端返回题目数量
  created_at: string; // ISO string
  updated_at: string; // ISO string
}

// 页面状态
interface AdminTemplatesPageState {
  templates: AdminTemplateSummary[];
  isLoading: boolean;
  error: string | null;
  // 分页可以后续添加，暂时获取全部
}

export default function AdminTemplatesPage() {
  const { user, isLoading: isAuthLoading } = useAuth();
  const router = useRouter();

  const [state, setState] = useState<AdminTemplatesPageState>({
    templates: [],
    isLoading: true,
    error: null,
  });

  // 获取模板列表的回调函数
  const fetchTemplates = useCallback(async () => {
    if (!user || user.role !== 'admin') {
      setState(prev => ({ ...prev, isLoading: false }));
      return;
    }

    console.log("Fetching all templates for admin...");
    setState(prev => ({ ...prev, isLoading: true, error: null }));
    try {
      // 调用管理员 API 获取所有模板
      // 注意：后端 /api/admin/templates GET 返回的是列表，不是分页对象
      const response: AdminTemplateSummary[] = await adminAPI.templates.getTemplates();
      console.log("Templates fetched:", response);
      setState(prev => ({
        ...prev,
        templates: response || [], // 确保是数组
        isLoading: false,
      }));
    } catch (err: any) {
      const errorMsg = err.message || '获取模板列表失败，请稍后重试。';
      setState(prev => ({ ...prev, error: errorMsg, isLoading: false }));
      console.error('获取模板列表失败:', err);
    }
  }, [user]); // 依赖 user

  // 初始加载数据
  useEffect(() => {
    if (!isAuthLoading && user?.role === 'admin') {
      fetchTemplates();
    } else if (!isAuthLoading && (!user || user.role !== 'admin')) {
      console.warn("非管理员用户尝试访问模板管理页面。");
      setState(prev => ({ ...prev, isLoading: false, error: "您没有权限访问此页面。" }));
    }
  }, [fetchTemplates, isAuthLoading, user]);

  // 格式化日期时间
  const formatDateTime = (dateString: string) => {
    try {
      return new Date(dateString).toLocaleString('zh-CN', {
        year: 'numeric', month: '2-digit', day: '2-digit',
        hour: '2-digit', minute: '2-digit'
      });
    } catch {
      return "无效日期";
    }
  };

  // 切换模板状态（启用/禁用）
  const toggleTemplateStatus = async (templateId: number, currentStatus: boolean) => {
    // 乐观更新 UI (可选，但体验更好)
    setState(prev => ({
      ...prev,
      templates: prev.templates.map(t =>
        t.id === templateId ? { ...t, is_active: !currentStatus } : t
      ),
    }));

    const action = currentStatus ? adminAPI.templates.deactivateTemplate : adminAPI.templates.activateTemplate;
    const actionText = currentStatus ? '禁用' : '启用';

    try {
      await action(templateId);
      toast.success(`模板 #${templateId} 已成功${actionText}`);
      // 乐观更新成功，无需重新 fetch
    } catch (err: any) {
      const errorMsg = err.message || `更新模板状态失败`;
      // 修改这一行：使用 setState 而不是 setError
      setState(prev => ({ ...prev, error: errorMsg }));
      toast.error(`${actionText}失败`, { description: errorMsg });
      console.error(`更新模板 #${templateId} 状态失败:`, err);
      // 回滚乐观更新
      setState(prev => ({
        ...prev,
        templates: prev.templates.map(t =>
          t.id === templateId ? { ...t, is_active: currentStatus } : t // 恢复原状
        ),
      }));
    }
  };


  // 删除模板
  const deleteTemplate = async (templateId: number, templateName: string) => {
    if (!confirm(`确定要永久删除模板 "${templateName}" (ID: ${templateId}) 吗？此操作不可撤销。`)) {
      return;
    }

    try {
      await adminAPI.templates.deleteTemplate(templateId);
      toast.success(`模板 "${templateName}" 已成功删除`);
      // 从本地状态移除
      setState(prev => ({
        ...prev,
        templates: prev.templates.filter(template => template.id !== templateId)
      }));
      // 或者重新 fetch: fetchTemplates();
    } catch (err: any) {
      const errorMsg = err.message || '删除模板失败';
      // 修改这一行：使用 setState 而不是 setError
      setState(prev => ({ ...prev, error: errorMsg }));
      toast.error("删除失败", { description: errorMsg });
      console.error(`删除模板 #${templateId} 失败:`, err);
    }
  };

  // 获取基础类型的中文名
  const getBaseTypeName = (type: AdminTemplateSummary['base_type']) => {
    switch (type) {
      case 'intelligence': return '情报收集';
      case 'communication': return '简易通信';
      default: return '未知';
    }
  }

  // --- 渲染 ---

  if (isAuthLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <ProtectedRoute adminOnly={true}>
      <div className="min-h-screen bg-gray-50">
        <Navbar />

        <main className="container mx-auto py-8 px-4">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-6 gap-4">
            <h1 className="text-3xl font-bold text-gray-800">试卷模板管理</h1>
            <Button onClick={() => router.push('/admin/templates/create')}>
              <PlusCircle className="mr-2 h-4 w-4" />
              创建新模板
            </Button>
          </div>

          {state.error && (
            <Alert variant="destructive" className="mb-6">
              <AlertCircle className="h-4 w-4" />
              <AlertTitle>操作失败</AlertTitle>
              <AlertDescription>
                {state.error}
                <Button variant="link" className="p-0 h-auto ml-2 text-destructive hover:underline" onClick={fetchTemplates}>
                  点此重试
                </Button>
              </AlertDescription>
            </Alert>
          )}

          <Card className="shadow-md bg-white">
            <CardContent className="p-0">
              {state.isLoading ? (
                // --- 表格骨架屏 ---
                <Table>
                  <TableHeader>
                    <TableRow>{/* 移除这里的换行和空格 */}
                      <TableHead className="w-[80px]">ID</TableHead>
                      <TableHead>名称</TableHead>
                      <TableHead className="w-[120px]">类型</TableHead>
                      <TableHead className="w-[100px]">题目数</TableHead>
                      <TableHead className="w-[100px]">时长(秒)</TableHead>
                      <TableHead className="w-[120px]">状态</TableHead>
                      <TableHead className="w-[180px]">更新时间</TableHead>
                      <TableHead className="w-[180px] text-right">操作</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {[...Array(5)].map((_, i) => (<TableRow key={`skeleton-tpl-row-${i}`}>{/* 移除这里的换行和空格 */}
                      <TableCell><Skeleton className="h-4 w-full" /></TableCell>
                      <TableCell><Skeleton className="h-4 w-full" /></TableCell>
                      <TableCell><Skeleton className="h-4 w-full" /></TableCell>
                      <TableCell><Skeleton className="h-4 w-full" /></TableCell>
                      <TableCell><Skeleton className="h-4 w-full" /></TableCell>
                      <TableCell><Skeleton className="h-8 w-full" /></TableCell>
                      <TableCell><Skeleton className="h-4 w-full" /></TableCell>
                      <TableCell className="text-right"><Skeleton className="h-8 w-full" /></TableCell>
                    </TableRow>))}
                  </TableBody>
                </Table>
              ) : state.templates.length > 0 ? (
                // --- 模板表格 ---
                <Table>
                    <TableHeader>
                      <TableRow>{/* 移除这里的换行和空格 */}
                        <TableHead className="w-[80px]">ID</TableHead>
                        <TableHead>名称</TableHead>
                        <TableHead className="w-[120px]">类型</TableHead>
                        <TableHead className="w-[100px]">题目数</TableHead>
                        <TableHead className="w-[100px]">时长(秒)</TableHead>
                        <TableHead className="w-[120px]">状态</TableHead>
                        <TableHead className="w-[180px]">最后更新</TableHead>
                        <TableHead className="w-[180px] text-right">操作</TableHead>
                      </TableRow>
                    </TableHeader>
                  <TableBody>
                    {state.templates.map((template) => (
                      <TableRow key={template.id}>
                        <TableCell className="font-medium">{template.id}</TableCell>
                        <TableCell className="font-semibold">{template.name}</TableCell>
                        <TableCell>
                          <Badge variant="secondary" className={template.base_type === 'intelligence' ? 'bg-blue-100 text-blue-800' : 'bg-purple-100 text-purple-800'}>
                            {getBaseTypeName(template.base_type)}
                          </Badge>
                        </TableCell>
                        <TableCell>{template.slot_count}</TableCell>
                        <TableCell>{template.time_limit_seconds}</TableCell>
                        <TableCell>
                          <TooltipProvider delayDuration={100}>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <div className="flex items-center gap-2">
                                  <Switch
                                    checked={template.is_active}
                                    onCheckedChange={(checked) => toggleTemplateStatus(template.id, template.is_active)}
                                    aria-label={template.is_active ? '禁用模板' : '启用模板'}
                                    className="data-[state=checked]:bg-green-500 data-[state=unchecked]:bg-red-500"
                                  />
                                  <span className="text-sm font-medium">
                                    {template.is_active ? '已启用' : '已禁用'}
                                  </span>
                                </div>
                              </TooltipTrigger>
                              <TooltipContent>
                                <p>点击{template.is_active ? '禁用' : '启用'}此模板</p>
                              </TooltipContent>
                            </Tooltip>
                          </TooltipProvider>
                        </TableCell>
                        <TableCell className="text-sm text-gray-600">{formatDateTime(template.updated_at)}</TableCell>
                        <TableCell className="text-right">
                          <div className="flex gap-2 justify-end">
                            <TooltipProvider delayDuration={100}>
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <Button
                                    variant="outline"
                                    size="icon" // 使用 icon 尺寸更紧凑
                                    onClick={() => router.push(`/admin/templates/edit/${template.id}`)}
                                  >
                                    <Pencil className="h-4 w-4" />
                                  </Button>
                                </TooltipTrigger>
                                <TooltipContent><p>编辑</p></TooltipContent>
                              </Tooltip>
                              {/* 删除按钮 */}
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <Button
                                    variant="destructive"
                                    size="icon"
                                    onClick={() => deleteTemplate(template.id, template.name)}
                                  >
                                    <Trash2 className="h-4 w-4" />
                                  </Button>
                                </TooltipTrigger>
                                <TooltipContent><p>删除</p></TooltipContent>
                              </Tooltip>
                            </TooltipProvider>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              ) : (
                <div className="text-center py-16 text-gray-500">
                  <p>没有找到试卷模板。</p>
                  <Button variant="link" onClick={() => router.push('/admin/templates/create')}>现在去创建</Button>
                </div>
              )}
            </CardContent>
            {/* 暂时不加分页，如果模板很多再考虑 */}
            {/* <CardFooter className="py-4 border-t"> ... </CardFooter> */}
          </Card>

        </main>
      </div>
    </ProtectedRoute>
  );
}