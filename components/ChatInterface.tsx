// components/ChatInterface.tsx

'use client';

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { FaCommentDots, FaPaperPlane, FaPlus, FaTimes, FaTrashAlt } from 'react-icons/fa';
import { v4 as uuidv4 } from 'uuid';
import { addToCart } from '../lib/shopify';
import styles from '../styles/ChatInterface.module.css';
import { ChatMessage, Message } from './ChatMessage';

const suggestedQuestions = [
  "What’s the best moisturizer for dry skin?",
  "Can you recommend a sulfate-free shampoo?",
  "Show me vegan lipsticks under $20.",
  "Are there any products for sensitive skin?",
  "I need a good anti-aging serum.",
  "What are some popular cruelty-free makeup brands?",
  "Find me a hydrating face mask.",
  "Suggest a gift set for a friend who loves skincare.",
  "What's a good sunscreen for oily skin?",
  "Show me some organic hair care products.",
];

const welcomeMessageText =
  process.env.NEXT_PUBLIC_WELCOME_MESSAGE ||
  "Welcome! How can I help you find beauty products today?";

export function ChatInterface() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [cartId, setCartId] = useState<string | null>(null);
  const [isOpen, setIsOpen] = useState(false);
  const [premadeQuestions, setPremadeQuestions] = useState<string[]>([]);

  const chatAreaRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const chatWidgetRef = useRef<HTMLDivElement>(null);

  const getPremadeQuestions = useCallback(() => {
    if (typeof window !== 'undefined') {
      const shuffled = [...suggestedQuestions].sort(() => 0.5 - Math.random());
      return shuffled.slice(0, 5);
    }
    return suggestedQuestions.slice(0, 5);
  }, []);

  useEffect(() => {
    setPremadeQuestions(getPremadeQuestions());
  }, [getPremadeQuestions]);

  const createWelcomeMessage = useCallback((): Message => {
    return {
      id: uuidv4(),
      role: 'bot',
      advice: welcomeMessageText,
    };
  }, []);

  const updateButtons = useCallback(() => {
    const clearBtn = document.getElementById('clear-btn') as HTMLButtonElement;
    const newBtn = document.getElementById('new-btn') as HTMLButtonElement;
    const hasMessages = messages.length > 1;
    if (clearBtn) clearBtn.disabled = !hasMessages;
    if (newBtn) newBtn.disabled = !hasMessages;
  }, [messages]);

  useEffect(() => {
    setMessages([createWelcomeMessage()]);
  }, [createWelcomeMessage]);

  useEffect(() => {
    if (chatAreaRef.current && isOpen) {
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
      const { cartId: newCartId, checkoutUrl, userErrors } = await addToCart(cartId, variantId, 1);
      if (userErrors.length > 0) {
        console.error('Cart errors:', userErrors);
        alert(`Failed to add ${productTitle} to cart: ${userErrors.map(e => e.message).join(', ')}`);
        return;
      }
      if (!newCartId) {
        throw new Error('No cart ID returned.');
      }
      setCartId(newCartId);
      console.log(`Product ${productTitle} added to cart: ${newCartId}`);
      if (checkoutUrl) {
        alert(`${productTitle} added to cart! Proceed to checkout?`);
        window.open(checkoutUrl, '_blank');
      } else {
        alert(`${productTitle} added to cart!`);
      }
    } catch (error) {
      console.error('Failed to add to cart:', error);
      alert(`Sorry, there was an error adding ${productTitle} to your cart.`);
    }
  }, [cartId]);

  const sendMessage = useCallback(async (messageText: string) => {
    const trimmedText = messageText.trim();
    if (!trimmedText || isLoading) return;

    const userMessageId = uuidv4();
    const userMessage: Message = { id: userMessageId, role: 'user', text: trimmedText };

    const loadingMessageId = uuidv4();
    setMessages((prev) => {
      const newMessages = [
        ...prev,
        userMessage,
        { id: loadingMessageId, role: 'bot' as const, isLoading: true } as Message,
      ];
      console.log('Added loading message:', loadingMessageId, 'Total messages:', newMessages.length);
      return newMessages;
    });
    setInput('');
    setIsLoading(true);

    try {
      const historyToSend = messages
        .filter(m => !m.isLoading && !m.isError)
        .slice(-6)
        .map(({ id, role, text, advice, product_card, complementary_products }) => ({
          id,
          role,
          text,
          advice,
          product_card,
          complementary_products,
        }));

      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: trimmedText, history: historyToSend }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || `API error: ${response.status} ${response.statusText}`);
      }

      const data = await response.json();
      console.log('Received API response:', data);

      setMessages((prev) => [
        ...prev.filter(msg => msg.id !== loadingMessageId),
        { ...data, id: uuidv4(), role: 'bot' },
      ]);
    } catch (error) {
      console.error('Failed to send/process message:', error);
      setMessages((prev) => [
        ...prev.filter(msg => msg.id !== loadingMessageId),
        {
          id: uuidv4(),
          role: 'bot',
          isError: true,
          text: `Sorry, something went wrong. Please try again. ${error instanceof Error ? `(${error.message.substring(0, 100)})` : ''}`,
        },
      ]);
    } finally {
      setIsLoading(false);
      inputRef.current?.focus();
      updateButtons();
    }
  }, [isLoading, messages, updateButtons]);

  const handleSendClick = () => {
    sendMessage(input);
  };

  const handleKeyPress = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && !isLoading) {
      sendMessage(input);
    }
  };

  const handleExampleClick = (question: string) => {
    setInput(question);
    setTimeout(() => sendMessage(question), 0);
  };

  const toggleChat = () => {
    setIsOpen(!isOpen);
  };

  const clearChat = useCallback(() => {
    setMessages([createWelcomeMessage()]);
    setInput('');
    inputRef.current?.focus();
    updateButtons();
  }, [createWelcomeMessage, updateButtons]);

  const newConversation = useCallback(() => {
    setMessages([createWelcomeMessage()]);
    setInput('');
    inputRef.current?.focus();
    updateButtons();
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
            disabled={messages.length <= 1}
            aria-label="Clear chat"
          >
            <FaTrashAlt size={12} className="mr-1" />
            Clear Chat
          </button>
          <button
            id="new-btn"
            className={styles.controlBtn}
            onClick={newConversation}
            disabled={messages.length <= 1}
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
        {messages.length <= 1 && !isLoading && premadeQuestions.length > 0 && (
          <div className={styles.examples}>
            {premadeQuestions.map((question, index) => (
              <button
                key={index}
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
            onClick={handleSendClick}
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