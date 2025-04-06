// src/app/admin/questions/create/page.tsx
'use client';

import { useState, useCallback } from 'react'; // 移除 useEffect, useParams
import { useRouter } from 'next/navigation';
import { useAuth } from '@/components/providers/auth-provider';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Navbar } from '@/components/navbar';
import { ProtectedRoute } from '@/components/protected-route';
import { adminAPI } from '@/lib/admin-api';
import { AdminQuestion } from '../page'; // 从列表页导入类型 (用于 Partial)
import { AlertCircle, Loader2, Save, ArrowLeft } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { toast } from "sonner";
import * as json5 from 'json5'; // 引入 json5 用于更宽松的 JSON 解析
import { 
  getQuestionTypeName, 
  getCommunicationMethodName, 
  getCommunicationSubtypeName
} from '@/lib/utils';

// 子类型选项 (与编辑页相同)
const communicationSubtypes = {
  sign_language: [
    { value: 'number', label: '数字' },
    { value: 'formation', label: '队形' },
    { value: 'command', label: '命令' },
    { value: 'inform', label: '告知' },
    { value: 'specific_designation', label: '专指' },
    { value: 'direction', label: '方位' },
    { value: 'sentence', label: '句子 (组合)' },
  ],
  semaphore: [
    { value: 'command', label: '指挥' },
    { value: 'number', label: '数字' },
    { value: 'service', label: '勤务' },
  ],
};

// 表单初始状态
const initialFormData: Partial<AdminQuestion> = {
    content: '',
    type: 'coordinate', // 默认类型
    answer_coord_x: '',
    answer_coord_y: '',
    answer_elevation: undefined,
    answer_text: '',
    communication_method: undefined,
    communication_subtype: undefined,
    is_long_sentence: false,
    keywords: '', // 初始为空字符串
};


