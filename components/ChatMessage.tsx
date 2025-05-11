
// components/ChatMessage.tsx

import DOMPurify from 'isomorphic-dompurify';
import { useEffect } from 'react';
import { ProductCardResponse } from '../lib/types';
import styles from '../styles/ChatInterface.module.css';
import { ComplementaryProducts } from './ComplementaryProducts';
import { KnowledgeBaseDisplay } from './KnowledgeBaseDisplay';
import { ProductCard } from './ProductCard';
import { ProductComparison } from './ProductComparison';

export interface Message {
  id: string;
  role: 'user' | 'bot';
  text?: string;
  ai_understanding?: string;
  product_card?: {
    title: string;
    description: string;
    price: number;
    image: string | null;
    landing_page: string;
    matches?: string;
    variantId: string;
    availableForSale?: boolean;
    quantityAvailable?: number;
  };
  advice?: string;
  isLoading?: boolean;
  isError?: boolean;
  product_comparison?: ProductCardResponse[];
  complementary_products?: ProductCardResponse[];
  knowledge_base_answer?: {
    question_matched: string;
    answer: string;
    source_url?: string;
  } | null;
}

interface ChatMessageProps {
  message: Message;
  onAddToCart: (productId: string, productTitle: string) => void;
}

export function ChatMessage({ message, onAddToCart }: ChatMessageProps) {
  const isUser = message.role === 'user';

  useEffect(() => {
    if (message.ai_understanding) {
      console.log('AI Understanding:', message.ai_understanding);
    }
  }, [message.ai_understanding]);

  useEffect(() => {
    if (message.isLoading) {
      console.log('Rendering typing indicator for message:', message.id);
    }
  }, [message.isLoading, message.id]);

  useEffect(() => {
    if (message.product_card) {
      console.log('Rendering product card:', message.product_card);
    }
    if (message.complementary_products) {
      console.log('Rendering complementary products:', message.complementary_products);
    }
  }, [message.product_card, message.complementary_products]);

  const parseAdvice = (advice: string) => {
    const productCardRegex = /PRODUCT_CARD_START(\{.*?\})PRODUCT_CARD_END/;
    const match = advice.match(productCardRegex);
    let cleanedAdvice = advice;
    let parsedProductCard = message.product_card;

    if (match && match[1]) {
      try {
        const productCardData = JSON.parse(match[1]);
        parsedProductCard = {
          title: productCardData.title || 'Untitled Product',
          description: productCardData.description || '',
          price: Number(productCardData.price) || 0,
          image: productCardData.image || null,
          landing_page: productCardData.landing_page || '#',
          matches: productCardData.matches || '',
          variantId: productCardData.variantId || productCardData.landing_page?.split('/').pop() || '',
          availableForSale: productCardData.availableForSale ?? true,
          quantityAvailable: productCardData.quantityAvailable ?? undefined,
        };
        cleanedAdvice = advice.replace(productCardRegex, '').trim();
      } catch (error) {
        console.error('Failed to parse product card from advice:', error);
      }
    }

    return { cleanedAdvice, parsedProductCard };
  };

  const sanitizeOptions = {
    USE_PROFILES: { html: true },
    ALLOWED_TAGS: ['b', 'i', 'strong', 'em', 'br', 'p', 'ul', 'ol', 'li'],
  };
  const { cleanedAdvice, parsedProductCard } = message.advice
    ? parseAdvice(message.advice)
    : { cleanedAdvice: '', parsedProductCard: message.product_card };
  const sanitizedAdvice = cleanedAdvice ? DOMPurify.sanitize(cleanedAdvice, sanitizeOptions) : '';
  const sanitizedText = message.text ? DOMPurify.sanitize(message.text, sanitizeOptions) : '';

  if (message.isLoading) {
    return (
      <div className={`${styles['message-base']} ${styles['bot-message']} ${styles.messageBubble} ${styles['typing-container']}`}>
        <div className={styles['typing-dots']}>
          <span className={`${styles['typing-dot']} animate-bounce`} style={{ animationDelay: '0s' }}></span>
          <span className={`${styles['typing-dot']} animate-bounce`} style={{ animationDelay: '0.2s' }}></span>
          <span className={`${styles['typing-dot']} animate-bounce`} style={{ animationDelay: '0.4s' }}></span>
        </div>
      </div>
    );
  }

  if (message.isError) {
    return (
      <div className={`${styles['message-base']} ${styles['bot-message']} ${styles.messageBubble} bg-red-100 dark:bg-red-900/30 border border-red-300 dark:border-red-700 text-red-700 dark:text-red-300`}>
        <p className="font-medium">Oops!</p>
        {sanitizedText && <div dangerouslySetInnerHTML={{ __html: sanitizedText }} />}
      </div>
    );
  }

  return (
    <div className={`${styles['message-base']} ${isUser ? styles['user-message'] : styles['bot-message']} ${styles.messageBubble}`}>
      {!isUser && message.ai_understanding && null}

      {isUser && message.text && <div>{message.text}</div>}

      {!isUser && parsedProductCard && (
        <div className="mt-3 mb-1">
          <ProductCard
            title={parsedProductCard.title}
            description={parsedProductCard.description}
            price={parsedProductCard.price}
            image={parsedProductCard.image || '/pb_logo.svg'}
            landing_page={parsedProductCard.landing_page}
            matches={parsedProductCard.matches}
            productId={parsedProductCard.variantId}
            availableForSale={parsedProductCard.availableForSale}
            quantityAvailable={parsedProductCard.quantityAvailable}
            onAddToCart={(productId) => onAddToCart(productId, parsedProductCard.title)}
          />
        </div>
      )}

      {!isUser && message.product_comparison && message.product_comparison.length > 0 && (
        <div className="mt-3 mb-1">
          <ProductComparison products={message.product_comparison} />
        </div>
      )}

      {!isUser && message.complementary_products && message.complementary_products.length > 0 && (
        <div className="mt-3 mb-1">
          <ComplementaryProducts
            products={message.complementary_products.map((product) => ({
              title: product.title,
              description: product.description,
              price: product.price,
              image: product.image || '/pb_logo.svg',
              landing_page: product.landing_page,
              matches: product.matches,
              variantId: product.variantId,
              availableForSale: product.availableForSale ?? true,
              quantityAvailable: product.quantityAvailable,
            }))}
          />
        </div>
      )}

      {!isUser && message.knowledge_base_answer && (
        <div className="mt-3 mb-1">
          <KnowledgeBaseDisplay answer={message.knowledge_base_answer} />
        </div>
      )}

      {!isUser && sanitizedAdvice && (
        <div className="advice-text" dangerouslySetInnerHTML={{ __html: sanitizedAdvice }} />
      )}
    </div>
  );
}