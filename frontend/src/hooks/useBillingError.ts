import { useState, useCallback, useEffect } from 'react';
import { isLocalMode } from '@/lib/config';
import { useTranslation } from '@/i18n/useTranslation';

interface BillingErrorState {
  message: string;
  currentUsage?: number;
  limit?: number;
  usagePercentage?: number;
  isWarning?: boolean; // 标记是否为警告（接近限制）而非错误（超出限制）
  subscription?: {
    price_id?: string;
    plan_name?: string;
    current_usage?: number;
    limit?: number;
    usage_percentage?: number;
  };
}

export function useBillingError() {
  const { t } = useTranslation();
  const [billingError, setBillingError] = useState<BillingErrorState | null>(null);
  
  // 添加对自定义计费错误事件的监听
  useEffect(() => {
    const handleBillingErrorEvent = (event: CustomEvent) => {
      if (event.detail) {
        handleBillingError(event.detail);
      }
    };
    
    // 添加事件监听器
    window.addEventListener('billing-error', handleBillingErrorEvent as EventListener);
    
    // 清理函数
    return () => {
      window.removeEventListener('billing-error', handleBillingErrorEvent as EventListener);
    };
  }, []);

  const handleBillingError = useCallback((error: any) => {
    // In local mode, don't process billing errors
    if (isLocalMode()) {
      console.log('Running in local development mode - billing checks are disabled');
      return false;
    }
    
    console.log('Processing potential billing error:', error);
    
    // Case 1: Error is already a formatted billing error detail object
    if (error && (error.message || error.subscription)) {
      const usagePercentage = error.usage_percentage || error.subscription?.usage_percentage;
      const isWarning = error.status === 402 || usagePercentage < 100;
      
      setBillingError({
        message: error.message || (isWarning 
          ? t('billing.approachingUsageMessage', { percentage: Math.round(usagePercentage || 0) })
          : t('billing.usageLimitExceededMessage')),
        currentUsage: error.currentUsage || error.subscription?.current_usage,
        limit: error.limit || error.subscription?.limit,
        usagePercentage: usagePercentage,
        isWarning: isWarning,
        subscription: error.subscription || {}
      });
      return true;
    }
    
    // Case 2: Error is an HTTP error response with status code
    if (error.status === 402 || error.status === 407 || (error.message && error.message.includes('Payment Required'))) {
      // Try to get details from error.data.detail (common API pattern)
      const errorDetail = error.data?.detail || {};
      const subscription = errorDetail.subscription || {};
      const usagePercentage = errorDetail.usage_percentage || subscription.usage_percentage || 0;
      const isWarning = error.status === 402 || usagePercentage < 100;
      
      setBillingError({
        message: errorDetail.message || (isWarning 
          ? t('billing.approachingUsageMessage', { percentage: Math.round(usagePercentage) })
          : t('billing.usageLimitExceededMessage')),
        currentUsage: subscription.current_usage,
        limit: subscription.limit,
        usagePercentage: usagePercentage,
        isWarning: isWarning,
        subscription
      });
      return true;
    }

    // Not a billing error
    return false;
  }, []);

  const clearBillingError = useCallback(() => {
    setBillingError(null);
  }, []);

  return {
    billingError,
    handleBillingError,
    clearBillingError
  };
} 