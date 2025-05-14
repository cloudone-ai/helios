import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

export async function GET(request: Request) {
  // The `/auth/callback` route is required for the server-side auth flow implemented
  // by the SSR package. It exchanges an auth code for the user's session.
  // https://supabase.com/docs/guides/auth/server-side/nextjs
  const requestUrl = new URL(request.url);
  const code = requestUrl.searchParams.get("code");
  const returnUrl = requestUrl.searchParams.get("returnUrl");
  const origin = requestUrl.origin;

  if (code) {
    const supabase = await createClient();
    // 确保会话交换成功并记录结果
    const { data, error } = await supabase.auth.exchangeCodeForSession(code);
    
    if (error) {
      console.error('Error exchanging code for session:', error);
      // 如果交换失败，重定向到登录页面并显示错误
      return NextResponse.redirect(`${origin}/auth?error=${encodeURIComponent(error.message)}`);
    }
    
    // 确认用户已成功登录
    if (!data.session) {
      console.error('No session returned after code exchange');
      return NextResponse.redirect(`${origin}/auth?error=Authentication failed`);
    }
  }

  // URL to redirect to after sign up process completes
  // Handle the case where returnUrl is 'null' (string) or actual null
  const redirectPath = returnUrl && returnUrl !== 'null' ? returnUrl : '/dashboard';
  
  // 构建完整的重定向URL
  const fullRedirectUrl = `${origin}${redirectPath.startsWith('/') ? '' : '/'}${redirectPath}`;
  console.log('Redirecting to:', fullRedirectUrl);
  
  // 使用 307 临时重定向确保浏览器不会缓存重定向
  return NextResponse.redirect(fullRedirectUrl, { status: 307 });
}
