// src/app/history/page.tsx
'use client';

import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/components/providers/auth-provider';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardFooter, CardDescription } from '@/components/ui/card';
import { Navbar } from '@/components/navbar';
import { ProtectedRoute } from '@/components/protected-route';
import { useRouter } from 'next/navigation';
import { attemptsAPI } from '@/lib/api-client'; // 引入 API
import { Skeleton } from "@/components/ui/skeleton";
import { AlertCircle, Loader2, ListChecks, ArrowLeftRight } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from "@/components/ui/pagination";
import { Badge } from '@/components/ui/badge'; // 引入 Badge
import { formatUtcToLocal } from '@/lib/utils'; // 引入时间格式化函数

// --- 类型定义 (匹配后端 /api/attempts GET 返回的列表项) ---
interface AttemptHistoryItem {
  attemptId: number;
  templateName: string;
  score: number | null;
  totalQuestions: number; // 总题数
  status: string; // 'completed', 'timed_out'
  submissionTime: string | null; // ISO string
  startTime: string; // ISO string
}

// API 响应分页结构
interface PaginatedHistoryResponse {
    history: AttemptHistoryItem[];
    total_items: number;
    current_page: number;
    per_page: number; // 后端返回的 per_page
    total_pages: number;
}

// 页面状态
interface HistoryPageState {
  history: AttemptHistoryItem[];
  isLoading: boolean;
  error: string | null;
  currentPage: number;
  totalPages: number;
  totalItems: number;
  itemsPerPage: number; // 前端控制，或从后端获取
}

