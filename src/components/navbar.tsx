'use client';

import { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useAuth } from './providers/auth-provider';
import { Button } from './ui/button';
import { Menu, X, User, LogOut } from 'lucide-react'; // 引入图标

export function Navbar() {
  const pathname = usePathname();
  const { user, logout } = useAuth();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  if (!user) return null;

  const isAdmin = user.role === 'admin';

  const navItems = [
    { label: '首页', href: '/dashboard', active: pathname === '/dashboard' },
    { label: '历史记录', href: '/history', active: pathname.startsWith('/history') },
  ];

  if (isAdmin) {
    navItems.push(
      { label: '题目管理', href: '/admin/questions', active: pathname.startsWith('/admin/questions') },
      { label: '模板管理', href: '/admin/templates', active: pathname.startsWith('/admin/templates') },
      { label: '记录管理', href: '/admin/attempts', active: pathname.startsWith('/admin/attempts') }
    );
  }

  const toggleMobileMenu = () => {
    setIsMobileMenuOpen(!isMobileMenuOpen);
  };

  const handleNavItemClick = () => {
    // 点击导航项后关闭移动菜单
    setIsMobileMenuOpen(false);
  };

  return (
    <nav className="bg-card border-b border-border sticky top-0 z-10">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between h-16">
          {/* 左侧 Logo 和桌面导航 */}
          <div className="flex">
            <div className="flex-shrink-0 flex items-center">
              <Link href="/dashboard" className="text-xl font-bold">
                答题系统
              </Link>
            </div>
            <div className="hidden sm:ml-6 sm:flex sm:space-x-4">
              {navItems.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`inline-flex items-center px-3 py-2 text-sm font-medium rounded-md ${
                    item.active
                      ? 'bg-primary/10 text-primary'
                      : 'text-muted-foreground hover:text-foreground hover:bg-gray-100'
                  }`}
                >
                  {item.label}
                </Link>
              ))}
            </div>
          </div>
          
          {/* 右侧用户信息和登出按钮 */}
          <div className="hidden sm:flex items-center space-x-4">
            <div className="flex items-center text-sm text-muted-foreground">
              <User className="w-4 h-4 mr-1" />
              {user.username}
            </div>
            <Button 
              variant="outline" 
              size="sm" 
              onClick={() => logout()}
              className="flex items-center"
            >
              <LogOut className="w-4 h-4 mr-1" />
              登出
            </Button>
          </div>
          
          {/* 移动端菜单切换按钮 */}
          <div className="flex sm:hidden">
            <button
              type="button"
              onClick={toggleMobileMenu}
              className="inline-flex items-center justify-center p-2 rounded-md text-muted-foreground hover:text-primary hover:bg-gray-100"
              aria-controls="mobile-menu"
              aria-expanded={isMobileMenuOpen}
            >
              <span className="sr-only">打开菜单</span>
              {isMobileMenuOpen ? (
                <X className="block h-6 w-6" />
              ) : (
                <Menu className="block h-6 w-6" />
              )}
            </button>
          </div>
        </div>
      </div>
      
      {/* 移动端菜单 - 可折叠 */}
      <div 
        className={`sm:hidden ${isMobileMenuOpen ? 'block' : 'hidden'}`}
        id="mobile-menu"
      >
        <div className="pt-2 pb-3 space-y-1 px-2">
          {navItems.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              onClick={handleNavItemClick}
              className={`block px-3 py-2 rounded-md text-base font-medium ${
                item.active
                  ? 'bg-primary/10 text-primary'
                  : 'text-muted-foreground hover:text-foreground hover:bg-gray-100'
              }`}
            >
              {item.label}
            </Link>
          ))}
          {/* 用户信息和登出项 - 在移动菜单底部显示 */}
          <div className="border-t border-border mt-3 pt-3">
            <div className="flex items-center px-3 py-2 text-sm text-muted-foreground">
              <User className="w-4 h-4 mr-2" />
              {user.username}
            </div>
            <button
              onClick={() => {
                logout();
                setIsMobileMenuOpen(false);
              }}
              className="w-full text-left flex items-center px-3 py-2 text-sm text-destructive hover:bg-destructive/10 rounded-md"
            >
              <LogOut className="w-4 h-4 mr-2" />
              登出
            </button>
          </div>
        </div>
      </div>
    </nav>
  );
}