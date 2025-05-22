"use client";

import { useFormStatus } from "react-dom";
import { useEffect, useState } from "react";
import { type ComponentProps } from "react";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "./alert";
import { AlertTriangle } from "lucide-react";
import { useRouter } from "next/navigation";

type Props = Omit<ComponentProps<typeof Button>, 'formAction'> & {
  pendingText?: string;
  formAction: (prevState: any, formData: FormData) => Promise<any>;
  errorMessage?: string;
};

const initialState = {
  message: "",
};

export function SubmitButtonWithRedirect({ children, formAction, errorMessage, pendingText = "Submitting...", ...props }: Props) {
  const { pending } = useFormStatus();
  const [state, setState] = useState(initialState);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const router = useRouter();

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setIsSubmitting(true);

    try {
      const formData = new FormData(event.currentTarget);
      const result = await formAction(state, formData);
      
      console.log("Form submission result:", result);
      
      if (result?.success && result?.url) {
        console.log("Redirecting to:", result.url);
        // 使用window.location直接跳转，而不是使用Next.js的router
        window.location.href = result.url;
      } else if (result?.error) {
        setState({ message: result.error.message || "An error occurred" });
      }
    } catch (error) {
      console.error("Form submission error:", error);
      setState({ message: "An unexpected error occurred" });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="flex flex-col gap-y-4 w-full">
      {Boolean(errorMessage || state?.message) && (
        <Alert variant="destructive" className="w-full">
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>
            {errorMessage || state?.message}
          </AlertDescription>
        </Alert>
      )}
      <form onSubmit={handleSubmit}>
        {props.children}
        <Button {...props} type="submit" aria-disabled={pending || isSubmitting}>
          {isSubmitting ? pendingText : children}
        </Button>
      </form>
    </div>
  );
}
