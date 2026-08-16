import React, { useState, useEffect, useRef } from 'react';
import { fetchChat, fetchChatStatus } from '../services/api';
import { Sparkles, Send, X, Bot, User, ArrowRight, ShieldCheck, AlertCircle, CornerDownLeft } from 'lucide-react';

interface ChatMessage {
  sender: 'user' | 'ai';
  text: string;
  suggestedTab?: string;
  sourceGrounding?: string;
  timestamp: string;
}

interface AssistantProps {
  isOpen: boolean;
  onClose: () => void;
  onOpen: () => void;
  onNavigateTab: (tab: string) => void;
  activeDashboardId?: string;
}

// Structured response renderer for AI messages to eliminate walls of text
const FormattedAIResponse: React.FC<{ text: string; onNavigateTab?: (tab: string) => void; suggestedTab?: string }> = ({ text, onNavigateTab, suggestedTab }) => {
  const lines = text.split('\n').map(l => l.trim()).filter(Boolean);

  const moneyMatch = text.match(/£[\d,]+(\.\d{2})?/g);
  const countMatch = text.match(/(\b\d{1,3}(,\d{3})*|\b\d+)\s+(customers|accounts|users)/i);
  const segmentMatch = text.match(/(Top VIP Customers|At-Risk VIP Customers|Active Customers|Inactive \/ Dormant Customers|High-Value At Risk|Active Casuals|High-Value Champions|Low-Value \/ Dormant)/i);

  const renderFormattedText = (content: string) => {
    const parts = content.split(/(\*\*.*?\*\*)/g);
    return parts.map((part, i) => {
      if (part.startsWith('**') && part.endsWith('**')) {
        return (
          <strong key={i} style={{ color: '#F8FAFC', fontWeight: 700 }}>
            {part.slice(2, -2)}
          </strong>
        );
      }
      return part;
    });
  };

  type Block =
    | { type: 'header'; text: string }
    | { type: 'paragraph'; text: string }
    | { type: 'product_card'; items: string[] }
    | { type: 'bullet'; text: string };

  const blocks: Block[] = [];
  let currentProductItems: string[] | null = null;

  const isPrimaryProductKey = (str: string) => {
    const clean = str.replace(/^[-•*]\s*/, '').replace(/\*/g, '').trim();
    return /^(StockCode|Stock Code|Product Code|Product ID|SKU|Item ID|Item Code)/i.test(clean);
  };

  const isProductAttrKey = (str: string) => {
    const clean = str.replace(/^[-•*]\s*/, '').replace(/\*/g, '').trim();
    return /^(Product Name|Product|Days Remaining|Units Available|Units|Current Price|Price|Discount|Revenue|Status|Clearance Price)/i.test(clean);
  };

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    if (line.startsWith('#') || line.startsWith('###') || line.startsWith('🎯') || line.startsWith('✨') || line.startsWith('🚨') || line.startsWith('💥') || line.startsWith('📦')) {
      if (currentProductItems) {
        blocks.push({ type: 'product_card', items: currentProductItems });
        currentProductItems = null;
      }
      blocks.push({ type: 'header', text: line.replace(/^[#\s]+/, '') });
      continue;
    }

    if (line.startsWith('-') || line.startsWith('•') || line.startsWith('*')) {
      const cleanText = line.replace(/^[-•*]\s*/, '');

      if (isPrimaryProductKey(line)) {
        if (currentProductItems) {
          blocks.push({ type: 'product_card', items: currentProductItems });
        }
        currentProductItems = [cleanText];
      } else if (currentProductItems) {
        currentProductItems.push(cleanText);
      } else if (isProductAttrKey(line)) {
        currentProductItems = [cleanText];
      } else {
        blocks.push({ type: 'bullet', text: cleanText });
      }
      continue;
    }

    if (currentProductItems) {
      blocks.push({ type: 'product_card', items: currentProductItems });
      currentProductItems = null;
    }
    blocks.push({ type: 'paragraph', text: line });
  }

  if (currentProductItems) {
    blocks.push({ type: 'product_card', items: currentProductItems });
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', fontSize: '1rem', lineHeight: 1.65 }}>

      {/* Auto-extracted Metric Highlight Cards if available */}
      {(moneyMatch || countMatch || segmentMatch) && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '12px', margin: '4px 0 8px 0' }}>
          {segmentMatch && (
            <div style={{ padding: '14px 16px', background: 'rgba(239, 68, 68, 0.12)', border: '1px solid rgba(239, 68, 68, 0.25)', borderRadius: '12px' }}>
              <div style={{ fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.05em', color: '#FCA5A5', fontWeight: 700, marginBottom: '4px' }}>
                🚨 Priority Group
              </div>
              <div style={{ fontSize: '1.1rem', fontWeight: 800, color: '#FFFFFF' }}>
                {segmentMatch[0]}
              </div>
            </div>
          )}

          {countMatch && (
            <div style={{ padding: '14px 16px', background: 'rgba(99, 102, 241, 0.12)', border: '1px solid rgba(99, 102, 241, 0.25)', borderRadius: '12px' }}>
              <div style={{ fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.05em', color: '#A5B4FC', fontWeight: 700, marginBottom: '4px' }}>
                👥 Affected Accounts
              </div>
              <div style={{ fontSize: '1.15rem', fontWeight: 800, color: '#FFFFFF' }}>
                {countMatch[1]} customers
              </div>
            </div>
          )}

          {moneyMatch && (
            <div style={{ padding: '14px 16px', background: 'rgba(245, 158, 11, 0.12)', border: '1px solid rgba(245, 158, 11, 0.25)', borderRadius: '12px' }}>
              <div style={{ fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.05em', color: '#FDE047', fontWeight: 700, marginBottom: '4px' }}>
                💷 Revenue Exposure
              </div>
              <div style={{ fontSize: '1.15rem', fontWeight: 800, color: '#FBBF24' }}>
                {moneyMatch[0]}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Structured Blocks Rendering */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
        {blocks.map((block, idx) => {
          if (block.type === 'header') {
            return (
              <h4 key={idx} style={{ color: '#818CF8', fontSize: '1.1rem', fontWeight: 800, margin: '12px 0 4px 0' }}>
                {renderFormattedText(block.text)}
              </h4>
            );
          }

          if (block.type === 'product_card') {
            return (
              <div
                key={idx}
                style={{
                  background: 'rgba(15, 23, 42, 0.75)',
                  border: '1px solid rgba(99, 102, 241, 0.35)',
                  borderRadius: '14px',
                  padding: '16px 20px',
                  margin: '4px 0',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '8px',
                  boxShadow: '0 4px 16px rgba(0, 0, 0, 0.25)'
                }}
              >
                {block.items.map((item, itemIdx) => (
                  <div key={itemIdx} style={{ display: 'flex', alignItems: 'flex-start', gap: '10px', fontSize: '0.96rem', color: '#E2E8F0' }}>
                    <span style={{ color: '#818CF8', fontSize: '0.85rem', marginTop: '2px' }}>•</span>
                    <span style={{ flex: 1, lineHeight: 1.5 }}>{renderFormattedText(item)}</span>
                  </div>
                ))}
              </div>
            );
          }

          if (block.type === 'bullet') {
            return (
              <div key={idx} style={{ display: 'flex', alignItems: 'flex-start', gap: '10px', padding: '8px 14px', background: 'rgba(255, 255, 255, 0.03)', borderRadius: '8px', borderLeft: '3px solid rgba(99, 102, 241, 0.5)' }}>
                <span style={{ fontSize: '1.05rem', color: '#94A3B8' }}>•</span>
                <span style={{ color: '#E2E8F0', fontSize: '0.98rem' }}>{renderFormattedText(block.text)}</span>
              </div>
            );
          }

          return (
            <p key={idx} style={{ color: '#CBD5E1', margin: 0, fontSize: '1rem', lineHeight: 1.65 }}>
              {renderFormattedText(block.text)}
            </p>
          );
        })}
      </div>

      {suggestedTab && onNavigateTab && (
        <div style={{ marginTop: '8px' }}>
          <button
            onClick={() => onNavigateTab(suggestedTab)}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '8px',
              padding: '10px 18px',
              background: 'linear-gradient(135deg, #4F46E5, #6366F1)',
              color: '#FFFFFF',
              border: 'none',
              borderRadius: '10px',
              fontSize: '0.9rem',
              fontWeight: 600,
              cursor: 'pointer',
              boxShadow: '0 4px 14px rgba(99, 102, 241, 0.35)',
              transition: 'transform 0.15s ease'
            }}
          >
            Open Related Page <ArrowRight size={16} />
          </button>
        </div>
      )}
    </div>
  );
};

export const BusinessAssistantDrawer: React.FC<AssistantProps> = ({ isOpen, onClose, onOpen, onNavigateTab, activeDashboardId = 'default' }) => {
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      sender: 'ai',
      text: `🎯 **Welcome to Business Copilot**\n\nI analyze your live retail data to estimate expected 30-day sales, identify potential revenue losses, and pinpoint priority customer accounts.\n\n✨ **Ask me anything like:**\n- "Who needs my attention?"\n- "How much revenue could I lose in the next 30 days?"\n- "What is my expected 30-day revenue?"`,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    }
  ]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [isAvailable, setIsAvailable] = useState(true);
  const [statusMessage, setStatusMessage] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    async function checkStatus() {
      try {
        const res = await fetchChatStatus();
        setIsAvailable(res.available);
        if (!res.available) {
          setStatusMessage(res.message);
        }
      } catch (err) {
        setIsAvailable(false);
        setStatusMessage("Business Assistant is offline.");
      }
    }
    checkStatus();
  }, []);

  useEffect(() => {
    if (isOpen) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, loading, isOpen]);

  const handleSend = async (queryText?: string) => {
    const textToSend = queryText || input;
    if (!textToSend.trim() || loading) return;

    const userMsg: ChatMessage = {
      sender: 'user',
      text: textToSend,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    };

    setMessages(prev => [...prev, userMsg]);
    if (!queryText) setInput('');
    setLoading(true);

    try {
      const response = await fetchChat(textToSend, activeDashboardId);
      const aiMsg: ChatMessage = {
        sender: 'ai',
        text: response.answer,
        suggestedTab: response.suggested_tab,
        sourceGrounding: response.source_grounding,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      };
      setMessages(prev => [...prev, aiMsg]);
    } catch (err) {
      setMessages(prev => [
        ...prev,
        {
          sender: 'ai',
          text: "⚠️ I encountered an issue retrieving data from the server. Please verify your connection or try again.",
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
        }
      ]);
    } finally {
      setLoading(false);
    }
  };



  return (
    <>
      {/* Floating Action AI Button Fixed at Bottom-Right */}
      <div
        style={{
          position: 'fixed',
          bottom: '28px',
          right: '28px',
          zIndex: 999,
          display: 'flex',
          alignItems: 'center',
          gap: '12px'
        }}
      >
        <button
          onClick={isOpen ? onClose : onOpen}
          className="floating-ai-trigger"
          style={{
            width: '64px',
            height: '64px',
            borderRadius: '50%',
            background: 'linear-gradient(135deg, #6366F1, #818CF8)',
            color: '#FFFFFF',
            border: '2px solid rgba(255, 255, 255, 0.25)',
            boxShadow: '0 8px 30px rgba(99, 102, 241, 0.5), 0 0 15px rgba(99, 102, 241, 0.3)',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            transition: 'all 0.25s cubic-bezier(0.4, 0, 0.2, 1)',
            position: 'relative'
          }}
          title="Ask your business assistant"
        >
          <Sparkles size={28} color="#FFFFFF" style={{ filter: 'drop-shadow(0 2px 4px rgba(0,0,0,0.2))' }} />
        </button>
      </div>

      {/* Floating Centered AI Workspace Modal (~50% width desktop) */}
      {isOpen && (
        <>
          {/* Dimmed Blurred Backdrop Overlay */}
          <div
            style={{
              position: 'fixed',
              inset: 0,
              backgroundColor: 'rgba(0, 0, 0, 0.65)',
              backdropFilter: 'blur(8px)',
              WebkitBackdropFilter: 'blur(8px)',
              zIndex: 1000,
              animation: 'fadeIn 0.25s ease-out'
            }}
            onClick={onClose}
          />

          {/* Centered Large Floating AI Workspace Modal (~50% width desktop) */}
          <div
            style={{
              position: 'fixed',
              top: '50%',
              left: '50%',
              transform: 'translate(-50%, -50%)',
              width: 'min(880px, 90vw)',
              height: 'min(860px, 92vh)',
              background: 'rgba(11, 15, 23, 0.95)',
              backdropFilter: 'blur(24px)',
              WebkitBackdropFilter: 'blur(24px)',
              border: '1px solid rgba(255, 255, 255, 0.12)',
              borderRadius: '24px',
              boxShadow: '0 30px 70px -15px rgba(0, 0, 0, 0.8), 0 0 40px rgba(99, 102, 241, 0.15)',
              zIndex: 1001,
              display: 'flex',
              flexDirection: 'column',
              overflow: 'hidden',
              animation: 'modalEntrance 0.3s cubic-bezier(0.16, 1, 0.3, 1)'
            }}
          >
            {/* Modal Header */}
            <div style={{ padding: '24px 32px', borderBottom: '1px solid rgba(255, 255, 255, 0.08)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: 'rgba(18, 24, 38, 0.8)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                <div style={{ width: '48px', height: '48px', borderRadius: '14px', background: 'linear-gradient(135deg, rgba(99, 102, 241, 0.25), rgba(129, 140, 248, 0.1))', border: '1px solid rgba(99, 102, 241, 0.3)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <Sparkles size={26} color="#818CF8" />
                </div>
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <h2 style={{ fontSize: '1.45rem', fontWeight: 800, color: '#F8FAFC', margin: 0, letterSpacing: '-0.02em' }}>
                      Business Copilot ✨
                    </h2>
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: '5px', padding: '3px 10px', borderRadius: '12px', background: 'rgba(16, 185, 129, 0.15)', color: '#34D399', fontSize: '0.75rem', fontWeight: 700 }}>
                      <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#10B981' }} /> Online
                    </span>
                  </div>
                  <span style={{ fontSize: '0.88rem', color: '#94A3B8', marginTop: '2px', display: 'block' }}>
                    Your data, explained simply.
                  </span>
                </div>
              </div>

              <button
                onClick={onClose}
                style={{
                  background: 'rgba(255, 255, 255, 0.05)',
                  border: '1px solid rgba(255, 255, 255, 0.1)',
                  color: '#94A3B8',
                  borderRadius: '50%',
                  width: '40px',
                  height: '40px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  cursor: 'pointer',
                  transition: 'all 0.2s'
                }}
                onMouseOver={(e) => { e.currentTarget.style.background = 'rgba(255,255,255,0.1)'; e.currentTarget.style.color = '#FFF'; }}
                onMouseOut={(e) => { e.currentTarget.style.background = 'rgba(255,255,255,0.05)'; e.currentTarget.style.color = '#94A3B8'; }}
              >
                <X size={20} />
              </button>
            </div>

            {/* Offline Warning Banner if applicable */}
            {!isAvailable && (
              <div style={{ padding: '14px 24px', background: 'rgba(236, 72, 153, 0.12)', borderBottom: '1px solid rgba(236, 72, 153, 0.2)', display: 'flex', alignItems: 'center', gap: '12px', fontSize: '0.9rem', color: '#FBCFE8' }}>
                <AlertCircle size={20} color="#EC4899" style={{ flexShrink: 0 }} />
                <span>{statusMessage || "Gemini API Key missing. Please set GEMINI_API_KEY in backend environment."}</span>
              </div>
            )}

            {/* Messages Scroll Area */}
            <div style={{ flex: 1, padding: '28px 32px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '24px' }}>
              {messages.map((msg, idx) => (
                <div key={idx} style={{ display: 'flex', gap: '16px', flexDirection: msg.sender === 'user' ? 'row-reverse' : 'row' }}>

                  {/* Avatar */}
                  <div style={{
                    width: '42px',
                    height: '42px',
                    borderRadius: '50%',
                    background: msg.sender === 'user' ? 'linear-gradient(135deg, #6366F1, #4F46E5)' : 'rgba(99, 102, 241, 0.15)',
                    border: msg.sender === 'user' ? 'none' : '1px solid rgba(99, 102, 241, 0.3)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexShrink: 0
                  }}>
                    {msg.sender === 'user' ? <User size={22} color="#FFFFFF" /> : <Bot size={24} color="#818CF8" />}
                  </div>

                  {/* Message Bubble Card */}
                  <div style={{
                    maxWidth: msg.sender === 'user' ? '70%' : '88%',
                    background: msg.sender === 'user' ? 'linear-gradient(135deg, #6366F1, #4F46E5)' : 'rgba(18, 24, 38, 0.85)',
                    color: '#F8FAFC',
                    padding: '20px 24px',
                    borderRadius: msg.sender === 'user' ? '22px 22px 4px 22px' : '22px 22px 22px 4px',
                    border: msg.sender === 'user' ? 'none' : '1px solid rgba(255, 255, 255, 0.08)',
                    boxShadow: msg.sender === 'ai' ? '0 10px 25px -5px rgba(0, 0, 0, 0.3)' : '0 4px 12px rgba(99, 102, 241, 0.3)'
                  }}>
                    {msg.sender === 'user' ? (
                      <p style={{ margin: 0, fontSize: '1.05rem', fontWeight: 500, lineHeight: 1.5 }}>{msg.text}</p>
                    ) : (
                      <FormattedAIResponse text={msg.text} onNavigateTab={(tab) => { onNavigateTab(tab); onClose(); }} suggestedTab={msg.suggestedTab} />
                    )}

                    {/* Grounding Source Badge */}
                    {msg.sourceGrounding && (
                      <div style={{ marginTop: '14px', paddingTop: '10px', borderTop: '1px solid rgba(255,255,255,0.06)', fontSize: '0.78rem', color: '#10B981', display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <ShieldCheck size={14} color="#10B981" /> Grounded in {msg.sourceGrounding}
                      </div>
                    )}

                    <div style={{ fontSize: '0.72rem', color: msg.sender === 'user' ? 'rgba(255,255,255,0.7)' : '#64748B', marginTop: '10px', textAlign: msg.sender === 'user' ? 'right' : 'left' }}>
                      {msg.timestamp}
                    </div>
                  </div>
                </div>
              ))}

              {/* Loading State */}
              {loading && (
                <div style={{ display: 'flex', gap: '16px', alignItems: 'center' }}>
                  <div style={{ width: '42px', height: '42px', borderRadius: '50%', background: 'rgba(99, 102, 241, 0.15)', border: '1px solid rgba(99, 102, 241, 0.3)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <Bot size={24} color="#818CF8" />
                  </div>
                  <div style={{ padding: '16px 24px', background: 'rgba(18, 24, 38, 0.85)', borderRadius: '22px', fontSize: '1rem', color: '#A5B4FC', border: '1px solid rgba(255, 255, 255, 0.08)', display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <Sparkles size={18} color="#818CF8" className="animate-pulse" />
                    <span>Looking through your business data...</span>
                  </div>
                </div>
              )}

              <div ref={messagesEndRef} />
            </div>



            {/* Input Box */}
            <div style={{ padding: '20px 32px 28px', borderTop: '1px solid rgba(255, 255, 255, 0.08)', background: 'rgba(18, 24, 38, 0.9)' }}>
              <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
                <input
                  type="text"
                  placeholder={isAvailable ? "Ask anything about your customers or revenue..." : "Assistant unavailable"}
                  disabled={!isAvailable || loading}
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter') handleSend(); }}
                  style={{
                    width: '100%',
                    background: '#0B0F17',
                    color: '#F8FAFC',
                    border: '1px solid rgba(255, 255, 255, 0.15)',
                    padding: '16px 120px 16px 20px',
                    borderRadius: '16px',
                    fontSize: '1rem',
                    outline: 'none',
                    transition: 'all 0.2s ease',
                    boxShadow: '0 4px 16px rgba(0, 0, 0, 0.2)'
                  }}
                  onFocus={(e) => {
                    e.target.style.borderColor = '#6366F1';
                    e.target.style.boxShadow = '0 0 20px rgba(99, 102, 241, 0.25)';
                  }}
                  onBlur={(e) => {
                    e.target.style.borderColor = 'rgba(255, 255, 255, 0.15)';
                    e.target.style.boxShadow = '0 4px 16px rgba(0, 0, 0, 0.2)';
                  }}
                />

                <div style={{ position: 'absolute', right: '12px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span style={{ fontSize: '0.75rem', color: '#64748B', display: 'flex', alignItems: 'center', gap: '3px' }}>
                    <CornerDownLeft size={12} /> Enter
                  </span>

                  <button
                    onClick={() => handleSend()}
                    disabled={!isAvailable || loading || !input.trim()}
                    style={{
                      width: '42px',
                      height: '42px',
                      background: isAvailable && input.trim() ? 'linear-gradient(135deg, #6366F1, #4F46E5)' : 'rgba(255, 255, 255, 0.05)',
                      color: isAvailable && input.trim() ? '#FFFFFF' : '#64748B',
                      border: 'none',
                      borderRadius: '12px',
                      cursor: isAvailable && input.trim() ? 'pointer' : 'not-allowed',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      transition: 'all 0.2s ease'
                    }}
                  >
                    <Send size={18} />
                  </button>
                </div>
              </div>
            </div>

          </div>
        </>
      )}

      <style dangerouslySetInnerHTML={{
        __html: `
        @keyframes modalEntrance {
          from { opacity: 0; transform: translate(-50%, -46%) scale(0.96); }
          to { opacity: 1; transform: translate(-50%, -50%) scale(1); }
        }
        @keyframes fadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        .floating-ai-trigger:hover {
          transform: scale(1.08) translateY(-2px);
          box-shadow: 0 12px 35px rgba(99, 102, 241, 0.65), 0 0 25px rgba(99, 102, 241, 0.5);
        }
      `}} />
    </>
  );
};
