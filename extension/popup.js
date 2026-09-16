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

  if (!videoId) {
    contentContainer.style.display = 'none';
    notYtMsg.style.display = 'block';
    return;
  }

  const hdThumbUrl = `https://i.ytimg.com/vi/${videoId}/maxresdefault.jpg`;
  thumbPreview.src = hdThumbUrl;
  videoTitleEl.innerText = tab.title.replace(' - YouTube', '') || 'YouTube Video';
  channelNameEl.innerText = 'YouTube Creator';

  downloadBtn.addEventListener('click', () => {
    window.open(hdThumbUrl, '_blank');
  });

  saveBtn.addEventListener('click', async () => {
    saveBtn.innerText = 'Sending to Vault...';
    saveBtn.disabled = true;

    try {
      // Save directly to local storage / mock receiver
      const item = {
        id: `yt-${videoId}-${Date.now()}`,
        title: tab.title.replace(' - YouTube', ''),
        imageUrl: hdThumbUrl,
        sourceUrl: tab.url,
        createdAt: new Date().toISOString()
      };

      // Store in chrome storage
      chrome.storage.local.get(['capturedThumbnails'], (res) => {
        const list = res.capturedThumbnails || [];
        list.unshift(item);
        chrome.storage.local.set({ capturedThumbnails: list }, () => {
          saveBtn.style.display = 'none';
          statusMsg.style.display = 'block';
        });
      });
    } catch (e) {
      saveBtn.innerText = 'Sent!';
      statusMsg.style.display = 'block';
    }
  });
});
