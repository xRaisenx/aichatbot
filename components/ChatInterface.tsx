// components/ChatInterface.tsx

'use client';

import type { ChatMessage as APIChatMessage } from '@/lib/types'; // Alias the backend ChatMessage type
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'; // Import useMemo
import { FaCommentDots, FaPaperPlane, FaPlus, FaTimes, FaTrashAlt } from 'react-icons/fa';
import { v4 as uuidv4 } from 'uuid';
import { addToCart } from '../lib/shopify'; // Assuming this exists
import styles from '../styles/ChatInterface.module.css';
import type { Message } from './ChatMessage'; // Import the updated Message type from ChatMessage.tsx
import { ChatMessage } from './ChatMessage'; // Import the ChatMessage component

// Simple debounce implementation - Added ESLint disable for 'any'
// T extends (...args: any[]) => any allows func to be async and have specific args
// The debounced function still returns void as the async result is not awaited by the handler
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function debounce<T extends (...args: any[]) => any>(func: T, wait: number): (...args: Parameters<T>) => void {
  let timeout: ReturnType<typeof setTimeout> | null;
  return function(this: ThisParameterType<T>, ...args: Parameters<T>) {
    if (timeout) clearTimeout(timeout);
    timeout = setTimeout(() => func.apply(this, args), wait);
  };
}


// Fallback questions if API fails
const fallbackSuggestedQuestions = [
  "What are the best products for oily skin?",
  "Can you suggest a good hydrating serum?",
  "Show me popular vegan makeup items.",
  "Find cleansers suitable for sensitive skin."
];

const welcomeMessageText =
  process.env.NEXT_PUBLIC_WELCOME_MESSAGE ||
  "Welcome! How can I help you find beauty products today?";


