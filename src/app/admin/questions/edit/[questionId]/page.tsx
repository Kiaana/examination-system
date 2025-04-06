// src/app/admin/questions/edit/[questionId]/page.tsx
'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter, useParams } from 'next/navigation'; // 使用 useParams
import { useAuth } from '@/components/providers/auth-provider';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea'; // 引入 Textarea
import { Checkbox } from "@/components/ui/checkbox"; // 引入 Checkbox
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"; // 引入 Select
import { Navbar } from '@/components/navbar';
import { ProtectedRoute } from '@/components/protected-route'; // 引入路由保护
import { adminAPI } from '@/lib/admin-api';
import { AdminQuestion } from '../../page'; // 从列表页面导入类型 (假设已导出)
import { Skeleton } from "@/components/ui/skeleton";
import { AlertCircle, Loader2, Save, ArrowLeft } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { toast } from "sonner";
import {
  getQuestionTypeName,
  getCommunicationMethodName,
  getCommunicationSubtypeName
} from '@/lib/utils';


// 定义通信题子类型选项 (可以考虑从后端获取或配置)
const communicationSubtypes = {
  sign_language: [
    { value: 'number', label: getCommunicationSubtypeName('sign_language', 'number') },
    { value: 'formation', label: getCommunicationSubtypeName('sign_language', 'formation') },
    { value: 'command', label: getCommunicationSubtypeName('sign_language', 'command') },
    { value: 'inform', label: getCommunicationSubtypeName('sign_language', 'inform') },
    { value: 'specific_designation', label: getCommunicationSubtypeName('sign_language', 'specific_designation') },
    { value: 'direction', label: getCommunicationSubtypeName('sign_language', 'direction') },
    { value: 'sentence', label: getCommunicationSubtypeName('sign_language', 'sentence') },
  ],
  semaphore: [
    { value: 'command', label: getCommunicationSubtypeName('semaphore', 'command') },
    { value: 'number', label: getCommunicationSubtypeName('semaphore', 'number') },
    { value: 'service', label: getCommunicationSubtypeName('semaphore', 'service') },
  ],
};

