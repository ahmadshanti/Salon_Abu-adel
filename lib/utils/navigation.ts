import type { Router } from 'expo-router';

type RouteHref = Parameters<Router['replace']>[0];

export function navigateBack(router: Router, fallbackHref?: RouteHref) {
  if (router.canGoBack()) {
    router.back();
    return;
  }

  if (fallbackHref) {
    router.replace(fallbackHref);
  }
}
