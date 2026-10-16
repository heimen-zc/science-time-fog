import { lookup } from 'node:dns/promises';
import { createWriteStream } from 'node:fs';
import { mkdir, readFile, writeFile, rename, rm } from 'node:fs/promises';
import { isIP } from 'node:net';
import { dirname, resolve } from 'node:path';
import { Readable, Transform } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const work = resolve(root, 'work/agnes-faraday');
const storyboardPath = resolve(root, 'content/faraday-video.json');
const jobsPath = resolve(work, 'jobs.json');
const apiOrigin = 'https://apihub.agnes-ai.com';
const model = 'agnes-video-2.5-flash';
const command = process.argv[2] ?? 'status';
const queueRetries = Number(process.env.AGNES_QUEUE_RETRIES ?? 15);
const sleep = (ms) => new Promise((done) => setTimeout(done, ms));

async function readKey() {
  // COSEC: 密钥只从环境或隐藏的标准输入读取，不进入参数、文件和输出。
  if (process.env.AGNES_API_KEY) return process.env.AGNES_API_KEY.trim();
  if (!process.stdin.isTTY) {
    let input = '';
    for await (const chunk of process.stdin) input += chunk;
    return input.trim();
  }
  process.stdout.write('Agnes API key (hidden): ');
  process.stdin.setRawMode(true);
  process.stdin.resume();
  return new Promise((done, reject) => {
    let input = '';
    const finish = () => {
      process.stdin.removeListener('data', onData);
      process.stdin.setRawMode(false);
      process.stdin.pause();
      process.stdout.write('\n');
    };
    const onData = (chunk) => {
      for (const char of chunk.toString()) {
        if (char === '\u0003') {
          finish();
          reject(new Error('Cancelled.'));
          return;
        }
        if (char === '\r' || char === '\n') {
          finish();
          done(input.trim());
          return;
        }
        if (char === '\u007f' || char === '\b') input = input.slice(0, -1);
        else if (char >= ' ') input += char;
      }
    };
    process.stdin.on('data', onData);
  });
}

