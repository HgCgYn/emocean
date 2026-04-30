/* ==========================================
   1. 初始化與配色地圖 
   ========================================== */
const firebaseConfig = {
    apiKey: "AIzaSyBiMK_yi-GUEYHAVGsoz3ugOoMmFEFtD5g",
    authDomain: "emocean-48759.firebaseapp.com",
    projectId: "emocean-48759",
    storageBucket: "emocean-48759.firebasestorage.app",
    messagingSenderId: "505730676997",
    appId: "1:505730676997:web:a72397579a70783edc1f6c",
    measurementId: "G-G7CHLD9XJE"
};
if (!firebase.apps.length) { firebase.initializeApp(firebaseConfig); }
const db = firebase.firestore();

const isMobile = window.innerWidth <= 768;
let currentTheme = isMobile ? 'light' : 'dark'; 

const DARK_COLOR_PALETTE = { oceanBase: '#5e7195', wordCloud: 'rgba(255, 255, 255, 0.5)', tooltipBorder: 'transparent' };
const LIGHT_COLOR_PALETTE = { oceanBase: '#5881be', wordCloud: 'rgba(30, 40, 80, 0.5)', tooltipBorder: '#ddd' };
function getPalette() { return currentTheme === 'dark' ? DARK_COLOR_PALETTE : LIGHT_COLOR_PALETTE; }

/* ==========================================
   2. 情緒字典
   ========================================== */
const emotions = [
  { name: '開心', color: '#FDE600', placeholder: '今天發票中了1000萬啦！' }, 
  { name: '悲傷', color: '#1E3190', placeholder: '失戀了，心好痛...' }, 
  { name: '生氣', color: '#C60907', placeholder: '又被教授刁難了，可惡！' }, 
  { name: '恐懼', color: '#996AB5', placeholder: '期末考要到了，完蛋了...' }, 
  { name: '厭惡', color: '#48AD30', placeholder: '這東西也太難吃了吧，噁心。' }, 
  { name: '焦慮', color: '#E9752D', placeholder: '明天要面試，超級緊張！' },
  { name: '羨慕', color: '#1FB1C4', placeholder: '他也太幸運了吧，真羨慕。' }, 
  { name: '尷尬', color: '#E688AF', placeholder: '剛剛認錯人打招呼，好丟臉...' }, 
  { name: '無聊', color: '#494EA3', placeholder: '教授上課好想睡覺喔。' }
];

/* ==========================================
   3. 面板與 UI 狀態變數
   ========================================= */
const startScreen = document.getElementById('startScreen');
const settingBtn = document.getElementById('settingBtn');
const toggleBtn = document.getElementById('toggleBtn');
const settingsPanel = document.getElementById('settingsPanel');
const inputContent = document.getElementById('inputContent');
const step1 = document.getElementById('step1');
const step2 = document.getElementById('step2');
const emotionSelector = document.getElementById('emotionSelector');
const messageInput = document.getElementById('messageInput');
const submitBtn = document.getElementById('submitBtn');
const backBtn = document.getElementById('backBtn');
const dimOverlay = document.getElementById('dimOverlay');
const mobileBottomBar = document.getElementById('mobileBottomBar');
const dpadPanel = document.getElementById('dpadPanel');
const canvas = document.getElementById('oceanCanvas'); 

const musicControlWrapper = document.getElementById('musicControlWrapper');
const waveSoundBtn = document.getElementById('waveSoundBtn');
const musicCapsule = document.getElementById('musicCapsule');

let mobileState = 'idle'; 
let desktopUIState = 'visible'; 
let selectedColor = null; 
let selectedParticle = null; 

let audioCtx; let analyser; let dataArray; let tracks = []; let currentTrackIndex = -1; 

/* ==========================================
   4. 全域背景點擊事件與初始進入設定
   ========================================== */
