import { Product } from "schemas";
import ReadWriteLock from "rwlock";
import { release } from "os";
import pool from "../infrastructure/MySQLPool";

export interface ProductCacheItem {
    product: Product,
    created: number,
    base_colors: string,
    sizes: string
}

class ProductsCache {
    private readonly _lock = new ReadWriteLock();
    private _items: ProductCacheItem[] = [];
    
    public GetProducts(): Promise<ProductCacheItem[]> {
        return new Promise((resolve, reject) => {
            this._lock.readLock((release) => {
                try {
                    resolve(this._items);;
                }
                finally {
                    release();
                }
            })
        })
    }

    public updateProducts(mutator: () => ProductCacheItem[]): Promise<void> {
        return new Promise((resolve, reject) => {
            this._lock.writeLock((resolve) => {
                try {
                    this._items = mutator();
                    resolve();
                }
                catch (e) {
                    reject(e);
                }
                finally {
                    release();
                }
            })
        })
    }
}

export function toCacheItem(product: Product): ProductCacheItem {
    (product as any).created = new Date(product.created);
    (product as any).modified = new Date(product.modified);
    product.variations.forEach(v => {
        (v as any).created = new Date(v.created);
        (v as any).modified = new Date(v.modified);
    });

    const timestamp = new Date(product.created).getTime();
    const baseColorsSet: Set<string> = new Set();
    const sizesSet: Set<string> = new Set();

    product.attributes.find(a => a.slug === "base_color")
        ?.options.forEach(o => baseColorsSet.add(o.slug));
    product.attributes.find(a => a.slug === "size")
        ?.options.forEach(o => sizesSet.add(o.slug));

    return {
        product,
        created: timestamp,
        base_colors: [...baseColorsSet].join(","),
        sizes: [...sizesSet].join(",")
    };
}

const productsCache = new ProductsCache();
export default productsCache;
