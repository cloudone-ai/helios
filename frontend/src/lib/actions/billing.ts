"use server";

import { redirect } from "next/navigation";
import { createClient } from "../supabase/server";
import handleEdgeFunctionError from "../supabase/handle-edge-error";

export async function setupNewSubscription(prevState: any, formData: FormData) {
    try {
        const accountId = formData.get("accountId") as string;
        const returnUrl = formData.get("returnUrl") as string;
        const planId = formData.get("planId") as string;
        
        console.log('Setting up new subscription with:', { accountId, returnUrl, planId });
        
        // 检查是否在本地开发环境
        const isLocal = process.env.NEXT_PUBLIC_ENV_MODE === 'local';
        
        if (isLocal) {
            console.log('Running in local/development mode - simulating Stripe Checkout');
            // 在本地环境中，模拟 Stripe Checkout 流程
            console.log('Simulated payment process, returning success URL');
            
            // 不使用 redirect 函数，而是返回一个包含 URL 的对象
            return {
                success: true,
                message: "Simulated checkout in local mode",
                url: returnUrl
            };
        }
        
        const supabaseClient = await createClient();

        try {
            console.log('Invoking billing-functions with action: get_new_subscription_url');
            const { data, error } = await supabaseClient.functions.invoke('billing-functions', {
                body: {
                    action: "get_new_subscription_url",
                    args: {
                        account_id: accountId,
                        success_url: returnUrl,
                        cancel_url: returnUrl,
                        plan_id: planId
                    }
                }
            });

            console.log('Response from billing-functions:', { data, error });

            if (error) {
                console.error('Edge function error:', error);
                return await handleEdgeFunctionError(error);
            }

            if (!data?.url) {
                console.error('No URL returned from edge function');
                return {
                    error: {
                        message: "No URL returned from billing service. Please try again later.",
                        code: "NO_URL_RETURNED"
                    }
                };
            }

            console.log('Redirecting to:', data.url);
            return {
			    success: true,
			    url: data.url
			};
        } catch (invokeError) {
            console.error('Failed to invoke edge function:', invokeError);
            return {
                error: {
                    message: "Billing service is currently unavailable. Please try again later.",
                    code: "FUNCTION_INVOKE_ERROR",
                    details: JSON.stringify(invokeError)
                }
            };
        }
    } catch (error) {
        console.error('Unexpected error in setupNewSubscription:', error);
        return {
            error: {
                message: "An unexpected error occurred. Please try again later.",
                code: "UNEXPECTED_ERROR",
                details: JSON.stringify(error)
            }
        };
    }
};

export async function manageSubscription(prevState: any, formData: FormData) {
    try {
        const accountId = formData.get("accountId") as string;
        const returnUrl = formData.get("returnUrl") as string;
        
        console.log('Managing subscription for:', { accountId, returnUrl });
        
        // 检查是否在本地开发环境
        const isLocal = process.env.NEXT_PUBLIC_ENV_MODE === 'local';
        
        if (isLocal) {
            console.log('Running in local/development mode - simulating Stripe Billing Portal');
            // 在本地环境中，模拟 Stripe Billing Portal 流程
            console.log('Simulated billing portal visit, returning success URL');
            
            // 不使用 redirect 函数，而是返回一个包含 URL 的对象
            return {
                success: true,
                message: "Simulated billing portal in local mode",
                url: returnUrl
            };
        }
        
        const supabaseClient = await createClient();

        try {
            console.log('Invoking billing-functions with action: get_billing_portal_url');
            const { data, error } = await supabaseClient.functions.invoke('billing-functions', {
                body: {
                    action: "get_billing_portal_url",
                    args: {
                        account_id: accountId,
                        return_url: returnUrl
                    }
                }
            });

            console.log('Response from billing-functions:', { data, error });
            
            if (error) {
                console.error('Edge function error:', error);
                return await handleEdgeFunctionError(error);
            }

            if (!data?.url) {
                console.error('No URL returned from edge function');
                return {
                    error: {
                        message: "No URL returned from billing service. Please try again later.",
                        code: "NO_URL_RETURNED"
                    }
                };
            }

            console.log('Redirecting to:', data.url);
            return {
			    success: true,
			    url: data.url
			};
        } catch (invokeError) {
            console.error('Failed to invoke edge function:', invokeError);
            return {
                error: {
                    message: "Billing service is currently unavailable. Please try again later.",
                    code: "FUNCTION_INVOKE_ERROR",
                    details: JSON.stringify(invokeError)
                }
            };
        }
    } catch (error) {
        console.error('Unexpected error in manageSubscription:', error);
        return {
            error: {
                message: "An unexpected error occurred. Please try again later.",
                code: "UNEXPECTED_ERROR",
                details: JSON.stringify(error)
            }
        };
    }
};