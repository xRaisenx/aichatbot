// components/ProductCard.tsx
import Image from 'next/image';
// --- UPDATED IMPORT ---
import styles from '../styles/ProductCard.module.css'; // Import styles from the new dedicated module
// --- END UPDATED IMPORT ---

interface ProductCardProps {
  title: string;
  description: string;
  price: number; // Changed to number for consistency, formatted as string in UI
  image: string | null;
  landing_page: string;
  matches?: string;
  // --- UPDATED PROP TYPE ---
  onAddToCart?: (productId: string, productTitle: string) => Promise<void>; // Updated signature to match async
  // --- END UPDATED PROP TYPE ---
  productId?: string; // Optional prop as in original
  availableForSale?: boolean;
  quantityAvailable?: number;
}

export function ProductCard({
  title,
  description,
  price,
  image,
  landing_page,
  matches,
  onAddToCart,
  productId,
  availableForSale,
  quantityAvailable,
}: ProductCardProps) {
  return (
    <div className={styles.productCard}>
      {image ? (
        <Image
          src={image}
          alt={title}
          className={styles.productImage}
          width={80}
          height={80}
          loading="lazy"
          sizes="(max-width: 768px) 80px, 80px"
          onError={(e) => {
            e.currentTarget.src = '/placeholder-image.png'; // Fallback image
          }}
        />
      ) : (
        <Image
          src="/placeholder-image.png"
          alt="Placeholder"
          className={styles.productImage}
          width={80}
          height={80}
          loading="lazy"
          sizes="(max-width: 768px) 80px, 80px"
        />
      )}
      <div className={styles.productInfo}>
        {/* Removed inline styles, use CSS module */}
        <h3 className={styles.productTitle}>{title}</h3>
        <p className={styles.productDescription}>{description}</p>
        {/* Removed inline styles, use CSS module */}
        <p className={styles.productPrice}>${price.toFixed(2)}</p>
        {availableForSale === false && (
          <p className={styles.outOfStock}>Out of Stock</p>
        )}
        {availableForSale === true && quantityAvailable !== undefined && quantityAvailable <= 5 && quantityAvailable > 0 && (
          <p className={styles.lowStock}>Low Stock: {quantityAvailable} left!</p>
        )}
        <div className={styles.productActions}>
          <a
            href={landing_page}
            target="_blank"
            rel="noopener noreferrer"
            // --- UPDATED CLASS NAMES ---
            className={`${styles.productActionButton} ${styles.viewProductButton}`}
            // --- END UPDATED CLASS NAMES ---
          >
            View Product
          </a>
          <button
            // --- UPDATED CLASS NAME ---
            className={styles.productActionButton}
            // --- END UPDATED CLASS NAME ---
            // --- UPDATED CALL SITE ---
            onClick={() => productId && onAddToCart && onAddToCart(productId, title)} // Pass title
            // --- END UPDATED CALL SITE ---
            disabled={!productId || !onAddToCart || availableForSale === false}
          >
            Add to Cart
          </button>
        </div>
        {matches && <p className={styles.productMatches}>{matches}</p>}
      </div>
    </div>
  );
}