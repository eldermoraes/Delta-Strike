/* DELTA STRIKE — service worker */
'use strict';
var CACHE = 'delta-strike-v6';   // bump manually on every release: -v2, -v3…
var ASSETS = [
  './',
  './index.html',
  './style.css',
  './manifest.webmanifest',
  './js/constants.js',
  './js/sprites.js',
  './js/audio.js',
  './js/river.js',
  './js/entities.js',
  './js/game.js',
  './icons/icon-192.png',
  './icons/icon-512.png'
];

self.addEventListener('install', function (e) {
  e.waitUntil(
    caches.open(CACHE).then(function (c) {
      // cache:'reload' bypasses the HTTP cache so a new release never
      // precaches stale assets (GitHub Pages serves max-age=600).
      return c.addAll(ASSETS.map(function (u) {
        return new Request(u, { cache: 'reload' });
      }));
    }).then(function () { return self.skipWaiting(); })
  );
});

self.addEventListener('activate', function (e) {
  e.waitUntil(
    caches.keys().then(function (keys) {
      return Promise.all(keys.map(function (k) {
        if (k !== CACHE && k.indexOf('delta-strike-') === 0) return caches.delete(k);
      }));
    }).then(function () { return self.clients.claim(); })
  );
});

self.addEventListener('fetch', function (e) {
  e.respondWith(
    caches.match(e.request, { ignoreSearch: true }).then(function (r) {
      return r || fetch(e.request);
    })
  );
});
