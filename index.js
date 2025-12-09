#!/usr/bin/env node
// FKRAIN # ius - 雨课堂心跳工具

const { config, parseArgs, getBaseUrl, setBaseUrl } = require('./config');
const { writeInfo, writeWarn, writeError, sleep, parseCookie, clearScreen, readLine, showProgress, endProgress } = require('./utils');
const { getLessonSummary, getCourseList, getLessonList, selectBestVideo } = require('./api');
const { normalizeDuration, newHeartbeatEvents, sendHeartbeats } = require('./heartbeat');
const { selectFromList, selectAction } = require('./menu');

// 解析命令行参数
parseArgs(process.argv.slice(2));

// 构建上下文
function buildContext(cookie) {
  const cookieMap = parseCookie(cookie);
  const csrf = cookieMap['csrftoken'];
  const university = cookieMap['uv_id'] || cookieMap['university_id'];
  
  return {
    cookie: cookie,
    userId: config.userId,
    courseId: config.courseId,
    classroomId: config.classroomId,
    lessonId: config.lessonId,
    videoId: config.videoId,
    duration: config.duration,
    interval: config.interval,
    batchSize: config.batchSize,
    timeout: config.timeout,
    retries: config.retries,
    sleepMs: config.sleepMsBetweenBatch,
    dryRun: config.dryRun,
    autoFix: config.autoFixMs,
    autoFill: config.autoFill,
    menu: config.menu,
    csrfToken: csrf,
    universityId: university,
  };
}

// 处理单个课程
async function invokeSingleLesson(context, courseId, classroomId, lessonItem) {
  const lessonId = String(lessonItem.courseware_id);
  
  const summary = await getLessonSummary(
    lessonId, classroomId, context.cookie, context.universityId,
    context.csrfToken, context.timeout
  );
  
  if (!summary.success) {
    writeError(`获取回放信息失败: ${summary.error}`);
    return false;
  }
  
  const durationCandidate = summary.video_duration_sec || summary.duration_sec || null;
  const best = selectBestVideo(summary.live_list, summary.video_id, durationCandidate);
  
  if (!best.id || best.duration == null || best.duration <= 0) {
    writeError('无法获取视频ID或时长');
    return false;
  }
  
  const userId = summary.user_id ? parseInt(summary.user_id, 10) : context.userId;
  const course = courseId || (summary.course?.id ? String(summary.course.id) : null);
  
  if (!userId || !course) {
    writeError('缺少 user_id 或 course_id');
    return false;
  }
  
  console.log(`\n正在刷课: ${lessonItem.title}`);
  console.log(`  lesson_id=${lessonId}, video_id=${best.id}, 时长=${best.duration}s`);
  
  const hb = newHeartbeatEvents(userId, course, classroomId, lessonId, best.id, best.duration, context.interval);
  
  if (context.dryRun) {
    writeInfo(`Dry run: 生成 ${hb.length} 个心跳事件`);
    return true;
  }
  
  const res = await sendHeartbeats(
    context.cookie, classroomId, context.universityId, context.csrfToken,
    hb, context.batchSize, context.timeout, context.retries, context.sleepMs, lessonId
  );
  
  if (res.success) {
    console.log('\n\x1b[32m成功\x1b[0m');
    return true;
  } else {
    writeError(`\n失败: ${res.response}`);
    return false;
  }
}

// 批量刷课
async function invokeBatchBrush(context, courseId, classroomId, lessons) {
  if (lessons.length === 0) {
    writeWarn('没有可刷的课程');
    return;
  }
  
  const ordered = [...lessons].sort((a, b) => (a.create_time || 0) - (b.create_time || 0));
  const total = ordered.length;
  
  console.log(`\n开始批量刷课: 共 ${total} 个`);
  
  let ok = 0;
  for (let i = 0; i < total; i++) {
    const item = ordered[i];
    console.log(`\n[${i + 1}/${total}] ${item.title}`);
    
    if (await invokeSingleLesson(context, courseId, classroomId, item)) {
      ok++;
    }
    
    if (i < total - 1) {
      console.log('等待10秒...');
      await sleep(10000);
    }
  }
  
  console.log(`\n批量刷课完成: 成功 ${ok}/${total}`);
}

// 课程菜单
async function runLessonMenu(context, courseId, classroomId, courseName, className) {
  while (true) {
    const lessonRes = await getLessonList(
      context.cookie, classroomId, context.universityId,
      context.csrfToken, context.userId, context.timeout
    );
    
    if (!lessonRes.success) {
      writeError(`获取回放列表失败: ${lessonRes.error}`);
      return;
    }
    
    const lessons = lessonRes.data;
    console.log(`\n当前: ${courseName} - ${className}`);
    console.log(`回放数量: ${lessons.length}`);
    
    const actions = [
      { label: '自动刷本班全部回放', code: 'auto' },
      { label: '手动选择单个回放', code: 'manual' },
      { label: '返回上一层', code: 'back' },
      { label: '退出程序', code: 'quit' },
    ];
    
    const action = await selectAction(actions, '选择操作');
    
    if (!action || action === 'back') return;
    if (action === 'quit') process.exit(0);
    
    if (action === 'auto') {
      await invokeBatchBrush(context, courseId, classroomId, lessons);
    } else if (action === 'manual') {
      if (lessons.length === 0) {
        writeWarn('当前无可选回放');
        continue;
      }
      
      const fmtLesson = x => {
        const t = x.create_time
          ? new Date(x.create_time).toLocaleString('zh-CN')
          : '-';
        return `${x.title} (${t})`;
      };
      
      const sel = await selectFromList(lessons, fmtLesson, '选择回放');
      if (sel.kind === 'Index') {
        await invokeSingleLesson(context, courseId, classroomId, lessons[sel.value]);
      }
    }
  }
}