async function request(path, key, options = {}) {
  // COSEC: 认证请求固定官方 origin，禁止重定向，避免凭据被带到其他主机。
  const response = await fetch(new URL(path, apiOrigin), {
    ...options,
    headers: {
      Authorization: `Bearer ${key}`,
      'Content-Type': 'application/json',
    },
    redirect: 'error',
    signal: AbortSignal.timeout(90_000),
  });
  if (!response.ok) {
    // COSEC: 错误只输出限长纯文本摘要，并移除密钥、Bearer 与签名 URL。
    const detail = (await response.text())
      .replaceAll(key, '[REDACTED]')
      .replace(/sk-[A-Za-z0-9_-]+/g, '[REDACTED]')
      .replace(/Bearer\s+\S+/gi, 'Bearer [REDACTED]')
      .replace(/https?:\/\/[^\s"<>]+/g, '[URL]')
      .replace(/<[^>]*>/g, ' ')
      .replace(/\s+/g, ' ')
      .slice(0, 500);
    const hints = {
      400: 'Invalid video parameters; check the current Agnes documentation.',
      401: 'API key was rejected by Agnes. Check its validity.',
      402: 'Agnes account has insufficient credit.',
      403: 'This key does not have access to the requested model.',
      429: 'Agnes rate limit reached; existing jobs were preserved.',
    };
    const error = new Error(
      `Agnes HTTP ${response.status}: ${hints[response.status] ?? 'Request failed; existing jobs were preserved.'} ${detail}`,
    );
    error.queueFull =
      response.status === 503 && detail.includes('video_queue_full');
    throw error;
  }
  return response.json();
}

async function readJobs() {
  try {
    return JSON.parse(await readFile(jobsPath, 'utf8'));
  } catch (error) {
    if (error.code === 'ENOENT') return [];
    throw error;
  }
}

async function saveJobs(jobs) {
  await mkdir(work, { recursive: true });
  await writeFile(`${jobsPath}.partial`, JSON.stringify(jobs, null, 2), {
    mode: 0o600,
  });
  await rename(`${jobsPath}.partial`, jobsPath);
}

function publicAddress(address) {
  if (isIP(address) === 4) {
    const [a, b] = address.split('.').map(Number);
    return !(
      a === 0 ||
      a === 10 ||
      a === 127 ||
      a >= 224 ||
      (a === 100 && b >= 64 && b <= 127) ||
      (a === 169 && b === 254) ||
      (a === 172 && b >= 16 && b <= 31) ||
      (a === 192 && (b === 168 || b === 0)) ||
      (a === 198 && (b === 18 || b === 19))
    );
  }
  // COSEC: 下载仅接受全球单播 IPv6，阻断 loopback、链路本地与 IPv4 映射地址。
  return isIP(address) === 6 && /^[23][0-9a-f]{3}:/i.test(address);
}

async function download(url, destination) {
  let current = new URL(url);
  for (let redirects = 0; redirects < 5; redirects++) {
    // COSEC: CDN URL 来自供应商，但仍限制 HTTPS、公网地址与无凭据 URL。
    if (
      current.protocol !== 'https:' ||
      current.username ||
      current.password ||
      (current.port && current.port !== '443')
    )
      throw new Error('Unsafe media URL.');
    const addresses = await lookup(current.hostname, { all: true });
    if (
      !addresses.length ||
      addresses.some(({ address }) => !publicAddress(address))
    ) {
      throw new Error('Media URL must resolve only to public addresses.');
    }
    const response = await fetch(current, {
      redirect: 'manual',
      signal: AbortSignal.timeout(180_000),
    });
    if ([301, 302, 303, 307, 308].includes(response.status)) {
      const location = response.headers.get('location');
      await response.body?.cancel();
      if (!location) throw new Error('Missing media redirect.');
      current = new URL(location, current);
      continue;
    }
    if (!response.ok || !response.body)
      throw new Error(`Media download HTTP ${response.status}.`);
    if (
      !/video|octet-stream/i.test(response.headers.get('content-type') ?? '')
    ) {
      throw new Error('Response is not a video file.');
    }
    const limit = 150 * 1024 * 1024;
    if (Number(response.headers.get('content-length')) > limit)
      throw new Error('Video exceeds 150 MB.');
    let bytes = 0;
    const cap = new Transform({
      transform(chunk, encoding, done) {
        bytes += chunk.length;
        done(bytes > limit ? new Error('Video exceeds 150 MB.') : null, chunk);
      },
    });
    const temporary = `${destination}.partial`;
    try {
      await pipeline(
        Readable.fromWeb(response.body),
        cap,
        createWriteStream(temporary, { flags: 'wx', mode: 0o600 }),
      );
      await rename(temporary, destination);
    } catch (error) {
      await rm(temporary, { force: true });
      throw error;
    }
    return bytes;
  }
  throw new Error('Too many media redirects.');
}

async function update(jobs, key) {
  for (const job of jobs) {
    if (!job.videoId || job.downloaded || job.status === 'failed') continue;
    const query = new URLSearchParams({
      video_id: job.videoId,
      model_name: model,
    });
    const result = await request(`/agnesapi?${query}`, key);
    job.status = result.status;
    job.progress = result.progress;
    if (result.status === 'failed') {
      job.errorCode = result.error?.code ?? 'generation_failed';
    } else if (result.status === 'completed') {
      if (typeof result.url !== 'string')
        throw new Error('Completed job has no video URL.');
      job.bytes = await download(result.url, resolve(work, `${job.slug}.mp4`));
      job.downloaded = true;
    }
    await saveJobs(jobs);
  }
  console.log(
    JSON.stringify(
      jobs.map(({ slug, status, progress, downloaded, bytes, errorCode }) => ({
        slug,
        status,
        progress,
        downloaded: Boolean(downloaded),
        bytes,
        errorCode,
      })),
    ),
  );
}

async function main() {
  if (!Number.isInteger(queueRetries) || queueRetries < 0 || queueRetries > 15)
    throw new Error('AGNES_QUEUE_RETRIES must be an integer from 0 to 15.');
  if (!['generate', 'status', 'wait', 'diagnose', 'plan'].includes(command))
    throw new Error(
      'Usage: node scripts/agnes-video.mjs generate|status|wait|diagnose|plan',
    );
  const storyboard = JSON.parse(await readFile(storyboardPath, 'utf8'));
  if (
    storyboard.clips.some(
      ({ seconds, slug, prompt }) =>
        !Number.isInteger(seconds) ||
        seconds < 4 ||
        seconds > 12 ||
        !/^[a-z0-9-]+$/.test(slug) ||
        typeof prompt !== 'string' ||
        !prompt.trim(),
    )
  ) {
    throw new Error(
      'Invalid storyboard: Agnes Flash accepts integer durations from 4 to 12 seconds.',
    );
  }
  if (command === 'plan') {
    console.log(
      JSON.stringify(
        {
          model,
          mode: 'text',
          size: '720P',
          aspectRatio: '16:9',
          totalSeconds: storyboard.clips.reduce(
            (sum, clip) => sum + clip.seconds,
            0,
          ),
          clips: storyboard.clips.map(({ slug, seconds, title }) => ({
            slug,
            seconds,
            title,
          })),
        },
        null,
        2,
      ),
    );
    return;
  }
  let key = await readKey();
  if (!key || /[\r\n]/.test(key))
    throw new Error('An Agnes API key is required.');
  if (command === 'diagnose') {
    const result = await request('/v1/models', key);
    const models = Array.isArray(result.data) ? result.data : [];
    console.log(
      JSON.stringify({
        connected: true,
        videoModels: models
          .filter(({ id }) => /video|agnes/i.test(id))
          .map(({ id }) => id),
      }),
    );
    return;
  }
  const jobs = await readJobs();
  if (command === 'generate') {
    for (const clip of storyboard.clips) {
      let job = jobs.find(({ slug }) => slug === clip.slug);
      if (job?.videoId) continue;
      if (job && job.status !== 'queue_full') {
        throw new Error(
          `${clip.slug} has an unconfirmed submission. Confirm it with Agnes before creating another task.`,
        );
      }
      if (!job) {
        job = {
          slug: clip.slug,
          seconds: clip.seconds,
          createdAt: new Date().toISOString(),
        };
        jobs.push(job);
      }
      let result;
      for (let attempt = 0; attempt <= queueRetries; attempt++) {
        // COSEC: 请求前持久化意图，中断或超时后保留未确认状态，防止下次运行重复计费。
        job.status = 'submission_unconfirmed';
        await saveJobs(jobs);
        try {
          result = await request('/v1/videos', key, {
            method: 'POST',
            body: JSON.stringify({
              model,
              prompt: clip.prompt,
              seconds: String(clip.seconds),
              mode: 'text',
              size: '720P',
              aspect_ratio: '16:9',
              n: 1,
            }),
          });
          break;
        } catch (error) {
          // COSEC: 只重试明确没有创建任务的 queue_full；超时等不确定结果禁止重复 POST。
          if (error.queueFull) {
            job.status = 'queue_full';
            await saveJobs(jobs);
          }
          if (!error.queueFull || attempt === queueRetries) throw error;
          console.log(
            `Agnes queue full for ${clip.slug}; retry ${attempt + 1}/${queueRetries} in 45s. No task created.`,
          );
          await sleep(45_000);
        }
      }
      if (typeof result.video_id !== 'string' || !result.video_id) {
        throw new Error(
          'Missing video_id: do not resubmit until the supplier confirms task creation.',
        );
      }
      Object.assign(job, {
        videoId: result.video_id,
        taskId: result.id ?? result.task_id,
        status: result.status ?? 'queued',
      });
      await saveJobs(jobs);
      console.log(`Submitted ${clip.slug}: ${clip.seconds}s, ${model}, 720P.`);
    }
  }
  if (!jobs.length) throw new Error('No jobs yet. Run generate first.');
  if (!jobs.some(({ videoId }) => videoId))
    throw new Error(
      'No accepted video jobs. Queue-full submissions can be retried with generate; unconfirmed submissions need supplier confirmation.',
    );
  const acceptedJobs = jobs.filter(({ videoId }) => Boolean(videoId));
  const deadline = Date.now() + (command === 'status' ? 0 : 25 * 60_000);
  do {
    await update(jobs, key);
    if (
      acceptedJobs.every(
        ({ downloaded, status }) => downloaded || status === 'failed',
      )
    )
      break;
    if (Date.now() >= deadline) break;
    await sleep(15_000);
  } while (Date.now() < deadline);
  key = '';
  if (acceptedJobs.some(({ status }) => status === 'failed'))
    throw new Error(
      'Some video jobs failed. Existing tasks were preserved; no automatic paid retry.',
    );
  if (acceptedJobs.some(({ downloaded }) => !downloaded))
    console.log(
      'Jobs are still running. Resume with wait; do not create duplicates.',
    );
  if (jobs.some(({ videoId }) => !videoId))
    console.log(
      'Some clips were not accepted. Check their saved submission state before retrying generate.',
    );
}

main().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
