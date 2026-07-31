/**
 * 档案页增强模块
 * 负责为正文页附加档案编号和分类标识，不修改正文内容
 */

const ARCHIVE_PAGE_CONFIG = Object.freeze({
  map: Object.freeze({ code: '01', label: 'MAP' }),
  objects: Object.freeze({ code: '02', label: 'OBJECTS' }),
  events: Object.freeze({ code: '03', label: 'EVENTS' }),
  terms: Object.freeze({ code: '04', label: 'TERMS' }),
  organizations: Object.freeze({ code: '05', label: 'ORGANIZATIONS' }),
  countries: Object.freeze({ code: '06', label: 'COUNTRIES' }),
  other: Object.freeze({ code: '07', label: 'OTHER RECORDS' }),
  mythology: Object.freeze({ code: '08', label: 'MYTHOLOGY' }),
  timeline: Object.freeze({ code: '09', label: 'TIMELINE' }),
  characters: Object.freeze({ code: '10', label: 'CHARACTERS' }),
});

function enhanceArchivePage(documentRef = document) {
  const pageId = documentRef.querySelector('meta[name="page-id"]')?.content;
  const config = ARCHIVE_PAGE_CONFIG[pageId];
  const contentArea = documentRef.querySelector('.content-area');

  if (!config || !contentArea) return null;

  documentRef.body.classList.add('archive-page');
  contentArea.dataset.archiveCode = config.code;
  contentArea.dataset.archiveLabel = config.label;
  return config;
}

if (typeof window !== 'undefined') {
  window.ArchivePage = Object.freeze({ ARCHIVE_PAGE_CONFIG, enhanceArchivePage });
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { ARCHIVE_PAGE_CONFIG, enhanceArchivePage };
}
