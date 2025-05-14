import { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Shared Conversation',
  description: 'View a shared AI conversation',
  openGraph: {
    title: 'Shared AI Conversation',
    description: 'View a shared AI conversation from CloudOne Helios',
    images: ['/cloudone-logo.png'],
  },
};

export default function ThreadLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
} 