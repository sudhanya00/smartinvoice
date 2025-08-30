import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { signInWithEmailAndPassword, createUserWithEmailAndPassword } from 'firebase/auth';
import { Eye, EyeOff, Loader2 } from 'lucide-react';
import { auth, isFirebaseConfigured } from '../services/firebase';
import AnimatedBackground from '../components/AnimatedBackground';

/**
 * Login and registration screen component
 */
const LoginScreen = () => {
    const [isLogin, setIsLogin] = useState(true);
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);    const handleAuth = async (e) => {
        if (e && e.preventDefault) {
            e.preventDefault();
        }
        setLoading(true);
        setError('');
        
        // Basic validation
        if (!email || !password) {
            setError('Please enter both email and password');
            setLoading(false);
            return;
        }
        
        try {
            if (isFirebaseConfigured) {
                // Use real Firebase authentication
                if (isLogin) {
                    await signInWithEmailAndPassword(auth, email, password);
                } else {
                    await createUserWithEmailAndPassword(auth, email, password);
                }
            } else {
                // Use mock authentication
                if (isLogin) {
                    await auth.signInWithEmailAndPassword(email, password);
                } else {
                    await auth.createUserWithEmailAndPassword(email, password);
                }
            }
        } catch (err) {
            setError(err.message || 'Authentication failed');
        }
        setLoading(false);
    };

    return (
        <div className="min-h-screen bg-gray-100 flex flex-col justify-center items-center p-4 antialiased">
            <AnimatedBackground />
            <div className="max-w-md w-full mx-auto">
                <div className="text-center mb-8">
                    <h1 className="text-5xl font-bold text-black tracking-wide">Welcome</h1>
                    <p className="text-gray-600 mt-2">
                        {isLogin ? "Sign in to continue." : "Create an account."}
                    </p>
                </div>
                
                <div className="bg-white/50 backdrop-blur-lg border border-white/20 p-8 rounded-2xl shadow-xl">
                    <form onSubmit={handleAuth} className="space-y-6">
                        <input 
                            type="email" 
                            placeholder="Email" 
                            value={email} 
                            onChange={e => setEmail(e.target.value)} 
                            className="w-full px-4 py-3 bg-white/50 border border-white/20 rounded-lg focus:outline-none focus:ring-2 focus:ring-black" 
                            required 
                        />
                        
                        <div className="relative">
                            <input 
                                type={showPassword ? "text" : "password"} 
                                placeholder="Password" 
                                value={password} 
                                onChange={e => setPassword(e.target.value)} 
                                className="w-full px-4 py-3 bg-white/50 border border-white/20 rounded-lg focus:outline-none focus:ring-2 focus:ring-black" 
                                required 
                            />
                            <motion.button 
                                type="button" 
                                whileHover={{ scale: 1.1 }} 
                                whileTap={{ scale: 0.9 }} 
                                onClick={() => setShowPassword(!showPassword)} 
                                className="absolute inset-y-0 right-0 pr-3 flex items-center text-gray-400 hover:text-gray-600"
                            >
                                {showPassword ? <EyeOff size={20}/> : <Eye size={20}/>}
                            </motion.button>
                        </div>                        {error && (
                            <p className="text-red-500 text-sm text-center">{error}</p>
                        )}
                        
                        <motion.button 
                            type="submit"
                            disabled={loading}
                            whileHover={{ scale: 1.02 }}
                            whileTap={{ scale: 0.98 }}
                            className="w-full bg-black text-white font-bold py-3 px-4 rounded-lg hover:bg-gray-800 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-black transition-colors disabled:bg-gray-400 shadow-lg"
                        >
                            {loading ? (
                                <Loader2 className="animate-spin mx-auto"/>
                            ) : (
                                isLogin ? 'Sign In' : 'Create Account'
                            )}
                        </motion.button>
                    </form>
                    
                    <p className="text-center text-sm text-gray-600 mt-6">
                        {isLogin ? "Don't have an account?" : "Already have an account?"}
                        <button 
                            onClick={() => { setIsLogin(!isLogin); setError(''); }} 
                            className="font-semibold text-black hover:underline ml-1"
                        >
                            {isLogin ? 'Sign Up' : 'Sign In'}
                        </button>
                    </p>
                </div>
            </div>
        </div>
    );
};

export default LoginScreen;