startScreen.addEventListener('click', () => {
  startScreen.style.opacity = '0';
  setTimeout(() => { startScreen.style.display = 'none'; }, 500);
  
  if (isMobile) {
    settingBtn.classList.remove('hidden');
    mobileBottomBar.classList.remove('hidden');
    mobileState = 'bottomBar';
  } else {
    document.getElementById('controlWrapper').classList.remove('hidden');
    musicControlWrapper.classList.remove('hidden');
    desktopUIState = 'visible';
  }
});

// 🌟 手機版點擊空白處邏輯：設定按鈕與底部欄「同進同出」
canvas.addEventListener('click', () => {
  if (isMobile) {
    if (mobileState === 'dpad') {
      dpadPanel.classList.add('hidden'); document.getElementById('tooltip').style.display = 'none'; mobileState = 'bottomBar';  
      mobileBottomBar.classList.remove('hidden'); settingBtn.classList.remove('hidden'); selectedParticle = null; 
    } else if (mobileState === 'idle') {
      mobileBottomBar.classList.remove('hidden'); settingBtn.classList.remove('hidden'); mobileState = 'bottomBar';
    } else if (mobileState === 'bottomBar') {
      mobileBottomBar.classList.add('hidden'); settingBtn.classList.add('hidden'); mobileState = 'idle';
    }
  } else {
    const wrapper = document.getElementById('controlWrapper');
    if (desktopUIState === 'hidden') {
      wrapper.classList.remove('hidden'); musicControlWrapper.classList.remove('hidden'); desktopUIState = 'visible';
    } else {
      wrapper.classList.add('hidden'); musicControlWrapper.classList.add('hidden'); desktopUIState = 'hidden'; 
    }
  }
});

/* ==========================================
   5. 面板 Hover 型態切換邏輯
   ========================================= */
const closePenPanel = () => {
  if (isMobile) {
    inputContent.classList.add('hidden'); dimOverlay.classList.add('hidden'); 
    settingBtn.classList.remove('hidden'); mobileBottomBar.classList.remove('hidden'); mobileState = 'bottomBar'; 
  } else {
    document.getElementById('inputGroup').classList.remove('expanded');
  }
  setTimeout(resetInputPanel, 400); 
};

function setupDesktopHover(group, isInput = false) {
  if (!group) return;
  let timeout;
  group.addEventListener('mouseenter', () => { if (isMobile) return; clearTimeout(timeout); group.classList.add('expanded'); });
  group.addEventListener('mouseleave', () => {
    if (isMobile) return;
    timeout = setTimeout(() => {
      if (isInput && document.activeElement === messageInput) return;
      group.classList.remove('expanded'); if (isInput) setTimeout(resetInputPanel, 400);
    }, 300);
  });
  if (isInput) {
    messageInput.addEventListener('blur', () => {
      if (isMobile) return;
      setTimeout(() => { if (!group.matches(':hover')) { group.classList.remove('expanded'); setTimeout(resetInputPanel, 400); } }, 100);
    });
  }
}
setupDesktopHover(document.getElementById('settingGroup'));
setupDesktopHover(document.getElementById('inputGroup'), true);
setupDesktopHover(document.getElementById('musicGroup'));

function getContrastColor(hexColor) {
  if (!hexColor) return 'dark'; const hex = hexColor.replace('#', ''); const r = parseInt(hex.substr(0, 2), 16), g = parseInt(hex.substr(2, 2), 16), b = parseInt(hex.substr(4, 2), 16); return (((r * 299) + (g * 587) + (b * 114)) / 1000 >= 128) ? 'light' : 'dark';
}

emotions.forEach(emo => {
  const btn = document.createElement('div'); btn.className = 'emotion-btn';
  btn.innerHTML = `<div class="emotion-dot" style="background-color: ${emo.color}"></div><span>${emo.name}</span>`;
  btn.onclick = () => { 
    selectedColor = emo.color; messageInput.placeholder = emo.placeholder; messageInput.style.setProperty('--input-bg-color', emo.color);
    if (getContrastColor(emo.color) === 'light') { messageInput.style.setProperty('--input-text-color', '#000000'); messageInput.style.setProperty('--input-placeholder-color', 'rgba(0, 0, 0, 0.6)'); 
    } else { messageInput.style.setProperty('--input-text-color', '#ffffff'); messageInput.style.setProperty('--input-placeholder-color', 'rgba(255, 255, 255, 0.7)'); }
    step1.classList.add('hidden'); step2.classList.remove('hidden'); messageInput.focus();
  };
  emotionSelector.appendChild(btn);
});

