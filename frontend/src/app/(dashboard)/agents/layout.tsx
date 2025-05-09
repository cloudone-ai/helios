import { Metadata } from "next";

export const metadata: Metadata = {
  title: "Agent Conversation | CloudOne Helios",
  description: "Interactive agent conversation powered by CloudOne Helios",
  openGraph: {
    title: "Agent Conversation | CloudOne Helios",
    description: "Interactive agent conversation powered by CloudOne Helios",
    type: "website",
  },
};

export default function AgentsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
} 