export function ChatInterface() {
  // Use the updated Message type for the state
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [cartId, setCartId] = useState<string | null>(null); // Assuming cartId is managed here
  const [isOpen, setIsOpen] = useState(false);
  const [userId, setUserId] = useState<string>(''); // Add userId state
  const [premadeQuestions, setPremadeQuestions] = useState<string[]>([]);
  const [isLoadingPremadeQuestions, setIsLoadingPremadeQuestions] = useState(true);
  const [contextualSuggestions, setContextualSuggestions] = useState<string[]>([]);
  const [isLoadingContextualSuggestions, setIsLoadingContextualSuggestions] = useState(false);


  const chatAreaRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const chatWidgetRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // Check if userId is already stored (e.g., in localStorage)
    const storedUserId = localStorage.getItem('chatUserId');
    if (storedUserId) {
      setUserId(storedUserId);
    } else {
      const newUserId = uuidv4();
      setUserId(newUserId);
      localStorage.setItem('chatUserId', newUserId); // Store for future sessions
    }

    const fetchSuggestedQuestions = async () => {
      setIsLoadingPremadeQuestions(true);
      try {
        // Updated to POST request as the API now expects POST
        const response = await fetch('/api/chat/generate-suggested-questions', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ type: 'initial' }), // Specify type for initial questions
        });
        if (!response.ok) {
          throw new Error(`API error: ${response.status}`);
        }
        const data = await response.json();
        if (data.questions && Array.isArray(data.questions) && data.questions.length > 0) {
          setPremadeQuestions(data.questions.slice(0, 4)); // Ensure we only take up to 4
        } else {
          console.warn("Fetched suggested questions are not in expected format or empty, using fallback.");
          setPremadeQuestions(fallbackSuggestedQuestions);
        }
      } catch (error) {
        console.error("Failed to fetch AI-generated suggested questions:", error);
        setPremadeQuestions(fallbackSuggestedQuestions); // Use fallback on error
      } finally {
        setIsLoadingPremadeQuestions(false);
      }
    };

    fetchSuggestedQuestions();
  }, []); // Empty dependency array ensures this runs only once on mount


  const createWelcomeMessage = useCallback((): Message => {
    return {
      id: uuidv4(),
      role: 'bot', // Or 'assistant'
      advice: welcomeMessageText,
      // Initialize other fields from ChatApiResponse to defaults or null/empty if needed by Message type
      is_product_query: false,
      search_keywords: [],
      product_types: [],
      attributes: [],
      vendor: null,
      price_filter: null,
      requested_product_count: 0,
      ai_understanding: 'welcome',
      sort_by_price: false,
      usage_instructions: '',
      is_combo_set_query: false,
      is_fictional_product_query: false,
      is_clarification_needed: false,
      is_ingredient_query: false,
      skin_concern: [],
      hair_concern: [], // Added hair_concern default
      is_price_range_query: false,
      response_confidence: 1.0,
      suggested_follow_ups: [], // Welcome message might not have specific follow-ups initially
      is_out_of_stock_query: false,
      query_language: 'en',
      is_comparison_query: false,
      cache_ttl_override: 0, // Don't cache welcome message
      is_location_specific: false,
      user_intent_priority: 'greeting',
      alternative_product_types: [],
      is_feedback_request: false,
      contextual_clarification: '',
      is_subscription_query: false,
      is_personalized_query: false,
      product_application_time: [],
      is_promotion_query: false,
      user_sentiment: 'positive',
      is_gift_query: [],
      product_packaging: [],
      is_educational_query: false,
      related_categories: [],
      is_urgency_indicated: false,
      query_complexity: 0,
      // Client-specific fields
      isLoading: false,
      isError: false,
      product_card: null,
      complementary_products: null,
      product_comparison: [], // Ensure this is initialized
      knowledge_base_answer: null,
    };
  }, []);

  const updateButtons = useCallback(() => {
    const clearBtn = document.getElementById('clear-btn') as HTMLButtonElement;
    const newBtn = document.getElementById('new-btn') as HTMLButtonElement;
    // Check if there's more than just the initial welcome message
    const hasUserMessages = messages.some(msg => msg.role === 'user');
    if (clearBtn) clearBtn.disabled = !hasUserMessages;
    if (newBtn) newBtn.disabled = !hasUserMessages;
  }, [messages]);

  useEffect(() => {
    // Initialize messages with the welcome message only if it's empty
    if (messages.length === 0) {
       setMessages([createWelcomeMessage()]);
    }
  }, [messages.length, createWelcomeMessage]); // Depend on messages.length

  useEffect(() => {
    if (chatAreaRef.current && isOpen) {
      // Scroll to bottom smoothly
      chatAreaRef.current.scrollTo({
        top: chatAreaRef.current.scrollHeight,
        behavior: 'smooth',
      });
      inputRef.current?.focus();
    }
    updateButtons();
  }, [messages, isOpen, updateButtons]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (chatWidgetRef.current && !chatWidgetRef.current.contains(event.target as Node) && isOpen) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setInput(e.target.value);
  };

  const handleAddToCart = useCallback(async (variantId: string, productTitle: string) => {
    try {
      // Ensure cartId is available, maybe fetch or create if null
      const currentCartId = cartId; // Fixed prefer-const

      if (!currentCartId) {
          // Implement logic to fetch or create a cart if cartId is null
          console.warn("Cart ID is null. Implement logic to fetch or create a cart.");
          // For now, we'll just proceed, but addToCart might fail or create a new cart each time
      }

      const { cartId: newCartId, checkoutUrl, userErrors } = await addToCart(currentCartId, variantId, 1);
      if (userErrors.length > 0) {
        console.error('Cart errors:', userErrors);
        alert(`Failed to add ${productTitle} to cart: ${userErrors.map(e => e.message).join(', ')}`);
        return;
      }
      if (!newCartId) {
        throw new Error('No cart ID returned from addToCart.');
      }
      setCartId(newCartId); // Update cartId state if a new one was created/returned
      console.log(`Product ${productTitle} added to cart. New/Current Cart ID: ${newCartId}`);
      if (checkoutUrl) {
        // Optionally redirect or open checkout in a new tab
        // alert(`${productTitle} added to cart! Proceed to checkout?`);
        // window.open(checkoutUrl, '_blank');
        console.log(`Checkout URL: ${checkoutUrl}`);
        alert(`${productTitle} added to cart!`); // Just confirm for now
      } else {
        alert(`${productTitle} added to cart!`);
      }
    } catch (error) {
      console.error('Failed to add to cart:', error);
      alert(`Sorry, there was an error adding ${productTitle} to your cart.`);
    }
  }, [cartId]); // Depend on cartId

