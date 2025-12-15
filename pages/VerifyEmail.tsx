
import React, { useEffect, useState } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import { db } from '../services/db';
import { SEO } from '../components/SEO';
import { CheckCircle, AlertCircle, Loader2 } from 'lucide-react';

export const VerifyEmail: React.FC = () => {
    const [searchParams] = useSearchParams();
    const token = searchParams.get('token');
    const [status, setStatus] = useState<'verifying' | 'success' | 'error'>('verifying');

    useEffect(() => {
        if (!token) {
            setStatus('error');
            return;
        }
        
        const verify = async () => {
            try {
                await db.verifyEmail(token);
                setStatus('success');
            } catch (e) {
                console.error(e);
                setStatus('error');
            }
        };
        verify();
    }, [token]);

    return (
        <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
            <SEO title="Verify Email" description="Verify your ShipTeez account" />
            <div className="bg-white p-8 rounded-2xl shadow-xl max-w-md w-full text-center">
                {status === 'verifying' && (
                    <>
                        <Loader2 className="h-12 w-12 text-blue-500 animate-spin mx-auto mb-4"/>
                        <h2 className="text-xl font-bold">Verifying...</h2>
                    </>
                )}
                {status === 'success' && (
                    <>
                        <CheckCircle className="h-12 w-12 text-green-500 mx-auto mb-4"/>
                        <h2 className="text-xl font-bold mb-2">Email Verified!</h2>
                        <p className="text-gray-500 mb-6">Your email has been successfully verified.</p>
                        <Link to="/login" className="block w-full bg-black text-white py-3 rounded-lg font-bold uppercase hover:bg-gray-800">
                            Go to Login
                        </Link>
                    </>
                )}
                {status === 'error' && (
                    <>
                        <AlertCircle className="h-12 w-12 text-red-500 mx-auto mb-4"/>
                        <h2 className="text-xl font-bold mb-2">Verification Failed</h2>
                        <p className="text-gray-500 mb-6">The link may have expired or is invalid.</p>
                        <Link to="/" className="text-blue-600 hover:underline">Return Home</Link>
                    </>
                )}
            </div>
        </div>
    );
};