backBtn.onclick = () => { resetInputPanel(); };
function resetInputPanel() { 
  step2.classList.add('hidden'); step1.classList.remove('hidden'); selectedColor = null; messageInput.value = ""; 
  messageInput.style.removeProperty('--input-bg-color'); messageInput.style.removeProperty('--input-text-color'); messageInput.style.removeProperty('--input-placeholder-color');
}

/* ==========================================
   6. 配色切換 
   ========================================== */
const themeToggleBtn = document.getElementById('themeToggleBtn');
let isThemeSwitching = false; 

if (currentTheme === 'light') {
  document.body.classList.add('light-mode'); if (themeToggleBtn) themeToggleBtn.innerText = '暗色模式';
} else {
  document.body.classList.remove('light-mode'); if (themeToggleBtn) themeToggleBtn.innerText = '亮色模式';
}

themeToggleBtn.addEventListener('click', () => {
  if (isThemeSwitching) return; 
  isThemeSwitching = true; themeToggleBtn.style.opacity = '0.5'; themeToggleBtn.style.pointerEvents = 'none';
  if (currentTheme === 'dark') { currentTheme = 'light'; document.body.classList.add('light-mode'); themeToggleBtn.innerText = '暗色模式';
  } else { currentTheme = 'dark'; document.body.classList.remove('light-mode'); themeToggleBtn.innerText = '亮色模式'; }
  updateWordCloud(); setTimeout(() => { isThemeSwitching = false; themeToggleBtn.style.opacity = '1'; themeToggleBtn.style.pointerEvents = 'auto'; }, 1600);
});

/* ==========================================
   7. NLP 現代內建斷詞與文字雲 
   ========================================== */
const skyWidth = window.innerWidth, skyHeight = window.innerHeight * 0.4; let mySavedBottles = []; 
const stopWords = ["我們", "你們", "他們", "她們", "它們", "大家", "自己", "別人", "什麼", "怎麼", "為什麼", "因為", "所以", "如果", "雖然", "可是", "但是", "非常", "超級", "可以", "覺得", "知道", "今天", "明天", "我", "你", "他", "的", "了", "啊", "啦", "吧", "呢", "嗎", "喔", "是", "有", "在", "就", "會", "能", "想"];

function updateWordCloud() {
  let wordCounts = {}; const segmenter = new Intl.Segmenter('zh-TW', { granularity: 'word' });
  mySavedBottles.forEach(msg => {
    let text = msg.text || ""; const segments = segmenter.segment(text);
    for (const { segment, isWordLike } of segments) {
      if (isWordLike) {
        const word = segment.trim(); const checkWord = word.toUpperCase(); 
        if (word.length >= 2 && word.length <= 6 && !stopWords.includes(checkWord) && isNaN(word)) { wordCounts[word] = (wordCounts[word] || 0) + 1; }
      }
    }
  });

  const baseFontSize = isMobile ? 14 : 20; const fontSizeStep = isMobile ? 8 : 12; 
  let finalWords = Object.keys(wordCounts).map(word => ({ text: word, size: baseFontSize + (wordCounts[word] * fontSizeStep) }));
  finalWords.sort((a, b) => b.size - a.size); let topWords = finalWords.slice(0, 20);
  const oldSky = d3.select("#skyOverlay").select("svg");
  if (!oldSky.empty()) { oldSky.transition().duration(800).style("opacity", 0).remove().on("end", () => drawNewSky(topWords)); } else { drawNewSky(topWords); }
}

