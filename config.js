// 配置和参数解析

let YKT_BASE_URL = 'https://www.yuketang.cn';

const config = {
  cookie: null,
  userId: null,
  courseId: null,
  classroomId: null,
  lessonId: null,
  videoId: null,
  duration: null,
  interval: 5,
  batchSize: 120,
  timeout: 20,
  retries: 2,
  sleepMsBetweenBatch: 80,
  dryRun: false,
  autoFixMs: true,
  autoFill: true,
  menu: true,
};

function parseArgs(args) {
  for (let i = 0; i < args.length; i++) {
    const arg = args[i].toLowerCase();
    const getValue = () => args[++i];
    
    if (arg === '--cookie' || arg === '-cookie') config.cookie = getValue();
    else if (arg === '--userid' || arg === '-userid') config.userId = parseInt(getValue(), 10);
    else if (arg === '--courseid' || arg === '-courseid') config.courseId = getValue();
    else if (arg === '--classroomid' || arg === '-classroomid') config.classroomId = getValue();
    else if (arg === '--lessonid' || arg === '-lessonid') config.lessonId = getValue();
    else if (arg === '--videoid' || arg === '-videoid') config.videoId = getValue();
    else if (arg === '--duration' || arg === '-duration') config.duration = parseFloat(getValue());
    else if (arg === '--interval' || arg === '-interval') config.interval = parseInt(getValue(), 10);
    else if (arg === '--batchsize' || arg === '-batchsize') config.batchSize = parseInt(getValue(), 10);
    else if (arg === '--timeout' || arg === '-timeout') config.timeout = parseInt(getValue(), 10);
    else if (arg === '--retries' || arg === '-retries') config.retries = parseInt(getValue(), 10);
    else if (arg === '--sleepmsbetweenbatch' || arg === '-sleepmsbetweenbatch') config.sleepMsBetweenBatch = parseInt(getValue(), 10);
    else if (arg === '--dryrun' || arg === '-dryrun') config.dryRun = true;
    else if (arg === '--autofixms' || arg === '-autofixms') config.autoFixMs = true;
    else if (arg === '--noautofixms' || arg === '-noautofixms') config.autoFixMs = false;
    else if (arg === '--autofill' || arg === '-autofill') config.autoFill = true;
    else if (arg === '--noautofill' || arg === '-noautofill') config.autoFill = false;
    else if (arg === '--menu' || arg === '-menu') config.menu = true;
    else if (arg === '--nomenu' || arg === '-nomenu') config.menu = false;
  }
}

function getBaseUrl() {
  return YKT_BASE_URL;
}

function setBaseUrl(url) {
  YKT_BASE_URL = url;
}

module.exports = {
  config,
  parseArgs,
  getBaseUrl,
  setBaseUrl,
};
