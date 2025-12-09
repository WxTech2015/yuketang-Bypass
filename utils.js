// 工具函数
const readline = require('readline');

function writeInfo(message) {
  console.log(message);
}

function writeWarn(message) {
  console.log('\x1b[33m%s\x1b[0m', message);
}

function writeError(message) {
  console.error('\x1b[31m%s\x1b[0m', message);
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function parseCookie(cookieText) {
  const result = {};
  if (!cookieText || !cookieText.trim()) return result;
  
  cookieText.split(';').forEach(part => {
    const trimmed = part.trim();
    if (trimmed && trimmed.includes('=')) {
      const [key, ...valueParts] = trimmed.split('=');
      result[key.trim()] = valueParts.join('=').trim();
    }
  });
  return result;
}

function clearScreen() {
  process.stdout.write('\x1b[2J\x1b[H');
}

function readLine(prompt) {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });
  return new Promise(resolve => {
    rl.question(prompt, answer => {
      rl.close();
      resolve(answer);
    });
  });
}

async function readKey() {
  return new Promise(resolve => {
    const wasRaw = process.stdin.isRaw;
    process.stdin.setRawMode(true);
    process.stdin.resume();
    process.stdin.once('data', data => {
      process.stdin.setRawMode(wasRaw);
      process.stdin.pause();
      resolve(data);
    });
  });
}

function getDisplaySlice(text, maxColumns) {
  if (!text) return '';
  let out = '';
  let width = 0;
  for (const ch of text) {
    const code = ch.charCodeAt(0);
    const dw = code < 128 ? 1 : 2;
    if (width + dw > maxColumns) break;
    out += ch;
    width += dw;
  }
  return out;
}

// 进度条
let lastProgressLine = '';

function showProgress(title, current, total) {
  if (total <= 0) total = 1;
  if (current < 0) current = 0;
  if (current > total) current = total;
  
  const percent = Math.floor((current / total) * 100);
  const barWidth = 40;
  const filled = Math.min(barWidth, Math.floor(barWidth * percent / 100));
  const bar = '▓'.repeat(filled) + '░'.repeat(barWidth - filled);
  const content = `[${bar}] ${String(percent).padStart(3)}% ${title} (${current}/${total})`;
  
  process.stdout.write(`\r${content}${' '.repeat(20)}`);
  lastProgressLine = content;
}

function endProgress() {
  if (lastProgressLine) {
    process.stdout.write(`\r${' '.repeat(lastProgressLine.length + 20)}\r`);
    lastProgressLine = '';
  }
}

module.exports = {
  writeInfo,
  writeWarn,
  writeError,
  sleep,
  parseCookie,
  clearScreen,
  readLine,
  readKey,
  getDisplaySlice,
  showProgress,
  endProgress,
};
