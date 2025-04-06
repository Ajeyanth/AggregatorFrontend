import React, {
  useState,
  KeyboardEvent,
  ChangeEvent,
  useRef,
  useEffect
} from 'react';
import ReactMarkdown from 'react-markdown';

// Define the shape of a chat message
interface Message {
  role: 'user' | 'system';
  content: string;
}

// Optional structure for aggregator debug data
interface DebugData {
  domain?: string;
  gpt_answer?: string;
  deepseek_answer?: string;
  anthropic_answer?: string;
  grok_answer?: string;
  aggregated_answer?: string;
  modelStrengths?: Record<string, string>;
  usedModels?: string[];
}

function App() {
  // Tracks user input
  const [userInput, setUserInput] = useState<string>('');
  // Full conversation messages
  const [messages, setMessages] = useState<Message[]>([]);
  // Loading indicator
  const [loading, setLoading] = useState<boolean>(false);

  // Dark mode toggle
  const [darkMode, setDarkMode] = useState<boolean>(false);

  // Debug info (domain, raw answers, model strengths, etc.)
  const [debugData, setDebugData] = useState<DebugData | null>(null);

  // Toggle for details panel
  const [showDetails, setShowDetails] = useState<boolean>(false);

  // FastAPI endpoint
  const AGGREGATOR_ENDPOINT = 'http://localhost:8000/ask';

  // For auto-scrolling
  const messagesEndRef = useRef<HTMLDivElement | null>(null);

  // Scroll to bottom whenever messages change
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Send user message => aggregator => handle response
  const handleSend = async () => {
    if (!userInput.trim()) return;

    // 1) Add user message to chat
    const newMessages = [...messages, { role: 'user' as const, content: userInput }];
    setMessages(newMessages);
    setUserInput('');
    setLoading(true);

    try {
      // 2) POST conversation to aggregator
      const response = await fetch(AGGREGATOR_ENDPOINT, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ conversation: newMessages })
      });
      if (!response.ok) {
        throw new Error(`Server error: ${response.status}`);
      }

      // 3) Parse aggregator response
      const data = await response.json();
      setDebugData(data);

      // 4) Build final text for display
      const finalAnswer = data.aggregated_answer || data.final_answer || 'N/A';
      // Optional: figure out usedModels if the server didn't supply them
      const usedModels: string[] = data.usedModels || [];
      const modelsLine = usedModels.length
        ? `Models used: **${usedModels.join(' + ')}**\n\n`
        : '';

      const strengthLines = data.modelStrengths
        ? `Model Strengths:\n${JSON.stringify(data.modelStrengths, null, 2)}\n\n`
        : '';

      const aggregatorContent = `${strengthLines}${modelsLine}**Refined / Final Answer**: ${finalAnswer}`;

      // 5) Add a new system message
      const systemMessage: Message = { role: 'system', content: '' };
      const updatedMessages = [...newMessages, systemMessage];
      setMessages(updatedMessages);

      // 6) Simulate typing effect
      let i = 0;
      const typingSpeed = 20; // ms per char
      const typingInterval = setInterval(() => {
        i++;
        setMessages((prev) => {
          const copy = [...prev];
          const lastIndex = copy.length - 1;
          if (lastIndex < 0) return copy;
          const lastMsg = copy[lastIndex];
          if (lastMsg.role === 'system') {
            lastMsg.content = aggregatorContent.slice(0, i);
          }
          return copy;
        });
        if (i >= aggregatorContent.length) {
          clearInterval(typingInterval);
        }
      }, typingSpeed);

    } catch (err: any) {
      console.error('Error:', err);
      const errorMsg: Message = {
        role: 'system',
        content: `Error: ${err.message}`
      };
      setMessages([...messages, errorMsg]);
    } finally {
      setLoading(false);
    }
  };

  // Handle Enter (send message)
  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  // Track textarea changes
  const handleChange = (e: ChangeEvent<HTMLTextAreaElement>) => {
    setUserInput(e.target.value);
  };

  return (
    <div
      style={{
        ...styles.container,
        background: darkMode
          ? 'linear-gradient(135deg, #1f1c2c, #928dab)'
          : '#f4f4f4'
      }}
    >
      <div style={styles.mainRow}>
        {/* Left: Chat Panel */}
        <div
          style={{
            ...styles.chatContainer,
            backgroundColor: darkMode ? '#2f2c3a' : '#fff',
            color: darkMode ? '#fff' : '#000'
          }}
        >
          {/* Header Bar */}
          <div style={styles.headerBar}>
            <h2 style={{ margin: 0 }}>⚡ Multi-Model Chat</h2>
            <div>
              <button
                onClick={() => setDarkMode(!darkMode)}
                style={styles.headerButton}
              >
                {darkMode ? 'Light Mode' : 'Dark Mode'}
              </button>
              <button
                style={styles.headerButton}
                onClick={() => setShowDetails(!showDetails)}
              >
                {showDetails ? 'Hide Details' : 'Show Details'}
              </button>
            </div>
          </div>

          {/* Messages Area */}
          <div
            style={{
              ...styles.messagesArea,
              backgroundColor: darkMode ? '#3f3b52' : '#fafafa'
            }}
            id="messagesArea"
          >
            {messages.map((msg, idx) => (
              <div
                key={idx}
                style={
                  msg.role === 'user'
                    ? { ...styles.userBubble, ...styles.bubble }
                    : { ...styles.systemBubble, ...styles.bubble }
                }
              >
                {msg.role === 'system' ? (
                  <div style={styles.preText}>
                    <ReactMarkdown>{msg.content}</ReactMarkdown>
                  </div>
                ) : (
                  <pre style={styles.preText}>{msg.content}</pre>
                )}
              </div>
            ))}

            {loading && (
              <div style={{ ...styles.systemBubble, ...styles.bubble }}>
                <div style={styles.typingDots}>
                  <span>.</span>
                  <span>.</span>
                  <span>.</span>
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Input Container */}
          <div style={styles.inputContainer}>
            <textarea
              style={{
                ...styles.textInput,
                backgroundColor: darkMode ? '#444' : '#fff',
                color: darkMode ? '#fff' : '#000'
              }}
              rows={2}
              value={userInput}
              onChange={handleChange}
              onKeyDown={handleKeyDown}
              placeholder="Type your question..."
            />
            <button
              style={styles.sendButton}
              onClick={handleSend}
              disabled={loading}
            >
              Send
            </button>
          </div>
        </div>

    {/* Right: Debug Panel */}
        {showDetails && (
          <div style={styles.debugPanel}>
            <h3>Under the Hood</h3>
            {debugData ? (
              <div style={styles.debugContent}>
                <p>
                  <strong>Domain:</strong> {debugData.domain || 'N/A'}
                </p>
                {debugData.modelStrengths && (
                  <div>
                    <strong>Model Strengths:</strong>
                    <pre style={styles.debugPre}>
                      {JSON.stringify(debugData.modelStrengths, null, 2)}
                    </pre>
                  </div>
                )}
                {debugData.gpt_answer && (
                  <div>
                    <strong>GPT Answer:</strong>
                    <pre style={styles.debugPre}>{debugData.gpt_answer}</pre>
                  </div>
                )}
                {debugData.deepseek_answer && (
                  <div>
                    <strong>DeepSeek Answer:</strong>
                    <pre style={styles.debugPre}>{debugData.deepseek_answer}</pre>
                  </div>
                )}
                {debugData.anthropic_answer && (
                  <div>
                    <strong>Anthropic Answer:</strong>
                    <pre style={styles.debugPre}>{debugData.anthropic_answer}</pre>
                  </div>
                )}
                {debugData.grok_answer && (
                  <div>
                    <strong>Grok Answer:</strong>
                    <pre style={styles.debugPre}>{debugData.grok_answer}</pre>
                  </div>
                )}
                <div>
                  <strong>Final / Aggregated Answer:</strong>
                  <pre style={styles.debugPre}>
                    {debugData.aggregated_answer || 'N/A'}
                  </pre>
                </div>
              </div>
            ) : (
              <p style={{ color: '#999' }}>No debug info yet. Send a question first!</p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// Basic styling
const styles: { [key: string]: React.CSSProperties } = {
  container: {
    minHeight: '100vh',
    transition: 'background 0.3s ease'
  },
  mainRow: {
    display: 'flex',
    width: '100%',
    height: '100vh'
  },
  chatContainer: {
    flex: 1,
    margin: '16px',
    borderRadius: '8px',
    boxShadow: '0 0 20px rgba(0,0,0,0.2)',
    display: 'flex',
    flexDirection: 'column',
    height: 'calc(100vh - 32px)',
    transition: 'background-color 0.3s ease'
  },
  headerBar: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '12px 16px',
    borderBottom: '1px solid rgba(255,255,255,0.2)'
  },
  headerButton: {
    marginLeft: '8px',
    backgroundColor: '#444',
    color: '#fff',
    border: 'none',
    padding: '8px 12px',
    borderRadius: '4px',
    cursor: 'pointer'
  },
  messagesArea: {
    flex: 1,
    overflowY: 'auto',
    padding: '16px'
  },
  userBubble: {
    backgroundColor: '#56d364',
    color: '#333',
    marginLeft: 'auto',
    marginRight: '20px',
    textAlign: 'right'
  },
  systemBubble: {
    backgroundColor: '#3c82de',
    color: '#fff',
    marginRight: 'auto',
    marginLeft: '20px',
    textAlign: 'left'
  },
  bubble: {
    margin: '8px 0',
    padding: '8px 12px',
    borderRadius: '16px',
    maxWidth: '60%',
    whiteSpace: 'pre-wrap',
    overflowWrap: 'anywhere'
  },
  preText: {
    margin: 0,
    fontFamily: 'inherit',
    whiteSpace: 'pre-wrap',
    overflowWrap: 'anywhere'
  },
  typingDots: {
    fontSize: '1.5rem',
    letterSpacing: '0.2rem',
    display: 'flex',
    justifyContent: 'center'
  },
  inputContainer: {
    display: 'flex',
    gap: '8px',
    padding: '8px 16px',
    borderTop: '1px solid rgba(0,0,0,0.1)'
  },
  textInput: {
    flex: 1,
    borderRadius: '4px',
    padding: '8px',
    fontFamily: 'inherit',
    fontSize: '1rem',
    border: '1px solid #ccc'
  },
  sendButton: {
    padding: '8px 16px',
    cursor: 'pointer',
    borderRadius: '4px',
    border: 'none',
    backgroundColor: '#3c82de',
    color: '#fff',
    fontWeight: 600
  },
  debugPanel: {
    width: '400px',
    minWidth: '300px',
    backgroundColor: '#f7f7f7',
    margin: '16px 16px 16px 0',
    borderRadius: '8px',
    padding: '16px',
    boxShadow: '0 0 20px rgba(0,0,0,0.1)',
    overflowY: 'auto',
    height: 'calc(100vh - 32px)'
  },
  debugContent: {
    fontSize: '0.9rem',
    lineHeight: '1.4',
    color: '#333'
  },
  debugPre: {
    backgroundColor: '#eee',
    padding: '8px',
    borderRadius: '4px',
    whiteSpace: 'pre-wrap',
    overflowWrap: 'anywhere'
  }
};

export default App;
