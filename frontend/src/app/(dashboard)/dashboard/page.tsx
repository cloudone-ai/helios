"use client";

import React, { useState, Suspense, useEffect, useRef } from 'react';
import { Skeleton } from "@/components/ui/skeleton";
import { useRouter } from 'next/navigation';
import { Menu } from "lucide-react";
import { ChatInput, ChatInputHandles } from '@/components/thread/chat-input';
import { initiateAgent, createThread, addUserMessage, startAgent, createProject } from "@/lib/api";
import { generateThreadName } from "@/lib/actions/threads";
import { useIsMobile } from "@/hooks/use-mobile";
import { useSidebar } from "@/components/ui/sidebar";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { useBillingError } from "@/hooks/useBillingError";
import { BillingErrorAlert } from "@/components/billing/usage-limit-alert";
import { useAccounts } from "@/hooks/use-accounts";
import { isLocalMode } from "@/lib/config";
import { toast } from "sonner";

// Constant for localStorage key to ensure consistency
const PENDING_PROMPT_KEY = 'pendingAgentPrompt';

function DashboardContent() {
  const [inputValue, setInputValue] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [autoSubmit, setAutoSubmit] = useState(false);
  const { billingError, handleBillingError, clearBillingError } = useBillingError();
  const router = useRouter();
  const isMobile = useIsMobile();
  const { setOpenMobile } = useSidebar();
  const { data: accounts } = useAccounts();
  const personalAccount = accounts?.find(account => account.personal_account);
  const chatInputRef = useRef<ChatInputHandles>(null);

  const handleSubmit = async (message: string, options?: { model_name?: string; enable_thinking?: boolean }) => {
    if ((!message.trim() && !(chatInputRef.current?.getPendingFiles().length)) || isSubmitting) return;

    setIsSubmitting(true);

    try {
      // Check if any files are attached
      const files = chatInputRef.current?.getPendingFiles() || [];

      // Clear localStorage if this is a successful submission
      localStorage.removeItem(PENDING_PROMPT_KEY);

      if (files.length > 0) {
        // Create a FormData instance
        const formData = new FormData();

        // Append the message
        formData.append('prompt', message);

        // Append all files
        files.forEach(file => {
          formData.append('files', file);
        });

        // Add any additional options
        if (options) {
          formData.append('options', JSON.stringify(options));
        }

        // Call initiateAgent API
        const result = await initiateAgent(formData);
        console.log('Agent initiated with files:', result);

        // Navigate to the thread
        if (result.thread_id) {
          router.push(`/agents/${result.thread_id}`);
        }
      } else {
        // ---- Text-only messages ----
        // 1. Generate a project name
        const projectName = await generateThreadName(message);

        // 2. Create the project
        // Assuming createProject gets the account_id from the logged-in user
        const newProject = await createProject({
          name: projectName,
          description: "", // Or derive a description if desired
        });

        // 3. Create the thread using the new project ID
        const thread = await createThread(newProject.id); // <-- Pass the actual project ID

        // 4. Then add the user message
        await addUserMessage(thread.thread_id, message);

        // 5. Start the agent on this thread with the options
        await startAgent(thread.thread_id, options);

        // 6. Navigate to thread
        router.push(`/agents/${thread.thread_id}`);
      }
    } catch (error: any) {
      // Log line 85 might be here if createThread or initiateAgent fails
      console.error('Error creating thread or initiating agent:', error);

      // Skip billing error checks in local development mode
      if (isLocalMode()) {
        console.log("Running in local development mode - billing checks are disabled");
      } else {
        // Check specifically for billing errors (402 Payment Required)
        if (error.message?.includes('(402)') || error?.status === 402) {
          console.log("Billing error detected:", error);

          // Try to extract the error details from the error object
          try {
            // Try to parse the error.response or the error itself
            let errorDetails;

            // First attempt: check if error.data exists and has a detail property
            if (error.data?.detail) {
              errorDetails = error.data.detail;
              console.log("Extracted billing error details from error.data.detail:", errorDetails);
            }
            // Second attempt: check if error.detail exists directly
            else if (error.detail) {
              errorDetails = error.detail;
              console.log("Extracted billing error details from error.detail:", errorDetails);
            }
            // Third attempt: try to parse the error text if it's JSON
            else if (typeof error.text === 'function') {
              const text = await error.text();
              console.log("Extracted error text:", text);
              try {
                const parsed = JSON.parse(text);
                errorDetails = parsed.detail || parsed;
                console.log("Parsed error text as JSON:", errorDetails);
              } catch (e) {
                // Not JSON, use regex to extract info
                console.log("Error text is not valid JSON");
              }
            }

            // If we still don't have details, try to extract from the error message
            if (!errorDetails && error.message) {
              const match = error.message.match(/Monthly limit of (\d+) minutes reached/);
              if (match) {
                const minutes = parseInt(match[1]);
                errorDetails = {
                  message: error.message,
                  subscription: {
                    price_id: "price_1RGJ9GG6l1KZGqIroxSqgphC", // Free tier by default
                    plan_name: "Free",
                    current_usage: minutes / 60, // Convert to hours
                    limit: minutes / 60 // Convert to hours
                  }
                };
                console.log("Extracted billing error details from error message:", errorDetails);
              }
            }

            // Handle the billing error with the details we extracted
            if (errorDetails) {
              console.log("Handling billing error with extracted details:", errorDetails);
              handleBillingError(errorDetails);
            } else {
              // Fallback with generic billing error
              console.log("Using fallback generic billing error");
              handleBillingError({
                message: "You've reached your monthly usage limit. Please upgrade your plan.",
                subscription: {
                  price_id: "price_1RGJ9GG6l1KZGqIroxSqgphC", // Free tier
                  plan_name: "Free"
                }
              });
            }
          } catch (parseError) {
            console.error("Error parsing billing error details:", parseError);
            // Fallback with generic error
            handleBillingError({
              message: "You've reached your monthly usage limit. Please upgrade your plan."
            });
          }

          // Don't rethrow - we've handled this error with the billing alert
          setIsSubmitting(false); // Stop submission process on billing error
          return; // Exit handleSubmit
        }
      }

      // Handle other errors or rethrow
      // The second log (line 174) might happen here if startAgent fails, for example
      toast.error(error.message || "An error occurred");
      console.error("Error creating agent:", error);
      setIsSubmitting(false); // Reset submitting state on other errors too
    }
    // Removed finally block as catch now handles resetting isSubmitting
  };

  // Check for pending prompt in localStorage on mount
  useEffect(() => {
    // Use a small delay to ensure we're fully mounted
    const timer = setTimeout(() => {
      const pendingPrompt = localStorage.getItem(PENDING_PROMPT_KEY);
      
      if (pendingPrompt) {
        setInputValue(pendingPrompt);
        setAutoSubmit(true); // Flag to auto-submit after mounting
      }
    }, 200);
    
    return () => clearTimeout(timer);
  }, []);

  // Auto-submit the form if we have a pending prompt
  useEffect(() => {
    if (autoSubmit && inputValue && !isSubmitting) {
      const timer = setTimeout(() => {
        handleSubmit(inputValue);
        setAutoSubmit(false);
      }, 500);
      
      return () => clearTimeout(timer);
    }
  }, [autoSubmit, inputValue, isSubmitting]);

  return (
    <div className="flex flex-col items-center justify-center h-full w-full">
      {isMobile && (
        <div className="absolute top-4 left-4 z-10">
          <Tooltip>
            <TooltipTrigger asChild>
              <Button 
                variant="ghost" 
                size="icon"
                className="h-8 w-8" 
                onClick={() => setOpenMobile(true)}
              >
                <Menu className="h-4 w-4" />
                <span className="sr-only">Open menu</span>
              </Button>
            </TooltipTrigger>
            <TooltipContent>Open menu</TooltipContent>
          </Tooltip>
        </div>
      )}

      <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-[560px] max-w-[90%]">
        <div className="text-center mb-10">
          <h1 className="text-4xl font-medium text-foreground mb-2">Hey </h1>
          <h2 className="text-2xl text-muted-foreground">What would you like Helios to do today?</h2>
        </div>
        
        <ChatInput 
          ref={chatInputRef}
          onSubmit={handleSubmit} 
          loading={isSubmitting}
          placeholder="Describe what you need help with..."
          value={inputValue}
          onChange={setInputValue}
          hideAttachments={false}
        />
      </div>
      
      {/* Billing Error Alert */}
      <BillingErrorAlert
        message={billingError?.message}
        currentUsage={billingError?.currentUsage || billingError?.subscription?.current_usage}
        limit={billingError?.limit || billingError?.subscription?.limit}
        accountId={personalAccount?.account_id}
        onDismiss={clearBillingError}
        isOpen={!!billingError}
      />
    </div>
  );
}

export default function DashboardPage() {
  return (
    <Suspense fallback={
      <div className="flex flex-col items-center justify-center h-full w-full">
        <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-[560px] max-w-[90%]">
          <div className="flex flex-col items-center text-center mb-10">
            <Skeleton className="h-10 w-40 mb-2" />
            <Skeleton className="h-7 w-56" />
          </div>
          
          <Skeleton className="w-full h-[100px] rounded-xl" />
          <div className="flex justify-center mt-3">
            <Skeleton className="h-5 w-16" />
          </div>
        </div>
      </div>
    }>
      <DashboardContent />
    </Suspense>
  );
}
