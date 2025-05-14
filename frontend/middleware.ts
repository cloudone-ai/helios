import { NextRequest, NextResponse } from 'next/server';

// 支持的语言列表
const locales = ['en', 'zh', 'ja', 'ko', 'fr', 'de', 'es', 'ru'];
// 默认语言
export const defaultLocale = 'en';
// 是否自动检测用户语言
const localeDetection = true;

function getLocale(request: NextRequest) {
  // 从请求路径中获取语言代码
  const pathname = request.nextUrl.pathname;
  const pathnameIsMissingLocale = locales.every(
    locale => !pathname.startsWith(`/${locale}/`) && pathname !== `/${locale}`
  );

  // 如果路径中没有语言代码，则从 Accept-Language 头或 cookie 中获取
  if (pathnameIsMissingLocale && localeDetection) {
    const acceptLanguage = request.headers.get('accept-language');
    // 从 cookie 中获取语言设置
    const cookieLocale = request.cookies.get('NEXT_LOCALE')?.value;
    
    // 优先使用 cookie 中的语言设置
    if (cookieLocale && locales.includes(cookieLocale)) {
      return cookieLocale;
    }
    
    // 从 Accept-Language 头中获取语言设置
    if (acceptLanguage) {
      const detectedLocale = acceptLanguage
        .split(',')
        .map(lang => lang.split(';')[0].trim())
        .find(lang => {
          const locale = lang.substring(0, 2);
          return locales.includes(locale);
        });
      
      if (detectedLocale) {
        return detectedLocale.substring(0, 2);
      }
    }
  }

  // 如果无法检测到语言，则使用默认语言
  return defaultLocale;
}

export function middleware(request: NextRequest) {
  const pathname = request.nextUrl.pathname;
  
  // 跳过认证相关路径，不进行国际化重定向
  if (
    pathname.startsWith('/auth/callback') || 
    pathname === '/dashboard' || // 登录成功后的初始重定向
    pathname.startsWith('/api/')
  ) {
    return NextResponse.next();
  }
  
  // 检查路径是否已经包含语言代码
  const pathnameIsMissingLocale = locales.every(
    locale => !pathname.startsWith(`/${locale}/`) && pathname !== `/${locale}`
  );
  
  // 如果路径中没有语言代码，则重定向到带有语言代码的路径
  if (pathnameIsMissingLocale) {
    const locale = getLocale(request);
    
    // 创建新的 URL 对象
    const newUrl = new URL(`/${locale}${pathname}`, request.url);
    // 保留查询参数
    newUrl.search = request.nextUrl.search;
    
    // 重定向到带有语言代码的路径
    return NextResponse.redirect(newUrl);
  }
  
  return NextResponse.next();
}

// 配置中间件匹配的路径
export const config = {
  // 匹配所有路径，除了 api 路由、静态文件和其他资源
  matcher: ['/((?!api|_next/static|_next/image|favicon.ico|.*\\..*).*)'],
};
