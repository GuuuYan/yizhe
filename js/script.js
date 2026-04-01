// 图片滚动效果
function initImageSlider() {
  const sliderWrapper = document.querySelector('.slider-wrapper');
  const sliderItems = document.querySelectorAll('.slider-item');
  const prevBtn = document.querySelector('.slider-btn.prev');
  const nextBtn = document.querySelector('.slider-btn.next');
  
  if (!sliderWrapper || !sliderItems.length) return;
  
  let currentIndex = 0;
  const itemCount = sliderItems.length;
  const itemWidth = 100;
  
  // 复制第一张图片到末尾，实现无缝循环
  const firstSlide = sliderItems[0].cloneNode(true);
  sliderWrapper.appendChild(firstSlide);
  
  // 自动滚动
  let autoSlideInterval = setInterval(nextSlide, 7000);
  
  function nextSlide() {
    currentIndex++;
    updateSlider();
    
    // 当滚动到最后一张（复制的第一张）时，立即重置到第一张，实现无缝循环
    if (currentIndex === itemCount) {
      setTimeout(() => {
        currentIndex = 0;
        // 禁用过渡效果
        sliderWrapper.style.transition = 'none';
        updateSlider();
        // 重新启用过渡效果
        setTimeout(() => {
          sliderWrapper.style.transition = 'transform 2s ease';
        }, 50);
      }, 2000);
    }
  }
  
  function prevSlide() {
    if (currentIndex === 0) {
      // 如果当前是第一张，先快速滚动到最后一张（复制的第一张）
      currentIndex = itemCount;
      sliderWrapper.style.transition = 'none';
      updateSlider();
      setTimeout(() => {
        sliderWrapper.style.transition = 'transform 2s ease';
        currentIndex--;
        updateSlider();
      }, 50);
    } else {
      currentIndex--;
      updateSlider();
    }
  }
  
  function updateSlider() {
    const translateX = -currentIndex * itemWidth;
    sliderWrapper.style.transform = `translateX(${translateX}%)`;
  }
  
  // 按钮事件
  if (nextBtn) {
    nextBtn.addEventListener('click', () => {
      clearInterval(autoSlideInterval);
      nextSlide();
      autoSlideInterval = setInterval(nextSlide, 7000);
    });
  }
  
  if (prevBtn) {
    prevBtn.addEventListener('click', () => {
      clearInterval(autoSlideInterval);
      prevSlide();
      autoSlideInterval = setInterval(nextSlide, 7000);
    });
  }
}

// 初始化所有功能
function initAll() {
  console.log('开始初始化所有功能');
  initImageSlider();
  console.log('所有功能初始化完成');
}

// 页面加载完成后初始化
window.addEventListener('DOMContentLoaded', initAll);
