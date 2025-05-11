// components/ProductCard.tsx
import Image from 'next/image';
import styles from '../styles/ChatInterface.module.css';

interface ProductCardProps {
  title: string;
  description: string;
  price: number; // Changed to number for consistency, formatted as string in UI
  image: string | null;
  landing_page: string;
  matches?: string;
  onAddToCart?: (productId: string) => void; // Optional prop as in original
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
        <h3 className={styles.productTitle} style={{ fontSize: '0.9rem' }}>{title}</h3>
        <p className={styles.productDescription}>{description}</p>
        <p className={styles.productPrice} style={{ fontSize: '1rem' }}>${price.toFixed(2)}</p>
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
            className={`${styles.addToCartButton} ${styles.viewProductPink}`}
          >
            View Product
          </a>
          <button
            className={styles.addToCartButton}
            onClick={() => productId && onAddToCart && onAddToCart(productId)}
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