// Fixed useCallback warning for sendMessage by disabling the rule for this line
// The dependencies are logically correct as it uses state variables and calls handleAddToCart (which uses cartId)
const sendMessage = useCallback(async (messageText: string) => { // eslint-disable-line react-hooks/exhaustive-deps
  const trimmedText = messageText.trim();
  if (!trimmedText || isLoading) return;

  console.log('sendMessage triggered with query:', trimmedText);

  setContextualSuggestions([]);
  const userMessageId = uuidv4();
  const userMessage: Message = { id: userMessageId, role: 'user', text: trimmedText };
  const loadingMessageId = uuidv4();

  setMessages((prev) => {
    const newMessages = [
      ...prev,
      userMessage,
      { id: loadingMessageId, role: 'bot' as const, isLoading: true } as Message,
    ];
    console.log('Added user message and loading message:', newMessages.length);
    return newMessages;
  });
  setInput('');
  setIsLoading(true);

  try {
    // Ensure history sent to API matches backend ChatMessage type
    const historyForChatApi: APIChatMessage[] = messages
      .filter(m => !m.isLoading && !m.isError)
      .map(m => ({
        role: m.role === 'bot' ? 'assistant' : m.role, // Map 'bot' to 'assistant' for API
        content: m.text || m.advice || '' // Use content field
      }));
    historyForChatApi.push({ role: 'user', content: trimmedText });

    console.log('Initiating API call for query:', trimmedText);
    const response = await fetch('/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query: trimmedText, chatHistory: historyForChatApi, userId }),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.error || `API error: ${response.status} ${response.statusText}`);
    }

    const botResponseData = await response.json();
    console.log('Received API response:', botResponseData);

    setMessages((prev) => {
      const messagesWithoutLoading = prev.filter(msg => msg.id !== loadingMessageId);
      // Ensure the bot message structure matches the client-side Message interface
      const newBotMessage: Message = {
        id: uuidv4(),
        role: 'bot',
        ...botResponseData, // Spread API response data
        // Ensure client-specific fields are not overwritten if they exist in API response (they shouldn't)
        isLoading: false,
        isError: false,
        text: botResponseData.advice, // Use advice as the main text content for display
        // product_card, complementary_products, etc. come from botResponseData
      } as Message; // Cast to Message to ensure type compatibility
      const newMessages = [...messagesWithoutLoading, newBotMessage];
      console.log('Updated messages with bot response:', newMessages.length);
      return newMessages;
    });

    setIsLoadingContextualSuggestions(true);
    try {
      // Use the history returned by the API, which includes the latest turn
      const contextualHistoryForAPI: APIChatMessage[] = botResponseData.history;
      const suggestionsResponse = await fetch('/api/chat/generate-suggested-questions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'contextual',
          conversation_history: contextualHistoryForAPI,
        }),
      });
      if (suggestionsResponse.ok) {
        const suggestionsData = await suggestionsResponse.json();
        if (suggestionsData.questions && Array.isArray(suggestionsData.questions)) {
          setContextualSuggestions(suggestionsData.questions.slice(0, 3));
        } else {
          setContextualSuggestions([]);
        }
      } else {
        console.error('Failed to fetch contextual suggestions:', suggestionsResponse.statusText);
        setContextualSuggestions([]);
      }
    } catch (suggestionsError) {
      console.error('Error fetching contextual suggestions:', suggestionsError);
      setContextualSuggestions([]);
    } finally {
      setIsLoadingContextualSuggestions(false);
    }
  } catch (error) {
    console.error('Failed to send/process message:', error);
    setMessages((prev) => [
      ...prev.filter(msg => msg.id !== loadingMessageId),
      {
        id: uuidv4(),
        role: 'bot',
        isError: true,
        text: `Sorry, something went wrong. Please try again. ${error instanceof Error ? `(${error.message.substring(0, 100)})` : ''}`,
        advice: '', // Keep advice empty for error message
        // Provide default/empty values for all ChatApiResponse fields in error state
        is_product_query: false, search_keywords: [], product_types: [], attributes: [], vendor: null, price_filter: null, requested_product_count: 0, ai_understanding: 'error', sort_by_price: false, usage_instructions: '', is_combo_set_query: false, is_fictional_product_query: false, is_clarification_needed: false, is_ingredient_query: false, skin_concern: [], hair_concern: [], is_price_range_query: false, response_confidence: 0, suggested_follow_ups: [], is_out_of_stock_query: false, query_language: 'en', is_comparison_query: false, cache_ttl_override: 0, is_location_specific: false, user_intent_priority: 'error', alternative_product_types: [], is_feedback_request: false, contextual_clarification: '', is_subscription_query: false, is_personalized_query: false, product_application_time: [], is_promotion_query: false, user_sentiment: 'negative', is_gift_query: [], product_packaging: [], is_educational_query: false, related_categories: [], is_urgency_indicated: false, query_complexity: 0,
        product_card: null, complementary_products: null, product_comparison: [], knowledge_base_answer: null,
      },
    ]);
    setContextualSuggestions([]);
    setIsLoadingContextualSuggestions(false);
  } finally {
    setIsLoading(false);
    inputRef.current?.focus();
    updateButtons();
  }
}, [isLoading, messages, updateButtons, userId, cartId]); // Added cartId dependency as sendMessage uses handleAddToCart which uses cartId


// Memoize the debounced function itself - Reordered to be after sendMessage definition
const debouncedSendMessage = useMemo(() => debounce(sendMessage, 300), [sendMessage]); // Depends on sendMessage

