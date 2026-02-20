// Firebase Cloud Messaging background handler
// This service worker handles push notifications when the app is in the background
importScripts('https://www.gstatic.com/firebasejs/10.12.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.12.0/firebase-messaging-compat.js');

firebase.initializeApp({
    apiKey: 'AIzaSyDaJ1zxEJSGPiSpHaXD9IqX5Ujb-3zZtLU',
    authDomain: 'diabetes-specialist.firebaseapp.com',
    projectId: 'diabetes-specialist',
    storageBucket: 'diabetes-specialist.firebasestorage.app',
    messagingSenderId: '682074932656',
    appId: '1:682074932656:web:d14de8662d4f56bd1e4275'
});

const messaging = firebase.messaging();

messaging.onBackgroundMessage((payload) => {
    const { title, body } = payload.notification || {};
    if (!title) return;

    self.registration.showNotification(title, {
        body: body || '',
        icon: '/pwa-192x192.png',
        badge: '/pwa-192x192.png',
        data: payload.data || {}
    });
});
