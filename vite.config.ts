import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import {defineConfig} from 'vite';

export default defineConfig(() => {
  return {
    plugins: [react(), tailwindcss()],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
    server: {
      // HMR is disabled in AI Studio via DISABLE_HMR env var.
      // Do not modifyâfile watching is disabled to prevent flickering during agent edits.
      hmr: process.env.DISABLE_HMR !== 'true',
      // Disable file watching when DISABLE_HMR is true to save CPU during agent edits.
      watch: process.env.DISABLE_HMR === 'true' ? null : {},
    },
    build: {
      rollupOptions: {
        output: {
          /*
            Vendor splitting.

            Route-level React.lazy in App.tsx separates the application code,
            but the three big third-party dependencies were still landing in
            one entry chunk with it: Firebase, Recharts and React. That means
            changing a single line of application code invalidates the browser
            cache for all of them.

            Splitting them out has two effects that matter here. They download
            in parallel with the entry chunk rather than after it, and — since
            they change only when a dependency is upgraded — they survive every
            application deploy in cache, where before a one-line copy change
            forced a fresh 700 kB of Firebase down the wire.

            Recharts is imported only by the inventory module, so vendor-charts
            is still fetched on demand: nothing pulls it in until somebody
            opens Inventory. It is a separate chunk rather than part of
            InventoryModule so that a second charting consumer later shares it
            instead of duplicating it.
          */
          manualChunks: (id: string) => {
            if (!id.includes('node_modules')) return undefined;
            if (id.includes('firebase') || id.includes('@firebase')) return 'vendor-firebase';
            if (id.includes('recharts') || id.includes('d3-') || id.includes('victory-vendor')) return 'vendor-charts';
            if (id.includes('react-dom') || id.includes('/react/') || id.includes('scheduler')) return 'vendor-react';
            return undefined;
          },
        },
      },
      // The remaining warning would be vendor-firebase, which cannot be split
      // further in any useful way. Raised so a real regression stands out.
      chunkSizeWarningLimit: 700,
    },
  };
});
