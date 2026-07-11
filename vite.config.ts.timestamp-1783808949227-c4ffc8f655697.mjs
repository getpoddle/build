// vite.config.ts
import { defineConfig } from "file:///home/project/node_modules/vite/dist/node/index.js";
import react from "file:///home/project/node_modules/@vitejs/plugin-react/dist/index.mjs";
var vite_config_default = defineConfig({
  plugins: [react()],
  optimizeDeps: {
    exclude: ["lucide-react"]
  },
  build: {
    target: "es2015",
    sourcemap: true,
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes("node_modules/react") || id.includes("node_modules/react-dom")) {
            return "vendor";
          }
          if (id.includes("node_modules/@supabase")) {
            return "supabase";
          }
          if (id.includes("node_modules/lucide-react")) {
            return "icons";
          }
          if (id.includes("node_modules/posthog-js")) {
            return "posthog";
          }
          if (id.includes("/pages/Admin") || id.includes("/pages/AdminPanel") || id.includes("/pages/AdminDashboard") || id.includes("/pages/AdminAuth") || id.includes("/components/admin/")) {
            return "Admin";
          }
          if (id.includes("/pages/WorkspaceHub") || id.includes("/pages/WorkspaceSettings") || id.includes("/pages/Workspaces") || id.includes("/pages/JoinWorkspace") || id.includes("/components/WorkspaceChat") || id.includes("/components/WorkspaceWarRoom") || id.includes("/lib/pdfExport")) {
            return "WorkspaceHub";
          }
          if (id.includes("/pages/ReasoningHub") || id.includes("/pages/EntityDetail") || id.includes("/pages/AgentPredictions")) {
            return "ReasoningHub";
          }
          if (id.includes("/pages/Pricing") || id.includes("/pages/PaymentSuccess") || id.includes("/components/UpgradePrompt")) {
            return "Pricing";
          }
          if (id.includes("/pages/Profile") || id.includes("/pages/AIFeed") || id.includes("/pages/Onboarding")) {
            return "UserPages";
          }
        }
      }
    }
  },
  server: {
    host: true,
    port: 5173
  },
  test: {
    environment: "node",
    include: ["src/tests/**/*.test.ts"],
    coverage: {
      provider: "v8",
      reporter: ["text", "html"],
      include: ["supabase/functions/_shared/**/*.ts"],
      exclude: [
        "**/*.test.ts",
        "**/node_modules/**",
        "**/dist/**",
        "src/vite-env.d.ts",
        "supabase/functions/_shared/*.d.ts"
      ]
    }
  }
});
export {
  vite_config_default as default
};
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsidml0ZS5jb25maWcudHMiXSwKICAic291cmNlc0NvbnRlbnQiOiBbImNvbnN0IF9fdml0ZV9pbmplY3RlZF9vcmlnaW5hbF9kaXJuYW1lID0gXCIvaG9tZS9wcm9qZWN0XCI7Y29uc3QgX192aXRlX2luamVjdGVkX29yaWdpbmFsX2ZpbGVuYW1lID0gXCIvaG9tZS9wcm9qZWN0L3ZpdGUuY29uZmlnLnRzXCI7Y29uc3QgX192aXRlX2luamVjdGVkX29yaWdpbmFsX2ltcG9ydF9tZXRhX3VybCA9IFwiZmlsZTovLy9ob21lL3Byb2plY3Qvdml0ZS5jb25maWcudHNcIjsvLy8gPHJlZmVyZW5jZSB0eXBlcz1cInZpdGVzdFwiIC8+XG5pbXBvcnQgeyBkZWZpbmVDb25maWcgfSBmcm9tICd2aXRlJztcbmltcG9ydCByZWFjdCBmcm9tICdAdml0ZWpzL3BsdWdpbi1yZWFjdCc7XG5cbmV4cG9ydCBkZWZhdWx0IGRlZmluZUNvbmZpZyh7XG4gIHBsdWdpbnM6IFtyZWFjdCgpXSxcbiAgb3B0aW1pemVEZXBzOiB7XG4gICAgZXhjbHVkZTogWydsdWNpZGUtcmVhY3QnXSxcbiAgfSxcbiAgYnVpbGQ6IHtcbiAgICB0YXJnZXQ6ICdlczIwMTUnLFxuICAgIHNvdXJjZW1hcDogdHJ1ZSxcbiAgICByb2xsdXBPcHRpb25zOiB7XG4gICAgICBvdXRwdXQ6IHtcbiAgICAgICAgbWFudWFsQ2h1bmtzKGlkKSB7XG4gICAgICAgICAgaWYgKGlkLmluY2x1ZGVzKCdub2RlX21vZHVsZXMvcmVhY3QnKSB8fCBpZC5pbmNsdWRlcygnbm9kZV9tb2R1bGVzL3JlYWN0LWRvbScpKSB7XG4gICAgICAgICAgICByZXR1cm4gJ3ZlbmRvcic7XG4gICAgICAgICAgfVxuICAgICAgICAgIGlmIChpZC5pbmNsdWRlcygnbm9kZV9tb2R1bGVzL0BzdXBhYmFzZScpKSB7XG4gICAgICAgICAgICByZXR1cm4gJ3N1cGFiYXNlJztcbiAgICAgICAgICB9XG4gICAgICAgICAgaWYgKGlkLmluY2x1ZGVzKCdub2RlX21vZHVsZXMvbHVjaWRlLXJlYWN0JykpIHtcbiAgICAgICAgICAgIHJldHVybiAnaWNvbnMnO1xuICAgICAgICAgIH1cbiAgICAgICAgICBpZiAoaWQuaW5jbHVkZXMoJ25vZGVfbW9kdWxlcy9wb3N0aG9nLWpzJykpIHtcbiAgICAgICAgICAgIHJldHVybiAncG9zdGhvZyc7XG4gICAgICAgICAgfVxuICAgICAgICAgIGlmIChpZC5pbmNsdWRlcygnL3BhZ2VzL0FkbWluJykgfHwgaWQuaW5jbHVkZXMoJy9wYWdlcy9BZG1pblBhbmVsJykgfHwgaWQuaW5jbHVkZXMoJy9wYWdlcy9BZG1pbkRhc2hib2FyZCcpIHx8IGlkLmluY2x1ZGVzKCcvcGFnZXMvQWRtaW5BdXRoJykgfHwgaWQuaW5jbHVkZXMoJy9jb21wb25lbnRzL2FkbWluLycpKSB7XG4gICAgICAgICAgICByZXR1cm4gJ0FkbWluJztcbiAgICAgICAgICB9XG4gICAgICAgICAgaWYgKGlkLmluY2x1ZGVzKCcvcGFnZXMvV29ya3NwYWNlSHViJykgfHwgaWQuaW5jbHVkZXMoJy9wYWdlcy9Xb3Jrc3BhY2VTZXR0aW5ncycpIHx8IGlkLmluY2x1ZGVzKCcvcGFnZXMvV29ya3NwYWNlcycpIHx8IGlkLmluY2x1ZGVzKCcvcGFnZXMvSm9pbldvcmtzcGFjZScpIHx8IGlkLmluY2x1ZGVzKCcvY29tcG9uZW50cy9Xb3Jrc3BhY2VDaGF0JykgfHwgaWQuaW5jbHVkZXMoJy9jb21wb25lbnRzL1dvcmtzcGFjZVdhclJvb20nKSB8fCBpZC5pbmNsdWRlcygnL2xpYi9wZGZFeHBvcnQnKSkge1xuICAgICAgICAgICAgcmV0dXJuICdXb3Jrc3BhY2VIdWInO1xuICAgICAgICAgIH1cbiAgICAgICAgICBpZiAoaWQuaW5jbHVkZXMoJy9wYWdlcy9SZWFzb25pbmdIdWInKSB8fCBpZC5pbmNsdWRlcygnL3BhZ2VzL0VudGl0eURldGFpbCcpIHx8IGlkLmluY2x1ZGVzKCcvcGFnZXMvQWdlbnRQcmVkaWN0aW9ucycpKSB7XG4gICAgICAgICAgICByZXR1cm4gJ1JlYXNvbmluZ0h1Yic7XG4gICAgICAgICAgfVxuICAgICAgICAgIGlmIChpZC5pbmNsdWRlcygnL3BhZ2VzL1ByaWNpbmcnKSB8fCBpZC5pbmNsdWRlcygnL3BhZ2VzL1BheW1lbnRTdWNjZXNzJykgfHwgaWQuaW5jbHVkZXMoJy9jb21wb25lbnRzL1VwZ3JhZGVQcm9tcHQnKSkge1xuICAgICAgICAgICAgcmV0dXJuICdQcmljaW5nJztcbiAgICAgICAgICB9XG4gICAgICAgICAgaWYgKGlkLmluY2x1ZGVzKCcvcGFnZXMvUHJvZmlsZScpIHx8IGlkLmluY2x1ZGVzKCcvcGFnZXMvQUlGZWVkJykgfHwgaWQuaW5jbHVkZXMoJy9wYWdlcy9PbmJvYXJkaW5nJykpIHtcbiAgICAgICAgICAgIHJldHVybiAnVXNlclBhZ2VzJztcbiAgICAgICAgICB9XG4gICAgICAgIH0sXG4gICAgICB9LFxuICAgIH0sXG4gIH0sXG4gIHNlcnZlcjoge1xuICAgIGhvc3Q6IHRydWUsXG4gICAgcG9ydDogNTE3MyxcbiAgfSxcbiAgdGVzdDoge1xuICAgIGVudmlyb25tZW50OiAnbm9kZScsXG4gICAgaW5jbHVkZTogWydzcmMvdGVzdHMvKiovKi50ZXN0LnRzJ10sXG4gICAgY292ZXJhZ2U6IHtcbiAgICAgIHByb3ZpZGVyOiAndjgnLFxuICAgICAgcmVwb3J0ZXI6IFsndGV4dCcsICdodG1sJ10sXG4gICAgICBpbmNsdWRlOiBbJ3N1cGFiYXNlL2Z1bmN0aW9ucy9fc2hhcmVkLyoqLyoudHMnXSxcbiAgICAgIGV4Y2x1ZGU6IFtcbiAgICAgICAgJyoqLyoudGVzdC50cycsXG4gICAgICAgICcqKi9ub2RlX21vZHVsZXMvKionLFxuICAgICAgICAnKiovZGlzdC8qKicsXG4gICAgICAgICdzcmMvdml0ZS1lbnYuZC50cycsXG4gICAgICAgICdzdXBhYmFzZS9mdW5jdGlvbnMvX3NoYXJlZC8qLmQudHMnLFxuICAgICAgXSxcbiAgICB9LFxuICB9LFxufSk7XG4iXSwKICAibWFwcGluZ3MiOiAiO0FBQ0EsU0FBUyxvQkFBb0I7QUFDN0IsT0FBTyxXQUFXO0FBRWxCLElBQU8sc0JBQVEsYUFBYTtBQUFBLEVBQzFCLFNBQVMsQ0FBQyxNQUFNLENBQUM7QUFBQSxFQUNqQixjQUFjO0FBQUEsSUFDWixTQUFTLENBQUMsY0FBYztBQUFBLEVBQzFCO0FBQUEsRUFDQSxPQUFPO0FBQUEsSUFDTCxRQUFRO0FBQUEsSUFDUixXQUFXO0FBQUEsSUFDWCxlQUFlO0FBQUEsTUFDYixRQUFRO0FBQUEsUUFDTixhQUFhLElBQUk7QUFDZixjQUFJLEdBQUcsU0FBUyxvQkFBb0IsS0FBSyxHQUFHLFNBQVMsd0JBQXdCLEdBQUc7QUFDOUUsbUJBQU87QUFBQSxVQUNUO0FBQ0EsY0FBSSxHQUFHLFNBQVMsd0JBQXdCLEdBQUc7QUFDekMsbUJBQU87QUFBQSxVQUNUO0FBQ0EsY0FBSSxHQUFHLFNBQVMsMkJBQTJCLEdBQUc7QUFDNUMsbUJBQU87QUFBQSxVQUNUO0FBQ0EsY0FBSSxHQUFHLFNBQVMseUJBQXlCLEdBQUc7QUFDMUMsbUJBQU87QUFBQSxVQUNUO0FBQ0EsY0FBSSxHQUFHLFNBQVMsY0FBYyxLQUFLLEdBQUcsU0FBUyxtQkFBbUIsS0FBSyxHQUFHLFNBQVMsdUJBQXVCLEtBQUssR0FBRyxTQUFTLGtCQUFrQixLQUFLLEdBQUcsU0FBUyxvQkFBb0IsR0FBRztBQUNuTCxtQkFBTztBQUFBLFVBQ1Q7QUFDQSxjQUFJLEdBQUcsU0FBUyxxQkFBcUIsS0FBSyxHQUFHLFNBQVMsMEJBQTBCLEtBQUssR0FBRyxTQUFTLG1CQUFtQixLQUFLLEdBQUcsU0FBUyxzQkFBc0IsS0FBSyxHQUFHLFNBQVMsMkJBQTJCLEtBQUssR0FBRyxTQUFTLDhCQUE4QixLQUFLLEdBQUcsU0FBUyxnQkFBZ0IsR0FBRztBQUN4UixtQkFBTztBQUFBLFVBQ1Q7QUFDQSxjQUFJLEdBQUcsU0FBUyxxQkFBcUIsS0FBSyxHQUFHLFNBQVMscUJBQXFCLEtBQUssR0FBRyxTQUFTLHlCQUF5QixHQUFHO0FBQ3RILG1CQUFPO0FBQUEsVUFDVDtBQUNBLGNBQUksR0FBRyxTQUFTLGdCQUFnQixLQUFLLEdBQUcsU0FBUyx1QkFBdUIsS0FBSyxHQUFHLFNBQVMsMkJBQTJCLEdBQUc7QUFDckgsbUJBQU87QUFBQSxVQUNUO0FBQ0EsY0FBSSxHQUFHLFNBQVMsZ0JBQWdCLEtBQUssR0FBRyxTQUFTLGVBQWUsS0FBSyxHQUFHLFNBQVMsbUJBQW1CLEdBQUc7QUFDckcsbUJBQU87QUFBQSxVQUNUO0FBQUEsUUFDRjtBQUFBLE1BQ0Y7QUFBQSxJQUNGO0FBQUEsRUFDRjtBQUFBLEVBQ0EsUUFBUTtBQUFBLElBQ04sTUFBTTtBQUFBLElBQ04sTUFBTTtBQUFBLEVBQ1I7QUFBQSxFQUNBLE1BQU07QUFBQSxJQUNKLGFBQWE7QUFBQSxJQUNiLFNBQVMsQ0FBQyx3QkFBd0I7QUFBQSxJQUNsQyxVQUFVO0FBQUEsTUFDUixVQUFVO0FBQUEsTUFDVixVQUFVLENBQUMsUUFBUSxNQUFNO0FBQUEsTUFDekIsU0FBUyxDQUFDLG9DQUFvQztBQUFBLE1BQzlDLFNBQVM7QUFBQSxRQUNQO0FBQUEsUUFDQTtBQUFBLFFBQ0E7QUFBQSxRQUNBO0FBQUEsUUFDQTtBQUFBLE1BQ0Y7QUFBQSxJQUNGO0FBQUEsRUFDRjtBQUNGLENBQUM7IiwKICAibmFtZXMiOiBbXQp9Cg==