export default function CreateQuestionPage() {
  const router = useRouter();
  const { user, isLoading: isAuthLoading } = useAuth();

  // 使用单一 state 管理表单数据
  const [formData, setFormData] = useState<Partial<AdminQuestion>>(initialFormData);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // --- 输入处理函数 (与编辑页相同) ---
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value, type } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? (e.target as HTMLInputElement).checked : value,
    }));
  };

  const handleSelectChange = (name: keyof typeof initialFormData, value: string) => {
     // 类型断言，确保 name 是 formData 的有效键
     const key = name as keyof typeof initialFormData;
     setFormData(prev => ({
       ...prev,
       [key]: value,
       ...(key === 'communication_method' && value !== 'sign_language' && value !== 'semaphore' && { communication_subtype: undefined }),
        // 如果切换题目类型，重置不相关的答案字段
       ...(key === 'type' && value !== 'coordinate' && { answer_coord_x: '', answer_coord_y: '' }),
       ...(key === 'type' && value !== 'elevation' && { answer_elevation: undefined }),
       ...(key === 'type' && value !== 'communication' && {
             answer_text: '',
             communication_method: undefined,
             communication_subtype: undefined,
             is_long_sentence: false,
             keywords: ''
           }),
     }));
   };

  const handleCheckboxChange = (name: keyof typeof initialFormData, checked: boolean | 'indeterminate') => {
       if (typeof checked === 'boolean') {
           const key = name as keyof typeof initialFormData;
           setFormData(prev => ({
               ...prev,
               [key]: checked,
               ...(key === 'is_long_sentence' && !checked && { keywords: '' })
           }));
       }
   };
   // -------------------------------------

  // --- 提交表单 (逻辑与编辑页类似，但调用 createQuestion) ---
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    // --- 表单验证 (与编辑页相同) ---
    if (!formData.content?.trim()) return setError('请输入题目内容');
    if (!formData.type) return setError('请选择题目类型');

    const { type, answer_coord_x, answer_coord_y, answer_elevation, answer_text, communication_method, communication_subtype, is_long_sentence, keywords } = formData;

    const submissionData: any = {
      content: formData.content,
      type: type,
    };

    if (type === 'coordinate') {
      if (!answer_coord_x?.trim() || !answer_coord_y?.trim()) return setError('请输入坐标X和Y值 (例如: 01234)');
      if (!/^\d{1,5}$/.test(answer_coord_x) || !/^\d{1,5}$/.test(answer_coord_y)) return setError('坐标格式不正确，应为1到5位数字');
      submissionData.answer_coord_x = answer_coord_x.padStart(5, '0');
      submissionData.answer_coord_y = answer_coord_y.padStart(5, '0');
    } else if (type === 'elevation') {
      if (answer_elevation === undefined || answer_elevation === null || isNaN(Number(answer_elevation))) return setError('请输入有效的高程整数值');
      submissionData.answer_elevation = Number(answer_elevation);
    } else if (type === 'communication') {
      if (!answer_text?.trim()) return setError('请输入通信题答案');
      if (!communication_method) return setError('请选择通信方式');
      submissionData.answer_text = answer_text;
      submissionData.communication_method = communication_method;

      if (communication_method === 'sign_language' || communication_method === 'semaphore') {
         if (!communication_subtype) return setError(`请为 ${communication_method === 'sign_language' ? '手语' : '旗语'} 选择子类型`);
         submissionData.communication_subtype = communication_subtype;
      } else {
          submissionData.communication_subtype = null;
      }

      submissionData.is_long_sentence = is_long_sentence;
      if (is_long_sentence) {
        if (!keywords?.trim()) return setError('长句题需要输入关键词');
        try {
             // 使用 json5 解析更宽松的输入，例如允许单引号或尾随逗号，但最终还是转成标准 JSON 字符串
             // const keywordsArray = json5.parse(`[${keywords}]`).map((k:any) => String(k).trim()).filter((k:string) => k);
             // 或者坚持简单的逗号分隔
             const keywordsArray = keywords.split(',').map(k => k.trim()).filter(k => k);
             if (keywordsArray.length === 0) throw new Error("关键词不能为空");
             submissionData.keywords = JSON.stringify(keywordsArray);
        } catch (err) {
             return setError("关键词格式错误，请使用英文逗号分隔，例如: 关键词1, 关键词2");
        }
      } else {
         submissionData.keywords = null;
      }
    }
    // ------------------

    console.log("准备创建的数据:", submissionData);
    setIsSubmitting(true);

    try {
      // 调用 API 创建题目
      await adminAPI.questions.createQuestion(submissionData);
      toast.success(`题目 "${submissionData.content.substring(0, 20)}..." 创建成功！`);
      router.push('/admin/questions'); // 创建成功，返回列表页
      router.refresh(); // 尝试刷新列表页数据
    } catch (err: any) {
      const errorMsg = err.message || '创建题目失败，请检查输入或稍后重试。';
      setError(errorMsg);
      toast.error("创建失败", { description: errorMsg });
      console.error('创建题目失败:', err);
    } finally {
      setIsSubmitting(false);
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

          <h1 className="text-2xl md:text-3xl font-bold mb-6 text-gray-800">创建新题目</h1>

          {/* 显示提交错误 */}
          {error && (
            <Alert variant="destructive" className="mb-6">
              <AlertCircle className="h-4 w-4" />
              <AlertTitle>创建失败</AlertTitle>
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
                    name="content"
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
                  <Select
                      name="type"
                      value={formData.type}
                      onValueChange={(value) => handleSelectChange('type', value as AdminQuestion['type'])}
                      required
                  >
                     <SelectTrigger id="type">
                         <SelectValue placeholder="选择题目类型" />
                     </SelectTrigger>
                     <SelectContent>
                         <SelectItem value="coordinate">坐标读取</SelectItem>
                         <SelectItem value="elevation">高程读取</SelectItem>
                         <SelectItem value="communication">通信题</SelectItem>
                     </SelectContent>
                  </Select>
                </div>
              </div>

              {/* --- 答案区域 (与编辑页相同) --- */}
              <h3 className="text-lg font-semibold mb-4 border-b pb-2 text-gray-700">答案设置</h3>

              {formData.type === 'coordinate' && (
                <div className="space-y-4">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="answer_coord_x">X坐标 <span className="text-red-500">*</span></Label>
                      <Input
                        id="answer_coord_x"
                        name="answer_coord_x"
                        value={formData.answer_coord_x || ''}
                        onChange={handleInputChange}
                        placeholder="例如：01234"
                        maxLength={5}
                        pattern="\d{1,5}"
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

              {formData.type === 'elevation' && (
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="answer_elevation">高程值 (整数) <span className="text-red-500">*</span></Label>
                    <Input
                      id="answer_elevation"
                      name="answer_elevation"
                      type="number"
                      value={formData.answer_elevation ?? ''}
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

              {formData.type === 'communication' && (
                <div className="space-y-6">
                  <div className="space-y-2">
                    <Label htmlFor="communication_method">通信方式 <span className="text-red-500">*</span></Label>
                     <Select
                         name="communication_method"
                         value={formData.communication_method || ''}
                         onValueChange={(value) => handleSelectChange('communication_method', value)}
                         required
                     >
                         <SelectTrigger id="communication_method">
                             <SelectValue placeholder="选择通信方式" />
                         </SelectTrigger>
                         <SelectContent>
                              <SelectItem value="sign_language">手语</SelectItem>
                              <SelectItem value="semaphore">旗语</SelectItem>
                              <SelectItem value="sound">音响</SelectItem>
                              <SelectItem value="light">光亮</SelectItem>
                         </SelectContent>
                     </Select>
                  </div>

                  {(formData.communication_method === 'sign_language' || formData.communication_method === 'semaphore') && (
                    <div className="space-y-2">
                       <Label htmlFor="communication_subtype">通信子类型 <span className="text-red-500">*</span></Label>
                       <Select
                           name="communication_subtype"
                           value={formData.communication_subtype || ''}
                           onValueChange={(value) => handleSelectChange('communication_subtype', value)}
                           required={formData.communication_method === 'sign_language' || formData.communication_method === 'semaphore'}
                       >
                           <SelectTrigger id="communication_subtype">
                               <SelectValue placeholder="选择子类型" />
                           </SelectTrigger>
                           <SelectContent>
                               {communicationSubtypes[formData.communication_method as keyof typeof communicationSubtypes]?.map(sub => (
                                   <SelectItem key={sub.value} value={sub.value}>{sub.label}</SelectItem>
                               ))}
                           </SelectContent>
                       </Select>
                    </div>
                  )}

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

                  <div className="flex items-center space-x-2">
                       <Checkbox
                           id="is_long_sentence"
                           name="is_long_sentence"
                           checked={formData.is_long_sentence || false}
                           onCheckedChange={(checked) => handleCheckboxChange('is_long_sentence', checked)}
                       />
                       <Label htmlFor="is_long_sentence" className="font-medium text-gray-700">
                           标记为长句题 (启用关键词判卷)
                       </Label>
                  </div>

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

            <CardFooter className="flex justify-end p-0 pt-6">
              <Button
                type="submit"
                disabled={isSubmitting || isAuthLoading} // 确保认证加载完成才可提交
                className="min-w-[120px]"
              >
                {isSubmitting ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                   <Save className="mr-2 h-4 w-4" />
                )}
                {isSubmitting ? '正在创建...' : '创建题目'}
              </Button>
            </CardFooter>
          </form>
        </main>
      </div>
    </ProtectedRoute>
  );
}