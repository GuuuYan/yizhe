/**
 * 状态管理模块
 * 负责管理应用的全局状态，包括夜间模式和音乐播放状态
 * 使用localStorage进行持久化存储
 */

const StateManager = (() => {
  // 检查localStorage是否可用
  const isLocalStorageAvailable = () => {
    try {
      const test = '__localStorage_test__';
      localStorage.setItem(test, test);
      localStorage.removeItem(test);
      return true;
    } catch (e) {
      console.warn('localStorage不可用，将使用内存存储', e);
      return false;
    }
  };

  const storageAvailable = isLocalStorageAvailable();
  const memoryStore = {}; // 备用内存存储

  // 获取值
  const getItem = (key) => {
    try {
      if (storageAvailable) {
        return localStorage.getItem(key);
      } else {
        return memoryStore[key] || null;
      }
    } catch (e) {
      console.error('获取状态失败:', e);
      return null;
    }
  };

  // 设置值
  const setItem = (key, value) => {
    try {
      if (storageAvailable) {
        localStorage.setItem(key, value);
      } else {
        memoryStore[key] = value;
      }
    } catch (e) {
      console.error('设置状态失败:', e);
    }
  };

  // 公开接口
  return {
    // 夜间模式相关
    getDarkMode: () => {
      const value = getItem('darkMode');
      return value === 'true';
    },

    setDarkMode: (isDark) => {
      setItem('darkMode', isDark ? 'true' : 'false');
    },

    // 音乐播放状态相关
    getMusicPlaying: () => {
      const value = getItem('musicPlaying');
      return value === 'true';
    },

    setMusicPlaying: (isPlaying) => {
      setItem('musicPlaying', isPlaying ? 'true' : 'false');
    },

    // 通用的获取/设置方法
    get: (key) => getItem(key),
    set: (key, value) => setItem(key, value),

    // 检查localStorage是否可用
    isAvailable: () => storageAvailable
  };
})();
