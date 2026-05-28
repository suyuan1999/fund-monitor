const axios = require('axios');

const MOBILE_HEADERS = {
  'User-Agent':
    'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1',
  Accept: 'application/json, text/plain, */*',
  'Accept-Language': 'zh-CN,zh;q=0.9',
  Referer: 'https://www.xiaohongshu.com/',
  Origin: 'https://www.xiaohongshu.com',
};

function parseUrl(url) {
  const trimmed = url.trim();

  if (/xhslink\.com\/[A-Za-z0-9]+\/[A-Za-z0-9]+/.test(trimmed)) {
    const id = trimmed.match(/xhslink\.com\/([A-Za-z0-9]+\/[A-Za-z0-9]+)/)[1];
    return { type: 'shortLink', id, url: trimmed };
  }
  if (/xhslink\.com\/[A-Za-z0-9]+/.test(trimmed)) {
    const id = trimmed.match(/xhslink\.com\/([A-Za-z0-9]+)/)[1];
    return { type: 'shortLink', id, url: trimmed };
  }
  if (/xiaohongshu\.com\/explore\/([a-f0-9]+)/.test(trimmed)) {
    return { type: 'note', id: trimmed.match(/xiaohongshu\.com\/explore\/([a-f0-9]+)/)[1], url: trimmed };
  }
  if (/xiaohongshu\.com\/discovery\/item\/([a-f0-9]+)/.test(trimmed)) {
    return { type: 'note', id: trimmed.match(/xiaohongshu\.com\/discovery\/item\/([a-f0-9]+)/)[1], url: trimmed };
  }
  if (/xiaohongshu\.com\/user\/profile\/([a-f0-9]+)/.test(trimmed)) {
    return { type: 'profile', id: trimmed.match(/xiaohongshu\.com\/user\/profile\/([a-f0-9]+)/)[1], url: trimmed };
  }

  return { type: 'unknown', id: null, url: trimmed };
}

async function resolveShortLink(shortUrl) {
  try {
    const response = await axios.get(shortUrl, {
      headers: MOBILE_HEADERS,
      maxRedirects: 0,
      validateStatus: (s) => s === 301 || s === 302 || s === 307 || s === 200,
      timeout: 10000,
    });
    return response.headers.location || null;
  } catch (err) {
    if (err.response?.headers?.location) {
      return err.response.headers.location;
    }
    return null;
  }
}

