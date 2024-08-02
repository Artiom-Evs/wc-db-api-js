import { Product } from "schemas";
import docStorage from "./DocStorage";
import productsRepository from "../infrastructure/ProductsRepository";
import ReadWriteLock from "rwlock";
import { release } from "os";

export interface ProductCacheItem {
    product: Product, 
    created: number, 
    base_colors: string,
    sizes: string
}

class ProductsCache {
    private readonly _lock = new ReadWriteLock();
    private _items: ProductCacheItem[] = [];

    constructor() {
        this.loadProducts();
    }

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

    public updateProducts(mutator: () => void): Promise<void> {
        return new Promise((resolve, reject) => {
            this._lock.writeLock((resolve) => {
                try {
                    mutator();
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

    private async loadProducts(): Promise<void> {
        console.debug("Start loading cached products.");
        const collection = docStorage.collection<Product>("products");
        const products = await collection.find({ }).toArray();
        const items = products.map(p => this.toCacheItem(p));
        this.updateProducts(() => this._items = items);
        console.debug("Cached products loaded. Count:", this._items.length);
    }

    private toCacheItem(product: Product): ProductCacheItem {
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

    private async importProducts(): Promise<void> {
        const collection = docStorage.collection<Product>("products");
        const productsCount = (await productsRepository.getProductsStatistic({ })).products_count;
        
        for (let i = 1; (i - 1) * 100 < productsCount; i++) {
            const products = await productsRepository.getAll({ page: i });
            const productIds = products.map(p => p.id);

            const existedProducts = await collection.find({ id: { $in: productIds }}).toArray();
            const existedProductIds = existedProducts.map((p: any) => p.id) as number[];

            const notExistedProducts = products.filter(p => !existedProductIds.includes(p.id));
            console.debug(notExistedProducts.length, "products  from page", i);

            if (notExistedProducts.length > 0) {
                await collection.insertMany(notExistedProducts);
            }
        }

        console.debug("Finish!");
    }
}

const productsCache = new ProductsCache();
export default productsCache;