// 主菜单
async function runInteractiveMenu(context) {
  while (true) {
    const courseRes = await getCourseList(
      context.cookie, context.universityId, context.csrfToken, context.timeout
    );
    
    if (!courseRes.success) {
      writeError(`获取课程列表失败: ${courseRes.error}`);
      return;
    }
    
    if (!context.userId && courseRes.user_id) {
      context.userId = parseInt(courseRes.user_id, 10);
    }
    
    const courses = courseRes.data;
    if (courses.length === 0) {
      writeWarn('未找到课程');
      return;
    }
    
    const fmtCourse = x => `${x.course_name} - ${x.class_name}`;
    const sel = await selectFromList(courses, fmtCourse, '课程列表');
    
    if (sel.kind === 'Back') {
      writeInfo('已退出');
      return;
    }
    
    if (sel.kind === 'Index') {
      const selected = courses[sel.value];
      await runLessonMenu(context, selected.course_id, selected.classroom_id, selected.course_name, selected.class_name);
    }
  }
}

// 直接模式
async function invokeDirectMode(context) {
  if (!context.classroomId) throw new Error('需要 ClassroomId');
  if (!context.lessonId) throw new Error('需要 LessonId');
  
  if (context.autoFill || !context.videoId || !context.duration || !context.courseId || !context.userId) {
    writeInfo('从 API 获取回放信息...');
    const summary = await getLessonSummary(
      context.lessonId, context.classroomId, context.cookie,
      context.universityId, context.csrfToken, context.timeout
    );
    
    if (!summary.success) {
      throw new Error(`获取回放信息失败: ${summary.error}`);
    }
    
    if (!context.videoId && summary.video_id) context.videoId = String(summary.video_id);
    if (!context.duration) context.duration = summary.video_duration_sec || summary.duration_sec;
    if (!context.courseId && summary.course?.id) context.courseId = String(summary.course.id);
    if (!context.userId && summary.user_id) context.userId = parseInt(summary.user_id, 10);
  }
  
  if (!context.videoId) throw new Error('缺少 video_id');
  if (!context.courseId) throw new Error('缺少 course_id');
  if (!context.userId) throw new Error('缺少 user_id');
  if (!context.duration) throw new Error('缺少 duration');
  
  const duration = normalizeDuration(context.duration, context.autoFix);
  const events = newHeartbeatEvents(
    context.userId, context.courseId, context.classroomId,
    context.lessonId, context.videoId, duration, context.interval
  );
  
  if (context.dryRun) {
    writeInfo(`Dry run: 生成 ${events.length} 个心跳事件`);
    return;
  }
  
  writeInfo(`提交心跳: user=${context.userId} course=${context.courseId} classroom=${context.classroomId}`);
  writeInfo(`  lesson_id=${context.lessonId} video_id=${context.videoId}`);
  writeInfo(`  时长=${duration}s 间隔=${context.interval}s 数量=${events.length}`);
  
  const res = await sendHeartbeats(
    context.cookie, context.classroomId, context.universityId, context.csrfToken,
    events, context.batchSize, context.timeout, context.retries, context.sleepMs, context.lessonId
  );
  
  if (res.success) {
    writeInfo(`\n完成 - 发送 ${res.count} 条`);
  } else {
    writeError(`\n失败 - 已发送 ${res.count} 条，响应: ${res.response}`);
  }
}

// 显示免责声明
function showDisclaimer() {
  console.log('\n========== 雨课堂刷课工具 ==========\n');
  console.log('免责声明:');
  console.log('  本工具仅供学习与研究使用');
  console.log('  请严格遵守法律法规与平台条款');
  console.log('  开发者不对任何后果承担责任');
  console.log('');
}

// 主函数
async function main() {
  try {
    if (!config.cookie) {
      showDisclaimer();
      
      // 平台选择
      const platforms = [
        { label: '雨课堂', sub: 'www' },
        { label: '荷塘雨课堂', sub: 'pro' },
        { label: '长江雨课堂', sub: 'changjiang' },
        { label: '黄河雨课堂', sub: 'huanghe' },
      ];
      
      console.log('选择平台:');
      platforms.forEach((p, i) => console.log(`  ${i + 1}. ${p.label}`));
      console.log('');
      
      const platformChoice = await readLine('输入数字 (1-4): ');
      const platformIndex = parseInt(platformChoice, 10) - 1;
      
      const selected = platforms[platformIndex] || platforms[0];
      setBaseUrl(`https://${selected.sub}.yuketang.cn`);
      
      console.log(`\n已选择: ${selected.label}`);
      console.log(`请在浏览器打开: ${getBaseUrl()}/v2/web/index`);
      console.log('获取 Cookie (只需要 csrftoken 和 sessionid)');
      console.log('');
      
      config.cookie = await readLine('粘贴 Cookie: ');
    }
    
    if (!config.cookie || !config.cookie.trim()) {
      throw new Error('Cookie 不能为空');
    }
    
    const context = buildContext(config.cookie.trim());
    
    if (context.menu) {
      await runInteractiveMenu(context);
    } else {
      await invokeDirectMode(context);
    }
  } catch (err) {
    writeError(`错误: ${err.message}`);
    process.exit(1);
  }
}

main();
