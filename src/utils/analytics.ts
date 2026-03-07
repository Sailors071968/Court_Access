// ============================================
// Court Access — Analytics Tracking
// Google Analytics + PostHog integration
// ============================================

// Google Analytics (gtag)
declare global {
  interface Window {
    gtag?: (...args: unknown[]) => void;
    dataLayer?: unknown[];
    posthog?: {
      capture: (event: string, properties?: Record<string, unknown>) => void;
      identify: (distinctId: string, properties?: Record<string, unknown>) => void;
      reset: () => void;
    };
  }
}

const GA_MEASUREMENT_ID = import.meta.env.VITE_GA_MEASUREMENT_ID || '';
const POSTHOG_API_KEY = import.meta.env.VITE_POSTHOG_API_KEY || '';
const POSTHOG_HOST = import.meta.env.VITE_POSTHOG_HOST || 'https://us.i.posthog.com';

let gaInitialized = false;
let posthogInitialized = false;

export function initGoogleAnalytics(): void {
  if (gaInitialized || !GA_MEASUREMENT_ID) return;

  const script = document.createElement('script');
  script.async = true;
  script.src = `https://www.googletagmanager.com/gtag/js?id=${GA_MEASUREMENT_ID}`;
  document.head.appendChild(script);

  window.dataLayer = window.dataLayer || [];
  window.gtag = function gtag(...args: unknown[]) {
    window.dataLayer?.push(args);
  };
  window.gtag('js', new Date());
  window.gtag('config', GA_MEASUREMENT_ID, {
    send_page_view: true,
  });

  gaInitialized = true;
}

export function initPostHog(): void {
  if (posthogInitialized || !POSTHOG_API_KEY) return;

  const script = document.createElement('script');
  script.async = true;
  script.innerHTML = `
    !function(t,e){var o,n,p,r;e.__SV||(window.posthog=e,e._i=[],e.init=function(i,s,a){function g(t,e){var o=e.split(".");2==o.length&&(t=t[o[0]],e=o[1]),t[e]=function(){t.push([e].concat(Array.prototype.slice.call(arguments,0)))}}(p=t.createElement("script")).type="text/javascript",p.crossOrigin="anonymous",p.async=!0,p.src=s.api_host+"/static/array.js",(r=t.getElementsByTagName("script")[0]).parentNode.insertBefore(p,r);var u=e;for(void 0!==a?u=e[a]=[]:a="posthog",u.people=u.people||[],u.toString=function(t){var e="posthog";return"posthog"!==a&&(e+="."+a),t||(e+=" (stub)"),e},u.people.toString=function(){return u.toString(1)+".people (stub)"},o="capture identify alias people.set people.set_once set_config register register_once unregister opt_out_capturing has_opted_out_capturing opt_in_capturing reset isFeatureEnabled onFeatureFlags getFeatureFlag getFeatureFlagPayload reloadFeatureFlags group updateEarlyAccessFeatureEnrollment getEarlyAccessFeatures getActiveMatchingSurveys getSurveys onSessionId".split(" "),n=0;n<o.length;n++)g(u,o[n]);e._i.push([i,s,a])},e.__SV=1)}(document,window.posthog||[]);
    posthog.init(${JSON.stringify(POSTHOG_API_KEY)}, {api_host: ${JSON.stringify(POSTHOG_HOST)}});
  `;
  document.head.appendChild(script);

  posthogInitialized = true;
}

export function initAnalytics(): void {
  initGoogleAnalytics();
  initPostHog();
}

export function trackEvent(eventName: string, properties?: Record<string, unknown>): void {
  // Google Analytics
  if (window.gtag) {
    window.gtag('event', eventName, properties);
  }

  // PostHog
  if (window.posthog?.capture) {
    window.posthog.capture(eventName, properties);
  }
}

export function identifyUser(userId: string, traits?: Record<string, unknown>): void {
  if (window.posthog?.identify) {
    window.posthog.identify(userId, traits);
  }
}

export function resetAnalytics(): void {
  if (window.posthog?.reset) {
    window.posthog.reset();
  }
}
