// src/app/admin/questions/page.tsx
'use client';

import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/components/providers/auth-provider';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from '@/components/ui/card'; // 引入其他 Card 部件
import { Navbar } from '@/components/navbar';
import { ProtectedRoute } from '@/components/protected-route';
import { useRouter } from 'next/navigation';
import { adminAPI } from '@/lib/admin-api'; // 确保导入 adminAPI
import { Badge } from "@/components/ui/badge"; // 引入 Badge 用于显示类型
import { Skeleton } from "@/components/ui/skeleton";
import { AlertCircle, Loader2, Trash2, Pencil, PlusCircle, Filter } from "lucide-react"; // 引入图标
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { toast } from "sonner";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"; // 引入表格组件
import {
  Pagination,
  PaginationContent,
  PaginationEllipsis,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from "@/components/ui/pagination"; // 引入分页组件
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"; // 引入下拉选择框
import {
  getQuestionTypeName,
  getCommunicationTypeDisplay
} from '@/lib/utils';


// --- 类型定义 (匹配后端 adminAPI.questions.getQuestions 返回的单条 question 结构) ---
// 对应后端 serialize_question 的返回

export interface AdminQuestion {
  id: number;
  type: 'coordinate' | 'elevation' | 'communication';
  content: string;
  answer_coord_x?: string | null;
  answer_coord_y?: string | null;
  answer_elevation?: number | null;
  answer_text?: string | null;
  keywords?: string | null; // JSON string or null
  is_long_sentence?: boolean;
  communication_method?: string | null;
  communication_subtype?: string | null;
  created_at: string; // ISO string
  updated_at: string; // ISO string
}

// API 响应分页结构
interface PaginatedQuestionsResponse {
  questions: AdminQuestion[];
  total_items: number;
  current_page: number;
  per_page: number;
  total_pages: number;
}

// 页面状态
interface AdminQuestionsPageState {
  questions: AdminQuestion[];
  isLoading: boolean;
  error: string | null;
  currentPage: number;
  totalPages: number;
  totalItems: number;
  itemsPerPage: number;
  filterType: 'all' | 'coordinate' | 'elevation' | 'communication'; // 过滤类型
}

export default function AdminQuestionsPage() {
  const { user, isLoading: isAuthLoading } = useAuth();
  const router = useRouter();

  const [state, setState] = useState<AdminQuestionsPageState>({
    questions: [],
    isLoading: true,
    error: null,
    currentPage: 1,
    totalPages: 1,
    totalItems: 0,
    itemsPerPage: 10, // 每页显示数量
    filterType: 'all',
  });

  // 获取题目列表的回调函数
  const fetchQuestions = useCallback(async (page = 1, typeFilter: string = state.filterType) => {
    // 只有管理员可以获取
    if (!user || user.role !== 'admin') {
      setState(prev => ({ ...prev, isLoading: false })); // 停止加载
      return;
    }

    console.log(`Fetching questions: page=${page}, filter=${typeFilter}`);
    setState(prev => ({ ...prev, isLoading: true, error: null }));
    try {
      const filters: { type?: string } = {};
      if (typeFilter !== 'all') {
        filters.type = typeFilter;
      }

      const response: PaginatedQuestionsResponse = await adminAPI.questions.getQuestions(
        page,
        state.itemsPerPage,
        filters
      );

      console.log("API Response:", response);

      setState(prev => ({
        ...prev,
        questions: response.questions || [],
        currentPage: response.current_page,
        totalPages: response.total_pages,
        totalItems: response.total_items,
        isLoading: false,
      }));
    } catch (err: any) {
      const errorMsg = err.message || '获取题目列表失败，请稍后重试。';
      setState(prev => ({ ...prev, error: errorMsg, isLoading: false }));
      console.error('获取题目失败:', err);
    }
  }, [user, state.itemsPerPage, state.filterType]); // 依赖 user 和 itemsPerPage, filterType

  // 初始加载和过滤/分页变化时重新获取
  useEffect(() => {
    if (!isAuthLoading && user?.role === 'admin') {
      fetchQuestions(state.currentPage, state.filterType);
    } else if (!isAuthLoading && (!user || user.role !== 'admin')) {
      // 如果认证结束但不是管理员，可以做一些处理，例如显示无权限信息或依赖 ProtectedRoute
      console.warn("非管理员用户尝试访问题目管理页面。");
      setState(prev => ({ ...prev, isLoading: false, error: "您没有权限访问此页面。" }));
    }
  }, [fetchQuestions, isAuthLoading, user, state.currentPage, state.filterType]); // 依赖 currentPage 和 filterType

  // 格式化日期
  const formatDate = (dateString: string) => {
    try {
      return new Date(dateString).toLocaleString('zh-CN', {
        year: 'numeric', month: '2-digit', day: '2-digit',
        hour: '2-digit', minute: '2-digit'
      });
    } catch {
      return "无效日期";
    }
  };

  // 删除题目
  const deleteQuestion = async (questionId: number) => {
    if (!confirm(`确定要永久删除题目 #${questionId} 吗？此操作不可撤销。`)) {
      return;
    }

    try {
      await adminAPI.questions.deleteQuestion(questionId);
      toast.success(`题目 #${questionId} 已成功删除`);
      // 刷新当前页数据
      fetchQuestions(state.currentPage, state.filterType);
    } catch (err: any) {
      const errorMsg = err.message || '删除题目失败';
      setState(prev => ({ ...prev, error: errorMsg }));
      toast.error("删除失败", { description: errorMsg });
      console.error(`删除题目 #${questionId} 失败:`, err);
    }
  };

  // 处理分页变化
  const handlePageChange = (newPage: number) => {
    if (newPage >= 1 && newPage <= state.totalPages) {
      setState(prev => ({ ...prev, currentPage: newPage }));
    }
  };

  // 处理过滤类型变化
  const handleFilterChange = (value: string) => {
    // value 是 Select 组件传回的字符串
    const newFilter = value as AdminQuestionsPageState['filterType']; // 类型断言
    setState(prev => ({
      ...prev,
      filterType: newFilter,
      currentPage: 1, // 切换过滤条件时回到第一页
    }));
  };

  // 获取类型的中文名称
  const getTypeName = (type: AdminQuestion['type']) => {
    return getQuestionTypeName(type);
  }

  // --- 渲染逻辑 ---

  // 加载状态
  if (isAuthLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <p className="ml-2 text-lg text-muted-foreground">正在加载...</p>
      </div>
    );
  }

  return (
    <ProtectedRoute adminOnly={true}> {/* 确保只有管理员能访问 */}
      <div className="min-h-screen bg-gray-50">
        <Navbar />

        <main className="container mx-auto py-8 px-4">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-6 gap-4">
            <h1 className="text-3xl font-bold text-gray-800">题目管理</h1>
            <Button onClick={() => router.push('/admin/questions/create')}>
              <PlusCircle className="mr-2 h-4 w-4" />
              创建新题目
            </Button>
          </div>

          {/* 错误提示 */}
          {state.error && (
            <Alert variant="destructive" className="mb-6">
              <AlertCircle className="h-4 w-4" />
              <AlertTitle>操作失败</AlertTitle>
              <AlertDescription>
                {state.error}
                {/* 添加重试按钮 */}
                <Button variant="link" className="p-0 h-auto ml-2 text-destructive hover:underline" onClick={() => fetchQuestions(state.currentPage, state.filterType)}>
                  点此重试
                </Button>
              </AlertDescription>
            </Alert>
          )}

          {/* 过滤控件 */}
          <div className="mb-6 flex items-center gap-4 bg-white p-4 rounded-lg shadow-sm">
            <Filter className="h-5 w-5 text-gray-500" />
            <span className="text-sm font-medium text-gray-700">筛选题目类型:</span>
            <Select value={state.filterType} onValueChange={handleFilterChange}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="选择类型" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">全部类型</SelectItem>
                <SelectItem value="coordinate">坐标读取</SelectItem>
                <SelectItem value="elevation">高程读取</SelectItem>
                <SelectItem value="communication">通信题</SelectItem>
              </SelectContent>
            </Select>
            <span className="text-sm text-gray-500 ml-auto">
              共 {state.totalItems} 条记录
            </span>
          </div>

          {/* 题目列表 (使用表格展示) */}
          <Card className="shadow-md bg-white">
            <CardContent className="p-0"> {/* 移除 CardContent 的默认 padding */}
              {state.isLoading ? (
                // --- 显示表格骨架屏 ---
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-[80px]">ID</TableHead>
                      <TableHead>内容预览</TableHead>
                      <TableHead className="w-[150px]">类型</TableHead>
                      <TableHead className="w-[180px]">创建时间</TableHead>
                      <TableHead className="w-[120px] text-right">操作</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {[...Array(state.itemsPerPage)].map((_, i) => (
                      <TableRow key={`skeleton-row-${i}`}>
                        <TableCell><Skeleton className="h-4 w-full" /></TableCell>
                        <TableCell><Skeleton className="h-4 w-full" /></TableCell>
                        <TableCell><Skeleton className="h-4 w-full" /></TableCell>
                        <TableCell><Skeleton className="h-4 w-full" /></TableCell>
                        <TableCell className="text-right"><Skeleton className="h-8 w-full" /></TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              ) : state.questions.length > 0 ? (
                // --- 显示题目表格 ---
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-[80px]">ID</TableHead>
                      <TableHead>内容预览</TableHead>
                      <TableHead className="w-[150px]">类型信息</TableHead>
                      <TableHead className="w-[180px]">创建时间</TableHead>
                      <TableHead className="w-[120px] text-right">操作</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {state.questions.map((question) => (
                      <TableRow key={question.id}>
                        <TableCell className="font-medium">{question.id}</TableCell>
                        <TableCell className="max-w-xs truncate" title={question.content}>
                          {question.content}
                        </TableCell>
                        <TableCell>
                          <Badge variant="secondary">{getTypeName(question.type)}</Badge>
                          {/* 显示通信题子类型 */}
                          {question.type === 'communication' && question.communication_method && (
                            <div className="text-xs text-gray-500 mt-1">
                              {getCommunicationTypeDisplay(
                                question.communication_method,
                                question.communication_subtype,
                                question.is_long_sentence
                              )}
                            </div>
                          )}
                        </TableCell>
                        <TableCell className="text-sm text-gray-600">{formatDate(question.created_at)}</TableCell>
                        <TableCell className="text-right">
                          <div className="flex gap-2 justify-end">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => router.push(`/admin/questions/edit/${question.id}`)}
                              title="编辑"
                            >
                              <Pencil className="h-3 w-3" />
                            </Button>
                            <Button
                              variant="destructive"
                              size="sm"
                              onClick={() => deleteQuestion(question.id)}
                              title="删除"
                            >
                              <Trash2 className="h-3 w-3" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              ) : (
                // --- 没有题目时的提示 ---
                <div className="text-center py-16 text-gray-500">
                  <p>没有找到符合条件的题目。</p>
                  {state.filterType !== 'all' && (
                    <Button variant="link" onClick={() => handleFilterChange('all')}>查看全部类型</Button>
                  )}
                </div>
              )}
            </CardContent>
            {/* 分页控件 */}
            {state.totalPages > 1 && (
              <CardFooter className="py-4 border-t">
                <Pagination>
                  <PaginationContent>
                    <PaginationItem>
                      <PaginationPrevious
                        href="#"
                        onClick={(e) => { e.preventDefault(); handlePageChange(state.currentPage - 1); }}
                        aria-disabled={state.currentPage <= 1}
                        className={state.currentPage <= 1 ? "pointer-events-none opacity-50" : ""}
                      />
                    </PaginationItem>
                    {/* 简单分页显示，可以根据需要实现更复杂的页码逻辑 */}
                    <PaginationItem>
                      <span className="px-4 py-2 text-sm">
                        第 {state.currentPage} / {state.totalPages} 页
                      </span>
                    </PaginationItem>
                    <PaginationItem>
                      <PaginationNext
                        href="#"
                        onClick={(e) => { e.preventDefault(); handlePageChange(state.currentPage + 1); }}
                        aria-disabled={state.currentPage >= state.totalPages}
                        className={state.currentPage >= state.totalPages ? "pointer-events-none opacity-50" : ""}
                      />
                    </PaginationItem>
                  </PaginationContent>
                </Pagination>
              </CardFooter>
            )}
          </Card>

        </main>
      </div>
    </ProtectedRoute>
  );
}