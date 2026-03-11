import { spawn } from 'child_process';
import os from 'os';

const isWindows = os.platform() === 'win32';
const dockerCmd = 'docker';
const dockerComposeCmd = 'docker-compose';

async function run(cmd, args) {
  return new Promise((resolve, reject) => {
    console.log(`> Running: ${cmd} ${args.join(' ')}`);
    const proc = spawn(cmd, args, { stdio: 'inherit', shell: true });
    proc.on('close', (code) => {
      if (code === 0) resolve();
      else reject(new Error(`Command failed with code ${code}`));
    });
  });
}

async function main() {
  try {

    await run(dockerCmd, ['--version']);

    console.log('--- Starting Optimized Multi-Platform Build ---');

    await run(dockerCmd, ['compose', 'build', '--parallel', '--pull']);

    console.log('--- Build Successful. Starting Containers ---');
    await run(dockerCmd, ['compose', 'up', '-d']);

    console.log('\n✅ Nexus AI is now running!');
    console.log('Frontend: http://localhost:3004');
    console.log('Backend:  http://localhost:3001');
    console.log('\nUse "docker compose logs -f" to see logs.');

  } catch (err) {
    console.error(`\n❌ Error during build/start: ${err.message}`);
    process.exit(1);
  }
}

main();