function drawNewSky(wordsToDraw) {
  d3.layout.cloud().size([skyWidth, skyHeight]).words(wordsToDraw).padding(isMobile ? 4 : 10).rotate(() => (Math.random() > 0.5 ? 0 : 90)).font("LXGW WenKai TC").fontSize(d => d.size).on("end", renderFadingWords).start();
}

function renderFadingWords(words) {
  const palette = getPalette(); const newSky = d3.select("#skyOverlay").append("svg").attr("width", skyWidth).attr("height", skyHeight).style("opacity", 0);
  newSky.append("g").attr("transform", "translate(" + skyWidth / 2 + "," + skyHeight / 2 + ")").selectAll("text").data(words).enter().append("text").style("font-size", d => d.size + "px").style("font-family", "'LXGW WenKai TC', cursive").style("font-weight", "400").style("fill", palette.wordCloud).attr("text-anchor", "middle").attr("transform", d => "translate(" + [d.x, d.y] + ")rotate(" + d.rotate + ")").text(d => d.text);
  newSky.transition().duration(800).style("opacity", 1);
}

/* ==========================================
   8. 海洋畫布與動態音頻波浪引擎
   ========================================== */
const ctx = canvas.getContext('2d');
function resizeCanvas() { canvas.width = window.innerWidth || document.documentElement.clientWidth || 1024; canvas.height = window.innerHeight || document.documentElement.clientHeight || 768; }
window.addEventListener('resize', resizeCanvas); resizeCanvas();
const nodes = []; let time = 0; const tooltip = document.getElementById('tooltip'); const tooltipContent = document.getElementById('tooltipContent');

function hexToRgb(hex) {
  if (!hex || typeof hex !== 'string') return null; 
  let shorthandRegex = /^#?([a-f\d])([a-f\d])([a-f\d])$/i; hex = hex.replace(shorthandRegex, function(m, r, g, b) { return r + r + g + g + b + b; });
  let result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex); return result ? { r: parseInt(result[1], 16), g: parseInt(result[2], 16), b: parseInt(result[3], 16) } : null;
}

