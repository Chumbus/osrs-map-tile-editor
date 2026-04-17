const CACHE_NAME = 'osrs-tiles-v2';
const TILE_CDN = 'https://mejrs.github.io/layers_osrs/mapsquares/-1/';

self.addEventListener('fetch', (event) => {
    const url = new URL(event.request.url);

    // Cache wiki icon sprites
    if (url.hostname === 'maps.runescape.wiki' && url.pathname.includes('/images/icons/')) {
        event.respondWith(cacheFirst(event.request));
        return;
    }

    // Handle tile requests — serve local, fall back to CDN, cache everything
    if (url.pathname.match(/\/tiles\/-?\d+\/\d+_\d+_\d+\.png$/)) {
        event.respondWith(tileStrategy(event.request, url));
        return;
    }
});

// Standard cache-first for icons
async function cacheFirst(request) {
    const cache = await caches.open(CACHE_NAME);
    const cached = await cache.match(request);
    if (cached) return cached;

    try {
        const response = await fetch(request);
        if (response.ok) cache.put(request, response.clone());
        return response;
    } catch {
        return new Response('', { status: 404 });
    }
}

// Tile strategy: cache → local → CDN → cache the result
async function tileStrategy(request, url) {
    const cache = await caches.open(CACHE_NAME);

    // 1. Check cache
    const cached = await cache.match(request);
    if (cached) return cached;

    // 2. Try local (the original request)
    try {
        const local = await fetch(request);
        if (local.ok) {
            cache.put(request, local.clone());
            return local;
        }
    } catch {}

    // 3. Fall back to CDN for tiles not yet downloaded locally
    // Extract path: /tiles/{zoom}/{plane}_{x}_{y}.png
    const match = url.pathname.match(/\/tiles\/(-?\d+\/\d+_\d+_\d+\.png)$/);
    if (match) {
        try {
            const cdnUrl = TILE_CDN + match[1];
            const cdnResponse = await fetch(cdnUrl);
            if (cdnResponse.ok) {
                // Cache under the original request URL so next time it hits cache
                cache.put(request, cdnResponse.clone());
                return cdnResponse;
            }
        } catch {}
    }

    return new Response('', { status: 404 });
}

self.addEventListener('activate', (event) => {
    event.waitUntil(
        caches.keys().then(names =>
            Promise.all(
                names.filter(name => name !== CACHE_NAME)
                     .map(name => caches.delete(name))
            )
        )
    );
});
