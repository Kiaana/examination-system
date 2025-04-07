// src/app/quiz/result/[attemptId]/page.tsx
'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { useAuth } from '@/components/providers/auth-provider';
import { Button } from '@/components/ui/button';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '@/components/ui/card';
import { Navbar } from '@/components/navbar';
import { ProtectedRoute } from '@/components/protected-route';
import { attemptsAPI } from '@/lib/api-client'; // 引入 API
import { AlertCircle, Loader2, CheckCircle, XCircle, RefreshCw, Home } from "lucide-react"; // 引入图标
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import {
  getQuestionTypeName,
  getCommunicationMethodName,
  getCommunicationSubtypeName,
  getCommunicationTypeDisplay,
  formatUtcToLocal
} from '@/lib/utils';

// --- 类型定义 (与后端 API 返回匹配) ---

// 对应后端 serialize_attempt_question_for_history 返回的结构
interface ApiQuestionResult {
  slot_order: number;
  question_id: number;
  content: string;
  type: string; // 'coordinate', 'elevation', 'communication'
  communication_method?: string | null;
  communication_subtype?: string | null;
  user_answer: string | null; // 后端返回格式化后的用户答案
  is_correct: boolean | null; // 后端可能返回 null 如果未作答？
  score_awarded: number | null;
  correct_answer: string | null; // 后端返回格式化后的正确答案
}

// 对应后端 GET /api/attempts/{id} 返回的结构
interface ApiAttemptResult {
  attemptId: number;
  templateId: number; // 需要后端返回 templateId
  templateName: string;
  templateDescription?: string | null;
  score: number | null;
  totalQuestions: number;
  status: string; // 'completed', 'timed_out'
  startTime: string; // ISO string
  submissionTime: string | null; // ISO string
  timeLimit: number; // time_limit_seconds from template
  questions: ApiQuestionResult[];
  duration?: number;
  // 可能还包含 userId, username, role, pairingCode 等，按需使用
}

// 前端展示用的结果状态
interface DisplayResult {
  attemptId: number;
  templateId: number;
  templateTitle: string;
  totalQuestions: number;
  correctCount: number;
  totalPossibleScore: number; // 总分 (假设每题1分)
  userScore: number;
  percentage: number;
  timeTakenSeconds: number | null; // 用时 (秒)
  completedAt: string | null; // 完成时间
  status: string;
  questions: ApiQuestionResult[]; // 直接使用 API 返回的题目结果结构
}


