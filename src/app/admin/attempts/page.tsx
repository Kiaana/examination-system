'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { adminAPI } from '@/lib/admin-api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ProtectedRoute } from '@/components/protected-route';
import { Navbar } from '@/components/navbar';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Pagination, PaginationContent, PaginationEllipsis, PaginationItem, PaginationLink, PaginationNext, PaginationPrevious } from '@/components/ui/pagination';
import { Loader2, Search, Eye } from 'lucide-react';
import { formatUtcToLocal } from '@/lib/utils';

// 定义接口
interface AttemptSummary {
    attemptId: number;
    userId: number;
    username: string;
    templateId: number;
    templateName: string;
    role: string | null;
    score: number | null;
    status: string;
    startTime: string;
    submissionTime: string | null;
    pairingCode?: string;
}

interface PaginationState {
    currentPage: number;
    totalItems: number;
    totalPages: number;
    perPage: number;
}

interface FilterState {
    username: string;
    status: string;
    role: string;
}

// 答题状态颜色映射
const statusColorMap: Record<string, string> = {
    'completed': 'bg-green-100 text-green-800',
    'timed_out': 'bg-orange-100 text-orange-800',
    'started': 'bg-blue-100 text-blue-800',
    'waiting_pair': 'bg-purple-100 text-purple-800',
    'inprogress': 'bg-yellow-100 text-yellow-800'
};

// 角色中文映射
const roleMap: Record<string, string> = {
    'sender': '发送方',
    'receiver': '接收方'
};