export default function EditQuestionPage() {
  const router = useRouter();
  const params = useParams<{ questionId: string }>();
  const questionIdStr = params.questionId;
  const questionId = parseInt(questionIdStr); // 转换为数字
  const { user, isLoading: isAuthLoading } = useAuth();

  // 使用一个对象来管理表单状态，更易于维护
  const [formData, setFormData] = useState<Partial<AdminQuestion>>({
    content: '',
    type: 'coordinate', // 默认值
    answer_coord_x: '',
    answer_coord_y: '',
    answer_elevation: undefined, // 使用 undefined 表示未设置
    answer_text: '',
    communication_method: undefined,
    communication_subtype: undefined,
    is_long_sentence: false,
    keywords: '', // 存储逗号分隔的字符串，提交时转换
  });

  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // 加载题目数据的回调函数
  const fetchQuestion = useCallback(async () => {
    if (isNaN(questionId) || !user || user.role !== 'admin') {
      setIsLoading(false);
      setError("无效的题目ID或权限不足。");
      return;
    }

    console.log(`Fetching question ${questionId}`);
    setIsLoading(true);
    setError(null);
    try {
      // 调用 API 获取题目详情
      // 后端返回的 serialize_question 结果直接匹配 AdminQuestion
      const question: AdminQuestion = await adminAPI.questions.getQuestion(questionId);

      console.log("Fetched question data:", question);

      // 解析 keywords (如果存在且是 JSON 字符串)
      let keywordsString = '';
      if (question.is_long_sentence && question.keywords) {
        try {
          const keywordsArray = JSON.parse(question.keywords);
          if (Array.isArray(keywordsArray)) {
            keywordsString = keywordsArray.join(', '); // 转换为逗号分隔
          }
        } catch (e) {
          console.error("Failed to parse keywords JSON:", e);
          keywordsString = question.keywords; // 保留原始字符串以防解析失败
        }
      }

      // 使用获取的数据更新表单状态
      setFormData({
        content: question.content || '',
        type: question.type || 'coordinate',
        answer_coord_x: question.answer_coord_x || '',
        answer_coord_y: question.answer_coord_y || '',
        answer_elevation: question.answer_elevation ?? undefined, // 处理 null
        answer_text: question.answer_text || '',
        communication_method: question.communication_method ?? undefined,
        communication_subtype: question.communication_subtype ?? undefined,
        is_long_sentence: question.is_long_sentence || false,
        keywords: keywordsString, // 使用处理后的字符串
      });

    } catch (err: any) {
      setError(err.message || '获取题目详情失败');
      console.error(`获取题目 #${questionId} 失败:`, err);
    } finally {
      setIsLoading(false);
    }
  }, [questionId, user]);

  // 组件挂载时加载数据
  useEffect(() => {
    fetchQuestion();
  }, [fetchQuestion]);

  // 处理表单输入变化 (通用)
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value, type } = e.target;

    setFormData(prev => ({
      ...prev,
      // 使用 name 属性来更新对应的 state key
      [name]: type === 'checkbox' ? (e.target as HTMLInputElement).checked : value,
    }));
  };

  // 处理 Select 组件的变化
  const handleSelectChange = (name: keyof AdminQuestion, value: string) => {
    setFormData(prev => ({
      ...prev,
      [name]: value,
      // 如果改变了 communication_method，重置 subtype (除非是 sound/light)
      ...(name === 'communication_method' && value !== 'sign_language' && value !== 'semaphore' && { communication_subtype: undefined }),
    }));
  };

  // 处理 Checkbox 组件的变化
  const handleCheckboxChange = (name: keyof AdminQuestion, checked: boolean | 'indeterminate') => {
    if (typeof checked === 'boolean') {
      setFormData(prev => ({
        ...prev,
        [name]: checked,
        // 如果取消勾选长句，清除关键词
        ...(name === 'is_long_sentence' && !checked && { keywords: '' })
      }));
    }
  };


  // 提交表单
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null); // 清除之前的错误

    // --- 表单验证 ---
    if (!formData.content?.trim()) return setError('请输入题目内容');
    if (!formData.type) return setError('请选择题目类型');

    const { type, answer_coord_x, answer_coord_y, answer_elevation, answer_text, communication_method, communication_subtype, is_long_sentence, keywords } = formData;

    const submissionData: any = {
      content: formData.content,
      type: type,
    };

    if (type === 'coordinate') {
      if (!answer_coord_x?.trim() || !answer_coord_y?.trim()) return setError('请输入坐标X和Y值 (例如: 01234)');
      // 可选：添加格式验证
      if (!/^\d{1,5}$/.test(answer_coord_x) || !/^\d{1,5}$/.test(answer_coord_y)) return setError('坐标格式不正确，应为1到5位数字');
      submissionData.answer_coord_x = answer_coord_x.padStart(5, '0'); // 补全前导零
      submissionData.answer_coord_y = answer_coord_y.padStart(5, '0');
    } else if (type === 'elevation') {
      if (answer_elevation === undefined || answer_elevation === null || isNaN(Number(answer_elevation))) return setError('请输入有效的高程整数值');
      submissionData.answer_elevation = Number(answer_elevation);
    } else if (type === 'communication') {
      if (!answer_text?.trim()) return setError('请输入通信题答案');
      if (!communication_method) return setError('请选择通信方式');
      submissionData.answer_text = answer_text;
      submissionData.communication_method = communication_method;

      // 处理子类型
      if (communication_method === 'sign_language' || communication_method === 'semaphore') {
        if (!communication_subtype) return setError(`请为 ${communication_method === 'sign_language' ? '手语' : '旗语'} 选择子类型`);
        submissionData.communication_subtype = communication_subtype;
      } else {
        submissionData.communication_subtype = null; // 声音/灯光无子类型
      }

      submissionData.is_long_sentence = is_long_sentence;
      if (is_long_sentence) {
        if (!keywords?.trim()) return setError('长句题需要输入关键词');
        // 将逗号分隔的字符串转为 JSON 字符串列表
        try {
          const keywordsArray = keywords.split(',').map(k => k.trim()).filter(k => k);
          if (keywordsArray.length === 0) throw new Error("关键词不能为空");
          submissionData.keywords = JSON.stringify(keywordsArray);
        } catch (err) {
          return setError("关键词格式错误，请使用英文逗号分隔。");
        }
      } else {
        submissionData.keywords = null; // 非长句题关键词为 null
      }
    }
    // ------------------

    console.log("准备提交的数据:", submissionData);
    setIsSubmitting(true);

    try {
      // 调用API更新题目
      await adminAPI.questions.updateQuestion(questionId, submissionData);
      toast.success(`题目 #${questionId} 更新成功！`);
      router.push('/admin/questions'); // 更新成功，返回列表页
      router.refresh(); // 强制刷新页面数据 (如果列表页是静态渲染的)
    } catch (err: any) {
      const errorMsg = err.message || '更新题目失败，请检查输入或稍后重试。';
      setError(errorMsg);
      toast.error("更新失败", { description: errorMsg });
      console.error(`更新题目 #${questionId} 失败:`, err);
    } finally {
      setIsSubmitting(false);
    }
  };

  // --- 渲染 ---

  // 加载认证状态
  if (isAuthLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  // 渲染骨架屏
  const renderSkeleton = () => (
    <div className="min-h-screen bg-gray-50">
      <Navbar />
      <main className="container mx-auto py-8 px-4">
        <Skeleton className="h-10 w-36 mb-6" /> {/* 返回按钮 */}
        <Skeleton className="h-9 w-48 mb-6" /> {/* 标题 */}
        {/* 错误提示区骨架 */}
        <Skeleton className="h-10 w-full mb-6" />
        <form>
          <Card className="p-6 mb-6">
            <Skeleton className="h-6 w-40 mb-4" /> {/* 基本信息标题 */}
            <div className="grid gap-4 mb-6">
              <div className="space-y-2">
                <Skeleton className="h-4 w-20" /> {/* Label */}
                <Skeleton className="h-10 w-full" /> {/* Input */}
              </div>
              <div className="space-y-2">
                <Skeleton className="h-4 w-20" /> {/* Label */}
                <Skeleton className="h-10 w-full" /> {/* Select */}
              </div>
            </div>
            {/* 答案区骨架 */}
            <Skeleton className="h-6 w-32 mb-3" /> {/* 答案标题 */}
            <div className="space-y-2">
              <Skeleton className="h-4 w-20" /> {/* Label */}
              <Skeleton className="h-10 w-full" /> {/* Input */}
            </div>
            <Skeleton className="h-4 w-full mt-2" /> {/* 提示文本 */}
          </Card>
          <div className="flex justify-end">
            <Skeleton className="h-10 w-32" /> {/* 提交按钮 */}
          </div>
        </form>
      </main>
    </div>
  );


  // 渲染加载状态
  if (isLoading) {
    return renderSkeleton();
  }

  // 渲染错误状态 (加载题目失败)
  if (error && !isSubmitting) { // 只显示加载错误，提交错误在表单内显示
    return (
      <div className="min-h-screen bg-gray-50">
        <Navbar />
        <main className="container mx-auto py-8 px-4">
          <Button
            variant="outline"
            className="mb-6"
            onClick={() => router.push('/admin/questions')}
          >
            <ArrowLeft className="mr-2 h-4 w-4" />
            返回题目列表
          </Button>
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertTitle>加载错误</AlertTitle>
            <AlertDescription>
              {error}
              <Button variant="link" className="ml-2" onClick={fetchQuestion}>重试</Button>
            </AlertDescription>
          </Alert>
        </main>
      </div>
    );
  }


  return (
    <ProtectedRoute adminOnly={true}>
      <div className="min-h-screen bg-gray-50">
        <Navbar />

        <main className="container mx-auto py-8 px-4">
          <Button
            variant="outline"
            className="mb-6"
            onClick={() => router.push('/admin/questions')}
          >
            <ArrowLeft className="mr-2 h-4 w-4" />
            返回题目列表
          </Button>

          <h1 className="text-2xl md:text-3xl font-bold mb-6 text-gray-800">编辑题目 #{questionId}</h1>

          {/* 显示提交错误 */}
          {error && isSubmitting && (
            <Alert variant="destructive" className="mb-6">
              <AlertCircle className="h-4 w-4" />
              <AlertTitle>保存失败</AlertTitle>
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          <form onSubmit={handleSubmit}>
            <Card className="p-6 md:p-8 mb-6 shadow-md bg-white">
              <h2 className="text-xl font-semibold mb-6 border-b pb-3 text-gray-700">题目信息</h2>

              <div className="grid gap-6 mb-6">
                {/* 题目内容 */}
                <div className="space-y-2">
                  <Label htmlFor="content" className="font-medium text-gray-700">题目内容 <span className="text-red-500">*</span></Label>
                  <Textarea
                    id="content"
                    name="content" // 添加 name 属性
                    value={formData.content}
                    onChange={handleInputChange}
                    placeholder="例如：请读取地图上 A 点的坐标"
                    required
                    className="min-h-[100px]"
                  />
                </div>

                {/* 题目类型 */}
                <div className="space-y-2">
                  <Label htmlFor="type" className="font-medium text-gray-700">题目类型 <span className="text-red-500">*</span></Label>
                  {/* 使用 ShadCN Select */}
                  <Select
                    name="type" // 添加 name
                    value={formData.type}
                    onValueChange={(value) => handleSelectChange('type', value as AdminQuestion['type'])} // 使用 handleSelectChange
                    required
                  >
                    <SelectTrigger id="type">
                      <SelectValue placeholder="选择题目类型" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="coordinate">{getQuestionTypeName('coordinate')}</SelectItem>
                      <SelectItem value="elevation">{getQuestionTypeName('elevation')}</SelectItem>
                      <SelectItem value="communication">{getQuestionTypeName('communication')}</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* --- 答案区域 (条件渲染) --- */}
              <h3 className="text-lg font-semibold mb-4 border-b pb-2 text-gray-700">答案设置</h3>

              {/* 坐标读取题 */}
              {formData.type === 'coordinate' && (
                <div className="space-y-4">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="answer_coord_x">X坐标 <span className="text-red-500">*</span></Label>
                      <Input
                        id="answer_coord_x"
                        name="answer_coord_x" // 匹配 state key
                        value={formData.answer_coord_x || ''}
                        onChange={handleInputChange}
                        placeholder="例如：01234"
                        maxLength={5}
                        pattern="\d{1,5}" // 添加 HTML5 验证
                        title="请输入1到5位数字"
                        className="font-mono text-center"
                        required
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="answer_coord_y">Y坐标 <span className="text-red-500">*</span></Label>
                      <Input
                        id="answer_coord_y"
                        name="answer_coord_y"
                        value={formData.answer_coord_y || ''}
                        onChange={handleInputChange}
                        placeholder="例如：56789"
                        maxLength={5}
                        pattern="\d{1,5}"
                        title="请输入1到5位数字"
                        className="font-mono text-center"
                        required
                      />
                    </div>
                  </div>
                  <p className="text-xs text-gray-500">
                    判卷规则：用户答案与标准答案比较，每个坐标容差 ±50（不含边界）。将自动补全前导零至5位。
                  </p>
                </div>
              )}

              {/* 高程读取题 */}
              {formData.type === 'elevation' && (
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="answer_elevation">高程值 (整数) <span className="text-red-500">*</span></Label>
                    <Input
                      id="answer_elevation"
                      name="answer_elevation"
                      type="number"
                      value={formData.answer_elevation ?? ''} // 处理 undefined
                      onChange={handleInputChange}
                      placeholder="例如：1200"
                      required
                    />
                  </div>
                  <p className="text-xs text-gray-500">
                    判卷规则：用户答案与标准答案比较，容差 ±5（不含边界）。
                  </p>
                </div>
              )}

              {/* 通信题 */}
              {formData.type === 'communication' && (
                <div className="space-y-6">
                  {/* 通信方式 */}
                  <div className="space-y-2">
                    <Label htmlFor="communication_method">通信方式 <span className="text-red-500">*</span></Label>
                    <Select
                      name="communication_method"
                      value={formData.communication_method || ''} // 处理 undefined
                      onValueChange={(value) => handleSelectChange('communication_method', value)}
                      required
                    >
                      <SelectTrigger id="communication_method">
                        <SelectValue placeholder="选择通信方式" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="sign_language">{getCommunicationMethodName('sign_language')}</SelectItem>
                        <SelectItem value="semaphore">{getCommunicationMethodName('semaphore')}</SelectItem>
                        <SelectItem value="sound">{getCommunicationMethodName('sound')}</SelectItem>
                        <SelectItem value="light">{getCommunicationMethodName('light')}</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  {/* 通信子类型 (条件渲染) */}
                  {(formData.communication_method === 'sign_language' || formData.communication_method === 'semaphore') && (
                    <div className="space-y-2">
                      <Label htmlFor="communication_subtype">通信子类型 <span className="text-red-500">*</span></Label>
                      <Select
                        name="communication_subtype"
                        value={formData.communication_subtype || ''}
                        onValueChange={(value) => handleSelectChange('communication_subtype', value)}
                        required
                      >
                        <SelectTrigger id="communication_subtype">
                          <SelectValue placeholder="选择子类型" />
                        </SelectTrigger>
                        <SelectContent>
                          {/* 根据 communication_method 动态生成选项 */}
                          {communicationSubtypes[formData.communication_method as keyof typeof communicationSubtypes]?.map(sub => (
                            <SelectItem key={sub.value} value={sub.value}>{sub.label}</SelectItem>
                          ))}
                          {/* 可以加一个“无特定子类型”的选项？根据后端逻辑决定 */}
                        </SelectContent>
                      </Select>
                    </div>
                  )}

                  {/* 答案文本 */}
                  <div className="space-y-2">
                    <Label htmlFor="answer_text">答案文本 <span className="text-red-500">*</span></Label>
                    <Textarea
                      id="answer_text"
                      name="answer_text"
                      value={formData.answer_text || ''}
                      onChange={handleInputChange}
                      placeholder="输入通信题的正确答案"
                      required
                      className="min-h-[80px]"
                    />
                    <p className="text-xs text-gray-500">
                      判卷规则：非长句题精确匹配（忽略大小写），长句题按关键词顺序匹配。
                    </p>
                  </div>

                  {/* 长句题选项 */}
                  <div className="flex items-center space-x-2">
                    <Checkbox
                      id="is_long_sentence"
                      name="is_long_sentence" // 匹配 state key
                      checked={formData.is_long_sentence || false}
                      onCheckedChange={(checked) => handleCheckboxChange('is_long_sentence', checked)} // 使用 handleCheckboxChange
                    />
                    <Label htmlFor="is_long_sentence" className="font-medium text-gray-700">
                      标记为长句题 (启用关键词判卷)
                    </Label>
                  </div>

                  {/* 关键词输入 (条件渲染) */}
                  {formData.is_long_sentence && (
                    <div className="space-y-2">
                      <Label htmlFor="keywords">关键词 (英文逗号分隔) <span className="text-red-500">*</span></Label>
                      <Input
                        id="keywords"
                        name="keywords"
                        value={formData.keywords || ''}
                        onChange={handleInputChange}
                        placeholder="例如：前方, 安全, 前进"
                        required={formData.is_long_sentence}
                      />
                      <p className="text-xs text-gray-500">
                        输入用于判卷的有序关键词，请使用英文逗号 "," 分隔。
                      </p>
                    </div>
                  )}
                </div>
              )}
            </Card>

            {/* 提交按钮 */}
            <CardFooter className="flex justify-end p-0 pt-6">
              <Button
                type="submit"
                disabled={isSubmitting || isLoading}
                className="min-w-[120px]"
              >
                {isSubmitting ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <Save className="mr-2 h-4 w-4" />
                )}
                {isSubmitting ? '正在保存...' : '保存更改'}
              </Button>
            </CardFooter>
          </form>
        </main>
      </div>
    </ProtectedRoute>
  );
}