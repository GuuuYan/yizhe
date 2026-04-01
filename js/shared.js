/**
 * 共享功能模块
 * 包含所有页面共享的功能：导航栏高亮、返回顶部、音乐播放、夜间模式等
 */

// 导航栏高亮功能
function initNavHighlight() {
  const navLinks = document.querySelectorAll('.nav-link');
  if (!navLinks.length) return;

  // 获取当前页面的page-id
  const currentPageId = document.querySelector('meta[name="page-id"]')?.content;
  
  // 根据page-id高亮对应的导航链接
  navLinks.forEach(link => {
    link.classList.remove('active');
    
    // 获取链接指向的页面ID
    const href = link.getAttribute('href');
    let linkPageId = null;
    
    if (href === './' || href === '../' || href === '/' || href === './index.html' || href === '../index.html') {
      linkPageId = 'home';
    } else {
      // 从href中提取页面ID (例如 ./map.html -> map)
      const match = href.match(/([a-z-]+)\.html/);
      if (match) {
        linkPageId = match[1];
      }
    }
    
    // 如果链接的page-id与当前页面的page-id匹配，添加active类
    if (linkPageId === currentPageId) {
      link.classList.add('active');
    }
  });
}

// 返回顶部按钮功能
function initBackToTop() {
  const backToTopBtn = document.getElementById('backToTop');
  if (!backToTopBtn) return;

  // 初始隐藏按钮
  backToTopBtn.style.display = 'none';

  window.addEventListener('scroll', () => {
    if (window.pageYOffset > 300) {
      backToTopBtn.style.display = 'block';
    } else {
      backToTopBtn.style.display = 'none';
    }
  });

  backToTopBtn.addEventListener('click', () => {
    window.scrollTo({
      top: 0,
      behavior: 'smooth'
    });
  });
}

// 全局音乐对象管理
function initBackgroundMusic() {
  // 确定音乐文件路径
  const isModulePage = window.location.pathname.includes('/pages/');
  const musicPath = isModulePage ? '../voice/2月28日.MP3' : './voice/2月28日.MP3';

  // 创建或获取全局音乐对象
  if (!window.backgroundMusic) {
    window.backgroundMusic = new Audio(musicPath);
    window.backgroundMusic.volume = 0.4;
    window.backgroundMusic.loop = false;
  }

  const backgroundMusic = window.backgroundMusic;
  const musicToggle = document.getElementById('musicToggle');
  const musicIcon = document.getElementById('musicIcon');

  if (!musicToggle || !musicIcon) return;

  // 从状态管理器恢复音乐播放状态
  let isMusicPlaying = StateManager.getMusicPlaying();

  // 更新UI
  const updateMusicUI = () => {
    if (isMusicPlaying) {
      musicIcon.textContent = '🎵';
      musicToggle.title = '关闭背景音乐';
    } else {
      musicIcon.textContent = '🔇';
      musicToggle.title = '开启背景音乐';
    }
  };

  updateMusicUI();

  // 音乐播放结束后等待25秒再重新播放
  backgroundMusic.addEventListener('ended', () => {
    if (isMusicPlaying) {
      setTimeout(() => {
        if (isMusicPlaying) {
          backgroundMusic.play().catch((e) => {
            console.error('音乐重新播放失败:', e);
          });
        }
      }, 25000);
    }
  });

  // 切换音乐播放状态
  function toggleMusic() {
    if (isMusicPlaying) {
      backgroundMusic.pause();
      backgroundMusic.currentTime = 0;
      isMusicPlaying = false;
    } else {
      backgroundMusic.play().catch((e) => {
        console.error('音乐播放失败:', e);
      });
      isMusicPlaying = true;
    }
    
    // 保存状态
    StateManager.setMusicPlaying(isMusicPlaying);
    updateMusicUI();
  }

  // 绑定音乐切换按钮事件
  musicToggle.addEventListener('click', toggleMusic);

  // 尝试自动播放（如果之前是播放状态）
  if (isMusicPlaying) {
    backgroundMusic.play().catch((e) => {
      console.log('自动播放失败，等待用户交互:', e);
      // 自动播放失败，添加点击事件监听器
      const playMusicOnClick = () => {
        backgroundMusic.play().catch((e) => {
          console.error('点击播放音乐失败:', e);
        });
        document.removeEventListener('click', playMusicOnClick);
      };
      document.addEventListener('click', playMusicOnClick);
    });
  }
}

// 夜间模式切换功能
function initDarkMode() {
  const modeToggle = document.getElementById('modeToggle');
  const modeIcon = document.getElementById('modeIcon');

  if (!modeToggle || !modeIcon) return;

  // 从状态管理器恢复夜间模式状态
  const isDarkMode = StateManager.getDarkMode();

  // 应用保存的状态
  if (isDarkMode) {
    document.body.classList.add('dark-mode');
    modeIcon.textContent = '☀️';
    modeToggle.title = '关闭夜间模式';
  } else {
    document.body.classList.remove('dark-mode');
    modeIcon.textContent = '🌙';
    modeToggle.title = '开启夜间模式';
  }

  // 点击切换模式
  modeToggle.addEventListener('click', () => {
    document.body.classList.toggle('dark-mode');

    if (document.body.classList.contains('dark-mode')) {
      modeIcon.textContent = '☀️';
      modeToggle.title = '关闭夜间模式';
      StateManager.setDarkMode(true);
    } else {
      modeIcon.textContent = '🌙';
      modeToggle.title = '开启夜间模式';
      StateManager.setDarkMode(false);
    }
  });
}

// 初始化所有共享功能
function initSharedFeatures() {
  console.log('初始化共享功能');
  initNavHighlight();
  initBackToTop();
  initBackgroundMusic();
  initDarkMode();
  console.log('共享功能初始化完成');
}

// 页面加载完成后初始化
window.addEventListener('DOMContentLoaded', initSharedFeatures);
