(() => {
  'use strict';

  const archive = window.CHARACTER_ARCHIVE;
  if (!archive) return;

  const elements = {
    search: document.getElementById('characterSearch'),
    filters: document.getElementById('categoryFilters'),
    directory: document.getElementById('characterDirectory'),
    count: document.getElementById('characterCount'),
    dossier: document.querySelector('.character-dossier'),
    name: document.getElementById('activeCharacterName'),
    category: document.getElementById('activeCategory'),
    fileCode: document.getElementById('activeFileCode'),
    portraitCode: document.getElementById('portraitCode'),
    content: document.getElementById('characterContent'),
  };

  const headings = new Set([
    '性格', '性格：', '性格特征', '性格特征：', '技能介绍', '异能介绍', '异能介绍：',
    '人物介绍', '人物介绍：', '人物志', '人物志：', '心理阴影', '厌恶', '诅咒', '诅咒：',
    '特殊疾病', '经历：', '存在状态：', '其他：', '履历：', '人际关系', '有关寄生灵',
    '造成异常的原因', '兄妹人物介绍：', '兄妹的一些小故事', '关于大主教“吃人”的步骤：',
  ]);
  const categoryById = new Map(archive.categories.map((category) => [category.id, category]));
  const characterById = new Map(archive.characters.map((character) => [character.id, character]));
  let activeCategory = 'all';
  let activeCharacterId = archive.characters[0].id;

  function createTextElement(paragraph, index) {
    const text = paragraph.text;
    const element = document.createElement(headings.has(text.trim()) ? 'h4' : 'p');
    element.textContent = text;
    element.dataset.sourceIndex = paragraph.index;
    if (index === 0) element.classList.add('source-record-title');
    if (/^①|^②|^③/.test(text.trim())) element.classList.add('source-list-line');
    return element;
  }

  function renderSourceText(container, paragraphs) {
    container.replaceChildren(...paragraphs.map(createTextElement));
  }

  function renderFilters() {
    const options = [{ id: 'all', name: '全部' }, ...archive.categories];
    elements.filters.replaceChildren(...options.map((option) => {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'category-filter';
      button.textContent = option.name;
      button.dataset.category = option.id;
      button.setAttribute('aria-pressed', String(option.id === activeCategory));
      button.addEventListener('click', () => {
        activeCategory = option.id;
        renderFilters();
        renderDirectory();
      });
      return button;
    }));
  }

  function getFilteredCharacters() {
    const query = elements.search.value.trim().toLocaleLowerCase('zh-CN');
    return archive.characters.filter((character) => {
      const categoryMatches = activeCategory === 'all' || character.category === activeCategory;
      const textMatches = !query || character.name.toLocaleLowerCase('zh-CN').includes(query)
        || character.paragraphs.some((paragraph) => paragraph.text.toLocaleLowerCase('zh-CN').includes(query));
      return categoryMatches && textMatches;
    });
  }

  function showCharacter(characterId, updateHash = true) {
    const character = characterById.get(characterId);
    if (!character) return;
    activeCharacterId = characterId;
    elements.dossier.hidden = false;
    renderDirectory();
    renderDossier(character);
    if (updateHash) history.replaceState(null, '', `#${characterId}`);
    document.title = `${character.name} - 角色档案`;
  }

  function renderDirectory() {
    const filtered = getFilteredCharacters();
    elements.count.textContent = `${filtered.length} / ${archive.characters.length}`;
    if (!filtered.length) {
      const empty = document.createElement('p');
      empty.className = 'directory-empty';
      empty.textContent = '没有找到匹配的角色。';
      elements.directory.replaceChildren(empty);
      return;
    }

    const fragment = document.createDocumentFragment();
    let lastCategory = null;
    filtered.forEach((character) => {
      if (character.category !== lastCategory) {
        const label = document.createElement('p');
        label.className = 'directory-category-label';
        label.textContent = categoryById.get(character.category).name;
        fragment.append(label);
        lastCategory = character.category;
      }
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'character-directory-item';
      button.classList.toggle('active', character.id === activeCharacterId && !elements.dossier.hidden);
      if (character.id === activeCharacterId && !elements.dossier.hidden) {
        button.setAttribute('aria-current', 'true');
      }
      button.innerHTML = `<span>${String(archive.characters.indexOf(character) + 1).padStart(2, '0')}</span>`;
      const name = document.createElement('strong');
      name.textContent = character.name;
      button.append(name);
      button.addEventListener('click', () => showCharacter(character.id));
      fragment.append(button);
    });
    elements.directory.replaceChildren(fragment);
  }

  function renderDossier(character) {
    const category = categoryById.get(character.category);
    const recordNumber = archive.characters.indexOf(character) + 1;
    elements.name.textContent = character.name;
    elements.category.textContent = category.name;
    elements.fileCode.textContent = `${category.code} / ${String(recordNumber).padStart(3, '0')}`;
    elements.portraitCode.textContent = `A-${String(recordNumber).padStart(2, '0')}`;
    renderSourceText(elements.content, character.paragraphs);
  }

  elements.search.addEventListener('input', renderDirectory);
  window.addEventListener('hashchange', () => {
    const nextId = decodeURIComponent(location.hash.slice(1));
    showCharacter(characterById.has(nextId) ? nextId : archive.characters[0].id, false);
  });
  renderFilters();
  renderDirectory();
  const hashId = decodeURIComponent(location.hash.slice(1));
  showCharacter(characterById.has(hashId) ? hashId : archive.characters[0].id, false);
})();
