import { spawn } from 'node:child_process';
import { mkdir, readFile, writeFile, rename } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const work = resolve(root, 'work/agnes-faraday');
const output = resolve(root, 'public/videos');
const ffmpeg = process.env.FFMPEG_PATH ?? 'ffmpeg';
const storyboard = JSON.parse(
  await readFile(resolve(root, 'content/faraday-video.json'), 'utf8'),
);
const jobs = JSON.parse(await readFile(resolve(work, 'jobs.json'), 'utf8'));

if (
  !storyboard.clips.every(({ slug }) =>
    jobs.some((job) => job.slug === slug && job.downloaded),
  )
) {
  throw new Error(
    'All three real Agnes video clips must be downloaded before rendering.',
  );
}

function run(binary, args, { probe = false } = {}) {
  return new Promise((done, reject) => {
    // COSEC: 使用参数数组和固定文件路径，不经过 shell，也不拼接外部命令。
    const child = spawn(binary, args, {
      cwd: root,
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    let stderr = '';
    child.stderr.on('data', (chunk) => {
      stderr = (stderr + chunk.toString()).slice(-12000);
    });
    child.stdout.resume();
    child.on('error', reject);
    child.on('close', (code) => {
      if (code === 0 || probe) done(stderr);
      else
        reject(new Error(`${binary} failed (${code}): ${stderr.slice(-1800)}`));
    });
  });
}

async function duration(path) {
  const result = await run(ffmpeg, ['-hide_banner', '-i', path], {
    probe: true,
  });
  const match = result.match(/Duration: (\d+):(\d+):([\d.]+)/);
  if (!match) throw new Error('Cannot verify media duration.');
  return Number(match[1]) * 3600 + Number(match[2]) * 60 + Number(match[3]);
}

const captions = [
  [0, 3, '1831 年，伦敦。我们先看懂装置。'],
  [3, 7, '左线圈接低压电池与开关。'],
  [7, 12, '右线圈只接检流计，两组导线彼此绝缘。'],
  [12, 15, '先看零位，再接通左侧开关。'],
  [15, 18, '接通瞬间：右侧指针短暂偏转。'],
  [18, 24, '保持接通：电池仍供电，右侧指针回零。'],
  [24, 27, '保持其他条件不变，现在断开。'],
  [27, 30, '断开瞬间：指针朝相反方向偏转。'],
  [30, 33, '穿过右线圈的磁场在变化，便产生感应电动势。'],
  [33, 36, '右回路闭合时，才有感应电流。'],
];

const narrations = [
  '回到一八三一年，先看清装置。',
  '左线圈接低压电池与开关。',
  '右线圈只接检流计。两组导线彼此绝缘。',
  '先看零位，准备接通。',
  '接通！指针短暂偏转。',
  '保持接通。电池仍供电，右侧指针却回到零。',
  '条件不变，准备断开。',
  '断开！指针反向偏转。',
  '磁场的变化，产生感应电动势。',
  '回路闭合，才有感应电流。',
];

const assTime = (seconds) =>
  `0:${String(Math.floor(seconds / 60)).padStart(2, '0')}:${String(seconds % 60).padStart(2, '0')}.00`;
const vttTime = (seconds) =>
  `00:${String(Math.floor(seconds / 60)).padStart(2, '0')}:${String(seconds % 60).padStart(2, '0')}.000`;
const assHeader = `[Script Info]
ScriptType: v4.00+
PlayResX: 1280
PlayResY: 720
WrapStyle: 0

[V4+ Styles]
Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding
Style: Caption,Heiti SC,32,&H00F4F5F8,&H000000FF,&H0020150A,&H90000000,0,0,0,0,100,100,0,0,1,1,0,2,48,48,55,1
Style: Heading,Heiti SC,31,&H0064CFF8,&H000000FF,&H0020150A,&H90000000,-1,0,0,0,100,100,0,0,1,1,0,7,45,45,25,1
Style: Chapter,Heiti SC,22,&H00E4DF88,&H000000FF,&H0020150A,&H90000000,0,0,0,0,100,100,0,0,1,1,0,9,40,40,30,1
Style: Note,Heiti SC,17,&H00AD9A88,&H000000FF,&H0020150A,&H90000000,0,0,0,0,100,100,0,0,1,1,0,2,40,40,20,1

[Events]
Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text
`;

await mkdir(output, { recursive: true });
const ass =
  assHeader +
  [
    `Dialogue: 0,${assTime(0)},${assTime(36)},Heading,,0,0,0,,法拉第实验｜为什么指针只动一下？`,
    `Dialogue: 0,${assTime(0)},${assTime(36)},Note,,0,0,0,,AI 教学重现 · 磁场光效为现代示意 · 使用低压电池`,
    ...storyboard.chapters.map(
      ({ start, end, label }, index) =>
        `Dialogue: 0,${assTime(start)},${assTime(end)},Chapter,,0,0,0,,${index + 1}/3  ${label}`,
    ),
    ...captions.map(
      ([start, end, text]) =>
        `Dialogue: 0,${assTime(start)},${assTime(end)},Caption,,0,0,0,,${text}`,
    ),
  ].join('\n');
await writeFile(resolve(work, 'captions.ass'), ass);
await writeFile(
  resolve(output, 'faraday-induction-zh.vtt'),
  'WEBVTT\n\n' +
    captions
      .map(
        ([start, end, text]) =>
          `${vttTime(start)} --> ${vttTime(end)}\n${text}`,
      )
      .join('\n\n') +
    '\n',
);

for (let index = 0; index < captions.length; index++) {
  const [start, end] = captions[index];
  const cueSeconds = end - start;
  const textPath = resolve(work, `narration-${index}.txt`);
  const voicePath = resolve(work, `narration-${index}.aiff`);
  await writeFile(textPath, narrations[index]);
  await run('say', [
    '-v',
    'Tingting',
    '-r',
    '185',
    '-f',
    textPath,
    '-o',
    voicePath,
  ]);
  const voiceSeconds = await duration(voicePath);
  const tempo = Math.max(0.9, voiceSeconds / (cueSeconds - 0.1));
  await run(ffmpeg, [
    '-hide_banner',
    '-loglevel',
    'error',
    '-y',
    '-i',
    voicePath,
    '-af',
    `atempo=${tempo.toFixed(4)},apad,atrim=duration=${cueSeconds},asetpts=PTS-STARTPTS`,
    '-c:a',
    'pcm_s16le',
    '-ar',
    '48000',
    '-ac',
    '2',
    '-t',
    String(cueSeconds),
    resolve(work, `cue-${index}.wav`),
  ]);
}

await writeFile(
  resolve(work, 'narration-concat.txt'),
  captions.map((_, index) => `file 'cue-${index}.wav'`).join('\n'),
);
for (let index = 0; index < storyboard.clips.length; index++) {
  const clip = storyboard.clips[index];
  const source = resolve(work, `${clip.slug}.mp4`);
  const actual = await duration(source);
  if (Math.abs(actual - clip.seconds) > 0.6)
    throw new Error(`Unexpected source duration for ${clip.slug}: ${actual}s.`);
  await run(ffmpeg, [
    '-hide_banner',
    '-loglevel',
    'error',
    '-y',
    '-i',
    source,
    '-vf',
    'scale=1280:720:force_original_aspect_ratio=decrease,pad=1280:720:(ow-iw)/2:(oh-ih)/2,fps=25,tpad=stop_mode=clone:stop_duration=12,trim=duration=12,setpts=PTS-STARTPTS',
    '-an',
    '-c:v',
    'libx264',
    '-preset',
    'fast',
    '-crf',
    '22',
    '-pix_fmt',
    'yuv420p',
    '-t',
    '12',
    resolve(work, `normalized-${index}.mp4`),
  ]);
  console.log(`Normalized clip ${index + 1}/3: source ${actual}s.`);
}

await writeFile(
  resolve(work, 'concat.txt'),
  storyboard.clips
    .map((_, index) => `file 'normalized-${index}.mp4'`)
    .join('\n'),
);
const final = resolve(output, 'faraday-induction-demo.mp4');
const temporary = resolve(work, 'faraday-induction-final.mp4');
await run(ffmpeg, [
  '-hide_banner',
  '-loglevel',
  'error',
  '-y',
  '-f',
  'concat',
  '-safe',
  '1',
  '-i',
  resolve(work, 'concat.txt'),
  '-f',
  'concat',
  '-safe',
  '1',
  '-i',
  resolve(work, 'narration-concat.txt'),
  '-map',
  '0:v:0',
  '-map',
  '1:a:0',
  '-vf',
  'drawbox=x=0:y=0:w=iw:h=85:color=0x07101d@0.92:t=fill,drawbox=x=0:y=596:w=iw:h=124:color=0x07101d@0.94:t=fill,subtitles=work/agnes-faraday/captions.ass',
  '-c:v',
  'libx264',
  '-preset',
  'slow',
  '-crf',
  '23',
  '-pix_fmt',
  'yuv420p',
  '-c:a',
  'aac',
  '-b:a',
  '128k',
  '-movflags',
  '+faststart',
  '-t',
  '36',
  temporary,
]);
await run(ffmpeg, [
  '-hide_banner',
  '-loglevel',
  'error',
  '-i',
  temporary,
  '-f',
  'null',
  '-',
]);
const finalSeconds = await duration(temporary);
if (Math.abs(finalSeconds - 36) > 0.2)
  throw new Error(`Final video has unexpected duration: ${finalSeconds}s.`);
await rename(temporary, final);
await run(ffmpeg, [
  '-hide_banner',
  '-loglevel',
  'error',
  '-y',
  '-ss',
  '8',
  '-i',
  final,
  '-frames:v',
  '1',
  resolve(work, 'poster.png'),
]);
await sharp(resolve(work, 'poster.png'))
  .resize({ width: 1280 })
  .webp({ quality: 82 })
  .toFile(resolve(output, 'faraday-induction-poster.webp'));
await writeFile(
  resolve(root, 'content/faraday-video-asset.json'),
  JSON.stringify(
    {
      ready: true,
      path: '/videos/faraday-induction-demo.mp4',
      poster: '/videos/faraday-induction-poster.webp',
      captions: '/videos/faraday-induction-zh.vtt',
      seconds: finalSeconds,
      model: storyboard.model,
    },
    null,
    2,
  ) + '\n',
);
await writeFile(
  resolve(output, 'faraday-induction-provenance.json'),
  JSON.stringify(
    {
      title: storyboard.title,
      model: storyboard.model,
      mode: 'text',
      requestedSize: '720P',
      generatedAt: new Date().toISOString(),
      totalSeconds: finalSeconds,
      clips: jobs.map(({ slug, seconds, createdAt }) => ({
        slug,
        seconds,
        createdAt,
      })),
      notes: storyboard.note,
      sources: storyboard.sources,
    },
    null,
    2,
  ) + '\n',
);
console.log(
  `Ready: ${finalSeconds}s, 1280x720, Chinese narration and captions. ${final}`,
);
