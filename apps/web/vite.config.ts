import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import net from 'net';

// ULTRAWORK: Smart Port Finder
// Logic: Start at 'start', check availability.
// If busy, increment by 'step' (default 5) to leave room for related processes.
async function getAvailablePort(start: number, step: number = 5): Promise<number> {
  const tryPort = (port: number): Promise<boolean> => {
    return new Promise((resolve) => {
      const server = net.createServer();
      server.unref();
      server.on('error', () => resolve(false));
      server.listen(port, () => {
        server.close(() => resolve(true));
      });
    });
  };

  let port = start;
  // Safety cap at 65535
  while (port < 65535) {
    if (await tryPort(port)) return port;
    port += step;
  }
  throw new Error('No available ports found in valid range.');
}

// https://vitejs.dev/config/
export default defineConfig(async () => {
  // Start at 3006 (Let Backend have 3005), then scan.
  const port = await getAvailablePort(3006, 5);
  
  console.log(`\n\n[ULTRAWORK] Assigned Frontend Port: ${port}\n\n`);

  return {
    plugins: [react()],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, './src'),
      },
    },
    server: {
      port,
      strictPort: true, // We found a good one, don't let Vite auto-increment by 1
      proxy: {
        '/api': {
          target: 'http://localhost:3005',
          changeOrigin: true,
        },
      },
    },
  };
});
