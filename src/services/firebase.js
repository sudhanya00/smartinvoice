import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import { FIREBASE_CONFIG_STRING } from '../constants';

// Parse Firebase configuration
let firebaseConfig = {};
let isFirebaseConfigured = false;

try {
    if (FIREBASE_CONFIG_STRING) {
        firebaseConfig = JSON.parse(FIREBASE_CONFIG_STRING);
        // Check if it's not the placeholder config
        if (firebaseConfig.apiKey && firebaseConfig.apiKey !== 'placeholder') {
            isFirebaseConfigured = true;
            console.log('Firebase: Using real Firebase configuration');
        } else {
            console.warn('Firebase: Placeholder configuration detected');
        }
    } else {
        console.error("Firebase config not found. Please set REACT_APP_FIREBASE_CONFIG in your .env file.");
    }
} catch (error) {
    console.error("Error parsing Firebase config:", error);
    isFirebaseConfigured = false;
}

// Initialize Firebase
let app;
try {
    if (isFirebaseConfigured) {
        app = initializeApp(firebaseConfig);
        console.log('Firebase: Successfully initialized with project:', firebaseConfig.projectId);
    } else {
        console.warn("Firebase: Using mock Firebase for development");
        // Create a mock app object for fallback
        app = { name: '[MOCK]', options: firebaseConfig };
    }
} catch (error) {
    console.error("Firebase initialization error:", error);
    // Fall back to mock if initialization fails
    app = { name: '[MOCK]', options: firebaseConfig };
    isFirebaseConfigured = false;
}

// Export Firebase services
let auth, db;

if (isFirebaseConfigured && app && app.name !== '[MOCK]') {
    // Use real Firebase services
    auth = getAuth(app);
    db = getFirestore(app);
    console.log('Firebase: Using real Firebase Auth and Firestore');
} else {
    // Mock auth and db for development/fallback
    console.warn("Firebase: Using mock Firebase services");
    auth = {
        currentUser: null,
        onAuthStateChanged: (callback) => {
            // For development, you can uncomment the lines below to auto-login a mock user
            // setTimeout(() => {
            //     const mockUser = {
            //         uid: 'mock-user-id',
            //         email: 'demo@example.com',
            //         displayName: 'Demo User'
            //     };
            //     callback(mockUser);
            // }, 1000);
            
            // For now, keep user as null to show login screen
            setTimeout(() => callback(null), 500);
            return () => {}; // Mock unsubscribe function
        },
        signInWithEmailAndPassword: () => Promise.resolve({ user: { uid: 'mock-user-id' } }),
        createUserWithEmailAndPassword: () => Promise.resolve({ user: { uid: 'mock-user-id' } }),
        signOut: () => Promise.resolve()
    };
    
    db = {
        collection: () => ({
            doc: () => ({
                get: () => Promise.resolve({ exists: false, data: () => ({}) }),
                set: () => Promise.resolve(),
                update: () => Promise.resolve(),
                delete: () => Promise.resolve()
            }),
            add: () => Promise.resolve({ id: 'mock-doc-id' }),
            where: () => ({
                get: () => Promise.resolve({ docs: [] })
            })
        })
    };
}

export { auth, db, app, isFirebaseConfigured };
