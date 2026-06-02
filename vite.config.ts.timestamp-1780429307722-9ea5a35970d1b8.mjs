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
    sourcemap: false,
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
  }
});
export {
  vite_config_default as default
};
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsidml0ZS5jb25maWcudHMiXSwKICAic291cmNlc0NvbnRlbnQiOiBbImNvbnN0IF9fdml0ZV9pbmplY3RlZF9vcmlnaW5hbF9kaXJuYW1lID0gXCIvaG9tZS9wcm9qZWN0XCI7Y29uc3QgX192aXRlX2luamVjdGVkX29yaWdpbmFsX2ZpbGVuYW1lID0gXCIvaG9tZS9wcm9qZWN0L3ZpdGUuY29uZmlnLnRzXCI7Y29uc3QgX192aXRlX2luamVjdGVkX29yaWdpbmFsX2ltcG9ydF9tZXRhX3VybCA9IFwiZmlsZTovLy9ob21lL3Byb2plY3Qvdml0ZS5jb25maWcudHNcIjtpbXBvcnQgeyBkZWZpbmVDb25maWcgfSBmcm9tICd2aXRlJztcbmltcG9ydCByZWFjdCBmcm9tICdAdml0ZWpzL3BsdWdpbi1yZWFjdCc7XG5cbmV4cG9ydCBkZWZhdWx0IGRlZmluZUNvbmZpZyh7XG4gIHBsdWdpbnM6IFtyZWFjdCgpXSxcbiAgb3B0aW1pemVEZXBzOiB7XG4gICAgZXhjbHVkZTogWydsdWNpZGUtcmVhY3QnXSxcbiAgfSxcbiAgYnVpbGQ6IHtcbiAgICB0YXJnZXQ6ICdlczIwMTUnLFxuICAgIHNvdXJjZW1hcDogZmFsc2UsXG4gICAgcm9sbHVwT3B0aW9uczoge1xuICAgICAgb3V0cHV0OiB7XG4gICAgICAgIG1hbnVhbENodW5rcyhpZCkge1xuICAgICAgICAgIGlmIChpZC5pbmNsdWRlcygnbm9kZV9tb2R1bGVzL3JlYWN0JykgfHwgaWQuaW5jbHVkZXMoJ25vZGVfbW9kdWxlcy9yZWFjdC1kb20nKSkge1xuICAgICAgICAgICAgcmV0dXJuICd2ZW5kb3InO1xuICAgICAgICAgIH1cbiAgICAgICAgICBpZiAoaWQuaW5jbHVkZXMoJ25vZGVfbW9kdWxlcy9Ac3VwYWJhc2UnKSkge1xuICAgICAgICAgICAgcmV0dXJuICdzdXBhYmFzZSc7XG4gICAgICAgICAgfVxuICAgICAgICAgIGlmIChpZC5pbmNsdWRlcygnbm9kZV9tb2R1bGVzL2x1Y2lkZS1yZWFjdCcpKSB7XG4gICAgICAgICAgICByZXR1cm4gJ2ljb25zJztcbiAgICAgICAgICB9XG4gICAgICAgICAgaWYgKGlkLmluY2x1ZGVzKCdub2RlX21vZHVsZXMvcG9zdGhvZy1qcycpKSB7XG4gICAgICAgICAgICByZXR1cm4gJ3Bvc3Rob2cnO1xuICAgICAgICAgIH1cbiAgICAgICAgICBpZiAoaWQuaW5jbHVkZXMoJy9wYWdlcy9BZG1pbicpIHx8IGlkLmluY2x1ZGVzKCcvcGFnZXMvQWRtaW5QYW5lbCcpIHx8IGlkLmluY2x1ZGVzKCcvcGFnZXMvQWRtaW5EYXNoYm9hcmQnKSB8fCBpZC5pbmNsdWRlcygnL3BhZ2VzL0FkbWluQXV0aCcpIHx8IGlkLmluY2x1ZGVzKCcvY29tcG9uZW50cy9hZG1pbi8nKSkge1xuICAgICAgICAgICAgcmV0dXJuICdBZG1pbic7XG4gICAgICAgICAgfVxuICAgICAgICAgIGlmIChpZC5pbmNsdWRlcygnL3BhZ2VzL1dvcmtzcGFjZUh1YicpIHx8IGlkLmluY2x1ZGVzKCcvcGFnZXMvV29ya3NwYWNlU2V0dGluZ3MnKSB8fCBpZC5pbmNsdWRlcygnL3BhZ2VzL1dvcmtzcGFjZXMnKSB8fCBpZC5pbmNsdWRlcygnL3BhZ2VzL0pvaW5Xb3Jrc3BhY2UnKSB8fCBpZC5pbmNsdWRlcygnL2NvbXBvbmVudHMvV29ya3NwYWNlQ2hhdCcpIHx8IGlkLmluY2x1ZGVzKCcvY29tcG9uZW50cy9Xb3Jrc3BhY2VXYXJSb29tJykgfHwgaWQuaW5jbHVkZXMoJy9saWIvcGRmRXhwb3J0JykpIHtcbiAgICAgICAgICAgIHJldHVybiAnV29ya3NwYWNlSHViJztcbiAgICAgICAgICB9XG4gICAgICAgICAgaWYgKGlkLmluY2x1ZGVzKCcvcGFnZXMvUmVhc29uaW5nSHViJykgfHwgaWQuaW5jbHVkZXMoJy9wYWdlcy9FbnRpdHlEZXRhaWwnKSB8fCBpZC5pbmNsdWRlcygnL3BhZ2VzL0FnZW50UHJlZGljdGlvbnMnKSkge1xuICAgICAgICAgICAgcmV0dXJuICdSZWFzb25pbmdIdWInO1xuICAgICAgICAgIH1cbiAgICAgICAgICBpZiAoaWQuaW5jbHVkZXMoJy9wYWdlcy9QcmljaW5nJykgfHwgaWQuaW5jbHVkZXMoJy9wYWdlcy9QYXltZW50U3VjY2VzcycpIHx8IGlkLmluY2x1ZGVzKCcvY29tcG9uZW50cy9VcGdyYWRlUHJvbXB0JykpIHtcbiAgICAgICAgICAgIHJldHVybiAnUHJpY2luZyc7XG4gICAgICAgICAgfVxuICAgICAgICAgIGlmIChpZC5pbmNsdWRlcygnL3BhZ2VzL1Byb2ZpbGUnKSB8fCBpZC5pbmNsdWRlcygnL3BhZ2VzL0FJRmVlZCcpIHx8IGlkLmluY2x1ZGVzKCcvcGFnZXMvT25ib2FyZGluZycpKSB7XG4gICAgICAgICAgICByZXR1cm4gJ1VzZXJQYWdlcyc7XG4gICAgICAgICAgfVxuICAgICAgICB9LFxuICAgICAgfSxcbiAgICB9LFxuICB9LFxuICBzZXJ2ZXI6IHtcbiAgICBob3N0OiB0cnVlLFxuICAgIHBvcnQ6IDUxNzMsXG4gIH0sXG59KTtcbiJdLAogICJtYXBwaW5ncyI6ICI7QUFBeU4sU0FBUyxvQkFBb0I7QUFDdFAsT0FBTyxXQUFXO0FBRWxCLElBQU8sc0JBQVEsYUFBYTtBQUFBLEVBQzFCLFNBQVMsQ0FBQyxNQUFNLENBQUM7QUFBQSxFQUNqQixjQUFjO0FBQUEsSUFDWixTQUFTLENBQUMsY0FBYztBQUFBLEVBQzFCO0FBQUEsRUFDQSxPQUFPO0FBQUEsSUFDTCxRQUFRO0FBQUEsSUFDUixXQUFXO0FBQUEsSUFDWCxlQUFlO0FBQUEsTUFDYixRQUFRO0FBQUEsUUFDTixhQUFhLElBQUk7QUFDZixjQUFJLEdBQUcsU0FBUyxvQkFBb0IsS0FBSyxHQUFHLFNBQVMsd0JBQXdCLEdBQUc7QUFDOUUsbUJBQU87QUFBQSxVQUNUO0FBQ0EsY0FBSSxHQUFHLFNBQVMsd0JBQXdCLEdBQUc7QUFDekMsbUJBQU87QUFBQSxVQUNUO0FBQ0EsY0FBSSxHQUFHLFNBQVMsMkJBQTJCLEdBQUc7QUFDNUMsbUJBQU87QUFBQSxVQUNUO0FBQ0EsY0FBSSxHQUFHLFNBQVMseUJBQXlCLEdBQUc7QUFDMUMsbUJBQU87QUFBQSxVQUNUO0FBQ0EsY0FBSSxHQUFHLFNBQVMsY0FBYyxLQUFLLEdBQUcsU0FBUyxtQkFBbUIsS0FBSyxHQUFHLFNBQVMsdUJBQXVCLEtBQUssR0FBRyxTQUFTLGtCQUFrQixLQUFLLEdBQUcsU0FBUyxvQkFBb0IsR0FBRztBQUNuTCxtQkFBTztBQUFBLFVBQ1Q7QUFDQSxjQUFJLEdBQUcsU0FBUyxxQkFBcUIsS0FBSyxHQUFHLFNBQVMsMEJBQTBCLEtBQUssR0FBRyxTQUFTLG1CQUFtQixLQUFLLEdBQUcsU0FBUyxzQkFBc0IsS0FBSyxHQUFHLFNBQVMsMkJBQTJCLEtBQUssR0FBRyxTQUFTLDhCQUE4QixLQUFLLEdBQUcsU0FBUyxnQkFBZ0IsR0FBRztBQUN4UixtQkFBTztBQUFBLFVBQ1Q7QUFDQSxjQUFJLEdBQUcsU0FBUyxxQkFBcUIsS0FBSyxHQUFHLFNBQVMscUJBQXFCLEtBQUssR0FBRyxTQUFTLHlCQUF5QixHQUFHO0FBQ3RILG1CQUFPO0FBQUEsVUFDVDtBQUNBLGNBQUksR0FBRyxTQUFTLGdCQUFnQixLQUFLLEdBQUcsU0FBUyx1QkFBdUIsS0FBSyxHQUFHLFNBQVMsMkJBQTJCLEdBQUc7QUFDckgsbUJBQU87QUFBQSxVQUNUO0FBQ0EsY0FBSSxHQUFHLFNBQVMsZ0JBQWdCLEtBQUssR0FBRyxTQUFTLGVBQWUsS0FBSyxHQUFHLFNBQVMsbUJBQW1CLEdBQUc7QUFDckcsbUJBQU87QUFBQSxVQUNUO0FBQUEsUUFDRjtBQUFBLE1BQ0Y7QUFBQSxJQUNGO0FBQUEsRUFDRjtBQUFBLEVBQ0EsUUFBUTtBQUFBLElBQ04sTUFBTTtBQUFBLElBQ04sTUFBTTtBQUFBLEVBQ1I7QUFDRixDQUFDOyIsCiAgIm5hbWVzIjogW10KfQo=
