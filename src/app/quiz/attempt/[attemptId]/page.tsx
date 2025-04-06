// src/app/quiz/attempt/[attemptId]/page.tsx
'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { useRouter, useParams, useSearchParams } from 'next/navigation';
import { useAuth } from '@/components/providers/auth-provider';
import { useSocket } from '@/components/providers/socket-provider'; // 引入 Socket
import { Button } from '@/components/ui/button';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '@/components/ui/card';
import { Input } from '@/components/ui/input'; // 引入 Input
import { Textarea } from '@/components/ui/textarea'; // 引入 Textarea
import { ProtectedRoute } from '@/components/protected-route';
import { attemptsAPI } from '@/lib/api-client'; // 引入 API
import { AlertCircle, Loader2, ChevronLeft, ChevronRight, Check, Send } from "lucide-react"; // 引入图标
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { toast } from "sonner";
import { Progress } from "@/components/ui/progress"; // 引入进度条
import { Navbar } from '@/components/navbar';
import {
  getQuestionTypeName,
  getCommunicationMethodName,
  getCommunicationSubtypeName,
  getCommunicationTypeDisplay
} from '@/lib/utils';

// --- 类型定义 ---

// 后端返回的 Question 结构 (对应 serialize_attempt_question_for_user)
interface AttemptQuestion {
  slot_order: number;
  question_id: number;
  type: 'coordinate' | 'elevation' | 'communication';
  content: string; // 发方看到答案，收方看到简化提示
  communication_method?: string | null;
  communication_subtype?: string | null;
  answer?: { // 仅发送方可见
    coord_x?: string;
    coord_y?: string;
    elevation?: number;
    text?: string;
  } | null;
  keywords?: string[] | null; // 仅发送方可见 (长句题)
  type_display?: string; // 仅接收方可见
}

// 组件内部答案状态结构
interface AnswerState {
  // key 是 slotOrder
  [key: number]: {
    answerText?: string; // 用于 elevation 和 communication
    answerCoordX?: string; // 用于 coordinate
    answerCoordY?: string; // 用于 coordinate
  }
}

// 页面状态
interface AttemptPageState {
  attemptId: number;
  role: 'sender' | 'receiver' | null;
  pairingCode: string | null; // 仅发送方
  templateName: string; // 需要从 API 获取或传递
  questions: AttemptQuestion[];
  startTime: Date | null; // ISO string from API, converted to Date
  timeLimitSeconds: number;
  status: string; // e.g., 'inprogress', 'waiting_pair', 'completed'
  isLoading: boolean;
  error: string | null;
  isSubmitting: boolean;
  isPartnerConnected: boolean; // 用于通信题
}

