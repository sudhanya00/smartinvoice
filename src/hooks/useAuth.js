import { useState, useEffect } from 'react';
import { onAuthStateChanged } from 'firebase/auth';
import { auth, isFirebaseConfigured } from '../services/firebase';

/**
 * Custom hook for managing authentication state
 * @returns {Object} Authentication state
 */
export const useAuth = () => {
    const [user, setUser] = useState(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        console.log('useAuth: Setting up auth state listener');
        
        let unsubscribe;
        
        if (isFirebaseConfigured && auth && onAuthStateChanged) {
            // Use real Firebase onAuthStateChanged
            unsubscribe = onAuthStateChanged(auth, (user) => {
                console.log('useAuth: Firebase auth state changed', user);
                setUser(user);
                setLoading(false);
            });
        } else if (auth && auth.onAuthStateChanged) {
            // Use mock auth onAuthStateChanged
            unsubscribe = auth.onAuthStateChanged((user) => {
                console.log('useAuth: Mock auth state changed', user);
                setUser(user);
                setLoading(false);
            });
        } else {
            console.error('Auth service not available');
            setLoading(false);
        }

        return () => {
            if (unsubscribe) unsubscribe();
        };
    }, []);

    console.log('useAuth: Current state', { user: user?.email || 'none', loading });
    return { user, loading };
};
