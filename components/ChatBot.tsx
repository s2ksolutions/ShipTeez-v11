
import React, { useState, useRef, useEffect } from 'react';
import { chatWithShopAI } from '../services/geminiService';
import { MessageSquare, X, Send, Loader2, Bot } from 'lucide-react';
import { ChatMessage } from '../types';
import { useStore } from '../context/StoreProvider';

export const ChatBot: React.FC = () => {
    const { user, content } = useStore();
    const [isOpen, setIsOpen] = useState(false);
    const [input, setInput] = useState('');
    const [messages, setMessages] = useState<ChatMessage[]>([
        { role: 'model', text: 'Hi! I am the ShipTeez assistant. How can I help you today?' }
    ]);
    const [isLoading, setIsLoading] = useState(false);
    const scrollRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (scrollRef.current) {
            scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
        }
    }, [messages, isOpen]);

    const handleSend = async () => {
        if (!input.trim() || isLoading) return;

        const userMsg: ChatMessage = { role: 'user', text: input };
        setMessages(prev => [...prev, userMsg]);
        setInput('');
        setIsLoading(true);

        try {
            const replyText = await chatWithShopAI(input, messages, user, content?.pageText.chatbotSystemPrompt);
            setMessages(prev => [...prev, { role: 'model', text: replyText }]);
        } catch (e) {
            setMessages(prev => [...prev, { role: 'model', text: "Sorry, I'm having trouble connecting right now." }]);
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <>
            <button 
                onClick={() => setIsOpen(!isOpen)}
                className="fixed bottom-6 right-6 z-[100] bg-black text-white p-4 rounded-full shadow-xl hover:scale-110 transition-transform"
            >
                {isOpen ? <X className="h-6 w-6" /> : <MessageSquare className="h-6 w-6" />}
            </button>

            {isOpen && (
                <div className="fixed bottom-24 right-6 z-[100] w-80 sm:w-96 bg-white border border-gray-200 shadow-2xl rounded-xl overflow-hidden flex flex-col h-[500px] animate-in fade-in slide-in-from-bottom-10">
                    <div className="bg-black text-white p-4 flex items-center gap-3">
                        <Bot className="h-5 w-5" />
                        <div>
                            <h3 className="font-bold text-sm">ShipTeez Support</h3>
                        </div>
                    </div>
                    
                    <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-gray-50" ref={scrollRef}>
                        {messages.map((msg, idx) => (
                            <div key={idx} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                                <div className={`max-w-[80%] rounded-2xl px-4 py-2 text-sm ${
                                    msg.role === 'user' ? 'bg-black text-white rounded-br-none' : 'bg-white border border-gray-200 text-gray-800 rounded-bl-none shadow-sm'
                                }`}>
                                    {msg.text}
                                </div>
                            </div>
                        ))}
                        {isLoading && (
                            <div className="flex justify-start">
                                <div className="bg-white border border-gray-200 rounded-2xl px-4 py-2 rounded-bl-none shadow-sm">
                                    <Loader2 className="h-4 w-4 animate-spin text-gray-400" />
                                </div>
                            </div>
                        )}
                    </div>

                    <div className="p-3 bg-white border-t border-gray-100 flex gap-2">
                        <input 
                            value={input}
                            onChange={(e) => setInput(e.target.value)}
                            onKeyDown={(e) => e.key === 'Enter' && handleSend()}
                            placeholder="Ask about shipping, returns..."
                            className="flex-1 text-sm border-gray-300 rounded-full px-4 focus:ring-black focus:border-black focus:outline-none"
                        />
                        <button 
                            onClick={handleSend}
                            disabled={isLoading || !input.trim()}
                            className="bg-black text-white p-2 rounded-full hover:bg-gray-800 disabled:opacity-50"
                        >
                            <Send className="h-4 w-4" />
                        </button>
                    </div>
                </div>
            )}
        </>
    );
};
