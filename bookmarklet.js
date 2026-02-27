/**
 * Teach Traffic — Tracking Checker Bookmarklet
 *
 * Checks for:
 * - Google Tag Manager (container installed)
 * - GA4 Analytics (tag loaded + hit sent)
 * - Google Ads Conversion (tag loaded + conversion ping sent)
 *
 * Detection methods:
 * 1. window.google_tag_manager object (most reliable for GTM)
 * 2. Script/iframe tags in the DOM
 * 3. performance.getEntriesByType('resource') — checks actual network requests
 *
 * Usage: Click the bookmarklet while on any page (e.g. a thank you page).
 *        A panel appears in the top-right corner showing pass/fail for each check.
 *        Click again (or ×) to close.
 */

(function () {
  // ─── Toggle: remove panel if already open ─────────────────────────────────
  var existing = document.getElementById('tt-tc');
  if (existing) { existing.remove(); return; }

  // ─── Detection state ──────────────────────────────────────────────────────
  var gtm  = { ok: false, ids: [] };
  var ga4  = { fired: false, installed: false, ids: [] };
  var gads = { fired: false, ids: [] };

  // ─── GTM: check window.google_tag_manager object ─────────────────────────
  if (window.google_tag_manager) {
    gtm.ok = true;
    Object.keys(window.google_tag_manager).forEach(function (k) {
      if (/^GTM-/.test(k) && gtm.ids.indexOf(k) < 0)  gtm.ids.push(k);
      if (/^G-/.test(k))  { ga4.installed = true;  if (ga4.ids.indexOf(k) < 0)  ga4.ids.push(k); }
      if (/^AW-/.test(k) && gads.ids.indexOf(k) < 0) gads.ids.push(k);
    });
  }

  // ─── GTM: check <script> tag ──────────────────────────────────────────────
  var gtmScript = document.querySelector('script[src*="googletagmanager.com/gtm.js"]');
  if (gtmScript) {
    gtm.ok = true;
    var m = gtmScript.src.match(/[?&]id=(GTM-[^&]+)/);
    if (m && gtm.ids.indexOf(m[1]) < 0) gtm.ids.push(m[1]);
  }

  // ─── GTM: check <noscript> iframe ────────────────────────────────────────
  var gtmNoscript = document.querySelector('iframe[src*="googletagmanager.com/ns.html"]');
  if (gtmNoscript) {
    gtm.ok = true;
    var m2 = gtmNoscript.src.match(/[?&]id=(GTM-[^&]+)/);
    if (m2 && gtm.ids.indexOf(m2[1]) < 0) gtm.ids.push(m2[1]);
  }

  // ─── GTM: dataLayer presence as fallback ─────────────────────────────────
  if (window.dataLayer && !gtm.ok) gtm.ok = true;

  // ─── GA4: check gtag.js script tag ───────────────────────────────────────
  document.querySelectorAll('script[src*="gtag/js"]').forEach(function (s) {
    ga4.installed = true;
    var m = s.src.match(/[?&]id=(G-[^&]+)/);
    if (m && ga4.ids.indexOf(m[1]) < 0) ga4.ids.push(m[1]);
  });

  // ─── Network requests: what actually fired on this page load ─────────────
  try {
    performance.getEntriesByType('resource').forEach(function (r) {
      var u = r.name;

      // GA4 hit
      if (u.indexOf('analytics.google.com/g/collect') > -1 ||
          u.indexOf('google-analytics.com/g/collect') > -1) {
        ga4.fired = true;
      }

      // Google Ads conversion ping
      if (u.indexOf('googleadservices.com/pagead/conversion') > -1 ||
          u.indexOf('google.com/pagead/conversion') > -1) {
        gads.fired = true;
        var cm = u.match(/\/conversion\/(\d+)/);
        if (cm) {
          var awId = 'AW-' + cm[1];
          if (gads.ids.indexOf(awId) < 0) gads.ids.push(awId);
        }
      }
    });
  } catch (e) { /* security error in some contexts */ }

  // ─── Build panel ──────────────────────────────────────────────────────────
  var panel = document.createElement('div');
  panel.id = 'tt-tc';
  panel.style.cssText = [
    'position:fixed', 'top:20px', 'right:20px', 'z-index:2147483647',
    'width:320px', 'background:#0f172a', 'color:#f1f5f9',
    "font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif",
    'font-size:13px', 'border-radius:12px',
    'box-shadow:0 8px 32px rgba(0,0,0,0.6)', 'overflow:hidden'
  ].join(';');

  function badge(ok) {
    return '<span style="background:' + (ok ? '#16a34a' : '#dc2626') +
      ';color:#fff;border-radius:20px;padding:2px 10px;font-size:11px;font-weight:700;">' +
      (ok ? '&#10003; Found' : '&#10007; Missing') + '</span>';
  }

  function chips(ids) {
    if (!ids || !ids.length) return '';
    return '<div style="margin-top:5px;font-size:11px;font-family:monospace;color:#94a3b8;">' +
      ids.join('&nbsp;&bull;&nbsp;') + '</div>';
  }

  function note(text) {
    if (!text) return '';
    return '<div style="margin-top:3px;font-size:11px;color:#64748b;">' + text + '</div>';
  }

  function row(label, ok, ids, noteText) {
    return '<div style="padding:12px 16px;border-bottom:1px solid rgba(255,255,255,0.07)">' +
      '<div style="display:flex;justify-content:space-between;align-items:center">' +
      '<span style="font-weight:500">' + label + '</span>' + badge(ok) +
      '</div>' + chips(ids) + note(noteText) + '</div>';
  }

  var ga4Ok   = ga4.fired || ga4.installed;
  var ga4Note = ga4.fired     ? 'Hit confirmed via network &#10003;'
              : ga4.installed ? 'Tag loaded &#8212; no hit captured yet'
              : '';

  var gadsOk   = gads.fired || gads.ids.length > 0;
  var gadsNote = gads.fired        ? 'Conversion ping confirmed &#10003;'
               : gads.ids.length   ? 'Tag present in GTM &#8212; no ping seen yet'
               : '';

  var gtmNote = gtm.ok && !gtm.ids.length ? 'Installed (ID not found in DOM)' : '';

  panel.innerHTML =
    '<div style="padding:14px 16px;background:rgba(255,255,255,0.04);display:flex;justify-content:space-between;align-items:center">' +
      '<div>' +
        '<strong style="font-size:14px">Tracking Checker</strong>' +
        '<div style="font-size:11px;color:#64748b;margin-top:1px">by Teach Traffic</div>' +
      '</div>' +
      '<button id="tt-tc-x" style="background:none;border:none;color:#64748b;font-size:22px;cursor:pointer;line-height:1;padding:0">&times;</button>' +
    '</div>' +
    row('Google Tag Manager', gtm.ok, gtm.ids, gtmNote) +
    row('GA4 Analytics', ga4Ok, ga4.ids, ga4Note) +
    row('Google Ads Conversion', gadsOk, gads.ids, gadsNote) +
    '<div style="padding:10px 16px;font-size:11px;color:#475569;text-align:center">' +
      'Click the bookmarklet again to close' +
    '</div>';

  document.body.appendChild(panel);
  document.getElementById('tt-tc-x').onclick = function () { panel.remove(); };
})();
