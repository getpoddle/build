/// <reference types="vitest" />
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  optimizeDeps: {
    exclude: ['lucide-react'],
  },
  build: {
    target: 'es2015',
    sourcemap: true,
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('node_modules/react') || id.includes('node_modules/react-dom')) {
            return 'vendor';
          }
          if (id.includes('node_modules/@supabase')) {
            return 'supabase';
          }
          if (id.includes('node_modules/lucide-react')) {
            return 'icons';
          }
          if (id.includes('node_modules/posthog-js')) {
            return 'posthog';
          }
          if (id.includes('/pages/Admin') || id.includes('/pages/AdminPanel') || id.includes('/pages/AdminDashboard') || id.includes('/pages/AdminAuth') || id.includes('/components/admin/')) {
            return 'Admin';
          }
          if (id.includes('/pages/WorkspaceHub') || id.includes('/pages/WorkspaceSettings') || id.includes('/pages/Workspaces') || id.includes('/pages/JoinWorkspace') || id.includes('/components/WorkspaceChat') || id.includes('/components/WorkspaceWarRoom') || id.includes('/lib/pdfExport')) {
            return 'WorkspaceHub';
          }
          if (id.includes('/pages/ReasoningHub') || id.includes('/pages/EntityDetail') || id.includes('/pages/AgentPredictions')) {
            return 'ReasoningHub';
          }
          if (id.includes('/pages/Pricing') || id.includes('/pages/PaymentSuccess') || id.includes('/components/UpgradePrompt')) {
            return 'Pricing';
          }
          if (id.includes('/pages/Profile') || id.includes('/pages/AIFeed') || id.includes('/pages/Onboarding')) {
            return 'UserPages';
          }
        },
      },
    },
  },
  server: {
    host: true,
    port: 5173,
  },
  test: {
    environment: 'node',
    include: ['src/tests/**/*.test.ts'],
  },
});
