import React, { useState, useEffect } from 'react';
import { initializeApp } from 'firebase/app';
import { getAuth, onAuthStateChanged } from 'firebase/auth';
import { Loader2 } from 'lucide-react';
import MainApp from './ui/mainapp';
import LoginScreen from './ui/auth';
import { firebaseConfig } from './service/firebase';

export default () => {
    const [user, setUser] = useState(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        let app;
        try { app = initializeApp(firebaseConfig); } catch(e) { console.error("Firebase init error", e) }
        const auth = getAuth(app);
        const unsubscribe = onAuthStateChanged(auth, (user) => { setUser(user); setLoading(false); });
        return () => unsubscribe();
    }, []);

    if (loading) return <div className="w-screen h-screen flex justify-center items-center bg-gray-100"><Loader2 className="animate-spin text-black" size={48} /></div>;

    return user ? <MainApp user={user} /> : <LoginScreen />;
};
