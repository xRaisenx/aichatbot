// components/ChatMessage.tsx

import DOMPurify from 'isomorphic-dompurify';
import { useEffect } from 'react';
import { ChatApiResponse, ProductCardResponse } from '../lib/types';
import styles from '../styles/ChatInterface.module.css';
import { ComplementaryProducts } from './ComplementaryProducts';
import { KnowledgeBaseDisplay } from './KnowledgeBaseDisplay';
import { ProductCard } from './ProductCard';
import { ProductComparison } from './ProductComparison';

// Define the client-side Message interface
// It extends Partial<ChatApiResponse> and adds client-specific fields
// and any fields from the API response that are NOT in ChatApiResponse but used here.
export interface Message extends Partial<ChatApiResponse> {
  id: string;
  role: 'user' | 'bot' | 'assistant'; // Include 'assistant' role for consistency with backend
  text?: string; // User message text or raw bot text before formatting
  isLoading?: boolean; // Client-side loading state
  isError?: boolean; // Client-side error state

  // Fields from ChatApiResponse are now potentially included via Partial<ChatApiResponse>
  // e.g., advice, product_card, complementary_products, suggested_follow_ups, etc.

  // Add product_comparison explicitly as it's used but not in ChatApiResponse
  product_comparison?: ProductCardResponse[];

  // Add knowledge_base_answer if it's a specific structure you add client-side
  // or ensure it's part of ChatApiResponse if the backend provides it.
  // Based on your previous code, it seems like a client-side addition for display.
  knowledge_base_answer?: {
    question_matched: string;
    answer: string;
    source_url?: string;
  } | null;
}


interface ChatMessageProps {
  // --- UPDATED PROP TYPE ---
  onAddToCart: (productId: string, productTitle: string) => Promise<void>; // Match async signature
  // --- END UPDATED PROP TYPE ---
  message: Message;
}

// Helper function to format markdown-like text to HTML
function formatMessageContent(content: string): string {
  if (!content?.trim()) return '<p class="formatted-paragraph"></p>';

  const blocks = content.split(/\n\n+/);
  const formattedBlocks: string[] = []; // Fixed prefer-const

  for (const block of blocks) { // Fixed prefer-const
      const lines = block.split('\n').filter(line => line.trim());
      let listHtml = '';
      let currentListType: 'ul' | 'ol' | null = null;
      let listItemsHtml: string[] = [];

      lines.forEach(line => {
          const olMatch = line.match(/^\s*(\d+)\.\s+(.*)$/);
          const ulMatch = line.match(/^\s*[-*]\s+(.*)$/);

          if (olMatch) {
              if (currentListType === 'ul' && listItemsHtml.length) {
                  listHtml += wrapList(listItemsHtml, true);
                  listItemsHtml = [];
              }
              currentListType = 'ol';
              listItemsHtml.push(`<li class="formatted-li-ol">${olMatch[2].trim()}</li>`);
          } else if (ulMatch) {
               if (currentListType === 'ol' && listItemsHtml.length) {
                  listHtml += wrapList(listItemsHtml, false);
                  listItemsHtml = [];
              }
              currentListType = 'ul';
              listItemsHtml.push(`<li class="formatted-li"><span class="formatted-li-bullet"></span>${ulMatch[1].trim()}</li>`);
          } else {
              // Not a list item line, close current list and treat as paragraph
               if (listItemsHtml.length) {
                  listHtml += wrapList(listItemsHtml, currentListType === 'ul');
                  listItemsHtml = [];
                  currentListType = null;
               }
               // Treat as paragraph line
               listHtml += `<p class="formatted-paragraph">${line.trim().replace(/\n/g, '<br>')}</p>`;
          }
      });
       if (listItemsHtml.length) {
          listHtml += wrapList(listItemsHtml, currentListType === 'ul');
       }
       formattedBlocks.push(listHtml); // Add the processed block (which might contain lists or paragraphs)

  }

  let formatted = formattedBlocks.join(''); // Join blocks

  // Apply inline formatting after block structure is done
  formatted = formatted
    .replace(/\*\*\*(.*?)\*\*\*/g, '<strong class="formatted-strong"><em class="formatted-em">$1</em></strong>')
    .replace(/\*\*(.*?)\*\*/g, '<strong class="formatted-strong">$1</strong>')
    .replace(/\*(.*?)\*/g, '<em class="formatted-em">$1</em>')
    // Headings - apply to paragraph content that looks like a heading
    .replace(/<p class="formatted-paragraph">\s*(#+)\s+(.+?)<\/p>/gm, (match, hashes, content) => {
         const headingLevel = Math.min(hashes.length, 3); // Limit to h3
         const tag = `h${headingLevel}`;
         return `<${tag} class="formatted-heading-${headingLevel}">${content.trim()}</${tag}>`;
    })
     // Emoji (e.g., 💡) - apply to paragraph content
    .replace(/<p class="formatted-paragraph">\s*💡\s*(.*?)(<\/p>|$)/gm, '<p class="formatted-paragraph"><span class="formatted-emoji">💡</span>$1$2');


  // Clean up empty tags and normalize whitespace (be careful with whitespace)
  formatted = formatted
    .replace(/<p[^>]*>\s*<\/p>/g, '') // Remove empty paragraphs
    .replace(/<br>\s*<br>/g, '<br>') // Replace double breaks with single (optional)
    // .replace(/\s+/g, ' ') // This might be too aggressive, remove if it breaks spacing
    .trim();

  // Final sanitization will handle escaping and allowed tags/attributes
  const sanitizeOptions = {
    USE_PROFILES: { html: true },
    // Allow tags generated by formatMessageContent
    ALLOWED_TAGS: ['p', 'br', 'strong', 'em', 'ul', 'ol', 'li', 'span', 'div', 'h1', 'h2', 'h3'],
    // Allow style for potential emoji rendering or other specific cases
    ALLOWED_ATTR: ['class', 'style'], // Allow class for CSS modules, style for specific inline styles
  };
  return DOMPurify.sanitize(formatted, sanitizeOptions);
}

