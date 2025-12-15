import React, { useEffect, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useStore } from '../context/StoreProvider';
import { Loader2 } from 'lucide-react';

export const AuthCallback: React.FC = () => {
    const location = useLocation();
    const navigate = useNavigate();
    const { showToast } = useStore();
    const processed = useRef(false);

    useEffect(() => {
        // Prevent double execution in React Strict Mode
        if (processed.current) return;

        // Parse params
        const params = new URLSearchParams(location.search);
        const error = params.get('error');
        const token = params.get('token'); // PHP direct token

        if (error) {
            processed.current = true;
            console.error("Google Auth Error:", error);
            showToast("Google Sign-In was cancelled or failed.", "error");
            navigate('/login');
            return;
        }

        // ✅ PHP sends direct token - store it and redirect
        if (token) {
            processed.current = true;
            localStorage.setItem('token', token);
            showToast("Successfully logged in with Google!", "success");
            navigate('/checkout'); // Or '/account'
            return;
        }

        // No token or code found, redirect to login
        processed.current = true;
        navigate('/login');
    }, [location, navigate, showToast]);

    return (
        <div className="min-h-screen flex items-center justify-center bg-white">
            <div className="text-center">
                <Loader2 className="h-10 w-10 animate-spin mx-auto mb-4 text-black" />
                <h2 className="text-lg font-bold">Verifying with Google...</h2>
                <p className="text-gray-500 text-sm">Please wait while we secure your session.</p>
            </div>
        </div>
    );
};