import { PropsWithChildren } from 'react';
import { BrowserRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import DemoNotice from '../components/common/DemoNotice';
import { AuthLifecycle } from '../features/auth/AuthProvider';
const queryClient = new QueryClient();
export function AppProviders({ children }: PropsWithChildren) {
  return <QueryClientProvider client={queryClient}><AuthLifecycle><BrowserRouter><DemoNotice />{children}</BrowserRouter></AuthLifecycle></QueryClientProvider>;
}