export default function AdminAttemptsPage() {
    const router = useRouter();
    const [attempts, setAttempts] = useState<AttemptSummary[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [pagination, setPagination] = useState<PaginationState>({
        currentPage: 1,
        totalItems: 0,
        totalPages: 1,
        perPage: 10
    });

    // 过滤器状态
    const [filters, setFilters] = useState<FilterState>({
        username: '',
        status: 'all',
        role: 'all'
    });

    // 加载答题记录
    const loadAttempts = async (page: number = 1) => {
        setIsLoading(true);
        try {
            const activeFilters: Record<string, string> = {};
            if (filters.username) activeFilters.username = filters.username;
            if (filters.status && filters.status !== 'all') activeFilters.status = filters.status;
            if (filters.role && filters.role !== 'all') activeFilters.role = filters.role;

            const response = await adminAPI.attempts.getAttempts(page, pagination.perPage, activeFilters);
            setAttempts(response.attempts || []);
            setPagination({
                currentPage: response.current_page || 1,
                totalItems: response.total_items || 0,
                totalPages: response.total_pages || 1,
                perPage: response.per_page || 10
            });
        } catch (error) {
            console.error('加载答题记录失败:', error);
        } finally {
            setIsLoading(false);
        }
    };

    // 首次加载
    useEffect(() => {
        loadAttempts(1);
    }, []);

    // 应用过滤器
    const applyFilters = () => {
        loadAttempts(1); // 重置到第一页
    };

    // 重置过滤器
    const resetFilters = () => {
        setFilters({
            username: '',
            status: 'all',
            role: 'all'
        });
        // 延迟一点再加载，确保状态已更新
        setTimeout(() => loadAttempts(1), 0);
    };

    // 页面变化处理
    const handlePageChange = (newPage: number) => {
        if (newPage >= 1 && newPage <= pagination.totalPages) {
            loadAttempts(newPage);
        }
    };

    // 生成分页控件
    const renderPagination = () => {
        // 保留当前页码前后各1页，其他用省略号
        const { currentPage, totalPages } = pagination;
        const pages: Array<number | string> = [];

        if (totalPages <= 7) {
            // 如果总页数少于等于7，显示所有页码
            for (let i = 1; i <= totalPages; i++) {
                pages.push(i);
            }
        } else {
            // 显示第一页
            pages.push(1);

            // 当前页靠前时
            if (currentPage <= 3) {
                pages.push(2, 3, 4, '...', totalPages);
            }
            // 当前页靠后时
            else if (currentPage >= totalPages - 2) {
                pages.push('...', totalPages - 3, totalPages - 2, totalPages - 1, totalPages);
            }
            // 当前页在中间时
            else {
                pages.push('...', currentPage - 1, currentPage, currentPage + 1, '...', totalPages);
            }
        }

        return (
            <Pagination>
                <PaginationContent>
                    <PaginationItem>
                        <PaginationPrevious
                            onClick={() => handlePageChange(currentPage - 1)}
                            className={(currentPage === 1 || isLoading) ? 'pointer-events-none opacity-50' : ''}
                        />
                    </PaginationItem>

                    {pages.map((page, index) => (
                        page === '...' ? (
                            <PaginationItem key={`ellipsis-${index}`}>
                                <PaginationEllipsis />
                            </PaginationItem>
                        ) : (
                            <PaginationItem key={`page-${page}`}>
                                <PaginationLink
                                    isActive={page === currentPage}
                                    onClick={isLoading ? undefined : () => handlePageChange(page as number)}
                                >
                                    {page}
                                </PaginationLink>
                            </PaginationItem>
                        )
                    ))}

                    <PaginationItem>
                        <PaginationNext
                            onClick={() => handlePageChange(currentPage + 1)}
                            className={(currentPage === totalPages || isLoading) ? 'pointer-events-none opacity-50' : ''}
                        />
                    </PaginationItem>
                </PaginationContent>
            </Pagination>
        );
    };

    return (
        <ProtectedRoute adminOnly>
            <div className="min-h-screen bg-gray-50">
                <Navbar />
                <div className="container mx-auto py-8 px-4">
                    <h1 className="text-2xl font-bold mb-6">答题记录管理</h1>

                    {/* 过滤器 */}
                    <Card className="mb-6">
                        <CardHeader>
                            <CardTitle className="text-lg">过滤器</CardTitle>
                        </CardHeader>
                        <CardContent>
                            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                                <div>
                                    <Label htmlFor="username" className="mb-1">用户名</Label>
                                    <Input
                                        id="username"
                                        placeholder="输入用户名"
                                        value={filters.username}
                                        onChange={(e) => setFilters({ ...filters, username: e.target.value })}
                                    />
                                </div>
                                <div>
                                    <Label htmlFor="status" className="mb-1">状态</Label>
                                    <Select
                                        value={filters.status}
                                        onValueChange={(value) => setFilters({ ...filters, status: value })}
                                    >
                                        <SelectTrigger>
                                            <SelectValue placeholder="全部状态" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="all">全部状态</SelectItem>
                                            <SelectItem value="completed">已完成</SelectItem>
                                            <SelectItem value="timed_out">已超时</SelectItem>
                                            <SelectItem value="started">已开始</SelectItem>
                                            <SelectItem value="waiting_pair">等待配对</SelectItem>
                                            <SelectItem value="inprogress">进行中</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>
                                <div>
                                    <Label htmlFor="role" className="mb-1">角色</Label>
                                    <Select
                                        value={filters.role}
                                        onValueChange={(value) => setFilters({ ...filters, role: value })}
                                    >
                                        <SelectTrigger>
                                            <SelectValue placeholder="全部角色" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="all">全部角色</SelectItem>
                                            <SelectItem value="sender">发送方</SelectItem>
                                            <SelectItem value="receiver">接收方</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>
                                <div className="flex items-end space-x-2">
                                    <Button onClick={applyFilters} disabled={isLoading}>
                                        {isLoading ? (
                                            <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> 加载中...</>
                                        ) : (
                                            <><Search className="mr-2 h-4 w-4" /> 搜索</>
                                        )}
                                    </Button>
                                    <Button variant="outline" onClick={resetFilters} disabled={isLoading}>重置</Button>
                                </div>
                            </div>
                        </CardContent>
                    </Card>

                    {/* 数据表格 */}
                    <Card>
                        <CardContent className="p-0 sm:p-6">
                            <div className="overflow-x-auto">
                                <Table>
                                    <TableHeader>
                                        <TableRow>
                                            <TableHead className="w-[80px]">ID</TableHead>
                                            <TableHead>用户</TableHead>
                                            <TableHead>试卷模板</TableHead>
                                            <TableHead>角色</TableHead>
                                            <TableHead>得分</TableHead>
                                            <TableHead>状态</TableHead>
                                            <TableHead>开始时间</TableHead>
                                            <TableHead>提交时间</TableHead>
                                            <TableHead className="text-right">操作</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {isLoading ? (
                                            <TableRow>
                                                <TableCell colSpan={9} className="text-center py-8">
                                                    <div className="flex justify-center">
                                                        <Loader2 className="h-6 w-6 animate-spin" />
                                                        <span className="ml-2">加载中...</span>
                                                    </div>
                                                </TableCell>
                                            </TableRow>
                                        ) : attempts.length === 0 ? (
                                            <TableRow>
                                                <TableCell colSpan={9} className="text-center py-8">未找到符合条件的答题记录</TableCell>
                                            </TableRow>
                                        ) : (
                                            attempts.map((attempt) => (
                                                <TableRow key={attempt.attemptId}>
                                                    <TableCell className="font-mono">{attempt.attemptId}</TableCell>
                                                    <TableCell>{attempt.username}</TableCell>
                                                    <TableCell>{attempt.templateName}</TableCell>
                                                    <TableCell>
                                                        {attempt.role ? roleMap[attempt.role] || attempt.role : '-'}
                                                    </TableCell>
                                                    <TableCell>
                                                        {attempt.score !== null ? attempt.score : '-'}
                                                    </TableCell>
                                                    <TableCell>
                                                        <Badge className={statusColorMap[attempt.status] || 'bg-gray-100 text-gray-800'}>
                                                            {{
                                                                'completed': '已完成',
                                                                'timed_out': '已超时',
                                                                'started': '已开始',
                                                                'waiting_pair': '等待配对',
                                                                'inprogress': '进行中'
                                                            }[attempt.status] || attempt.status}
                                                        </Badge>
                                                    </TableCell>
                                                    <TableCell>{formatUtcToLocal(attempt.startTime)}</TableCell>
                                                    <TableCell>{formatUtcToLocal(attempt.submissionTime)}</TableCell>
                                                    <TableCell className="text-right">
                                                        <Button
                                                            variant="ghost"
                                                            size="icon"
                                                            onClick={() => router.push(`/admin/attempts/${attempt.attemptId}`)}
                                                        >
                                                            <Eye className="h-4 w-4" />
                                                        </Button>
                                                    </TableCell>
                                                </TableRow>
                                            ))
                                        )}
                                    </TableBody>
                                </Table>
                            </div>

                            {/* 分页 */}
                            {!isLoading && attempts.length > 0 && (
                                <div className="flex justify-between items-center mt-4 px-2">
                                    <div className="text-sm text-gray-500">
                                        共 {pagination.totalItems} 条记录，每页 {pagination.perPage} 条
                                    </div>
                                    {renderPagination()}
                                </div>
                            )}
                        </CardContent>
                    </Card>
                </div>
            </div>
        </ProtectedRoute>
    );
}