export default function QuizAttemptPage() {
  const router = useRouter();
  const params = useParams<{ attemptId: string }>();
  const searchParams = useSearchParams(); // Pairing code might be here for sender link sharing
  const { user, isLoading: isAuthLoading } = useAuth();
  const { socket, isConnected, on, emit } = useSocket();

  const attemptId = parseInt(params.attemptId);

  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [answers, setAnswers] = useState<AnswerState>({});
  const [timeLeft, setTimeLeft] = useState<number | null>(null);
  const [pageState, setPageState] = useState<AttemptPageState>({
    attemptId: attemptId,
    role: null, // Will be set based on fetched data or context
    pairingCode: null,
    templateName: '',
    questions: [],
    startTime: null,
    timeLimitSeconds: 0,
    status: 'loading', // Initial status
    isLoading: true,
    error: null,
    isSubmitting: false,
    isPartnerConnected: false, // Initially assume not connected
  });

  // --- 数据获取 ---
  const fetchAttemptDetails = useCallback(async () => {
    if (isNaN(attemptId) || !user) return;
    console.log(`Fetching details for attempt ${attemptId}`);
    setPageState(prev => ({ ...prev, isLoading: true, error: null }));
    try {
      // TODO: 后端需要支持获取进行中尝试的 API (GET /api/attempts/{id}/active ?)
      // 暂时假设 getAttemptDetails 可以获取进行中的尝试
      const attemptData = await attemptsAPI.getActiveAttemptDetails(attemptId);

      // 验证返回的数据是否有效且属于当前用户
      if (!attemptData || (attemptData.userId && attemptData.userId !== user.id)) {
        throw new Error("无法加载此答题尝试，或权限不足。");
      }
      // 检查状态，如果已完成或超时，直接跳转到结果页
      if (attemptData.status === 'completed' || attemptData.status === 'timed_out') {
        console.log(`Attempt ${attemptId} already finished (${attemptData.status}). Redirecting to results.`);
        router.replace(`/quiz/result/${attemptId}`); // 使用 replace 避免用户回退
        return; // 停止后续处理
      }

      console.log("Attempt data received:", attemptData);

      // 初始化答案状态
      const initialAnswers: AnswerState = {};
      attemptData.questions?.forEach((q: AttemptQuestion) => {
        initialAnswers[q.slot_order] = { answerText: '', answerCoordX: '', answerCoordY: '' };
      });
      setAnswers(initialAnswers);

      setPageState(prev => ({
        ...prev,
        role: attemptData.role || null,
        pairingCode: attemptData.pairingCode || null,
        templateName: attemptData.templateName || `试卷 ${attemptId}`,
        questions: attemptData.questions || [],
        startTime: attemptData.startTime ? new Date(attemptData.startTime + 'Z') : null,
        timeLimitSeconds: attemptData.timeLimit || 0,
        status: attemptData.status || 'unknown',
        isLoading: false,
      }));

    } catch (err: any) {
      console.error("获取活动答题详情失败:", err);
      // 检查是否是已完成/超时的错误 (附加了 status)
      if ((err as any).status === 'completed' || (err as any).status === 'timed_out') {
        console.log(`Attempt ${attemptId} already finished (${(err as any).status}). Redirecting to results.`);
        router.replace(`/quiz/result/${attemptId}`);
        return; // 停止处理
      }
      // 其他错误
      setPageState(prev => ({
        ...prev,
        error: err.message || '加载答题数据时出错，请返回重试。',
        isLoading: false
      }));
    }
  }, [attemptId, user, router]); // 依赖项

  useEffect(() => {
    if (!isAuthLoading && user) {
      fetchAttemptDetails();
    } else if (!isAuthLoading && !user) {
      router.push('/login'); // 如果检查后未登录，跳转
    }
  }, [isAuthLoading, user, fetchAttemptDetails, router]);


  // --- WebSocket 事件监听 ---
  useEffect(() => {
    if (!socket || !isConnected || !pageState.role) return;

    // 发送方监听收方完成考试的通知，无论当前状态如何都监听
    if (pageState.role === 'sender') {
      console.log(`发送方 (Attempt ${attemptId}) 正在监听考试完成事件...`);

      const unsubscribeCompleted = on('exam_completed', (data) => {
        console.log("收方已完成考试:", data);
        toast.success(`考试已完成！得分: ${data.score}`);

        // 减少延迟时间，提高响应速度
        setTimeout(() => {
          router.replace(`/quiz/result/${attemptId}`);
        }, 500); // 缩短到500ms
      });

      return () => {
        unsubscribeCompleted?.();
      };
    }
  }, [socket, isConnected, pageState.role, attemptId, on, router]); // 移除pageState.status依赖

  // --- 交互处理函数 ---

  // 处理答案变更 (通用)
  const handleAnswerChange = useCallback((slotOrder: number, field: 'answerText' | 'answerCoordX' | 'answerCoordY', value: string) => {
    setAnswers(prev => ({
      ...prev,
      [slotOrder]: {
        ...prev[slotOrder], // 保留其他字段
        [field]: value,
      },
    }));
    // TODO: (可选) 可以将答案变更通过 WebSocket 发送给后端或对手 (用于实时保存或同步)
    // emit('answer_update', { attemptId, slotOrder, field, value });
  }, []);

  // 导航到下一题
  const handleNextQuestion = useCallback(() => {
    if (currentQuestionIndex < pageState.questions.length - 1) {
      setCurrentQuestionIndex(prev => prev + 1);
    }
  }, [currentQuestionIndex, pageState.questions.length]);

  // 导航到上一题
  const handlePrevQuestion = useCallback(() => {
    if (currentQuestionIndex > 0) {
      setCurrentQuestionIndex(prev => prev - 1);
    }
  }, [currentQuestionIndex]);

  // 将 handleSubmit 函数声明提到计时器 useEffect 之前

  // 提交答案
  const handleSubmit = useCallback(async (timedOut: boolean = false) => {
    if (pageState.isSubmitting || pageState.role === 'sender') return; // 防止重复提交或发送方提交

    console.log("准备提交答案:", answers);
    setPageState(prev => ({ ...prev, isSubmitting: true, error: null }));

    // 格式化答案以匹配后端 API
    const formattedAnswers = Object.entries(answers).map(([slotOrder, answerData]) => ({
      slotOrder: parseInt(slotOrder),
      answerText: answerData.answerText, // 即使是坐标题，也可能记录原始文本？或者只发送相关字段
      answerCoordX: answerData.answerCoordX,
      answerCoordY: answerData.answerCoordY,
    }));

    try {
      const result = await attemptsAPI.submitAttempt(attemptId, formattedAnswers);
      console.log("提交成功:", result);
      toast.success("答案提交成功！");
      // 跳转到结果页面
      router.push(`/quiz/result/${attemptId}`);
    } catch (err: any) {
      console.error("提交失败:", err);
      const errorMsg = err.message || '提交答案时发生错误，请稍后重试。';
      setPageState(prev => ({ ...prev, error: errorMsg, isSubmitting: false }));
      toast.error("提交失败", { description: errorMsg });
    }
  }, [attemptId, answers, pageState.isSubmitting, pageState.role, router]);

  // 然后是计时器 useEffect
  // 修改计时器处理 useEffect
  useEffect(() => {
    // 如果 startTime 为 null 或 timeLimit 为 0 或状态不是 inprogress，则不启动计时器
    if (!pageState.startTime || pageState.timeLimitSeconds <= 0 || pageState.status !== 'inprogress' && pageState.status !== 'started') {
      setTimeLeft(null);
      return;
    }

    // 打印调试信息，帮助检查时间格式
    console.log("原始 startTime:", pageState.startTime);

    // 将服务器端的 UTC 时间和本地时间都转换为纯毫秒时间戳进行比较
    const startTimestamp = pageState.startTime.getTime();
    const nowTimestamp = new Date().getTime();

    // 计算实际过去的时间（毫秒）
    const elapsedMs = nowTimestamp - startTimestamp;
    console.log("已过去毫秒数:", elapsedMs, "已过去秒数:", Math.floor(elapsedMs / 1000), "总时限:", pageState.timeLimitSeconds);

    // 计算剩余秒数
    const remainingSeconds = Math.max(0, pageState.timeLimitSeconds - Math.floor(elapsedMs / 1000));
    console.log("初始剩余时间(秒):", remainingSeconds);
    setTimeLeft(remainingSeconds);

    // 如果一开始就超时了，直接触发提交
    if (remainingSeconds <= 0 && pageState.role !== 'sender') {
      console.log("时间一开始就到了，自动提交...");
      toast.info("时间到！正在自动提交答案...");
      setTimeout(() => handleSubmit(true), 0);
      return; // 不启动计时器
    }

    // 每秒减少剩余时间
    const timer = setInterval(() => {
      setTimeLeft(prev => {
        if (prev === null) {
          clearInterval(timer);
          return null;
        }
        if (prev <= 1) {
          clearInterval(timer);
          if (pageState.role !== 'sender') {
            console.log("计时器到达0，自动提交...");
            toast.info("时间到！正在自动提交答案...");
            setTimeout(() => handleSubmit(true), 0);
          }
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [pageState.startTime, pageState.timeLimitSeconds, pageState.status, pageState.role, handleSubmit]);

  // --- 渲染辅助 ---

  const formatTimeLeft = () => {
    if (timeLeft === null) return '--:--';
    const minutes = Math.floor(timeLeft / 60);
    const seconds = timeLeft % 60;
    return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
  };

  // 当前显示的题目
  const currentQuestion = useMemo(() => {
    return pageState.questions[currentQuestionIndex];
  }, [pageState.questions, currentQuestionIndex]);

  // 进度条
  const progressValue = useMemo(() => {
    return ((currentQuestionIndex + 1) / pageState.questions.length) * 100;
  }, [currentQuestionIndex, pageState.questions.length]);


  // --- 渲染加载状态 ---
  if (pageState.isLoading || isAuthLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <p className="ml-2 text-lg text-muted-foreground">正在加载答题页面...</p>
      </div>
    );
  }

  // --- 渲染错误状态 ---
  if (pageState.error && !pageState.isSubmitting) { // 提交错误在页面内提示
    return (
      <div className="flex min-h-screen flex-col items-center justify-center p-4">
        <Alert variant="destructive" className="max-w-md text-center">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>加载失败</AlertTitle>
          <AlertDescription>
            {pageState.error}
            <br />
            <Button variant="link" className="mt-2" onClick={() => router.push('/dashboard')}>
              返回仪表盘
            </Button>
            {/* 可以添加重试按钮 */}
            <Button variant="link" className="mt-2" onClick={fetchAttemptDetails}>
              重试加载
            </Button>
          </AlertDescription>
        </Alert>
      </div>
    );
  }


  // --- 渲染发送方界面 ---
  if (pageState.role === 'sender') {
    return (
      <ProtectedRoute>
        <div className="min-h-screen bg-gray-50 flex flex-col">
          <Navbar />
          <main className="container mx-auto py-8 px-4 flex-1">
            <Card className="w-full max-w-4xl mx-auto shadow-lg">
              <CardHeader>
                <CardTitle className="text-2xl font-bold text-gray-800">
                  题目详情 - 发送方界面
                </CardTitle>
                <CardDescription>
                  试卷：{pageState.templateName} |
                  状态: {pageState.status === 'inprogress' ? '接收方答题中...' : pageState.status} |
                  连接状态: {isConnected ? '已连接' : '未连接'}
                </CardDescription>
              </CardHeader>
              <CardContent>
                {/* 题目列表 */}
                <div className="space-y-8">
                  {pageState.questions.map((question, index) => (
                    <div key={question.slot_order} className="border p-4 rounded-lg bg-white">
                      <h3 className="text-lg font-semibold mb-2">
                        题目 {question.slot_order}
                        {question.type === 'communication' && (
                          <span className="ml-2 text-xs bg-blue-100 text-blue-800 px-2 py-1 rounded">
                            {getCommunicationMethodName(question.communication_method)}
                            {question.communication_subtype && ` - ${getCommunicationSubtypeName(question.communication_method, question.communication_subtype)}`}
                          </span>
                        )}
                      </h3>
                      <p className="mb-3 text-gray-700">{question.content}</p>

                      {/* 显示答案 */}
                      <div className="mt-3 p-3 bg-green-50 border border-green-200 rounded-md">
                        <p className="font-medium text-green-800">参考答案:</p>
                        {question.type === 'coordinate' && question.answer && (
                          <p className="text-green-700">
                            坐标: ({question.answer.coord_x}, {question.answer.coord_y})
                          </p>
                        )}
                        {question.type === 'elevation' && question.answer && (
                          <p className="text-green-700">
                            高程: {question.answer.elevation}
                          </p>
                        )}
                        {question.type === 'communication' && question.answer && (
                          <p className="text-green-700">
                            {question.answer.text}
                          </p>
                        )}
                        {question.keywords && (
                          <div className="mt-1">
                            <p className="text-sm text-green-600">关键词:</p>
                            <div className="flex flex-wrap gap-1 mt-1">
                              {question.keywords.map((keyword, idx) => (
                                <span key={idx} className="bg-green-100 text-green-800 text-xs px-2 py-1 rounded">
                                  {keyword}
                                </span>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
              <CardFooter className="flex justify-between">
                <p className="text-sm text-gray-500">
                  请向接收方传递题目相关信息。接收方完成答题后系统将自动评分。
                </p>
                <Button variant="outline" onClick={() => router.push('/dashboard')}>
                  退出答题
                </Button>
              </CardFooter>
            </Card>
          </main>
        </div>
      </ProtectedRoute>
    );
  }


  // --- 渲染接收方或情报题答题界面 ---
  if (!currentQuestion) {
    // 如果题目为空或索引无效
    return (
      <div className="flex min-h-screen items-center justify-center">
        <p className="text-lg text-destructive">无法加载当前题目。</p>
        {/* 可以添加返回按钮 */}
      </div>
    );
  }

  return (
    <ProtectedRoute>
      <div className="min-h-screen bg-gray-50 flex flex-col">
        {/* 顶部状态栏 */}
        <div className="bg-white border-b border-gray-200 sticky top-0 z-10 shadow-sm">
          <div className="container mx-auto py-3 px-4 flex justify-between items-center">
            <div className="flex items-center gap-4">
              {/* 显示试卷名称 */}
              <span className="text-sm font-medium text-gray-700 hidden sm:inline">{pageState.templateName}</span>
              {/* 进度条 */}
              <Progress value={progressValue} className="w-32 sm:w-48" />
              <div>
                <span className="text-sm text-gray-500">题目 </span>
                <span className="font-semibold text-gray-900">{currentQuestionIndex + 1}</span>
                <span className="text-sm text-gray-500"> / {pageState.questions.length}</span>
              </div>
            </div>
            <div className="bg-blue-600 text-white px-3 py-1 rounded-full text-sm font-mono tracking-wider">
              <span className="hidden sm:inline">剩余时间: </span>
              <span>{formatTimeLeft()}</span>
            </div>
            {/* 退出按钮 */}
            <Button
              variant="ghost" // 使用 ghost 样式减少视觉干扰
              size="sm"
              className="text-gray-500 hover:text-gray-700 hover:bg-gray-100"
              onClick={() => {
                if (confirm('确定要退出答题吗？您的作答进度将会丢失。')) { // 明确告知进度丢失
                  router.push('/dashboard');
                }
              }}
            >
              退出答题
            </Button>
          </div>
        </div>

        {/* 主要答题区域 */}
        <main className="container mx-auto py-8 px-4 flex-1 flex flex-col items-center">
          <Card className="w-full max-w-3xl p-6 md:p-8 mb-6 bg-white shadow-md">
            <CardHeader className="p-0 mb-4">
              <CardTitle className="text-xl font-semibold text-gray-800 mb-1">
                题目 {currentQuestionIndex + 1}

                {/* 显示题目类型 */}
                <span className="ml-2 text-xs font-normal bg-blue-100 text-blue-800 px-2 py-0.5 rounded">
                  {getQuestionTypeName(currentQuestion.type)}
                </span>

                {/* 如果是通信题，额外显示通信子类型 */}
                {currentQuestion.type === 'communication' && (
                  <span className="ml-2 text-xs font-normal bg-indigo-100 text-indigo-800 px-2 py-0.5 rounded">
                    {getCommunicationMethodName(currentQuestion.communication_method)}
                    {currentQuestion.communication_subtype &&
                      ` - ${getCommunicationSubtypeName(
                        currentQuestion.communication_method,
                        currentQuestion.communication_subtype
                      )}`
                    }
                  </span>
                )}
              </CardTitle>
              <CardDescription className="text-lg text-gray-700 leading-relaxed">
                {currentQuestion.content}
              </CardDescription>
            </CardHeader>

            <CardContent className="p-0">
              {/* 答题区域 */}
              {currentQuestion.type === 'coordinate' && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label htmlFor={`coordX-${currentQuestion.slot_order}`} className="block text-sm font-medium text-gray-700 mb-1">X 坐标</label>
                    <Input
                      id={`coordX-${currentQuestion.slot_order}`}
                      type="text" // 使用 text 允许前导零
                      placeholder="例如: 01234"
                      maxLength={5} // 限制长度
                      value={answers[currentQuestion.slot_order]?.answerCoordX || ''}
                      onChange={(e) => handleAnswerChange(currentQuestion.slot_order, 'answerCoordX', e.target.value)}
                      className="text-center font-mono" // 居中和等宽字体
                    />
                  </div>
                  <div>
                    <label htmlFor={`coordY-${currentQuestion.slot_order}`} className="block text-sm font-medium text-gray-700 mb-1">Y 坐标</label>
                    <Input
                      id={`coordY-${currentQuestion.slot_order}`}
                      type="text"
                      placeholder="例如: 56789"
                      maxLength={5}
                      value={answers[currentQuestion.slot_order]?.answerCoordY || ''}
                      onChange={(e) => handleAnswerChange(currentQuestion.slot_order, 'answerCoordY', e.target.value)}
                      className="text-center font-mono"
                    />
                  </div>
                </div>
              )}

              {currentQuestion.type === 'elevation' && (
                <div>
                  <label htmlFor={`elevation-${currentQuestion.slot_order}`} className="block text-sm font-medium text-gray-700 mb-1">高程值</label>
                  <Input
                    id={`elevation-${currentQuestion.slot_order}`}
                    type="number" // 使用 number 类型，但注意可能不支持前导零
                    placeholder="输入整数高程"
                    value={answers[currentQuestion.slot_order]?.answerText || ''}
                    onChange={(e) => handleAnswerChange(currentQuestion.slot_order, 'answerText', e.target.value)}
                  />
                </div>
              )}

              {currentQuestion.type === 'communication' && (
                <div>
                  <label htmlFor={`comm-${currentQuestion.slot_order}`} className="block text-sm font-medium text-gray-700 mb-1">答案</label>
                  <Textarea
                    id={`comm-${currentQuestion.slot_order}`}
                    className="min-h-[120px]" // 调整高度
                    placeholder="请输入答案..."
                    value={answers[currentQuestion.slot_order]?.answerText || ''}
                    onChange={(e: { target: { value: string; }; }) => handleAnswerChange(currentQuestion.slot_order, 'answerText', e.target.value)}
                  />
                </div>
              )}
              {/* 提交错误提示 */}
              {pageState.error && pageState.isSubmitting && (
                <Alert variant="destructive" className="mt-4">
                  <AlertCircle className="h-4 w-4" />
                  <AlertTitle>提交失败</AlertTitle>
                  <AlertDescription>{pageState.error}</AlertDescription>
                </Alert>
              )}
            </CardContent>
          </Card>

          {/* 底部导航和提交按钮 */}
          <div className="w-full max-w-3xl flex justify-between items-center mt-4">
            <Button
              variant="outline"
              onClick={handlePrevQuestion}
              disabled={currentQuestionIndex === 0 || pageState.isSubmitting}
              aria-label="上一题"
            >
              <ChevronLeft className="h-4 w-4 mr-1" />
              上一题
            </Button>

            {/* 显示当前进度 */}
            <span className="text-sm text-gray-500 hidden md:inline">
              {currentQuestionIndex + 1} / {pageState.questions.length}
            </span>

            {currentQuestionIndex === pageState.questions.length - 1 ? (
              // 最后一题显示提交按钮
              <Button
                onClick={() => handleSubmit(false)} // 手动提交非超时
                disabled={pageState.isSubmitting}
                size="lg" // 提交按钮大一些
                aria-label="提交所有答案"
              >
                {pageState.isSubmitting ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <Send className="mr-2 h-4 w-4" /> // 使用发送图标
                )}
                {pageState.isSubmitting ? '正在提交...' : '提交答案'}
              </Button>
            ) : (
              // 非最后一题显示下一题按钮
              <Button
                onClick={handleNextQuestion}
                disabled={pageState.isSubmitting}
                aria-label="下一题"
              >
                下一题
                <ChevronRight className="h-4 w-4 ml-1" />
              </Button>
            )}
          </div>
        </main>
      </div>
    </ProtectedRoute>
  );
}