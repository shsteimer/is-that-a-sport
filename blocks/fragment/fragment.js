/*
 * Fragment Block
 * Include content on a page as a fragment.
 * https://www.aem.live/developer/block-collection/fragment
 */

// eslint-disable-next-line import/no-cycle
import {
  decorateMain,
} from '../../scripts/scripts.js';

import {
  loadSections,
} from '../../scripts/aem.js';

/**
 * Loads a fragment.
 * @param {string} path The path to the fragment
 * @returns {HTMLElement} The root element of the fragment
 */
export async function loadFragment(path) {
  if (path && path.startsWith('/') && !path.startsWith('//')) {
    let html;
    const plainResp = await fetch(`${path}.plain.html`);
    if (plainResp.ok) {
      html = await plainResp.text();
    } else {
      // local dev fallback: extract main from the full doc when .plain.html is absent
      const resp = await fetch(path);
      if (!resp.ok) return null;
      const doc = new DOMParser().parseFromString(await resp.text(), 'text/html');
      const mainEl = doc.querySelector('main');
      if (!mainEl) return null;
      html = mainEl.innerHTML;
    }
    const main = document.createElement('main');
    main.innerHTML = html;

    // reset base path for media to fragment base
    const resetAttributeBase = (tag, attr) => {
      main.querySelectorAll(`${tag}[${attr}^="./media_"]`).forEach((elem) => {
        elem[attr] = new URL(elem.getAttribute(attr), new URL(path, window.location)).href;
      });
    };
    resetAttributeBase('img', 'src');
    resetAttributeBase('source', 'srcset');

    decorateMain(main);
    await loadSections(main);
    return main;
  }
  return null;
}

export default async function decorate(block) {
  const link = block.querySelector('a');
  const path = link ? link.getAttribute('href') : block.textContent.trim();
  const fragment = await loadFragment(path);
  if (fragment) block.replaceChildren(...fragment.childNodes);
}