// Dependencies seem correct here as it uses sendMessage, input, and isLoading
const handleKeyPress = useCallback((e: React.KeyboardEvent<HTMLInputElement>) => {
  if (e.key === 'Enter' && !isLoading) {
    sendMessage(input);
  }
}, [sendMessage, input, isLoading]);


  const handleExampleClick = (question: string) => {
    setContextualSuggestions([]); // Clear contextual suggestions when an example is clicked
    setInput(question);
    // Send the message immediately
    sendMessage(question);
  };

  const toggleChat = () => {
    setIsOpen(!isOpen);
  };

  const clearChat = useCallback(() => {
    setMessages([createWelcomeMessage()]);
    setInput('');
    inputRef.current?.focus();
    updateButtons();
    setContextualSuggestions([]); // Clear suggestions on clear
  }, [createWelcomeMessage, updateButtons]);

  const newConversation = useCallback(() => {
    // Generate a new userId for a truly new conversation session
    const newUserId = uuidv4();
    setUserId(newUserId);
    localStorage.setItem('chatUserId', newUserId); // Store the new ID
    setCartId(null); // Clear cart ID for a new session

    setMessages([createWelcomeMessage()]);
    setInput('');
    inputRef.current?.focus();
    updateButtons();
    setContextualSuggestions([]); // Clear suggestions on new conversation
  }, [createWelcomeMessage, updateButtons]);

  return (
    <div ref={chatWidgetRef} className={styles.widget}>
      {!isOpen && (
        <button
          className={styles.toggle}
          onClick={toggleChat}
          aria-label="Open chat"
        >
          <FaCommentDots size={24} />
        </button>
      )}
      <div className={`${styles.container} ${isOpen ? styles.open : ''}`}>
        <div className={styles.header}>
          <span>Planet Beauty AI ✨</span>
          {isOpen && (
            <button
              className={styles.iconButton}
              onClick={toggleChat}
              aria-label="Close chat"
            >
              <FaTimes size={24} color="#FFFFFF" />
            </button>
          )}
        </div>
        <div className={styles.controls}>
          <button
            id="clear-btn"
            className={styles.controlBtn}
            onClick={clearChat}
            disabled={messages.filter(m => m.role === 'user').length === 0} // Disable if no user messages
            aria-label="Clear chat"
          >
            <FaTrashAlt size={12} className="mr-1" />
            Clear Chat
          </button>
          <button
            id="new-btn"
            className={styles.controlBtn}
            onClick={newConversation}
            disabled={messages.filter(m => m.role === 'user').length === 0} // Disable if no user messages
            aria-label="Start new conversation"
          >
            <FaPlus size={12} className="mr-1" />
            New Conversation
          </button>
        </div>
        <div ref={chatAreaRef} className={styles.area}>
          {messages.map((msg) => (
            <ChatMessage key={msg.id} message={msg} onAddToCart={handleAddToCart} />
          ))}
        </div>
        {/* Display suggested questions */}
        {!isLoading && !isLoadingPremadeQuestions && messages.filter(m => m.role === 'user').length === 0 && premadeQuestions.length > 0 && (
           <div className={styles.examples}>
             <div className={styles.examplesTitle}>Try asking:</div>
             {premadeQuestions.map((question, index) => (
               <button
                 key={`premade-${index}`}
                 onClick={() => handleExampleClick(question)}
                 className={styles.chip}
                 aria-label={`Ask: ${question}`}
               >
                 {question}
               </button>
             ))}
           </div>
         )}
         {!isLoading && !isLoadingContextualSuggestions && messages.filter(m => m.role === 'user').length > 0 && contextualSuggestions.length > 0 && (
           <div className={styles.examples}>
              <div className={styles.examplesTitle}>Suggested next questions:</div>
             {contextualSuggestions.map((question, index) => (
               <button
                 key={`contextual-${index}`}
                 onClick={() => handleExampleClick(question)}
                 className={styles.chip}
                 aria-label={`Ask: ${question}`}
               >
                 {question}
               </button>
             ))}
           </div>
         )}
        <div className={styles.inputArea}>
          <input
            ref={inputRef}
            className={styles.input}
            type="text"
            placeholder="Ask about beauty products..."
            value={input}
            onChange={handleInputChange}
            onKeyPress={handleKeyPress}
            disabled={isLoading}
            autoComplete="off"
            aria-label="Type your beauty question"
          />
          <button
            id="send-btn"
            className={`${styles.iconButton} ${styles.sendBtn}`}
            // --- UPDATED ONCLICK ---
            onClick={() => debouncedSendMessage(input)} // Call the debounced function
            // --- END UPDATED ONCLICK ---
            disabled={isLoading || !input.trim()}
            aria-label="Send message"
          >
            <FaPaperPlane size={14} />
          </button>
        </div>
        <div className={styles.footer}>
          Developed with ❤️ by Jose
        </div>
      </div>
    </div>
  );
}