// 雨课堂 API 接口
const { getBaseUrl } = require('./config');
const { newYKTHeaders, makeRequest } = require('./http');

function selectBestVideo(liveList, defaultId, defaultDuration) {
  let best = null;
  let bestScore = Number.MIN_SAFE_INTEGER;
  
  for (const item of liveList || []) {
    const duration = item.duration_sec != null ? parseFloat(item.duration_sec) : 0;
    const order = item.order != null ? -parseFloat(item.order) : 0;
    const score = duration * 1000 + order;
    
    if (score > bestScore) {
      bestScore = score;
      best = item;
    }
  }
  
  if (best) {
    const bestDuration = best.duration_sec != null ? parseFloat(best.duration_sec) : defaultDuration;
    return {
      id: best.id ? String(best.id) : defaultId,
      duration: bestDuration,
    };
  }
  
  return { id: defaultId, duration: defaultDuration };
}

async function getLessonSummary(lessonId, classroomId, cookie, universityId, csrfToken, timeout = 20) {
  const baseUrl = getBaseUrl();
  const referer = `${baseUrl}/v2/web/v3/playback/${lessonId}/slide/2/0`;
  const headers = newYKTHeaders(cookie, classroomId, universityId, referer, csrfToken);
  const url = `${baseUrl}/api/v3/lesson-summary/replay?lesson_id=${lessonId}`;
  
  try {
    const rawResponse = await makeRequest('GET', url, headers, null, timeout * 1000);
    const { statusCode, content } = rawResponse;
    
    let response;
    try {
      response = JSON.parse(content);
    } catch {
      return { success: false, error: 'Non-JSON response', raw: content, status: statusCode };
    }
    
    if (statusCode !== 200) {
      return { success: false, error: `HTTP ${statusCode}`, raw: content, status: statusCode };
    }
    
    if (!response || response.code !== 0) {
      return { success: false, error: response?.msg || 'Unknown error', raw: content, status: statusCode };
    }
    
    const data = response.data;
    const lesson = data.lesson;
    const lives = (data.live || []).filter(Boolean).map(item => ({
      id: String(item.id),
      source: item.source,
      url: item.url,
      start: item.start,
      end: item.end,
      duration_sec: item.duration ? Math.round((parseFloat(item.duration) / 1000) * 1000) / 1000 : 0.0,
      order: item.order,
    }));
    
    const durationRaw = data.lessonDuration;
    const durationSec = durationRaw ? Math.round((parseFloat(durationRaw) / 1000) * 1000) / 1000 : 0.0;
    const best = selectBestVideo(lives, null, durationSec);
    
    return {
      success: true,
      duration_sec: durationSec,
      video_duration_sec: best.duration,
      video_id: best.id,
      live_list: lives,
      lesson: lesson,
      course: lesson?.course,
      classroom: lesson?.classroom,
      user_id: data.userId,
    };
  } catch (err) {
    return { success: false, error: err.message };
  }
}

async function getCourseList(cookie, universityId, csrfToken, timeout = 20) {
  const baseUrl = getBaseUrl();
  const headers = newYKTHeaders(cookie, '0', universityId, `${baseUrl}/v2/web/index`, csrfToken);
  const url = `${baseUrl}/v2/api/web/courses/list?identity=2`;
  
  try {
    const rawResponse = await makeRequest('GET', url, headers, null, timeout * 1000);
    const { statusCode, content } = rawResponse;
    
    let response;
    try {
      response = JSON.parse(content);
    } catch {
      return { success: false, error: 'Non-JSON response', raw: content, status: statusCode };
    }
    
    if (statusCode !== 200) {
      return { success: false, error: `HTTP ${statusCode}`, raw: content, status: statusCode };
    }
    
    if (!response || response.errcode !== 0) {
      return { success: false, error: response?.errmsg || 'Unknown error', raw: content, status: statusCode };
    }
    
    const classes = (response.data?.list || []).filter(Boolean).map(item => ({
      course_id: String(item.course?.id),
      course_name: item.course?.name,
      classroom_id: String(item.classroom_id),
      class_name: item.name,
      term: item.term,
    }));
    
    let userId = null;
    if (response.data?.user_id) {
      userId = parseInt(response.data.user_id, 10);
    }
    
    return { success: true, data: classes, user_id: userId };
  } catch (err) {
    return { success: false, error: err.message };
  }
}

async function getLessonList(cookie, classroomId, universityId, csrfToken, userId, timeout = 20) {
  const baseUrl = getBaseUrl();
  let referer = null;
  if (classroomId && universityId) {
    referer = `${baseUrl}/v2/web/studentLog/${classroomId}?university_id=${universityId}&platform_id=3&classroom_id=${classroomId}&content_url=`;
  }
  const headers = newYKTHeaders(cookie, classroomId, universityId, referer, csrfToken);
  const url = `${baseUrl}/v2/api/web/logs/learn/${classroomId}?actype=-1&page=0&offset=20&sort=-1`;
  
  try {
    const rawResponse = await makeRequest('GET', url, headers, null, timeout * 1000);
    const { statusCode, content } = rawResponse;
    
    let response;
    try {
      response = JSON.parse(content);
    } catch {
      return { success: false, error: 'Non-JSON response', raw: content, status: statusCode };
    }
    
    if (statusCode !== 200) {
      return { success: false, error: `HTTP ${statusCode}`, raw: content, status: statusCode };
    }
    
    if (!response || response.errcode !== 0) {
      return { success: false, error: response?.errmsg || 'Unknown error', raw: content, status: statusCode };
    }
    
    const activities = (response.data?.activities || []).filter(a => a.type === 14);
    return { success: true, data: activities };
  } catch (err) {
    return { success: false, error: err.message };
  }
}

module.exports = {
  selectBestVideo,
  getLessonSummary,
  getCourseList,
  getLessonList,
};