function drawWave() {
  try {
    time += 0.0015; ctx.clearRect(0, 0, canvas.width, canvas.height);
    let bassAvg = 0; let highAvg = 0; 
    if (audioCtx && currentTrackIndex !== -1 && dataArray) {
      analyser.getByteFrequencyData(dataArray); 
      let bassSum = 0; for(let i=0; i<10; i++) bassSum += dataArray[i]; bassAvg = bassSum / 10;
      let highSum = 0; for(let i=50; i<120; i++) highSum += dataArray[i]; highAvg = highSum / 70; time += (bassAvg / 255) * 0.0015; 
    }
    nodes.forEach((node, index) => {
      try {
        node.radius = node.radius || 5; node.baseX = node.baseX || (canvas.width / 2); node.baseY = node.baseY || (canvas.height / 2); node.color = node.color || '#ffffff';
        if (node.isFalling) {
          node.velocityY += 0.15; node.velocityY *= 0.92; node.currentY += node.velocityY; 
          if (node.currentY >= node.baseY) { node.isFalling = false; node.isGlowFading = true; node.glowIntensity = 30; }
        } else {
          const dynamicAmplitude = 12 + (bassAvg / 255) * 6; const bigWave = Math.sin(node.baseX * 0.002 + time) * dynamicAmplitude; const smallWave = Math.sin(node.baseX * 0.01 + time * 1.2) * 2; const sway = Math.cos(node.baseY * 0.01 + time * 0.8) * 8; 
          node.currentX = node.baseX + sway; node.currentY = node.baseY + bigWave + smallWave;
        }

        let pulseScale = 1; let auraRadius = 0; let flashOpacity = 0; let nodeMidValue = 0;
        if (currentTrackIndex !== -1 && dataArray) {
          nodeMidValue = dataArray[10 + (index % 40)] || 0; const sensitivity = 0.7 + ((index * 13) % 10) * 0.06; pulseScale = 1 + Math.pow(nodeMidValue / 255, 3) * (1.8 * sensitivity); const bassRatio = bassAvg / 255;
          if (bassRatio > 0.3) { auraRadius = node.radius * pulseScale + (bassRatio * 35 * sensitivity); }
          const flashThreshold = 0.2 + ((index * 7) % 10) * 0.015; if (highAvg / 255 > flashThreshold) { flashOpacity = Math.min((highAvg / 255 - flashThreshold) * 2.5, 0.95); }
        }

        const currentRadius = Math.abs(node.radius * pulseScale); const rgb = hexToRgb(node.color);
        if (auraRadius > currentRadius && rgb) {
          ctx.beginPath(); ctx.arc(node.currentX, node.currentY, auraRadius, 0, Math.PI * 2); const gradient = ctx.createRadialGradient(node.currentX, node.currentY, currentRadius, node.currentX, node.currentY, auraRadius);
          gradient.addColorStop(0, `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, ${0.6 * (bassAvg/255)})`); gradient.addColorStop(1, `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, 0)`);                      
          ctx.fillStyle = gradient; ctx.fill();
        }

        let finalBlur = 0;
        if (node.isGlowFading) { node.glowIntensity -= 0.15; if (node.glowIntensity <= 0) { node.isGlowFading = false; node.glowIntensity = 0; } finalBlur = node.glowIntensity; }
        if (finalBlur > 0 || (currentTrackIndex !== -1 && nodeMidValue > 20)) { ctx.shadowColor = node.color; ctx.shadowBlur = Math.max(finalBlur, (nodeMidValue / 255) * 15); } else { ctx.shadowBlur = 0; }

        ctx.beginPath(); ctx.arc(node.currentX, node.currentY, currentRadius, 0, Math.PI * 2); ctx.fillStyle = node.color; ctx.fill();

        if (isMobile && typeof mobileState !== 'undefined' && mobileState === 'dpad' && node === selectedParticle) {
          ctx.shadowColor = '#ffffff'; ctx.shadowBlur = 30; ctx.lineWidth = 3; ctx.strokeStyle = '#ffffff'; ctx.stroke(); ctx.beginPath(); ctx.arc(node.currentX, node.currentY, currentRadius + 6, 0, Math.PI * 2); ctx.lineWidth = 1.5; ctx.strokeStyle = 'rgba(255, 255, 255, 0.6)'; ctx.stroke();
          let tipX = node.currentX + 15; let tipY = node.currentY + 15; if (tipX + tooltip.offsetWidth > window.innerWidth) tipX = node.currentX - tooltip.offsetWidth - 15; if (tipY + tooltip.offsetHeight > window.innerHeight) tipY = node.currentY - tooltip.offsetHeight - 15; 
          tooltip.style.transform = 'none'; tooltip.style.left = tipX + 'px'; tooltip.style.top = tipY + 'px'; 
        } else if (node.isInteractive) { ctx.shadowBlur = 0; ctx.lineWidth = 1.5; ctx.strokeStyle = 'rgba(255, 255, 255, 0.8)'; ctx.stroke(); }

        if (flashOpacity > 0) { ctx.shadowBlur = 0; ctx.beginPath(); ctx.arc(node.currentX, node.currentY, currentRadius * 0.7, 0, Math.PI * 2); ctx.fillStyle = `rgba(255, 255, 255, ${flashOpacity})`; ctx.fill(); }
      } catch(nodeErr) {}
    });
  } catch (err) { console.error(err); }
  requestAnimationFrame(drawWave);
}
drawWave();

/* ==========================================
   9. 雲端連線：撈取與提交
   ========================================== */
const thirtyDaysAgo = Date.now() - (30 * 24 * 60 * 60 * 1000);
db.collection("emocean_bottles").where("createdAt", ">", thirtyDaysAgo).get().then((querySnapshot) => {
  querySnapshot.forEach((doc) => {
    const cloudData = doc.data(); mySavedBottles.push(cloudData); 
    nodes.push({ radius: isMobile ? (Math.random() * 1.5 + 3.5) : (Math.random() * 2 + 5), color: cloudData.color || '#ffffff', isInteractive: true, message: cloudData.text || '', baseX: Math.random() * (canvas.width - 80) + 40, baseY: canvas.height * 0.55 + Math.random() * (canvas.height * 0.35), currentX: 0, currentY: 0, isFalling: false, isGlowFading: false, glowIntensity: 0 });
  });
  updateWordCloud();
}).catch(error => console.error(error));