export default function QuizResultPage() {
  const router = useRouter();
  const params = useParams<{ attemptId: string }>();
  const { user, isLoading: isAuthLoading } = useAuth();
  const attemptId = parseInt(params.attemptId);

  const [result, setResult] = useState<DisplayResult | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // 获取答题结果详情
  const fetchResult = useCallback(async () => {
    if (isNaN(attemptId) || !user) return;

    setIsLoading(true);
    setError(null);
    try {
      // 调用获取历史详情的 API
      const apiResult: ApiAttemptResult = await attemptsAPI.getHistoryAttemptDetails(attemptId);

      if (!apiResult) {
        throw new Error("未找到对应的答题记录。");
      }

      // 验证状态是否为已结束
      if (apiResult.status !== 'completed' && apiResult.status !== 'timed_out') {
        console.warn(`Attempt ${attemptId} is not finished yet (status: ${apiResult.status}). Redirecting.`);
        setError("该答题尚未完成。"); // 或者直接跳转回 dashboard?
        // router.replace('/dashboard');
        // return;
      }

      // --- 数据转换和计算 ---
      const correctCount = apiResult.questions.filter(q => q.is_correct === true).length;
      const totalPossibleScore = apiResult.totalQuestions * 1.0; // 假设每题1分
      const userScore = apiResult.score ?? 0; // 使用后端计算的分数，如果为空则为0
      const percentage = totalPossibleScore > 0 ? Math.round((userScore / totalPossibleScore) * 100) : 0;

      // 修改前端结果页面代码
      let timeTakenSeconds: number | null = null;
      if (apiResult.duration != null) {  // 使用 != null 同时检查 undefined 和 null
        // 使用后端返回的实际字段名 - duration
        timeTakenSeconds = apiResult.duration;
      } else if (apiResult.startTime && apiResult.submissionTime) {
        // 后备方案现在会在 duration 为 null 时执行
        const start = new Date(apiResult.startTime);
        const end = new Date(apiResult.submissionTime);
        timeTakenSeconds = Math.max(0, Math.round((end.getTime() - start.getTime()) / 1000));
      }

      const displayResult: DisplayResult = {
        attemptId: apiResult.attemptId,
        templateId: apiResult.templateId,
        templateTitle: apiResult.templateName,
        totalQuestions: apiResult.totalQuestions,
        correctCount: correctCount,
        totalPossibleScore: totalPossibleScore,
        userScore: userScore,
        percentage: percentage,
        timeTakenSeconds: timeTakenSeconds,
        completedAt: apiResult.submissionTime, // 使用 submissionTime
        status: apiResult.status,
        questions: apiResult.questions || [], // 确保 questions 是数组
      };

      setResult(displayResult);

    } catch (err: any) {
      console.error("获取答题结果失败:", err);
      setError(err.message || '无法加载答题结果，请稍后重试。');
    } finally {
      setIsLoading(false);
    }
  }, [attemptId, user]); // 不需要 router 作为依赖

  useEffect(() => {
    if (!isAuthLoading && user) {
      fetchResult();
    } else if (!isAuthLoading && !user) {
      router.push('/login');
    }
  }, [isAuthLoading, user, fetchResult, router]); // 添加 router

  // --- 辅助函数 ---
  const formatTime = (seconds: number | null): string => {
    if (seconds === null) return '未知';
    seconds = Math.round(seconds);
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes}分${remainingSeconds}秒`;
  };

  // --- 渲染逻辑 ---

  // 加载状态
  if (isLoading || isAuthLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <p className="ml-2 text-lg text-muted-foreground">正在加载结果...</p>
      </div>
    );
  }

  // 未登录或无权限
  if (!user) {
    return null; // AuthProvider 会处理重定向
  }

  // 加载错误
  if (error) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center p-4">
        <Alert variant="destructive" className="max-w-md text-center">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>加载失败</AlertTitle>
          <AlertDescription>
            {error}
            <br />
            <Button variant="link" className="mt-2" onClick={() => router.push('/dashboard')}>
              返回仪表盘
            </Button>
            <Button variant="link" className="mt-2" onClick={fetchResult}>
              重试加载
            </Button>
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  // 未找到结果
  if (!result) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <p className="text-lg text-muted-foreground">无法加载答题结果数据。</p>
      </div>
    );
  }


  // --- 成功获取结果后的渲染 ---
  return (
    <ProtectedRoute>
      <div className="min-h-screen bg-gray-50">
        <Navbar />

        <main className="container mx-auto py-4 px-3 md:py-6 md:px-4">
          {/* 更紧凑的导航按钮 */}
          <div className="mb-4 flex justify-between items-center">
            <Button
              variant="outline"
              size="sm"
              onClick={() => router.push('/dashboard')}
            >
              <Home className="h-4 w-4 mr-1" />
              返回仪表盘
            </Button>
            <Button size="sm" onClick={() => router.push(`/quiz/start/${result.templateId}`)}>
              <RefreshCw className="h-4 w-4 mr-1" />
              重新答题
            </Button>
          </div>

          <div className="space-y-4">
            {/* 结果摘要卡片 */}
            <Card className="p-4 shadow-sm bg-white">
              <CardHeader className="p-0 pb-2 text-center">
                <CardTitle className="text-xl md:text-2xl font-bold text-gray-800">{result.templateTitle}</CardTitle>
                <CardDescription className="text-sm text-gray-600">
                  答题结果 {result.status === 'timed_out' ? '(已超时)' : ''}
                  {result.completedAt && (
                    <span className="ml-1">
                      · {formatUtcToLocal(result.completedAt)}
                    </span>
                  )}
                </CardDescription>
              </CardHeader>

              <CardContent className="p-0 py-3">
                <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-center">
                  <div className="bg-gray-50 p-2 rounded">
                    <p className="text-xs font-medium text-gray-500">得分</p>
                    <p className="text-lg font-bold text-blue-600">{result.userScore.toFixed(1)}/{result.totalPossibleScore.toFixed(1)}</p>
                  </div>
                  <div className="bg-gray-50 p-2 rounded">
                    <p className="text-xs font-medium text-gray-500">正确率</p>
                    <p className="text-lg font-bold text-green-600">{result.percentage}%</p>
                  </div>
                  <div className="bg-gray-50 p-2 rounded">
                    <p className="text-xs font-medium text-gray-500">答对/总数</p>
                    <p className="text-lg font-bold text-gray-700">{result.correctCount}/{result.totalQuestions}</p>
                  </div>
                  <div className="bg-gray-50 p-2 rounded">
                    <p className="text-xs font-medium text-gray-500">用时</p>
                    <p className="text-lg font-bold text-gray-700">{formatTime(result.timeTakenSeconds)}</p>
                  </div>
                </div>

                {/* 紧凑的进度条 */}
                <div className="mt-3 w-full h-2 bg-gray-200 rounded-full overflow-hidden">
                  <div
                    className={`h-full ${result.percentage >= 60 ? 'bg-green-500' : 'bg-red-500'}`}
                    style={{ width: `${result.percentage}%` }}
                  ></div>
                </div>
              </CardContent>
            </Card>

            {/* 详细题目列表 */}
            <div>
              <h2 className="text-lg font-semibold mb-2 text-gray-700 flex items-center">
                题目回顾
                <span className="text-sm font-normal text-gray-500 ml-2">
                  ({result.correctCount}/{result.totalQuestions})
                </span>
              </h2>

              <div className="space-y-3">
                {result.questions.map((question, index) => (
                  <Card key={question.question_id} className="p-3 bg-white shadow-sm gap-2">
                    <div className="flex justify-between items-center">
                      <div className="flex items-center">
                        <span className="font-medium text-gray-800">题目 {index + 1}</span>

                        {/* 显示题目类型 - 可选 */}
                        {question.type && (
                          <span className={`ml-2 text-xs px-1.5 py-0.5 rounded ${question.type === 'coordinate' ? 'bg-green-100 text-green-700' :
                              question.type === 'elevation' ? 'bg-yellow-100 text-yellow-700' :
                                'bg-blue-100 text-blue-700'
                            }`}>
                            {question.type === 'communication'
                              ? getCommunicationTypeDisplay(
                                question.communication_method,
                                question.communication_subtype
                              )
                              : getQuestionTypeName(question.type)
                            }
                          </span>
                        )}
                      </div>

                      <div className={`flex items-center px-2 py-0.5 rounded text-xs font-medium ${question.is_correct ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                        {question.is_correct ?
                          <CheckCircle className="h-3 w-3 mr-1" /> :
                          <XCircle className="h-3 w-3 mr-1" />
                        }
                        {question.is_correct ? '正确' : '错误'}
                        {question.score_awarded !== null && ` (${question.score_awarded.toFixed(1)}分)`}
                      </div>
                    </div>

                    <p className="text-sm text-gray-700">{question.content}</p>
                    {/* 使用更细的分隔线 */}
                    <div className="border-t border-gray-100 my-2"></div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-xs">
                      <div>
                        <p className="mb-1 font-medium text-gray-600">您的答案:</p>
                        <p className={`p-1.5 rounded break-words ${question.is_correct ? 'bg-green-50' : 'bg-red-50'}`}>
                          {question.user_answer || <span className="text-gray-400 italic">未作答</span>}
                        </p>
                      </div>

                      {/* 只有错误或未作答时显示正确答案 */}
                      {(question.is_correct === false || question.user_answer === null) && question.correct_answer && (
                        <div>
                          <p className="mb-1 font-medium text-green-700">正确答案:</p>
                          <p className="p-1.5 bg-green-50 text-green-800 rounded break-words">
                            {question.correct_answer}
                          </p>
                        </div>
                      )}
                    </div>
                  </Card>
                ))}
              </div>
            </div>
          </div>
        </main>
      </div>
    </ProtectedRoute>
  );
}