async function fetchProfile(url) {
  try {
    const response = await axios.get(url, {
      headers: { ...MOBILE_HEADERS, Accept: 'text/html,application/xhtml+xml' },
      timeout: 15000,
    });
    const html = response.data;

    // Try __INITIAL_STATE__ JSON
    const stateMatch = html.match(/window\.__INITIAL_STATE__\s*=\s*({.+?})\s*<\/script>/);
    if (stateMatch) {
      try {
        const replaced = stateMatch[1].replace(/undefined/g, 'null');
        const state = JSON.parse(replaced);
        const userData = state?.user?.userPageData || state?.profile?.user;
        if (userData) {
          return {
            success: true,
            nickname: userData.nickname || '未知博主',
            avatar: userData.avatar || '',
            profileUrl: url,
          };
        }
      } catch (_) {}
    }

    // Fallback: extract nickname from meta/body
    const nickMatch =
      html.match(/nickname":"([^"]+)"/) ||
      html.match(/nickName":"([^"]+)"/) ||
      html.match(/<title>([^<]+)的个人主页[^<]*<\/title>/) ||
      html.match(/<title>([^<]+)[^<]*<\/title>/);

    return {
      success: true,
      nickname: nickMatch ? nickMatch[1] : '未知博主',
      avatar: '',
      profileUrl: url,
    };
  } catch (err) {
    return { success: false, error: `无法访问主页: ${err.message}` };
  }
}

async function fetchNoteContent(noteId) {
  const noteUrl = `https://www.xiaohongshu.com/explore/${noteId}`;
  try {
    const response = await axios.get(noteUrl, {
      headers: { ...MOBILE_HEADERS, Accept: 'text/html,application/xhtml+xml' },
      timeout: 15000,
    });
    const html = response.data;

    const stateMatch = html.match(/window\.__INITIAL_STATE__\s*=\s*({.+?})\s*<\/script>/);
    if (stateMatch) {
      try {
        const replaced = stateMatch[1].replace(/undefined/g, 'null');
        const state = JSON.parse(replaced);
        const noteData = state.note?.noteDetailMap?.[noteId]?.note;
        if (noteData) {
          return {
            success: true,
            nickname: noteData.user?.nickname || '未知博主',
            content: noteData.desc || '',
            noteUrl,
            title: noteData.title || '',
          };
        }
      } catch (_) {}
    }

    const descMatch = html.match(/<meta[^>]+name="description"[^>]+content="([^"]+)"/i);
    const authorMatch = html.match(/nickname":"([^"]+)"/);

    return {
      success: true,
      nickname: authorMatch ? authorMatch[1] : '未知博主',
      content: descMatch ? descMatch[1] : '',
      noteUrl,
    };
  } catch (err) {
    return { success: false, error: `解析失败: ${err.message}` };
  }
}

async function parseNote(url) {
  const parsed = parseUrl(url);

  // Handle short links: resolve first, then handle the target
  if (parsed.type === 'shortLink') {
    const resolved = await resolveShortLink(parsed.url);
    if (!resolved) {
      return { success: false, error: '短链接解析失败，请检查链接是否有效' };
    }

    const resolvedParsed = parseUrl(resolved);

    if (resolvedParsed.type === 'profile') {
      const profileResult = await fetchProfile(resolved);
      if (profileResult.success) {
        return {
          success: true,
          nickname: profileResult.nickname,
          content: '',
          isProfile: true,
          profileUrl: resolved,
          noteUrl: '',
        };
      }
      return profileResult;
    }

    if (resolvedParsed.type === 'note') {
      return await fetchNoteContent(resolvedParsed.id);
    }

    // Resolved to something we don't understand, return what we have
    return {
      success: true,
      nickname: '未知博主',
      content: '',
      noteUrl: resolved,
    };
  }

  // Note links
  if (parsed.type === 'note') {
    return await fetchNoteContent(parsed.id);
  }

  // Profile links
  if (parsed.type === 'profile') {
    return await fetchProfile(parsed.url);
  }

  return { success: false, error: '不支持的链接格式，请使用小红书分享链接' };
}

/**
 * Fetch notes from a user's profile page with cookie auth.
 * days: number of days to look back (default 1 = today only).
 * maxNotes: max notes to fetch full content for (default 3, for cost control).
 */
async function fetchUserNotes(profileUrl, cookie, days = 1, maxNotes = 3) {
  if (!cookie) {
    return { success: false, error: '需要小红书 Cookie，请在设置中配置' };
  }

  const cookieStr = cookie.includes('web_session=') ? cookie : `web_session=${cookie}`;

  // "Today" = start of today in local timezone, converted to UTC ms
  const todayStart = new Date(new Date().toISOString().slice(0, 10)).getTime();
  const since = todayStart - (days - 1) * 24 * 60 * 60 * 1000;

  try {
    const response = await axios.get(profileUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
        Accept: 'text/html,application/xhtml+xml',
        'Accept-Language': 'zh-CN,zh;q=0.9',
        Cookie: cookieStr,
      },
      timeout: 15000,
      maxRedirects: 5,
    });

    const html = response.data;

    // Extract note IDs and titles from the page HTML
    const noteIds = [...html.matchAll(/[\"']noteId[\"']\s*:\s*[\"']([a-f0-9]{24})[\"']/g)].map((m) => m[1]);
    const titles = [...html.matchAll(/[\"']displayTitle[\"']\s*:\s*[\"']([^\"']*)[\"']/g)].map((m) => m[1]);

    if (noteIds.length === 0) {
      return { success: false, error: '未找到笔记，Cookie 可能已过期' };
    }

    // Build note list (pair IDs with titles)
    const notes = [];
    const seen = new Set();
    for (let i = 0; i < Math.min(noteIds.length, 30); i++) {
      if (seen.has(noteIds[i])) continue;
      seen.add(noteIds[i]);
      notes.push({
        noteId: noteIds[i],
        title: titles[i] || '',
        url: `https://www.xiaohongshu.com/explore/${noteIds[i]}`,
      });
    }

    // Fetch note detail pages and filter by publish date
    const contents = [];
    let skipped = 0;
    const notesToFetch = notes.slice(0, Math.min(maxNotes * 3, 15)); // fetch more to filter by date
    for (const note of notesToFetch) {
      if (contents.length >= maxNotes) break; // stop once we have enough
      try {
        const detail = await fetchNotePage(note.noteId, cookieStr);
        const publishTime = detail?.time || 0;

        // Filter by actual publish date
        if (publishTime > 0 && publishTime < since) {
          skipped++;
          continue;
        }

        const noteDate = publishTime > 0
          ? new Date(publishTime).toISOString().slice(0, 10)
          : new Date().toISOString().slice(0, 10);

        if (detail && detail.content) {
          contents.push({
            content: detail.title ? `${detail.title}\n${detail.content}` : detail.content,
            noteUrl: note.url,
            noteDate,
          });
        } else if (note.title) {
          contents.push({ content: note.title, noteUrl: note.url, noteDate });
        }
      } catch (_) {
        if (note.title && contents.length < maxNotes) {
          contents.push({
            content: note.title,
            noteUrl: note.url,
            noteDate: new Date().toISOString().slice(0, 10),
          });
        }
      }
    }

    return {
      success: true,
      notes,
      contents,
      totalFetched: notes.length,
      recentCount: contents.length,
      skipped,
      days,
    };
  } catch (err) {
    if (err.response && err.response.status === 471) {
      return { success: false, error: 'Cookie 已过期或无效，请重新获取' };
    }
    return { success: false, error: `获取笔记失败: ${err.message}` };
  }
}

async function fetchNotePage(noteId, cookieStr) {
  try {
    const response = await axios.get(
      `https://www.xiaohongshu.com/explore/${noteId}`,
      {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
          Accept: 'text/html',
          Cookie: cookieStr,
        },
        timeout: 10000,
      }
    );

    const html = response.data;

    // Try __INITIAL_STATE__
    const stateMatch = html.match(/window\.__INITIAL_STATE__\s*=\s*({.+?})\s*<\/script>/);
    if (stateMatch) {
      try {
        const replaced = stateMatch[1].replace(/undefined/g, 'null');
        const state = JSON.parse(replaced);
        const noteMap = state?.note?.noteDetailMap;
        if (noteMap) {
          const noteKey = Object.keys(noteMap)[0];
          const note = noteMap[noteKey]?.note;
          if (note) {
            return {
              title: note.title || '',
              content: note.desc || '',
              time: note.time || 0,
            };
          }
        }
      } catch (_) {}
    }

    // Fallback: extract from meta + time pattern
    const descMatch = html.match(/<meta[^>]+name="description"[^>]+content="([^"]+)"/i);
    const timeMatch = html.match(/\"time\"\s*:\s*(\d{13})/);
    return {
      title: '',
      content: descMatch ? descMatch[1] : '',
      time: timeMatch ? Number(timeMatch[1]) : 0,
    };
  } catch (_) {
    return null;
  }
}

module.exports = { parseNote, parseUrl, fetchUserNotes };
