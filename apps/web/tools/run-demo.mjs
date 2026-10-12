import { spawn } from 'node:child_process';
import { createConnection } from 'node:net';
import { createRequire } from 'node:module';
import path from 'node:path';
import process from 'node:process';
import { log } from 'node:console';
import { demoDataDir, seedDemo, webRoot } from './seed-demo.mjs';

const port = 3000;
const busy = await new Promise((resolve) => {
  const socket = createConnection({ host: '127.0.0.1', port });
  socket.once('connect', () => {
    socket.destroy();
    resolve(true);
  });
  socket.once('error', () => resolve(false));
});
if (busy) {
  log(
    'ポート3000を使用中です。通常の開発サーバーを停止してから pnpm dev:demo を実行してください。',
  );
  process.exitCode = 1;
} else {
  const result = await seedDemo();
  log(`デモモード: ${result.days}日分の記録。通常DBは変更しません。`);
  const require = createRequire(path.join(webRoot, 'package.json'));
  const child = spawn(
    process.execPath,
    [
      require.resolve('next/dist/bin/next'),
      'dev',
      '--hostname',
      '0.0.0.0',
      '--port',
      String(port),
    ],
    {
      cwd: webRoot,
      stdio: 'inherit',
      env: {
        ...process.env,
        DATABASE_URL: '',
        PGLITE_DATA_DIR: demoDataDir,
        CALORIE_ESTIMATOR: 'mock',
      },
    },
  );
  child.once('exit', (code) => {
    process.exitCode = code ?? 0;
  });
  for (const signal of ['SIGINT', 'SIGTERM'])
    process.once(signal, () => child.kill(signal));
}
