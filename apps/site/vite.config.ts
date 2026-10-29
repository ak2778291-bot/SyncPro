import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// Static pre-launch site for syncpro.org — no backend, no proxy.
export default defineConfig({
  plugins: [react()],
});