export default function HistoryPage() {
  const { user, isLoading: isAuthLoading } = useAuth();
  const router = useRouter();

  const [state, setState] = useState<HistoryPageState>({
    history: [],
    isLoading: true,
    error: null,
    currentPage: 1,
    totalPages: 1,
    totalItems: 0,
    itemsPerPage: 10, // 默认每页显示 10 条
  });

  // 获取历史记录的回调函数
  const fetchHistory = useCallback(async (page = 1) => {
    if (!user) {
      setState(prev => ({ ...prev, isLoading: false }));
      return;
    }
    console.log(`Fetching history: page=${page}`);
    setState(prev => ({ ...prev, isLoading: true, error: null }));
    try {
      const response: PaginatedHistoryResponse = await attemptsAPI.getHistory(page, state.itemsPerPage);
      console.log("History API Response:", response);
      setState(prev => ({
        ...prev,
        history: response.history || [],
        currentPage: response.current_page,
        totalPages: response.total_pages,
        totalItems: response.total_items,
        itemsPerPage: response.per_page, // 使用后端返回的 per_page
        isLoading: false,
      }));
    } catch (err: any) {
      const errorMsg = err.message || '获取历史记录失败，请稍后重试。';
      setState(prev => ({ ...prev, error: errorMsg, isLoading: false }));
      console.error('获取历史记录失败:', err);
    }
  }, [user, state.itemsPerPage]); // 依赖 user 和 itemsPerPage

  // 初始加载和分页变化时重新获取
  useEffect(() => {
    if (!isAuthLoading && user) {
      fetchHistory(state.currentPage);
    } else if (!isAuthLoading && !user) {
      router.push('/login'); // 检查后未登录则跳转
    }
  }, [fetchHistory, isAuthLoading, user, state.currentPage, router]); // 添加 router

  // 计算正确率
  const calculatePercentage = (score: number | null, totalQuestions: number): string => {
      if (score === null || totalQuestions <= 0) return 'N/A';
      // 假设每题 1 分
      const percentage = Math.round((score / totalQuestions) * 100);
      return `${percentage}%`;
  };

   // 处理分页变化
  const handlePageChange = (newPage: number) => {
    if (newPage >= 1 && newPage <= state.totalPages && newPage !== state.currentPage) {
      setState(prev => ({ ...prev, currentPage: newPage }));
      // fetchHistory 会在 currentPage 变化时自动触发
    }
  };


  // --- 渲染 ---

  if (isAuthLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <ProtectedRoute>
      <div className="min-h-screen bg-gray-50">
        <Navbar />

        <main className="container mx-auto py-8 px-4">
          <h1 className="text-3xl font-bold mb-8 text-gray-800">答题历史记录</h1>

          {state.error && (
            <Alert variant="destructive" className="mb-6">
              <AlertCircle className="h-4 w-4" />
              <AlertTitle>加载错误</AlertTitle>
              <AlertDescription>
                {state.error}
                <Button variant="link" className="p-0 h-auto ml-2 text-destructive hover:underline" onClick={() => fetchHistory(state.currentPage)}>
                  点此重试
                </Button>
              </AlertDescription>
            </Alert>
          )}

          <Card className="shadow-md bg-white">
             <CardHeader>
                <CardTitle>共 {state.totalItems} 条记录</CardTitle>
                <CardDescription>查看您过往的答题成绩和详情。</CardDescription>
             </CardHeader>
            <CardContent className="p-0">
              {state.isLoading ? (
                // --- 表格骨架屏 ---
                <Table>
                    <TableHeader>
                        <TableRow>{/* 移除这里的换行和空格 */}
                            <TableHead>试卷名称</TableHead>
                            <TableHead className="w-[120px]">得分</TableHead>
                            <TableHead className="w-[100px]">正确率</TableHead>
                             <TableHead className="w-[100px]">状态</TableHead>
                            <TableHead className="w-[180px]">完成时间</TableHead>
                            <TableHead className="w-[100px] text-right">操作</TableHead>
                        </TableRow>
                    </TableHeader>
                  <TableBody>
                    {[...Array(state.itemsPerPage)].map((_, i) => (<TableRow key={`skeleton-hist-row-${i}`}>{/* 移除这里的换行和空格 */}
                      <TableCell><Skeleton className="h-4 w-3/4" /></TableCell>
                      <TableCell><Skeleton className="h-4 w-full" /></TableCell>
                      <TableCell><Skeleton className="h-4 w-full" /></TableCell>
                      <TableCell><Skeleton className="h-4 w-full" /></TableCell>
                      <TableCell><Skeleton className="h-4 w-full" /></TableCell>
                      <TableCell className="text-right"><Skeleton className="h-8 w-full" /></TableCell>
                    </TableRow>))}
                  </TableBody>
                </Table>
              ) : state.history.length > 0 ? (
                // --- 历史记录表格 ---
                <Table>
                    <TableHeader>
                        <TableRow>{/* 移除这里的换行和空格 */}
                            <TableHead>试卷名称</TableHead>
                            <TableHead className="w-[120px]">得分</TableHead>
                            <TableHead className="w-[100px]">正确率</TableHead>
                            <TableHead className="w-[100px]">状态</TableHead>
                            <TableHead className="w-[180px]">完成时间</TableHead>
                            <TableHead className="w-[100px] text-right">操作</TableHead>
                        </TableRow>
                    </TableHeader>
                  <TableBody>
                    {state.history.map((attempt) => (
                      <TableRow key={attempt.attemptId}>
                        <TableCell className="font-medium">{attempt.templateName}</TableCell>
                        <TableCell>
                            {attempt.score !== null ? `${attempt.score.toFixed(1)} / ${attempt.totalQuestions.toFixed(1)}` : 'N/A'}
                        </TableCell>
                        <TableCell>
                            <Badge variant={(attempt.score !== null && (attempt.score / attempt.totalQuestions) >= 0.6) ? "outline" : "destructive"}>
                                {calculatePercentage(attempt.score, attempt.totalQuestions)}
                            </Badge>
                        </TableCell>
                        <TableCell>
                            <Badge variant={attempt.status === 'timed_out' ? 'destructive' : 'outline'}>
                                {attempt.status === 'completed' ? '已完成' : '已超时'}
                            </Badge>
                        </TableCell>
                        <TableCell className="text-sm text-gray-600">{formatUtcToLocal(attempt.submissionTime)}</TableCell>
                        <TableCell className="text-right">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => router.push(`/quiz/result/${attempt.attemptId}`)}
                          >
                            查看详情
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              ) : (
                // --- 没有记录时的提示 ---
                 <div className="text-center py-16 text-gray-500">
                    <ListChecks className="mx-auto h-12 w-12 text-gray-400 mb-4"/>
                    <p className="mb-4">您还没有任何答题记录。</p>
                    <Button onClick={() => router.push('/dashboard')}>
                        <ArrowLeftRight className="mr-2 h-4 w-4"/>
                        前往答题
                    </Button>
                 </div>
              )}
            </CardContent>
             {/* 分页控件 */}
             {state.totalPages > 1 && (
                 <CardFooter className="py-4 border-t justify-center">
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
                            {/* 可以添加更复杂的页码逻辑 */}
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