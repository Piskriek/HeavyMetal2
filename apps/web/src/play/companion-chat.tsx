import React, { useState, useEffect, useRef } from 'react';
import type { CompanionEntity } from './companion';
import './companion-chat.css';

export interface CompanionChatProps {
  readonly companion: CompanionEntity | null;
  readonly onBroadcastRadio?: (text: string) => void;
}

interface Message {
  readonly id: string;
  readonly sender: 'player' | 'companion';
  readonly text: string;
}

export const CompanionChat: React.FC<CompanionChatProps> = ({ companion, onBroadcastRadio }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [input, setInput] = useState('');
  const [isListening, setIsListening] = useState(false);
  const [messages, setMessages] = useState<Message[]>([
    {
      id: 'init-1',
      sender: 'companion',
      text: 'Overwatch link established. Standing by as Co-Builder, Piskriek. Where shall we build?',
    },
  ]);
  const logRef = useRef<HTMLDivElement | null>(null);

  // Auto-scroll chat log
  useEffect(() => {
    if (logRef.current) {
      logRef.current.scrollTop = logRef.current.scrollHeight;
    }
  }, [messages, isOpen]);

  // Keyboard shortcut: Enter opens chat if closed
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent): void => {
      if (e.key === 'Enter' && !isOpen && document.activeElement?.tagName !== 'INPUT') {
        e.preventDefault();
        setIsOpen(true);
      } else if (e.key === 'Escape' && isOpen) {
        setIsOpen(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen]);

  const send = (userText: string): void => {
    const trimmed = userText.trim();
    if (!trimmed) return;

    const userMsg: Message = { id: `msg-${Date.now()}-u`, sender: 'player', text: trimmed };
    setMessages((prev) => [...prev, userMsg]);
    setInput('');

    // Send to companion
    setTimeout(() => {
      let reply = 'Copy that, Piskriek. Aligning position with you now.';
      const lower = trimmed.toLowerCase();

      if (lower.includes('follow') || lower.includes('come here')) {
        companion?.followPlayer();
        reply = 'Moving into formation on your shoulder.';
      } else if (lower.includes('wave') || lower.includes('hello') || lower.includes('hi')) {
        companion?.playGesture('wave');
        reply = 'Greetings, Lead Architect. Simulation telemetry nominal.';
      } else if (lower.includes('cheer') || lower.includes('great') || lower.includes('good job')) {
        companion?.playGesture('cheer');
        reply = 'Ascent resonance confirmed! Grounding the structure.';
      } else if (lower.includes('mine') || lower.includes('ore')) {
        reply = 'I detect copper and quartz deposits nearby. Point the rifle and I will assist.';
      } else if (lower.includes('status') || lower.includes('report')) {
        const state = companion?.getState();
        reply = `Status: ${state?.state.toUpperCase()}. Coordinates: X=${state?.x.toFixed(1)}, Z=${state?.z.toFixed(1)}. Sovereign Harness active at 60 Hz.`;
      }

      const compMsg: Message = { id: `msg-${Date.now()}-c`, sender: 'companion', text: reply };
      setMessages((prev) => [...prev, compMsg]);
      companion?.say(reply, 5.0);
      onBroadcastRadio?.(reply);
    }, 450);
  };

  // Push to talk using Web Speech API
  const toggleSpeech = (): void => {
    const SpeechRecognition =
      (window as unknown as { SpeechRecognition?: any }).SpeechRecognition ||
      (window as unknown as { webkitSpeechRecognition?: any }).webkitSpeechRecognition;

    if (!SpeechRecognition) {
      alert('Speech Recognition is supported in Chrome, Edge, and Safari.');
      return;
    }

    if (isListening) {
      setIsListening(false);
      return;
    }

    try {
      const recognition = new SpeechRecognition();
      recognition.continuous = false;
      recognition.interimResults = false;
      recognition.lang = 'en-US';

      recognition.onstart = () => setIsListening(true);
      recognition.onend = () => setIsListening(false);
      recognition.onerror = () => setIsListening(false);
      recognition.onresult = (event: any) => {
        const transcript = event.results[0]?.[0]?.transcript;
        if (transcript) {
          send(transcript);
        }
      };

      recognition.start();
    } catch {
      setIsListening(false);
    }
  };

  return (
    <>
      <button
        className="companion-chat-toggle"
        data-testid="companion-comms-toggle"
        onClick={() => setIsOpen((o) => !o)}
        aria-label="Toggle Companion Comms"
      >
        <span className="companion-chat-orb" />
        <span>COMMS · OVERWATCH</span>
      </button>

      {isOpen && (
        <div className="companion-chat-panel" data-testid="companion-comms-panel">
          <div className="companion-chat-header">
            <div className="companion-chat-title">
              <span className="companion-chat-orb" />
              Overwatch <span>Co-Builder</span>
            </div>
            <button className="companion-chat-close" onClick={() => setIsOpen(false)}>
              ✕
            </button>
          </div>

          <div className="companion-chat-log" ref={logRef}>
            {messages.map((m) => (
              <div key={m.id} className={`chat-bubble ${m.sender}`}>
                {m.text}
              </div>
            ))}
          </div>

          <div className="companion-chat-chips">
            <button className="companion-chip" onClick={() => send('Follow me')}>
              🚶 Follow Me
            </button>
            <button className="companion-chip" onClick={() => send('Hello')}>
              👋 Wave
            </button>
            <button className="companion-chip" onClick={() => send('Status report')}>
              📊 Status
            </button>
            <button className="companion-chip" onClick={() => send('Awesome job')}>
              ✨ Cheer
            </button>
          </div>

          <div className="companion-chat-input-row">
            <input
              type="text"
              className="companion-chat-input"
              placeholder="Ask Overwatch or give an order..."
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') send(input);
              }}
              autoFocus
            />
            <button
              className={`companion-mic-btn ${isListening ? 'active' : ''}`}
              title="Voice Input (Mic)"
              onClick={toggleSpeech}
            >
              🎙️
            </button>
            <button className="companion-send-btn" onClick={() => send(input)}>
              Send
            </button>
          </div>
        </div>
      )}
    </>
  );
};