submitBtn.onclick = () => {
  const text = messageInput.value.trim(); if (text === "") { alert("要先寫下心事喔！"); return; }
  const randomTargetDepth = canvas.height * 0.55 + Math.random() * (canvas.height * 0.35); const randomX = Math.random() * (canvas.width - 80) + 40;
  nodes.push({ radius: isMobile ? 4.5 : 7, color: selectedColor || '#ffffff', isInteractive: true, message: text, baseX: randomX, baseY: randomTargetDepth, currentX: randomX, currentY: -20, isFalling: true, velocityY: 0, isGlowFading: false, glowIntensity: 0 });
  db.collection("emocean_bottles").add({ color: selectedColor, text: text, createdAt: Date.now() }); mySavedBottles.push({ color: selectedColor, text: text, createdAt: Date.now() }); updateWordCloud(); closePenPanel(); 
};

/* ==========================================
   10. 滑鼠 Tooltip (電腦版)
   ========================================== */
canvas.addEventListener('mousemove', (event) => {
  if (isMobile) return; 
  const mouseX = event.clientX; const mouseY = event.clientY; let hoveredNode = null; let minDistance = 15; 
  for (let i = 0; i < nodes.length; i++) { const node = nodes[i]; if (!node.isInteractive) continue; const dist = Math.hypot(mouseX - node.currentX, mouseY - node.currentY); if (dist < minDistance) { minDistance = dist; hoveredNode = node; } }
  if (hoveredNode) {
    const palette = getPalette(); tooltip.style.display = 'block'; tooltipContent.innerText = hoveredNode.message; tooltip.style.borderColor = palette.tooltipBorder === 'transparent' ? hoveredNode.color : palette.tooltipBorder;
    let tipX = mouseX + 15; let tipY = mouseY + 15; if (tipX + tooltip.offsetWidth > window.innerWidth) tipX = mouseX - tooltip.offsetWidth - 15; if (tipY + tooltip.offsetHeight > window.innerHeight) tipY = mouseY - tooltip.offsetHeight - 15; 
    tooltip.style.left = tipX + 'px'; tooltip.style.top = tipY + 'px'; document.body.style.cursor = 'pointer'; 
  } else { tooltip.style.display = 'none'; document.body.style.cursor = 'default'; }
});

/* ==========================================
   11. 手機版 UI 專屬互動邏輯 (🌟 完美狀態切換邏輯)
   ========================================== */
const viewMsgBtn = document.getElementById('viewMsgBtn');
const writeMsgBtn = document.getElementById('writeMsgBtn');

function updateMobileTooltipText(node) {
  if (!node) return; const palette = getPalette(); tooltip.style.display = 'block'; tooltipContent.innerText = node.message; tooltip.style.borderColor = palette.tooltipBorder === 'transparent' ? node.color : palette.tooltipBorder;
}

