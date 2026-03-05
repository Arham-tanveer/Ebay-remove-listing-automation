(function () {
  if (window.ebayAutoSelectorInjected) return;
  window.ebayAutoSelectorInjected = true;

  /***********************
   * Utilities
   ***********************/
  function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  function extractNumberFromText(text) {
    if (!text) return 0;
    const m = text.replace(/,/g, '').match(/-?\d+/);
    return m ? parseInt(m[0], 10) : 0;
  }

  function parseTimeLeft(timeString) {
    if (!timeString) return 0;
    let days = 0, hours = 0, minutes = 0;
    const d = timeString.match(/(\d+)\s*d/);
    const h = timeString.match(/(\d+)\s*h/);
    const m = timeString.match(/(\d+)\s*m/);
    if (d) days = parseInt(d[1], 10);
    if (h) hours = parseInt(h[1], 10);
    if (m) minutes = parseInt(m[1], 10);
    return days + hours / 24 + minutes / 1440;
  }

  function compareValues(actual, operator, expected) {
    if (expected === '' || expected === null || expected === undefined) return true;
    const a = parseFloat(actual) || 0;
    const e = parseFloat(expected);
    switch (operator) {
      case '<': return a < e;
      case '<=': return a <= e;
      case '=': return a === e;
      case '>=': return a >= e;
      case '>': return a > e;
      default: return true;
    }
  }

  function dispatchChange(el) {
    try {
      el.dispatchEvent(new Event('input', { bubbles: true }));
      el.dispatchEvent(new Event('change', { bubbles: true }));
    } catch (err) { /* ignore */ }
  }

  function clickElement(el) {
    if (!el) return;
    try {
      el.scrollIntoView({block: 'center', inline: 'center'});
      el.dispatchEvent(new MouseEvent('mouseover', { bubbles: true }));
      el.click();
    } catch (err) {
      try {
        el.dispatchEvent(new MouseEvent('click', { bubbles: true }));
      } catch (e) { /* ignore */ }
    }
  }

  // function forceCheck(checkbox) {
  //   if (!checkbox) return;
  //   try {
  //     // Prefer clicking label or parent to trigger eBay handlers
  //     const label = checkbox.closest('label');
  //     if (label) {
  //       clickElement(label);
  //     } else if (checkbox.parentElement) {
  //       clickElement(checkbox.parentElement);
  //     }
  //     // fallback
  //     clickElement(checkbox);
  //     dispatchChange(checkbox);
  //   } catch (err) {
  //     checkbox.checked = true;
  //     dispatchChange(checkbox);
  //   }
  // }

    function forceCheck(checkbox) {
    if (!checkbox) return;
    try {
      // If already checked, do nothing (idempotent)
      if (checkbox.checked) return;

      // 1) Try setting property + events first (non-destructive)
      try {
        checkbox.checked = true;
        dispatchChange(checkbox);
        if (checkbox.checked) return;
      } catch (e) { /* ignore and fallback */ }

      // 2) Try clicking an associated label/parent to trigger site handlers
      const label = checkbox.closest('label') || checkbox.parentElement;
      if (label) {
        try {
          clickElement(label);
        } catch (e) { /* ignore */ }
        if (checkbox.checked) return;
      }

      // 3) Fallback: click the checkbox itself (synthesized via clickElement)
      try {
        clickElement(checkbox);
      } catch (e) { /* ignore */ }

      // 4) Final attempt: set property and dispatch events again
      checkbox.checked = true;
      dispatchChange(checkbox);
    } catch (err) {
      // last resort
      try { checkbox.checked = true; dispatchChange(checkbox); } catch(e) {}
    }
  }


  function forceUncheck(checkbox) {
    if (!checkbox) return;
    try {
      if (checkbox.checked) {
        const label = checkbox.closest('label');
        if (label) clickElement(label);
        else clickElement(checkbox);
        dispatchChange(checkbox);
      }
    } catch (err) {
      checkbox.checked = false;
      dispatchChange(checkbox);
    }
  }

  /***********************
   * Row detection & filters
   ***********************/
  function findListingRows() {
    // Primary: table rows under Active listings table
    let rows = Array.from(document.querySelectorAll('table tbody tr'));
    // Filter out header/empty rows
    rows = rows.filter(r => r.querySelector('input[type="checkbox"], [role="checkbox"]'));
    if (rows.length) return rows;

    // Fallback: any tr that contains a checkbox
    rows = Array.from(document.querySelectorAll('tr')).filter(r => r.querySelector('input[type="checkbox"]'));
    return rows;
  }

  function applyFiltersToPage(filters) {
    const rows = findListingRows();
    if (!rows || rows.length === 0) {
      throw new Error('No listing rows found on this page.');
    }

    let selectedCount = 0;

    rows.forEach(row => {

      // ===== CHECKBOX =====
      let checkbox = row.querySelector('input[type="checkbox"]');
      if (!checkbox) {
        const role = row.querySelector('[role="checkbox"]');
        checkbox = role && role.tagName.toLowerCase() === 'input'
          ? role
          : (role && role.querySelector('input[type="checkbox"]'));
      }
      if (!checkbox) return;

      // ===== QUANTITY =====
      let qty = 0;
      const qtyCell = row.querySelector('.shui-dt-column__availableQuantity');
      if (qtyCell) {
        const span = qtyCell.querySelector('span');
        if (span) qty = extractNumberFromText(span.textContent.trim());
      }

      // ===== OTHER COLUMNS =====
      const viewsEl = row.querySelector('.shui-dt-column__visitCount') || row.querySelector('td:nth-child(6)');
      const watchersEl = row.querySelector('.shui-dt-column__watchCount') || row.querySelector('td:nth-child(8)');
      const soldEl = row.querySelector('.shui-dt-column__soldQuantity') || row.querySelector('td:nth-child(9)');
      const timeEl = row.querySelector('.shui-dt-column__timeRemaining') || row.querySelector('td:nth-child(10)');

      const views = extractNumberFromText(viewsEl?.textContent.trim() || '');
      const watchers = extractNumberFromText(watchersEl?.textContent.trim() || '');
      const sold = extractNumberFromText(soldEl?.textContent.trim() || '');
      const daysLeft = parseTimeLeft(timeEl?.textContent.trim() || '');

      // ===== FILTER CHECK =====
      let meets = true;

      if (!compareValues(views, filters.views.op, filters.views.value)) meets = false;
      if (!compareValues(watchers, filters.watchers.op, filters.watchers.value)) meets = false;
      if (!compareValues(sold, filters.sold.op, filters.sold.value)) meets = false;
      if (!compareValues(daysLeft, filters.days.op, filters.days.value)) meets = false;
      if (!compareValues(qty, filters.quantity.op, filters.quantity.value)) meets = false;

      // ===== SELECT OR UNSELECT =====
      if (meets) {
        forceCheck(checkbox);
        selectedCount++;
      } else {
        forceUncheck(checkbox);
      }
    });

    // update eBay UI
    const table = document.querySelector('table');
    if (table) table.dispatchEvent(new Event('change', { bubbles: true }));

    return selectedCount;
}


  function clearAllSelectionsOnPage() {
    const cb = Array.from(document.querySelectorAll('input[type="checkbox"]'));
    cb.forEach(c => {
      if (c.checked) forceUncheck(c);
    });
    const table = document.querySelector('table');
    if (table) table.dispatchEvent(new Event('change', { bubbles: true }));
  }

  /***********************
   * End listings flow (per page bulk)
   ***********************/
  async function openActionsMenuAndClickEnd() {
    // Find Actions menu button inside bulk-action-bar
    const actionBtns = Array.from(document.querySelectorAll('.bulk-action-bar .fake-menu-button__button, .bulk-action-bar button'));
    let actionsBtn = actionBtns.find(b => b.textContent && b.textContent.trim().toLowerCase() === 'actions');

    // fallback: find the first fake-menu-button in bulk-action-bar that is enabled
    if (!actionsBtn) {
      actionsBtn = document.querySelector('.bulk-action-bar .fake-menu-button__button:not([disabled])') || document.querySelector('.bulk-action-bar button:not([disabled])');
    }
    if (!actionsBtn) throw new Error('Actions button not found');

    clickElement(actionsBtn);
    await sleep(300);

    // find menu and the End listings item (button or anchor)
    // menu items often inside .fake-menu-button__menu or .fake-menu__items
    const menuRoot = document.querySelector('.bulk-action-bar .fake-menu-button__menu, .bulk-action-bar .fake-menu__items');
    let endBtn;
    if (menuRoot) {
      endBtn = Array.from(menuRoot.querySelectorAll('button, a'))
        .find(el => el.textContent && /end listings/i.test(el.textContent.trim()));
      if (!endBtn) {
        // sometimes menu is rendered elsewhere; search globally for the text in open menus
        endBtn = Array.from(document.querySelectorAll('button, a'))
          .find(el => el.closest('.fake-menu-button__menu, .fake-menu__items') && /end listings/i.test(el.textContent.trim()));
      }
    } else {
      // last fallback: search globally
      endBtn = Array.from(document.querySelectorAll('button, a')).find(el => /end listings/i.test(el.textContent.trim()));
    }

    if (!endBtn) throw new Error('End listings menu item not found');
    clickElement(endBtn);
  }

   async function waitForDialogAndConfirm(timeout = 12000) {
    console.log("Waiting for End Listing popup (robust finder)...");

    const start = Date.now();

    function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }
    function isVisible(el) {
        if (!el) return false;
        const r = el.getBoundingClientRect();
        return r.width > 1 && r.height > 1 && r.bottom > 0 && r.right > 0;
    }

    function synthClick(el) {
        try { el.scrollIntoView({ block: 'center', inline: 'center' }); } catch(e) {}
        const evs = ['pointerdown','mousedown','pointerup','mouseup','click'];
        for (const name of evs) {
        try {
            el.dispatchEvent(new MouseEvent(name, { bubbles: true, cancelable: true, view: window }));
        } catch (err) { /* ignore */ }
        }
        // fallback native click
        try { el.click(); } catch(e) {}
    }

    // helper: find the end-listing dialog window element
    function findEndListingWindow() {
        // 1) prefer explicit container if present
        const explicit = document.querySelector('.end-listing-layer .lightbox-dialog__window, [aria-labelledby="end-listing-layer-dialog"] .lightbox-dialog__window');
        if (explicit && !explicit.closest('[hidden]')) return explicit;

        // 2) scan all visible lightbox windows and look for title text "End listing(s)"
        const windows = Array.from(document.querySelectorAll('.lightbox-dialog__window'));
        for (const w of windows) {
        // skip hidden windows
        if (w.closest('[hidden]') || !isVisible(w)) continue;
        const titleEl = w.querySelector('.lightbox-dialog__title, .lightbox-dialog__header h2, .lightbox-dialog__header .title');
        const titleText = titleEl && (titleEl.innerText || titleEl.textContent || '').trim().toLowerCase();
        if (titleText && titleText.includes('end listing')) return w;
        // fallback: some dialogs don't have title but contain se-end-listing content
        if (w.querySelector('.se-end-listing')) return w;
        }

        return null;
    }

    // Wait for the correct dialog to appear
    let dialogWindow = null;
    while (Date.now() - start < timeout) {
        dialogWindow = findEndListingWindow();
        if (dialogWindow) {
        console.log('Found candidate dialog window:', dialogWindow);
        break;
        }
        // also attempt to dismiss well-known interfering modals (celebration / snackbars) to reduce false positives
        try {
        // dismiss "Got it" celebration modal if visible
        const cele = Array.from(document.querySelectorAll('.celebration-modal .lightbox-dialog__window, [data-testid="celebration-modal"] .lightbox-dialog__window, .snackbar-dialog .lightbox-dialog__window'));
        for (const c of cele) {
            if (c && isVisible(c)) {
            const got = c.querySelector('button, .btn--primary, [data-testid$="cta"]');
            if (got && (got.innerText||'').toLowerCase().includes('got it')) {
                console.log('Dismissing celebration modal (Got it).');
                synthClick(got);
                await sleep(250);
            }
            }
        }
        } catch(e){ /* ignore */ }

        await sleep(200);
    }

    if (!dialogWindow) {
        console.warn('End listings dialog NOT found within timeout.');
        return false;
    }

    // Wait for the actual confirm button inside that dialog
    const btnStart = Date.now();
    let confirmBtn = null;
    while (Date.now() - btnStart < 8000) {
        // common selectors used on page:
        confirmBtn = dialogWindow.querySelector('.se-end-listing__footer-actions button.btn--primary, .se-end-listing__footer-actions button, button[data-testid="submit-button"], button.btn--primary');
        // if found, validate it's the "End listing(s)" button (text or class)
        if (confirmBtn) {
        const txt = (confirmBtn.innerText || confirmBtn.textContent || '').trim().toLowerCase();
        // if it's a generic primary btn that is disabled or is "send offers"/other, reject it
        if (confirmBtn.disabled || !isVisible(confirmBtn)) {
            console.log('Found primary button but it is disabled or not visible:', confirmBtn, 'disabled=', confirmBtn.disabled);
            // maybe need to wait for it to enable
            await sleep(200);
            continue;
        }
        if (!/end\s+listing/i.test(txt) && !confirmBtn.className.includes('btn--primary')) {
            // Could be other primary button like "Send offers" / "Got it" — ensure text contains 'end'
            console.log('Primary button text did not contain "end listing":', txt);
            // if it's not the end button, try to find by text specifically
            const byText = Array.from(dialogWindow.querySelectorAll('button, a'))
            .find(el => {
                const t = (el.innerText || el.textContent || '').trim().toLowerCase();
                if (!t) return false;
                if (/end\s+listing(s)?/.test(t)) return true;
                return false;
            });
            if (byText) {
            confirmBtn = byText;
            break;
            }
            // otherwise keep waiting (maybe dialog content not yet rendered)
            await sleep(150);
            continue;
        }
        console.log('Confirm candidate:', confirmBtn, 'text=', (confirmBtn.innerText||confirmBtn.textContent).trim());
        break;
        }
        await sleep(150);
    }

    if (!confirmBtn) {
        console.warn('Confirm button not found in End listing dialog.');
        return false;
    }

    // Click it robustly (synthesize events + normal click)
    try {
        console.log('Clicking End Listing button:', (confirmBtn.innerText||confirmBtn.textContent).trim());
        synthClick(confirmBtn);
        // small delay to let eBay handle the click
        await sleep(700);
        return true;
    } catch (err) {
        console.error('Error clicking confirm button:', err);
        return false;
    }
   }

  async function waitForListingsToChange(prevRowCount, timeout = 20000) {
  const start = Date.now();

  while (Date.now() - start < timeout) {
    const popup = document.querySelector('.lightbox-dialog__window');
    if (popup) {
      await sleep(300); 
      continue; // do NOT proceed while popup visible
    }

    const rows = findListingRows();
    const curr = rows.length;

    // 1) Row count changed → listings ended
    if (curr !== prevRowCount) return true;

    // 2) Selected count reset → listings ended
    const sel = document.querySelector('.grid-selected-count');
    if (sel && sel.textContent.trim() === '') return true;

    await sleep(400);
  }

  return false;
}


  function getPaginationInfo() {
    // form .go-to-page input with current page value and a sibling label holding " / N"
    const form = document.querySelector('.go-to-page');
    if (!form) return null;
    const input = form.querySelector('input[type="text"], input[type="number"]');
    const label = form.querySelector('.label');
    let current = input ? parseInt(input.value, 10) || 1 : 1;
    let total = 1;
    if (label) {
      const m = label.textContent.match(/\/\s*(\d+)/);
      if (m) total = parseInt(m[1], 10);
    } else {
      // fallback: try reading pager elements or next button
      const pagerText = document.querySelector('.pagination, .pager');
      if (pagerText) {
        const m2 = pagerText.textContent.match(/(\d+)\s*\/\s*(\d+)/);
        if (m2) { current = parseInt(m2[1], 10); total = parseInt(m2[2], 10); }
      }
    }
    return { form, input, current, total };
  }

  async function goToPage(form, pageNumber) {
    if (!form) return false;
    // set input value and submit
    const input = form.querySelector('input[type="text"], input[type="number"]');
    if (!input) return false;
    input.focus();
    input.value = pageNumber;
    // dispatch input events
    input.dispatchEvent(new Event('input', { bubbles: true }));
    input.dispatchEvent(new Event('change', { bubbles: true }));
    // try to submit the form by finding the submit button
    const btn = form.querySelector('button[type="submit"], .goto-page');
    if (btn) {
      clickElement(btn);
      return true;
    }
    // fallback: form.submit()
    try {
      form.submit();
      return true;
    } catch (err) {
      // last resort: navigate via URL param (this keeps the per-page size usually)
      const currentUrl = new URL(window.location.href);
      currentUrl.searchParams.set('offset', ((pageNumber - 1) * 50).toString()); // best-effort offset adjust
      window.location.href = currentUrl.toString();
      return true;
    }
  }

  /***********************
   * Orchestration & storage
   ***********************/

  async function applyFilters(filters) {
    return applyFiltersToPage(filters);
  }

  // Starts the full auto-end process:
  // - saves filters and sets autoEndActive flag in storage
  // - selects items on current page
  // - triggers Actions -> End listings -> confirms
  // - waits for change then navigates to next page and continues (the content script on next page will resume)
  async function startAutoEnd(filters) {
    // persist filters and set flag
    await chrome.storage.local.set({ ebayAutoFilters: filters, ebayAutoEndActive: true });

    // first select items on this page
    const selected = applyFiltersToPage(filters);

    if (selected === 0) {
      // nothing selected on this page; proceed to next page
      await chrome.storage.local.set({ lastAutoEndPageNoSelection: true });
      await goToNextPageOrStop();
      return;
    }

    // open Actions menu and click End listings
    const prevRows = findListingRows().length;
    try {
      await openActionsMenuAndClickEnd();
    } catch (err) {
      // If menu couldn't be opened, stop and surface error to popup (we send an event)
      console.error('Failed to open Actions menu or find End item:', err);
      await chrome.storage.local.set({ ebayAutoEndActive: false });
      dispatchStatusToPopup({ running: false, error: 'Failed to open Actions menu or find End item' });
      return;
    }

    // Wait for dialog and confirm
    const confirmed = await waitForDialogAndConfirm(15000);
    if (!confirmed) {
      console.warn('Confirm dialog not found');
      // try to stop safely
      await chrome.storage.local.set({ ebayAutoEndActive: false });
      dispatchStatusToPopup({ running: false, error: 'End confirm dialog not found' });
      return;
    }

    // wait for the listing(s) to be removed / table to change
    const changed = await waitForListingsToChange(prevRows, 20_000);
    if (!changed) {
      // still continue but log
      console.warn('Listings did not change within expected time — continuing to next page.');
    }

    // go to next page
    await goToNextPageOrStop();
  }

 
  async function goToNextPageOrStop() {
    // read pagination info and autoEndActive flag
    const pinfo = getPaginationInfo();
    const { ebayAutoFilters } = await chrome.storage.local.get('ebayAutoFilters') || {};
    const { ebayAutoEndActive } = await chrome.storage.local.get('ebayAutoEndActive') || {};
    if (!ebayAutoEndActive) {
        dispatchStatusToPopup({ running: false });
        return;
    }

    if (pinfo) {
  const { current, total } = pinfo;
  if (current >= total) {
    console.log("Reached the LAST PAGE — stopping automation.");
    await chrome.storage.local.set({ ebayAutoEndActive: false });
    dispatchStatusToPopup({ running: false, completed: true });
    return;
  }
}

    // ---------- Robust popup visibility check ----------
    function nodeIsVisible(n) {
      if (!n) return false;
      try { if (n.hasAttribute && (n.hasAttribute('hidden') || n.getAttribute('aria-hidden') === 'true')) return false; } catch(e){}
      try {
        const cs = window.getComputedStyle(n);
        if (cs && (cs.display === 'none' || cs.visibility === 'hidden' || parseFloat(cs.opacity || '1') === 0)) return false;
      } catch(e){}
      try {
        const r = n.getBoundingClientRect();
        if (r.width <= 1 || r.height <= 1) return false;
        if (r.bottom < 0 || r.right < 0) return false;
      } catch(e){}
      return true;
    }

    // Wait briefly for any visible popup to disappear (retry loop)
    const popSelectors = ['.lightbox-dialog__window', '.ui-dialog', '[role="dialog"]'];
    const maxPopupLoops = 6;
    for (let i = 0; i < maxPopupLoops; i++) {
      const popups = Array.from(document.querySelectorAll(popSelectors.join(',')));
      const visiblePopup = popups.find(p => nodeIsVisible(p));
      if (!visiblePopup) break;
      console.warn("Popup still open (visible) — delaying next page navigation...");
      await sleep(600);
    }
    const stillPopup = Array.from(document.querySelectorAll(popSelectors.join(','))).some(p => nodeIsVisible(p));
    if (stillPopup) {
      console.warn("Visible popup persisted — will retry later.");
      await sleep(800);
      return;
    }

    // Record pre-navigation state (rows + URL) so we can detect page change
    const prevUrl = window.location.href;
    const prevRows = findListingRows().length;

    // ---------- Robust NEXT button fallback ----------
    const nextSelectors = [
      'a[aria-label="Go to next page"]',
      'a[aria-label="Next page"]',
      'a[aria-label*="next"]',
      'a.pagination__next',
      '.pagination__next',
      '.pagination a.next',
      'a[type="next"]',
      'a[rel="next"]'
    ];

    let nextBtn = null;
    for (const s of nextSelectors) {
      try {
        const el = document.querySelector(s);
        if (el && nodeIsVisible(el)) { nextBtn = el; break; }
        const child = document.querySelector(s + ' a');
        if (child && nodeIsVisible(child)) { nextBtn = child; break; }
      } catch (e) { /* ignore */ }
    }

    let navigationTriggered = false;
    if (nextBtn) {
      try {
        console.log("Fallback NEXT button found — navigating using:", nextBtn);
        try { nextBtn.scrollIntoView({ block: 'center' }); } catch (e) {}
        nextBtn.dispatchEvent(new MouseEvent('pointerdown', { bubbles: true, cancelable: true }));
        nextBtn.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, cancelable: true }));
        nextBtn.dispatchEvent(new MouseEvent('mouseup', { bubbles: true, cancelable: true }));
        nextBtn.click();
      } catch (e) {
        console.warn('Next button click failed - falling back to href navigation', e);
        const href = (nextBtn && (nextBtn.getAttribute('href') || nextBtn.href));
        if (href) window.location.href = href;
      }
      navigationTriggered = true;
    }

    // If no fallback anchor/button found, try your existing pagination form/url fallback
    if (!navigationTriggered) {
      if (!pinfo) {
        // can't paginate — stop
        await chrome.storage.local.set({ ebayAutoEndActive: false });
        dispatchStatusToPopup({ running: false, error: 'Pagination not found' });
        return;
      }

      const { form, input, current, total } = pinfo;
      if (current >= total) {
        // finished
        await chrome.storage.local.set({ ebayAutoEndActive: false });
        dispatchStatusToPopup({ running: false, completed: true });
        return;
      }
      const nextPageNum = current + 1;
      const navigated = await goToPage(form, nextPageNum);
      if (!navigated) {
        // try URL offset last-ditch fallback
        try {
          const currentUrl = new URL(window.location.href);
          const limit = parseInt(currentUrl.searchParams.get('limit') || '25', 10) || 25;
          currentUrl.searchParams.set('offset', ((nextPageNum - 1) * limit).toString());
          window.location.href = currentUrl.toString();
          navigationTriggered = true;
        } catch (e) {
          await chrome.storage.local.set({ ebayAutoEndActive: false });
          dispatchStatusToPopup({ running: false, error: 'Failed to navigate to next page' });
          return;
        }
      } else {
        navigationTriggered = true;
      }
    }

    if (!navigationTriggered) {
      console.warn('No navigation could be triggered.');
      await chrome.storage.local.set({ ebayAutoEndActive: false });
      dispatchStatusToPopup({ running: false, error: 'Failed to navigate to next page' });
      return;
    }

    // ---------- Wait for page/listings to update ----------
    // Wait up to N ms for either URL change or rows count change.
    const waitStart = Date.now();
    const waitTimeout = 10000; // 10s
    let sawChange = false;
    while (Date.now() - waitStart < waitTimeout) {
      // if SPA navigation doesn't change URL immediately, check rows
      try {
        if (window.location.href !== prevUrl) { sawChange = true; break; }
      } catch (e) { /* ignore */ }

      const currRows = findListingRows().length;
      if (currRows !== prevRows) { sawChange = true; break; }

      // also break if DOM shows the pagination region for new page (helpful)
      const pag = document.querySelector('.action-pagination__pag, .pagination, .go-to-page');
      if (pag) {
        // attempt to detect if its content updated (simple heuristic: presence of links with different href)
        const links = Array.from(pag.querySelectorAll('a')).map(a => a.href || a.getAttribute('href'));
        if (links.length && links.some(h => h && !h.includes(prevUrl))) {
          sawChange = true;
          break;
        }
      }

      await sleep(250);
    }

    // small extra delay for DOM stabilization
    await sleep(400);

    // If the navigation happened but we saw no change, still attempt to resume once
    const stillActive = (await chrome.storage.local.get('ebayAutoEndActive')).ebayAutoEndActive;
    if (stillActive) {
      try {
        console.log('Resuming auto-end on newly loaded page (sawChange=' + Boolean(sawChange) + ')');
        // call startAutoEnd with stored filters — this will re-apply filters on the new page
        await startAutoEnd(ebayAutoFilters || { views: {op:'<', value:''}, watchers:{op:'<',value:''}, sold:{op:'<',value:''}, days:{op:'<',value:''} });
      } catch (err) {
        console.warn('Auto-resume failed after navigation:', err);
        // ensure we don't leave the flag on
        await chrome.storage.local.set({ ebayAutoEndActive: false });
        dispatchStatusToPopup({ running: false, error: 'Auto-resume failed after navigation' });
      }
    } else {
      console.log('Auto-end no longer active after navigation.');
    }
}




  async function stopAutoEnd() {
    await chrome.storage.local.set({ ebayAutoEndActive: false });
    dispatchStatusToPopup({ running: false });
  }

  function dispatchStatusToPopup(payload) {
    // send a broadcast message to popup if open
    try {
      chrome.runtime.sendMessage({ type: 'AUTO_END_STATUS', payload });
    } catch (err) { /* ignore */ }
  }

  // resume if autoEndActive flag set when content script loads
  async function autoResumeIfNeeded() {
    const { ebayAutoEndActive, ebayAutoFilters } = await chrome.storage.local.get(['ebayAutoEndActive', 'ebayAutoFilters']);
    if (ebayAutoEndActive) {
      // slight delay to allow page to finish rendering
      await sleep(600);
      try {
        await startAutoEnd(ebayAutoFilters || { views: {op:'<', value:''}, watchers:{op:'<',value:''}, sold:{op:'<',value:''}, days:{op:'<',value:''} });
      } catch (err) {
        console.error('Auto-resume error:', err);
        await chrome.storage.local.set({ ebayAutoEndActive: false });
        dispatchStatusToPopup({ running: false, error: err.message });
      }
    }
  }

  /***********************
   * Message handling (popup <-> content)
   ***********************/
  chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    (async () => {
      try {
        if (request.action === 'applyFilters') {
          const count = applyFiltersToPage(request.filters);
          sendResponse({ success: true, count });
        } else if (request.action === 'clearSelection') {
          clearAllSelectionsOnPage();
          sendResponse({ success: true });
        } else if (request.action === 'startAutoEnd') {
          // save filters before starting
          await chrome.storage.local.set({ ebayAutoFilters: request.filters, ebayAutoEndActive: true });
          // start the flow
          startAutoEnd(request.filters).catch(err => console.error(err));
          sendResponse({ success: true, message: 'Auto end started' });
        } else if (request.action === 'stopAutoEnd') {
          await stopAutoEnd();
          sendResponse({ success: true });
        } else if (request.action === 'getStatus') {
          const state = await chrome.storage.local.get(['ebayAutoEndActive', 'ebayAutoFilters']);
          sendResponse({ success: true, state });
        } else {
          sendResponse({ success: false, message: 'Unknown action' });
        }
      } catch (err) {
        sendResponse({ success: false, message: err.message });
      }
    })();
    // keep channel open for async response
    return true;
  });

  // Run resume check on load
  autoResumeIfNeeded();

  // expose for debugging
  window.ebayAutoSelector = {
    applyFiltersToPage,
    clearAllSelectionsOnPage,
    startAutoEnd,
    stopAutoEnd,
    parseTimeLeft,
    findListingRows
  };
})();