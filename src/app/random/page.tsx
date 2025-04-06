'use client';

import { useState, useCallback } from 'react';
import { ProtectedRoute } from '@/components/protected-route';
import { Navbar } from '@/components/navbar';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card';
import { toast } from 'sonner';
import { Shuffle, Copy, ArrowRight, Check, DownloadIcon } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';

interface Pair {
  person1: number;
  person2: number | null;
}

export default function RandomPairingPage() {
  const [numberOfPeople, setNumberOfPeople] = useState<number | ''>(10);
  const [pairs, setPairs] = useState<Pair[]>([]);
  const [copied, setCopied] = useState(false);
  const [customPrefix, setCustomPrefix] = useState<string>('');

  // 生成随机配对
  const generatePairs = useCallback(() => {
    if (typeof numberOfPeople !== 'number' || numberOfPeople < 2) {
      toast.error('请输入有效的人数（至少2人）');
      return;
    }

    // 生成人员编号数组
    const people = Array.from({ length: numberOfPeople }, (_, i) => i + 1);
    
    // 随机打乱数组
    for (let i = people.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [people[i], people[j]] = [people[j], people[i]];
    }
    
    // 两两配对
    const newPairs: Pair[] = [];
    for (let i = 0; i < people.length; i += 2) {
      if (i + 1 < people.length) {
        newPairs.push({ person1: people[i], person2: people[i + 1] });
      } else {
        // 处理奇数情况，最后一个人没有配对
        newPairs.push({ person1: people[i], person2: null });
      }
    }
    
    setPairs(newPairs);
    toast.success(`已成功生成 ${newPairs.length} 个配对`);
  }, [numberOfPeople]);

  // 复制配对结果到剪贴板
  const copyToClipboard = useCallback(() => {
    if (pairs.length === 0) return;

    const text = pairs.map((pair, index) => {
      const pairText = pair.person2 
        ? `${customPrefix}${pair.person1} - ${customPrefix}${pair.person2}` 
        : `${customPrefix}${pair.person1} (未配对)`;
      return `${index + 1}. ${pairText}`;
    }).join('\n');

    navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      toast.success('已复制到剪贴板');
      setTimeout(() => setCopied(false), 2000);
    });
  }, [pairs, customPrefix]);

  // 导出为CSV文件
  const exportToCSV = useCallback(() => {
    if (pairs.length === 0) return;

    const csvContent = pairs.map((pair, index) => {
      return `${index + 1},${customPrefix}${pair.person1},${pair.person2 ? `${customPrefix}${pair.person2}` : "未配对"}`;
    }).join('\n');

    const header = "序号,人员1,人员2\n";
    const blob = new Blob([header + csvContent], { type: 'text/csv;charset=utf-8;' });
    
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    
    link.setAttribute('href', url);
    link.setAttribute('download', `随机配对结果_${new Date().toISOString().slice(0,10)}.csv`);
    link.style.visibility = 'hidden';
    
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    
    toast.success('已导出为CSV文件');
  }, [pairs, customPrefix]);

  return (
    <ProtectedRoute>
      <div className="min-h-screen bg-gray-50">
        <Navbar />
        <div className="container mx-auto py-8 px-4">
          <h1 className="text-2xl font-bold mb-6">随机配对工具</h1>
          
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* 配置卡片 */}
            <Card>
              <CardHeader>
                <CardTitle>配对设置</CardTitle>
                <CardDescription>设置人数并生成随机配对</CardDescription>
              </CardHeader>
              
              <CardContent className="space-y-4">
                <div>
                  <Label htmlFor="number-of-people">总人数</Label>
                  <Input 
                    id="number-of-people"
                    type="number" 
                    min="2"
                    value={numberOfPeople} 
                    onChange={e => setNumberOfPeople(e.target.value ? parseInt(e.target.value) : '')}
                    placeholder="请输入人数" 
                    className="mt-1"
                  />
                </div>
                
                <div>
                  <Label htmlFor="custom-prefix">编号前缀 (可选)</Label>
                  <Input 
                    id="custom-prefix"
                    value={customPrefix} 
                    onChange={e => setCustomPrefix(e.target.value)}
                    placeholder="例如: A-, 学员-" 
                    className="mt-1"
                  />
                </div>
              </CardContent>
              
              <CardFooter>
                <Button onClick={generatePairs} className="w-full">
                  <Shuffle className="mr-2 h-4 w-4" />
                  生成随机配对
                </Button>
              </CardFooter>
            </Card>
            
            {/* 结果卡片 */}
            <Card>
              <CardHeader>
                <CardTitle>配对结果</CardTitle>
                <CardDescription>
                  {pairs.length > 0 
                    ? `共 ${pairs.length} 组配对${pairs.some(p => p.person2 === null) ? '（含未配对）' : ''}` 
                    : '点击按钮生成配对'}
                </CardDescription>
              </CardHeader>
              
              <CardContent>
                {pairs.length === 0 ? (
                  <div className="text-center py-8 text-gray-500">
                    暂无配对结果，请先生成
                  </div>
                ) : (
                  <div className="space-y-2 max-h-[400px] overflow-y-auto pr-2">
                    {pairs.map((pair, index) => (
                      <div 
                        key={index} 
                        className="flex items-center p-2 rounded-md bg-gray-100 border border-gray-200"
                      >
                        <div className="w-8 h-8 rounded-full bg-primary/10 text-primary flex items-center justify-center font-medium">
                          {index + 1}
                        </div>
                        <div className="ml-3 text-lg font-medium">
                          {customPrefix}{pair.person1}
                        </div>
                        {pair.person2 ? (
                          <>
                            <ArrowRight className="mx-2 h-4 w-4 text-gray-400" />
                            <div className="text-lg font-medium">
                              {customPrefix}{pair.person2}
                            </div>
                          </>
                        ) : (
                          <div className="ml-2 px-2 py-1 text-xs bg-yellow-100 text-yellow-800 rounded">
                            未配对
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
              
              {pairs.length > 0 && (
                <CardFooter className="flex flex-col sm:flex-row gap-2">
                  <Button 
                    onClick={copyToClipboard} 
                    variant="outline" 
                    className="w-full sm:w-auto"
                  >
                    {copied ? <Check className="mr-2 h-4 w-4" /> : <Copy className="mr-2 h-4 w-4" />}
                    {copied ? '已复制' : '复制结果'}
                  </Button>
                  <Button 
                    onClick={exportToCSV} 
                    variant="secondary" 
                    className="w-full sm:w-auto"
                  >
                    <DownloadIcon className="mr-2 h-4 w-4" />
                    导出CSV
                  </Button>
                </CardFooter>
              )}
            </Card>
          </div>
        </div>
      </div>
    </ProtectedRoute>
  );
}