function wrapList(items: string[], isUnordered: boolean): string {
  return isUnordered ? `<ul class="formatted-ul">${items.join('')}</ul>` : `<ol class="formatted-ol">${items.join('')}</ol>`;
}

// Add this CSS class for formatted messages
const formattedStyles = `
.formatted-heading-1, .formatted-heading-2, .formatted-heading-3 {
  margin: 1em 0 0.5em; /* Adjusted margin */
  padding: 0;
  font-weight: 600;
  color: inherit; /* Inherit color */
}
.formatted-heading-1 { font-size: 1.5em; }
.formatted-heading-2 { font-size: 1.3em; }
.formatted-heading-3 { font-size: 1.2em; }

.formatted-strong {
    font-weight: 700;
}

.formatted-em {
    font-style: italic;
}

.formatted-link {
    color: #2563eb; /* Blue link color */
    text-decoration: underline;
    transition: color 0.2s;
}

.dark .formatted-link {
    color: #93c5fd; /* Lighter blue for dark mode */
}

.formatted-link:hover {
    color: #1e40af;
}

.dark .formatted-link:hover {
     color: #60a5fa;
}


.formatted-pre {
    margin: 0.5em 0; /* Adjusted margin */
    padding: 0.5em;
    background: #f8fafc;
    border: 1px solid #e2e8f0;
    border-radius: 4px;
    overflow-x: auto;
    font-family: monospace;
    font-size: 0.9em;
    color: #333; /* Code text color */
}

.dark .formatted-pre {
    background: #2A2A2A;
    border-color: #444444;
    color: #E0E0E0;
}

.formatted-code {
    background: #f8fafc;
    padding: 0.2em 0.4em;
    border-radius: 3px;
    font-family: monospace;
    font-size: 0.9em;
    color: #333; /* Inline code text color */
}

.dark .formatted-code {
    background: #2A2A2A;
    color: #E0E0E0;
}


.formatted-blockquote {
    margin: 0.5em 0; /* Adjusted margin */
    padding: 0.5em 1em; /* Adjusted padding */
    border-left: 4px solid #6b7280;
    background: #f9fafb;
    border-radius: 3px;
    color: #374151;
    font-style: italic;
    line-height: 1.5;
}

.dark .formatted-blockquote {
    background: #2A2A2A;
    border-color: #444444;
    color: #E0E0E0;
}

.formatted-emoji {
    font-size: 1.1em;
    margin-right: 4px;
    vertical-align: middle; /* Align emoji better */
}

.formatted-ul {
    margin: 0.5em 0; /* Adjusted margin */
    padding: 0 0 0 1.5em; /* Adjusted padding */
    list-style: none; /* Remove default list style */
    font-size: 1em;
    color: inherit; /* Inherit color */
}

.formatted-ol {
    margin: 0.5em 0; /* Adjusted margin */
    padding: 0 0 0 1.8em; /* Adjusted padding for numbers */
    list-style: decimal;
    font-size: 1em;
    color: inherit; /* Inherit color */
}

.formatted-li {
    margin: 0.25em 0; /* Add some vertical margin to list items */
    padding-left: 0; /* Remove default padding */
    position: relative;
    line-height: 1.5;
    color: inherit; /* Inherit color */
}

.formatted-li-bullet {
    position: absolute;
    left: -1.2em; /* Position bullet outside */
    top: 0.5em; /* Align bullet vertically */
    width: 6px;
    height: 6px;
    background-color: currentColor; /* Use text color for bullet */
    border-radius: 50%;
}

.formatted-li-ol {
    margin: 0.25em 0; /* Add some vertical margin to list items */
    padding-left: 0; /* Remove default padding */
    line-height: 1.5;
    color: inherit; /* Inherit color */
}

/* Ensure list items within formatted lists inherit color */
.formatted-ul li,
.formatted-ol li {
    color: inherit;
}
`;


