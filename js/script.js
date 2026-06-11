function initImageSlider() {
  const slider = document.querySelector('.image-slider');
  const sliderWrapper = document.querySelector('.slider-wrapper');
  const sliderItems = document.querySelectorAll('.slider-item');
  const prevBtn = document.querySelector('.slider-btn.prev');
  const nextBtn = document.querySelector('.slider-btn.next');

  if (!sliderWrapper || !sliderItems.length) return;

  let currentIndex = 0;
  const itemCount = sliderItems.length;
  const itemWidth = 100;
  const slideIntervalMs = 4200;
  const slideTransitionMs = 900;
  const slideTransition = `transform ${slideTransitionMs}ms ease`;

  const firstSlide = sliderItems[0].cloneNode(true);
  sliderWrapper.appendChild(firstSlide);
  sliderWrapper.style.transition = slideTransition;

  let autoSlideInterval = window.setInterval(nextSlide, slideIntervalMs);

  function restartAutoSlide() {
    window.clearInterval(autoSlideInterval);
    autoSlideInterval = window.setInterval(nextSlide, slideIntervalMs);
  }

  function nextSlide() {
    currentIndex += 1;
    updateSlider();

    if (currentIndex === itemCount) {
      window.setTimeout(() => {
        currentIndex = 0;
        sliderWrapper.style.transition = 'none';
        updateSlider();

        window.setTimeout(() => {
          sliderWrapper.style.transition = slideTransition;
        }, 50);
      }, slideTransitionMs);
    }
  }

  function prevSlide() {
    if (currentIndex === 0) {
      currentIndex = itemCount;
      sliderWrapper.style.transition = 'none';
      updateSlider();

      window.setTimeout(() => {
        sliderWrapper.style.transition = slideTransition;
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
      nextSlide();
      restartAutoSlide();
    });
  }

  if (prevBtn) {
    prevBtn.addEventListener('click', () => {
      prevSlide();
      restartAutoSlide();
    });
  }

  if (slider) {
    slider.addEventListener('mouseenter', () => window.clearInterval(autoSlideInterval));
    slider.addEventListener('mouseleave', restartAutoSlide);
    slider.addEventListener('focusin', () => window.clearInterval(autoSlideInterval));
    slider.addEventListener('focusout', restartAutoSlide);
  }
}

function initHomePagePanelScroll() {
  if (!document.body.classList.contains('home-page')) return;
  if (document.body.classList.contains('anime-home-page')) return;
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

  let isTicking = false;

  const updateFade = () => {
    const mainTop = mainContainer.getBoundingClientRect().top + window.scrollY;
    const fadeDistance = Math.max(220, mainTop * 0.72);
    const progress = Math.min(window.scrollY / fadeDistance, 1);

    document.body.style.setProperty('--home-copy-fade', progress.toFixed(3));
    isTicking = false;
  };

  const requestFadeUpdate = () => {
    if (isTicking) return;

    isTicking = true;
    window.requestAnimationFrame(updateFade);
  };

  window.addEventListener('scroll', requestFadeUpdate, { passive: true });
  window.addEventListener('resize', requestFadeUpdate);
  updateFade();
}

function initArchiveCardGlow() {
  const cards = document.querySelectorAll('.archive-card');
  if (!cards.length) return;

  cards.forEach((card) => {
    card.addEventListener('pointermove', (event) => {
      const rect = card.getBoundingClientRect();
      const x = ((event.clientX - rect.left) / rect.width) * 100;
      const y = ((event.clientY - rect.top) / rect.height) * 100;

      card.style.setProperty('--mx', `${x}%`);
      card.style.setProperty('--my', `${y}%`);
    });
  });
}

function initHomeMapSwitcher() {
  const mapImage = document.querySelector('.home-map-image');
  const switchButtons = document.querySelectorAll('.map-switch-btn');

  if (!mapImage || !switchButtons.length) return;

  switchButtons.forEach((button) => {
    button.addEventListener('click', () => {
      const mapSrc = button.dataset.mapSrc;
      const mapAlt = button.dataset.mapAlt;

      if (!mapSrc || !mapAlt) return;

      switchButtons.forEach((item) => {
        item.classList.toggle('active', item === button);
        item.setAttribute('aria-pressed', item === button ? 'true' : 'false');
      });

      mapImage.src = mapSrc;
      mapImage.alt = mapAlt;
    });
  });
}

function initTimelineDrag() {
  const dragArea = document.querySelector('.timeline-drag-area');
  if (!dragArea) return;

  let isDragging = false;
  let hasDragged = false;
  let startX = 0;
  let startScrollLeft = 0;

  dragArea.addEventListener('pointerdown', (event) => {
    if (event.button !== 0) return;
    isDragging = true;
    hasDragged = false;
    startX = event.clientX;
    startScrollLeft = dragArea.scrollLeft;
    dragArea.dataset.dragMoved = 'false';
    dragArea.dataset.pointerStartedOnImage = event.target.closest('.timeline-image-button') ? 'true' : 'false';
    dragArea.classList.add('dragging');
    dragArea.setPointerCapture(event.pointerId);
  });

  dragArea.addEventListener('pointermove', (event) => {
    if (!isDragging) return;
    const deltaX = event.clientX - startX;
    if (Math.abs(deltaX) > 6) {
      hasDragged = true;
      dragArea.dataset.dragMoved = 'true';
    }
    dragArea.scrollLeft = startScrollLeft - deltaX;
  });

  const stopDragging = (event) => {
    if (!isDragging) return;
    isDragging = false;
    dragArea.classList.remove('dragging');
    if (hasDragged) {
      window.setTimeout(() => {
        dragArea.dataset.dragMoved = 'false';
      }, 120);
    }
    window.setTimeout(() => {
      dragArea.dataset.pointerStartedOnImage = 'false';
    }, 120);
    if (dragArea.hasPointerCapture(event.pointerId)) {
      dragArea.releasePointerCapture(event.pointerId);
    }
  };

  dragArea.addEventListener('pointerup', stopDragging);
  dragArea.addEventListener('pointercancel', stopDragging);
}

function initTimelineLightbox() {
  const trigger = document.querySelector('.timeline-image-button');
  const image = document.querySelector('.timeline-image');
  const dragArea = document.querySelector('.timeline-image-viewer');

  if (!trigger || !image) return;

  const lightbox = document.createElement('div');
  lightbox.className = 'timeline-lightbox';
  lightbox.setAttribute('role', 'dialog');
  lightbox.setAttribute('aria-modal', 'true');
  lightbox.setAttribute('aria-label', '世界时间线放大图');
  lightbox.hidden = true;

  const closeButton = document.createElement('button');
  closeButton.type = 'button';
  closeButton.className = 'timeline-lightbox-close';
  closeButton.setAttribute('aria-label', '关闭放大图');
  closeButton.textContent = '×';

  const frame = document.createElement('div');
  frame.className = 'timeline-lightbox-frame';
  frame.tabIndex = 0;

  const zoomedImage = document.createElement('img');
  zoomedImage.className = 'timeline-lightbox-image';
  zoomedImage.src = image.currentSrc || image.src;
  zoomedImage.alt = image.alt;

  frame.appendChild(zoomedImage);
  lightbox.append(closeButton, frame);
  document.body.appendChild(lightbox);

  const closeLightbox = () => {
    lightbox.classList.remove('open');
    document.body.classList.remove('timeline-lightbox-open');
    window.setTimeout(() => {
      lightbox.hidden = true;
    }, 180);
    trigger.focus({ preventScroll: true });
  };

  const openLightbox = (event) => {
    if (dragArea?.dataset.dragMoved === 'true') return;
    if (
      event?.detail !== 0 &&
      dragArea?.dataset.pointerStartedOnImage !== 'true' &&
      !event?.target.closest('.timeline-image-button')
    ) {
      return;
    }

    zoomedImage.src = image.currentSrc || image.src;
    zoomedImage.alt = image.alt;
    lightbox.hidden = false;
    document.body.classList.add('timeline-lightbox-open');
    window.requestAnimationFrame(() => {
      lightbox.classList.add('open');
      frame.scrollLeft = Math.max(0, (frame.scrollWidth - frame.clientWidth) / 2);
      closeButton.focus({ preventScroll: true });
    });
  };

  dragArea?.addEventListener('click', openLightbox);
  closeButton.addEventListener('click', closeLightbox);
  lightbox.addEventListener('click', (event) => {
    if (event.target === lightbox) closeLightbox();
  });

  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && !lightbox.hidden) {
      closeLightbox();
    }
  });
}

function initAll() {
  initImageSlider();
  initHomePagePanelScroll();
  initHomePageTitleFade();
  initArchiveCardGlow();
  initHomeMapSwitcher();
  initTimelineDrag();
  initTimelineLightbox();
}

window.addEventListener('DOMContentLoaded', initAll);
