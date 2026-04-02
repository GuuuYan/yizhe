/**
 * 共享功能模块
 * 包含所有页面共用的功能：导航栏高亮、返回顶部、背景音乐、夜间模式等
 */

function initNavHighlight() {
  const navLinks = document.querySelectorAll('.nav-link');
  if (!navLinks.length) return;

  const currentPageId = document.querySelector('meta[name="page-id"]')?.content;

  navLinks.forEach((link) => {
    link.classList.remove('active');

    const href = link.getAttribute('href');
    let linkPageId = null;

    if (
      href === './' ||
      href === '../' ||
      href === '/' ||
      href === './index.html' ||
      href === '../index.html'
    ) {
      linkPageId = 'home';
    } else {
      const match = href?.match(/([a-z-]+)\.html/);
      if (match) {
        linkPageId = match[1];
      }
    }

    if (linkPageId === currentPageId) {
      link.classList.add('active');
    }
  });
}

function initBackToTop() {
  const backToTopBtn = document.getElementById('backToTop');
  if (!backToTopBtn) return;
  const isHomePage = document.body.classList.contains('home-page');

  const updateVisibility = () => {
    const visibilityThreshold = isHomePage ? Math.max(420, window.innerHeight * 0.55) : 300;

    if (window.pageYOffset > visibilityThreshold) {
      backToTopBtn.classList.add('visible');
    } else {
      backToTopBtn.classList.remove('visible');
    }
  };

  window.addEventListener('scroll', updateVisibility);
  updateVisibility();

  backToTopBtn.addEventListener('click', () => {
    window.scrollTo({
      top: 0,
      behavior: 'smooth',
    });
  });
}

function initBackgroundMusic() {
  const isModulePage = window.location.pathname.includes('/pages/');
  const musicPath = isModulePage ? '../voice/2月28日.MP3' : './voice/2月28日.MP3';

  if (!window.backgroundMusic) {
    window.backgroundMusic = new Audio(musicPath);
    window.backgroundMusic.volume = 0.4;
    window.backgroundMusic.loop = false;
  }

  const backgroundMusic = window.backgroundMusic;
  const musicToggle = document.getElementById('musicToggle');
  const musicIcon = document.getElementById('musicIcon');

  if (!musicToggle || !musicIcon) return;

  let isMusicPlaying = StateManager.getMusicPlaying();

  const updateMusicUI = () => {
    if (isMusicPlaying) {
      musicIcon.textContent = '🎵';
      musicToggle.title = '关闭背景音乐';
      musicToggle.setAttribute('aria-pressed', 'true');
    } else {
      musicIcon.textContent = '🔇';
      musicToggle.title = '开启背景音乐';
      musicToggle.setAttribute('aria-pressed', 'false');
    }
  };

  updateMusicUI();

  backgroundMusic.addEventListener('ended', () => {
    if (!isMusicPlaying) return;

    setTimeout(() => {
      if (!isMusicPlaying) return;

      backgroundMusic.play().catch((error) => {
        console.error('背景音乐重新播放失败:', error);
      });
    }, 25000);
  });

  function toggleMusic() {
    if (isMusicPlaying) {
      backgroundMusic.pause();
      backgroundMusic.currentTime = 0;
      isMusicPlaying = false;
    } else {
      backgroundMusic.play().catch((error) => {
        console.error('背景音乐播放失败:', error);
      });
      isMusicPlaying = true;
    }

    StateManager.setMusicPlaying(isMusicPlaying);
    updateMusicUI();
  }

  musicToggle.addEventListener('click', toggleMusic);

  if (isMusicPlaying) {
    backgroundMusic.play().catch((error) => {
      console.log('自动播放失败，等待用户交互后重试:', error);

      const playMusicOnClick = () => {
        backgroundMusic.play().catch((playError) => {
          console.error('点击后播放背景音乐失败:', playError);
        });
        document.removeEventListener('click', playMusicOnClick);
      };

      document.addEventListener('click', playMusicOnClick);
    });
  }
}

function initDarkMode() {
  const modeToggle = document.getElementById('modeToggle');
  const modeIcon = document.getElementById('modeIcon');

  if (!modeToggle || !modeIcon) return;

  const isDarkMode = StateManager.getDarkMode();

  if (isDarkMode) {
    document.body.classList.add('dark-mode');
    modeIcon.textContent = '🌙';
    modeToggle.title = '关闭夜间模式';
    modeToggle.setAttribute('aria-pressed', 'true');
  } else {
    document.body.classList.remove('dark-mode');
    modeIcon.textContent = '☀️';
    modeToggle.title = '开启夜间模式';
    modeToggle.setAttribute('aria-pressed', 'false');
  }

  modeToggle.addEventListener('click', () => {
    document.body.classList.toggle('dark-mode');

    if (document.body.classList.contains('dark-mode')) {
      modeIcon.textContent = '🌙';
      modeToggle.title = '关闭夜间模式';
      modeToggle.setAttribute('aria-pressed', 'true');
      StateManager.setDarkMode(true);
    } else {
      modeIcon.textContent = '☀️';
      modeToggle.title = '开启夜间模式';
      modeToggle.setAttribute('aria-pressed', 'false');
      StateManager.setDarkMode(false);
    }
  });
}

function initSharedFeatures() {
  console.log('初始化共享功能');
  initNavHighlight();
  initBackToTop();
  initBackgroundMusic();
  initDarkMode();
  console.log('共享功能初始化完成');
}

window.addEventListener('DOMContentLoaded', initSharedFeatures);
