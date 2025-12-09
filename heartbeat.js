// 心跳生成和发送
const { getBaseUrl } = require('./config');
const { newYKTHeaders, makeRequest } = require('./http');
const { writeInfo, writeWarn, sleep, showProgress, endProgress } = require('./utils');

function normalizeDuration(duration, autoFix = true) {
  if (duration == null) {
    throw new Error('Video duration is required.');
  }
  
  let value = parseFloat(duration);
  if (autoFix && value > 86400) {
    const candidate = value / 1000.0;
    if (candidate <= 43200) {
      writeInfo(`检测到毫秒时长，自动调整为 ${candidate} 秒`);
      return candidate;
    }
  }
  return value;
}

function newHeartbeatEvents(userId, courseId, classroomId, lessonId, videoId, duration, interval) {
  const start = Date.now();
  const events = [];
  let seq = 1;
  const pg = `${videoId}_${start}`;
  
  const addEvent = (type, cp, offset) => {
    const timestamp = start + offset;
    const event = {
      ts: String(timestamp),
      i: 20,
      et: type,
      p: 'web',
      t: 'ykt_playback',
      u: userId,
      c: courseId,
      classroomid: classroomId,
      lob: 'ykt',
      v: videoId,
      fp: 0,
      tp: 0,
      d: 0,
      pg: pg,
      n: 'ali-cdn.xuetangx.com',
      lesson_id: lessonId,
      source: 'ks',
      sp: 1,
      sq: seq,
      cp: Math.round(cp * 1000) / 1000,
    };
    seq++;
    events.push(event);
  };
  
  addEvent('loadstart', 0, 0);
  addEvent('loadeddata', 0, 600);
  addEvent('play', 0, 900);
  addEvent('playing', 0, 920);
  addEvent('waiting', 0, 1100);
  addEvent('playing', 0, 1400);
  
  let current = interval;
  let offset = 2000;
  
  while (current <= duration) {
    addEvent('heartbeat', Math.min(current, duration), offset);
    current += interval;
    offset += interval * 1000;
  }
  
  const last = events[events.length - 1];
  if (last.et === 'heartbeat' && last.cp < duration) {
    addEvent('heartbeat', duration, offset);
  }
  
  return events;
}

async function sendHeartbeats(cookie, classroomId, universityId, csrfToken, heartbeats, batchSize, timeout, retries, sleepMs, lessonId) {
  const baseUrl = getBaseUrl();
  const referer = `${baseUrl}/v2/web/v3/playback/${lessonId}/slide/2/0`;
  const headers = newYKTHeaders(cookie, classroomId, universityId, referer, csrfToken);
  const url = `${baseUrl}/video-log/heartbeat/`;
  
  if (batchSize <= 0) batchSize = heartbeats.length;
  
  const total = heartbeats.length;
  let sent = 0;
  let lastStatus = null;
  let lastResponse = null;
  
  for (let i = 0; i < total; i += batchSize) {
    const chunk = heartbeats.slice(i, Math.min(i + batchSize, total));
    const payload = JSON.stringify({ heart_data: chunk });
    
    let attempt = 0;
    let ok = false;
    let errorMessage = null;
    
    while (attempt <= retries) {
      try {
        const response = await makeRequest('POST', url, headers, payload, timeout * 1000);
        lastStatus = response.statusCode;
        lastResponse = response.content;
        
        const done = Math.min(i + batchSize, total);
        showProgress('发送心跳', done, total);
        
        if (response.statusCode === 200) {
          ok = true;
          break;
        } else {
          errorMessage = response.content;
        }
      } catch (err) {
        errorMessage = err.message;
      }
      
      attempt++;
      if (attempt <= retries) {
        writeWarn(`重试第 ${attempt} 次: ${errorMessage}`);
        await sleep(300);
      }
    }
    
    if (!ok) {
      return {
        success: false,
        count: sent,
        status_code: lastStatus,
        response: errorMessage,
      };
    }
    
    sent += chunk.length;
    if (sent < total && sleepMs > 0) {
      await sleep(sleepMs);
    }
  }
  
  endProgress();
  return {
    success: true,
    count: sent,
    status_code: lastStatus,
    response: lastResponse,
  };
}

module.exports = {
  normalizeDuration,
  newHeartbeatEvents,
  sendHeartbeats,
};
