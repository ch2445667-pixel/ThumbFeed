document.addEventListener('DOMContentLoaded', async () => {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

  const contentContainer = document.getElementById('content-container');
  const notYtMsg = document.getElementById('not-yt-msg');
  const thumbPreview = document.getElementById('thumb-preview');
  const videoTitleEl = document.getElementById('video-title');
  const channelNameEl = document.getElementById('channel-name');
  const saveBtn = document.getElementById('save-btn');
  const downloadBtn = document.getElementById('download-btn');
  const statusMsg = document.getElementById('status-msg');

  if (!tab || !tab.url || !tab.url.includes('youtube.com/watch')) {
    contentContainer.style.display = 'none';
    notYtMsg.style.display = 'block';
    return;
  }

  const urlParams = new URLSearchParams(new URL(tab.url).search);
  const videoId = urlParams.get('v');

  if (!videoId || !/^[a-zA-Z0-9_-]{11}$/.test(videoId)) {
    contentContainer.style.display = 'none';
    notYtMsg.style.display = 'block';
    return;
  }

  const hdThumbUrl = `https://i.ytimg.com/vi/${videoId}/maxresdefault.jpg`;
  thumbPreview.src = hdThumbUrl;
  videoTitleEl.innerText = tab.title.replace(' - YouTube', '') || 'YouTube Video';
  channelNameEl.innerText = 'YouTube Creator';

  downloadBtn.addEventListener('click', () => {
    chrome.tabs.create({ url: hdThumbUrl });
  });

  saveBtn.addEventListener('click', async () => {
    saveBtn.innerText = 'Saving...';
    saveBtn.disabled = true;

    try {
      const uniqueSuffix = typeof crypto?.randomUUID === 'function'
        ? crypto.randomUUID().slice(0, 8)
        : Math.random().toString(36).slice(2, 10);
      const item = {
        id: `yt-${videoId}-${uniqueSuffix}`,
        title: tab.title.replace(' - YouTube', ''),
        imageUrl: hdThumbUrl,
        sourceUrl: tab.url,
        createdAt: new Date().toISOString()
      };

      chrome.storage.local.get(['capturedThumbnails'], (res) => {
        const list = res.capturedThumbnails || [];
        list.unshift(item);
        chrome.storage.local.set({ capturedThumbnails: list }, () => {
          saveBtn.style.display = 'none';
          statusMsg.style.display = 'block';
        });
      });
    } catch {
      saveBtn.innerText = 'Save failed';
      saveBtn.disabled = false;
    }
  });
});
