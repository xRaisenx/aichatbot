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
  product_type?: string;
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

// Helper function to format markdown-like text to HTML
function formatMessageContent(content: string): string {
  let formatted = content
    .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>') // Bold
    .replace(/\*(.*?)\*/g, '<em>$1</em>') // Italic
    .replace(/^- (.*)$/gm, '<li>$1</li>') // Bullets
    .replace(/\n\n/g, '</p><p>') // Paragraphs
    .replace(/\n/g, '<br>'); // Single newlines
  formatted = `<p>${formatted}</p>`;
  // Wrap bullets in ul
  formatted = formatted.replace(/(<li>.*<\/li>)/g, '<ul>$1</ul>');
  return formatted;
}

export function ChatMessage({ message, onAddToCart }: ChatMessageProps) {
  const isUser = message.role === 'user';

  // Enhanced logging for debugging
  useEffect(() => {
    if (message.ai_understanding) {
      console.log(`AI Understanding for message ${message.id}:`, message.ai_understanding);
    }
    if (message.product_card) {
      console.log(`Product card for message ${message.id}:`, message.product_card.title);
    }
    if (message.complementary_products) {
      console.log(`Complementary products for message ${message.id}:`, message.complementary_products.map(p => p.title));
    }
    if (message.advice) {
      console.log(`Advice length for message ${message.id}: ${message.advice.length} characters`);
    }
  }, [message]);

  // Validate product relevance (e.g., exclude haircare for skincare queries)
  const isProductRelevant = (product: ProductCardResponse): boolean => {
    const isHaircareProduct = product.title.toLowerCase().includes('conditioner') || product.title.toLowerCase().includes('shampoo');
    const queryProductType = message.product_type?.toLowerCase();
    const productTitleLower = product.title.toLowerCase();

    // Assuming we only want to exclude haircare products for now
    if (isHaircareProduct) {
      console.warn(`Irrelevant product detected: ${product.title}`);
      return false;
    }

    if (queryProductType && !productTitleLower.includes(queryProductType)) {
      console.warn(`Irrelevant product detected: ${product.title} (not a ${queryProductType})`);
      return false;
    }

    return true;
  };

  const getReasonForMatch = (product: ProductCardResponse): string => {
    let reason = "This product matches your query.";
    const queryProductType = message.product_type?.toLowerCase();
    const productTitleLower = product.title.toLowerCase();

    if (queryProductType && productTitleLower.includes(queryProductType)) {
      reason = `This is a ${queryProductType}.`;
    }

    return reason;
  }

  // Parse and format advice
  const parseAdvice = (advice: string, query: string = '') => {
    let cleanedAdvice = advice;
    let parsedProductCard = message.product_card;

    // Handle product card regex (if embedded in advice)
    const productCardRegex = /PRODUCT_CARD_START(\{.*?\})PRODUCT_CARD_END/;
    const match = advice.match(productCardRegex);
    if (match && match[1]) {
      try {
        const productCardData = JSON.parse(match[1]);
        parsedProductCard = {
          title: productCardData.title || 'Untitled Product',
          description: productCardData.description || '',
          price: Number(productCardData.price) / 100 || 0,
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

    // Format advice for chatbox display
    const formattedAdvice = formatMessageContent(cleanedAdvice || 'No advice provided.');

    return { cleanedAdvice: formattedAdvice, parsedProductCard };
  };

  // Sanitization options for safe HTML rendering
  const sanitizeOptions = {
    USE_PROFILES: { html: true },
    ALLOWED_TAGS: ['b', 'i', 'strong', 'em', 'br', 'p', 'ul', 'ol', 'li', 'span'],
    ALLOWED_ATTR: ['style'], // Allow style for potential emoji rendering
  };

  const { cleanedAdvice, parsedProductCard } = message.advice
    ? parseAdvice(message.advice, message.text || '')
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
        <p className="font-medium">Oops! Something went wrong.</p>
        {sanitizedText && <div dangerouslySetInnerHTML={{ __html: sanitizedText }} />}
      </div>
    );
  }

  // Filter unique and relevant products
  const uniqueProducts = new Set<string>();
  const filteredProductCard = parsedProductCard && isProductRelevant(parsedProductCard)
    ? parsedProductCard
    : null;
  const filteredComplementaryProducts = message.complementary_products
    ?.filter(p => isProductRelevant(p) && !uniqueProducts.has(p.variantId) && p.variantId !== parsedProductCard?.variantId)
    .map(p => {
      uniqueProducts.add(p.variantId);
      return p;
    }) || [];

  if (filteredProductCard) {
    uniqueProducts.add(filteredProductCard.variantId);
  }

  return (
    <div className={`${styles['message-base']} ${isUser ? styles['user-message'] : styles['bot-message']} ${styles.messageBubble}`}>
      {/* User message */}
      {isUser && message.text && (
        <div dangerouslySetInnerHTML={{ __html: sanitizedText }} />
      )}

      {/* Bot message components */}
      {!isUser && (
        <>
          {/* Advice text */}
          {sanitizedAdvice ? (
            <div className="advice-text" dangerouslySetInnerHTML={{ __html: sanitizedAdvice }} />
          ) : (
            <p>No advice available. Try asking for specific product recommendations!</p>
          )}

          {/* Product card */}
          {filteredProductCard ? (
            <div className="mt-3 mb-1">
              <ProductCard
                title={filteredProductCard.title}
                description={`${filteredProductCard.description} \n\n ${getReasonForMatch(filteredProductCard)}`}
                price={filteredProductCard.price}
                image={filteredProductCard.image || '/pb_logo.svg'}
                landing_page={filteredProductCard.landing_page}
                matches={filteredProductCard.matches}
                productId={filteredProductCard.variantId}
                availableForSale={filteredProductCard.availableForSale}
                quantityAvailable={filteredProductCard.quantityAvailable}
                onAddToCart={(productId) => onAddToCart(productId, filteredProductCard.title)}
              />
            </div>
          ) : null}

          {/* Product comparison */}
          {message.product_comparison ? (
            <div className="mt-3 mb-1">
              <ProductComparison products={message.product_comparison} />
            </div>
          ) : null}

          {/* Complementary products */}
          {filteredComplementaryProducts.length > 0 ? (
            <div className="mt-3 mb-1">
              <ComplementaryProducts
                products={filteredComplementaryProducts.map((product) => ({
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
          ) : null}

          {/* Knowledge base answer */}
          {message.knowledge_base_answer ? (
            <div className="mt-3 mb-1">
              <KnowledgeBaseDisplay answer={message.knowledge_base_answer} />
            </div>
          ) : null}
        </>
      )}
    </div>
  );
}
