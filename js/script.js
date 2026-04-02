function initImageSlider() {
  const sliderWrapper = document.querySelector('.slider-wrapper');
  const sliderItems = document.querySelectorAll('.slider-item');
  const prevBtn = document.querySelector('.slider-btn.prev');
  const nextBtn = document.querySelector('.slider-btn.next');

  if (!sliderWrapper || !sliderItems.length) return;

  let currentIndex = 0;
  const itemCount = sliderItems.length;
  const itemWidth = 100;

  const firstSlide = sliderItems[0].cloneNode(true);
  sliderWrapper.appendChild(firstSlide);

  let autoSlideInterval = window.setInterval(nextSlide, 7000);

  function nextSlide() {
    currentIndex += 1;
    updateSlider();

    if (currentIndex === itemCount) {
      window.setTimeout(() => {
        currentIndex = 0;
        sliderWrapper.style.transition = 'none';
        updateSlider();

        window.setTimeout(() => {
          sliderWrapper.style.transition = 'transform 2s ease';
        }, 50);
      }, 2000);
    }
  }

  function prevSlide() {
    if (currentIndex === 0) {
      currentIndex = itemCount;
      sliderWrapper.style.transition = 'none';
      updateSlider();

      window.setTimeout(() => {
        sliderWrapper.style.transition = 'transform 2s ease';
        currentIndex -= 1;
        updateSlider();
      }, 50);
      return;
    }

    currentIndex -= 1;
    updateSlider();
  }

  function updateSlider() {
    const translateX = -currentIndex * itemWidth;
    sliderWrapper.style.transform = `translateX(${translateX}%)`;
  }

  if (nextBtn) {
    nextBtn.addEventListener('click', () => {
      window.clearInterval(autoSlideInterval);
      nextSlide();
      autoSlideInterval = window.setInterval(nextSlide, 7000);
    });
  }

  if (prevBtn) {
    prevBtn.addEventListener('click', () => {
      window.clearInterval(autoSlideInterval);
      prevSlide();
      autoSlideInterval = window.setInterval(nextSlide, 7000);
    });
  }
}

function initHomePagePanelScroll() {
  if (!document.body.classList.contains('home-page')) return;
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

  const mainContainer = document.querySelector('.main-container');

  if (!mainContainer) return;

  let isAnimating = false;
  let releaseTimer = null;

  const getMainTop = () => mainContainer.getBoundingClientRect().top + window.scrollY;

  const lockScroll = (duration = 850) => {
    isAnimating = true;
    window.clearTimeout(releaseTimer);
    releaseTimer = window.setTimeout(() => {
      isAnimating = false;
    }, duration);
  };

  const snapTo = (top) => {
    lockScroll();
    window.scrollTo({
      top,
      behavior: 'smooth',
    });
  };

  window.addEventListener(
    'wheel',
    (event) => {
      if (window.innerWidth <= 1024) return;
      if (event.ctrlKey || Math.abs(event.deltaY) < 8) return;

      const mainTop = getMainTop();
      const currentY = window.scrollY;
      const direction = Math.sign(event.deltaY);
      const inHeaderZone = currentY < mainTop - 6;
      const inMainTopZone = currentY > 6 && currentY <= mainTop + window.innerHeight * 0.6;

      if (isAnimating) {
        event.preventDefault();
        return;
      }

      if (direction > 0 && inHeaderZone) {
        event.preventDefault();
        snapTo(mainTop);
        return;
      }

      if (direction < 0 && inMainTopZone) {
        event.preventDefault();
        snapTo(0);
      }
    },
    { passive: false }
  );
}

function initHomePageTitleFade() {
  if (!document.body.classList.contains('home-page')) return;
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

  const mainContainer = document.querySelector('.main-container');
  if (!mainContainer) return;

  const updateFade = () => {
    const mainTop = mainContainer.getBoundingClientRect().top + window.scrollY;
    const fadeDistance = Math.max(220, mainTop * 0.72);
    const progress = Math.min(window.scrollY / fadeDistance, 1);

    document.body.style.setProperty('--home-copy-fade', progress.toFixed(3));
  };

  window.addEventListener('scroll', updateFade, { passive: true });
  window.addEventListener('resize', updateFade);
  updateFade();
}

function initAll() {
  initImageSlider();
  initHomePagePanelScroll();
  initHomePageTitleFade();
}

window.addEventListener('DOMContentLoaded', initAll);
