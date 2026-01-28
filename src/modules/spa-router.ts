import { NAVIGATION_OPACITY, NAVIGATION_TRANSITION } from "../constants.js";

export const SPA_ROUTER_SCRIPT = `(function(){
  'use strict';

  // Cache for fetched pages
  var cache = {};

  // Current navigation controller for aborting in-flight requests
  var currentController = null;

  /**
   * Check if a URL is internal (same origin)
   */
  function isInternal(url) {
    try {
      var parsed = new URL(url, window.location.origin);
      return parsed.origin === window.location.origin;
    } catch (e) {
      return false;
    }
  }

  /**
   * Check if the link should be handled by the SPA router
   */
  function shouldHandle(anchor) {
    // Must be an anchor with href
    if (!anchor || !anchor.href) return false;

    // Skip if modifier keys are pressed (open in new tab, etc.)
    // This is checked at click time, not here

    // Skip external links
    if (!isInternal(anchor.href)) return false;

    // Skip anchors (hash-only links)
    var href = anchor.getAttribute('href');
    if (href && href.startsWith('#')) return false;

    // Skip download links
    if (anchor.hasAttribute('download')) return false;

    // Skip target="_blank" links
    if (anchor.target === '_blank') return false;

    // Skip links with rel="external"
    if (anchor.rel && anchor.rel.includes('external')) return false;

    // Skip non-HTML resources
    var path = new URL(anchor.href).pathname;
    if (/\\.(pdf|zip|png|jpg|jpeg|gif|svg|webp|mp4|mp3|wav)$/i.test(path)) {
      return false;
    }

    return true;
  }

  /**
   * Navigate to a URL using SPA navigation
   */
  function navigate(url, pushState) {
    // Abort any in-flight request
    if (currentController) {
      currentController.abort();
    }
    currentController = new AbortController();

    // Check cache first
    if (cache[url]) {
      updatePage(cache[url], url, pushState);
      return;
    }

    // Show loading state
    document.body.style.opacity = '0.7';
    document.body.style.transition = 'opacity 0.1s';

    fetch(url, { signal: currentController.signal })
      .then(function(response) {
        if (!response.ok) throw new Error('HTTP ' + response.status);
        return response.text();
      })
      .then(function(html) {
        cache[url] = html;
        updatePage(html, url, pushState);
      })
      .catch(function(err) {
        if (err.name === 'AbortError') return;
        // Fall back to regular navigation on error
        console.warn('[spa-router] Navigation failed, falling back:', err);
        window.location.href = url;
      })
      .finally(function() {
        document.body.style.opacity = '';
        document.body.style.transition = '';
        currentController = null;
      });
  }

  /**
   * Update the page content with fetched HTML
   */
  function updatePage(html, url, pushState) {
    var parser = new DOMParser();
    var doc = parser.parseFromString(html, 'text/html');

    // Update the title
    var newTitle = doc.querySelector('title');
    if (newTitle) {
      document.title = newTitle.textContent || '';
    }

    // Update meta tags (description, etc.)
    var metaTags = ['description', 'keywords', 'author'];
    metaTags.forEach(function(name) {
      var newMeta = doc.querySelector('meta[name="' + name + '"]');
      var oldMeta = document.querySelector('meta[name="' + name + '"]');
      if (newMeta && oldMeta) {
        oldMeta.setAttribute('content', newMeta.getAttribute('content') || '');
      } else if (newMeta && !oldMeta) {
        document.head.appendChild(newMeta.cloneNode(true));
      }
    });

    // Update Open Graph tags
    var ogTags = doc.querySelectorAll('meta[property^="og:"]');
    ogTags.forEach(function(newTag) {
      var prop = newTag.getAttribute('property');
      var oldTag = document.querySelector('meta[property="' + prop + '"]');
      if (oldTag) {
        oldTag.setAttribute('content', newTag.getAttribute('content') || '');
      } else {
        document.head.appendChild(newTag.cloneNode(true));
      }
    });

    // Update the body content
    var newBody = doc.querySelector('body');
    if (newBody) {
      // Preserve the SPA router script
      var routerScript = document.body.querySelector('script:last-of-type');

      // Replace body content
      document.body.innerHTML = newBody.innerHTML;

      // Re-add the router script
      if (routerScript) {
        document.body.appendChild(routerScript.cloneNode(true));
      }
    }

    // Update history
    if (pushState) {
      history.pushState({ url: url }, '', url);
    }

    // Scroll to top or to anchor
    var hash = new URL(url, window.location.origin).hash;
    if (hash) {
      var target = document.querySelector(hash);
      if (target) {
        target.scrollIntoView();
      }
    } else {
      window.scrollTo(0, 0);
    }

    // Dispatch a custom event for any listeners
    window.dispatchEvent(new CustomEvent('spa-navigation', { detail: { url: url } }));
  }

  /**
   * Handle click events on links
   */
  function handleClick(event) {
    // Skip if modifier keys are pressed
    if (event.ctrlKey || event.metaKey || event.shiftKey || event.altKey) {
      return;
    }

    // Find the closest anchor element
    var anchor = event.target;
    while (anchor && anchor.tagName !== 'A') {
      anchor = anchor.parentElement;
    }

    if (!shouldHandle(anchor)) return;

    event.preventDefault();
    navigate(anchor.href, true);
  }

  /**
   * Handle browser back/forward buttons
   */
  function handlePopState(event) {
    if (event.state && event.state.url) {
      navigate(event.state.url, false);
    } else {
      navigate(window.location.href, false);
    }
  }

  // Initialize
  document.addEventListener('click', handleClick);
  window.addEventListener('popstate', handlePopState);

  // Set initial state
  history.replaceState({ url: window.location.href }, '', window.location.href);

  // Prefetch visible links on idle
  if ('requestIdleCallback' in window) {
    requestIdleCallback(function() {
      var links = document.querySelectorAll('a[href]');
      var observer = new IntersectionObserver(function(entries) {
        entries.forEach(function(entry) {
          if (entry.isIntersecting) {
            var anchor = entry.target;
            if (shouldHandle(anchor) && !cache[anchor.href]) {
              fetch(anchor.href)
                .then(function(r) { return r.text(); })
                .then(function(html) { cache[anchor.href] = html; })
                .catch(function() {});
            }
            observer.unobserve(anchor);
          }
        });
      });
      links.forEach(function(link) {
        if (shouldHandle(link)) observer.observe(link);
      });
    });
  }
})();`;

export function getSpaRouterScript(): string {
  return SPA_ROUTER_SCRIPT;
}