// Inject formatted message styles into document head if not already present
if (typeof document !== 'undefined') {
  const styleId = 'formatted-message-styles';
  if (!document.getElementById(styleId)) {
    const style = document.createElement('style');
    style.id = styleId;
    style.innerHTML = formattedStyles;
    document.head.appendChild(style);
  }
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
     if (message.product_comparison) { // Log product comparison
        console.log(`Product comparison for message ${message.id}:`, message.product_comparison.map(p => p.title));
     }
    if (message.advice) {
      console.log(`Advice length for message ${message.id}: ${message.advice.length} characters`);
    }
     if (message.suggested_follow_ups) {
        console.log(`Suggested follow-ups for message ${message.id}:`, message.suggested_follow_ups);
     }
  }, [message]);


  // Format and sanitize advice
  const formatAndSanitizeAdvice = (advice: string) => {
    const formatted = formatMessageContent(advice || 'No advice provided.');
    // Sanitization options for safe HTML rendering
    const sanitizeOptions = {
      USE_PROFILES: { html: true },
      // Allow tags generated by formatMessageContent
      ALLOWED_TAGS: ['p', 'br', 'strong', 'em', 'ul', 'ol', 'li', 'span', 'div', 'h1', 'h2', 'h3'],
      // Allow style for potential emoji rendering or other specific cases
      ALLOWED_ATTR: ['class', 'style'], // Allow class for CSS modules, style for specific inline styles
    };
    return DOMPurify.sanitize(formatted, sanitizeOptions);
  };

  const sanitizedAdvice = message.advice ? formatAndSanitizeAdvice(message.advice) : '';
  const sanitizedText = message.text ? DOMPurify.sanitize(message.text, { USE_PROFILES: { html: true } }) : ''; // Simple sanitization for user text


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
      <div className={`${styles['message-base']} ${styles['bot-message']} ${styles.messageBubble} ${styles.errorMessage}`}> {/* Added error class */}
        <p className="font-medium">Oops! Something went wrong.</p>
        {/* Display error text if available, sanitized */}
        {message.text && <div dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(message.text) }} />}
      </div>
    );
  }

  // Use products directly from the message object (provided by backend)
  const productCard = message.product_card;
  const complementaryProducts = message.complementary_products || [];
  const productComparison = message.product_comparison || []; // Use product_comparison from message
  const knowledgeBaseAnswer = message.knowledge_base_answer; // Assuming this is added client-side or is part of the message structure


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
            // Fallback text if no advice is provided by LLM or formatting fails
            <p>No advice available. Try asking for specific product recommendations!</p>
          )}

          {/* Product card */}
          {productCard ? (
            <div className="mt-3 mb-1">
              <ProductCard
                title={productCard.title}
                description={productCard.description} // Use description directly from backend
                price={productCard.price}
                image={productCard.image || '/pb_logo.svg'}
                landing_page={productCard.landing_page}
                matches={productCard.matches} // Use matches directly from backend if available
                productId={productCard.variantId}
                availableForSale={productCard.availableForSale ?? true} // Use backend value or default
                quantityAvailable={productCard.quantityAvailable} // Use backend value
                onAddToCart={(productId) => onAddToCart(productId, productCard.title)}
              />
            </div>
          ) : null}

          {/* Product comparison */}
          {productComparison.length > 0 ? ( // Check if productComparison array has items
             <div className="mt-3 mb-1">
               <ProductComparison products={productComparison} />
             </div>
           ) : null}


          {/* Complementary products */}
          {complementaryProducts.length > 0 ? (
            <div className="mt-3 mb-1">
              {/* Render ComplementaryProducts component */}
              <ComplementaryProducts
                products={complementaryProducts}
                onAddToCart={onAddToCart} // Pass onAddToCart down
              />
            </div>
          ) : null}

          {/* Knowledge base answer - Assuming this is a specific display type */}
          {knowledgeBaseAnswer ? (
            <div className="mt-3 mb-1">
              <KnowledgeBaseDisplay answer={knowledgeBaseAnswer} />
            </div>
          ) : null}

           {/* Suggested Follow-ups - Displayed in ChatInterface, not ChatMessage */}
        </>
      )}
    </div>
  );
}