if (isMobile) {
  // 🌟 點擊齒輪時：底部選單和齒輪自己都消失，打開面板
  settingBtn.addEventListener('click', (e) => { 
    e.stopPropagation(); dimOverlay.classList.remove('hidden'); settingBtn.classList.add('hidden'); mobileBottomBar.classList.add('hidden'); dpadPanel.classList.add('hidden'); settingsPanel.classList.remove('hidden'); mobileState = 'settings'; 
  });
  
  // 🌟 點擊外圍空白處：收起所有面板，齒輪與底部選單一起重新出現
  dimOverlay.addEventListener('click', () => { 
    settingsPanel.classList.add('hidden'); inputContent.classList.add('hidden'); dimOverlay.classList.add('hidden'); 
    settingBtn.classList.remove('hidden'); mobileBottomBar.classList.remove('hidden'); mobileState = 'bottomBar'; resetInputPanel(); 
  });
  
  // 🌟 點擊撰寫留言：底部選單和齒輪一起消失
  writeMsgBtn.addEventListener('click', (e) => { 
    e.stopPropagation(); mobileBottomBar.classList.add('hidden'); settingBtn.classList.add('hidden'); inputContent.classList.remove('hidden'); dimOverlay.classList.remove('hidden'); mobileState = 'writing'; 
  });
  
  // 🌟 點擊查看留言：底部選單和齒輪一起消失
  viewMsgBtn.addEventListener('click', (e) => { 
    e.stopPropagation(); mobileBottomBar.classList.add('hidden'); dpadPanel.classList.remove('hidden'); settingBtn.classList.add('hidden'); mobileState = 'dpad'; 
    const centerX = canvas.width / 2, centerY = canvas.height / 2; let minDistance = Infinity; nodes.forEach(node => { if (!node.isInteractive) return; const dist = Math.hypot(node.currentX - centerX, node.currentY - centerY); if (dist < minDistance) { minDistance = dist; selectedParticle = node; } }); updateMobileTooltipText(selectedParticle); 
  });

  const moveSelection = (direction) => { if (!selectedParticle) return; let candidates = nodes.filter(n => n.isInteractive && n !== selectedParticle); if (direction === 'up') candidates = candidates.filter(n => n.currentY < selectedParticle.currentY); if (direction === 'down') candidates = candidates.filter(n => n.currentY > selectedParticle.currentY); if (direction === 'left') candidates = candidates.filter(n => n.currentX < selectedParticle.currentX); if (direction === 'right') candidates = candidates.filter(n => n.currentX > selectedParticle.currentX); if (candidates.length === 0) return; candidates.sort((a, b) => Math.hypot(a.currentX - selectedParticle.currentX, a.currentY - selectedParticle.currentY) - Math.hypot(b.currentX - selectedParticle.currentX, b.currentY - selectedParticle.currentY)); selectedParticle = candidates[0]; updateMobileTooltipText(selectedParticle); };
  document.getElementById('dpadUp').onclick = (e) => { e.stopPropagation(); moveSelection('up'); }; document.getElementById('dpadDown').onclick = (e) => { e.stopPropagation(); moveSelection('down'); }; document.getElementById('dpadLeft').onclick = (e) => { e.stopPropagation(); moveSelection('left'); }; document.getElementById('dpadRight').onclick = (e) => { e.stopPropagation(); moveSelection('right'); };
}

/* ==========================================
   13. 🎵 Web Audio API 音樂燈光秀引擎
   ========================================== */
const trackSources = [ './audio/track1.mp3', './audio/track2.mp3', './audio/track3.mp3', './audio/track4.mp3', './audio/track5.mp3', './audio/track6.mp3' ];
function initAudio() {
  if (audioCtx) return; 
  audioCtx = new (window.AudioContext || window.webkitAudioContext)(); analyser = audioCtx.createAnalyser(); analyser.fftSize = 256; 
  const bufferLength = analyser.frequencyBinCount; dataArray = new Uint8Array(bufferLength);
  trackSources.forEach(src => { const audio = new Audio(src); audio.crossOrigin = "anonymous"; audio.loop = true; const source = audioCtx.createMediaElementSource(audio); source.connect(analyser); tracks.push(audio); });
  analyser.connect(audioCtx.destination);
}
const musicBtns = document.querySelectorAll('.music-mode-btn');
musicBtns.forEach((btn, index) => {
  btn.addEventListener('click', () => {
    initAudio(); if (audioCtx.state === 'suspended') audioCtx.resume();
    if (currentTrackIndex === index) { tracks[index].pause(); btn.classList.remove('playing'); currentTrackIndex = -1; return; }
    tracks.forEach(track => track.pause()); musicBtns.forEach(b => b.classList.remove('playing'));
    tracks[index].currentTime = 0; tracks[index].play(); btn.classList.add('playing'); currentTrackIndex = index;
  });
});