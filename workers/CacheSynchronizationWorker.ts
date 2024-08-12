import { Product, Variation } from "schemas";
import docStorage from "../services/DocStorage";
import productsCache, { toCacheItem } from "../services/ProductsCache";
import productsRepository from "../infrastructure/ProductsRepository";
import pool from "../infrastructure/DbConnectionPool";
import { unserialize } from "php-serialize";

interface ChangeLogItem {
    ID: number,
    product_or_variation_id: number,
    meta_key: string,
    meta_value: string
}

class CacheSynchronizationWorker {
    private _lastAppliedChange: number = 0;

    public async start(): Promise<void>{
        await this.importProducts();
        await this.loadProducts();
        this.startPeriodicHandler();
    }

    private async loadProducts(): Promise<void> {
        console.debug("Start loading cached products.");

        const collection = docStorage.collection<Product>("products");

        const products = await collection.find({ }).toArray();
        const items = products.map(p => toCacheItem(p));
        productsCache.updateProducts(() => items);
        console.debug("Cached products loaded. Count:", items.length);
    }

    private async importProducts(): Promise<void> {
        console.debug("Start importing products from main database to cache database.");

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
                const productsMap: Map<number, Product> = new Map();
                notExistedProducts.forEach(p => {
                    if (!productsMap.has(p.id))
                        productsMap.set(p.id, p);
                });

                await collection.insertMany([...productsMap.values()]);
            }
        }

        console.debug("Finish!");
    }

    private startPeriodicHandler(): void {
        const interval = 15000;

        setTimeout(async () => {
            try {
                await this.applyChangesToCache();
            }
            catch (e) {
                console.error("Error while executing periodic handler.", e);
            }
            finally {
                this.startPeriodicHandler();
            }
        }, interval);
    }

    private async applyChangesToCache(): Promise<void> {
        const query = `SELECT ID, product_or_variation_id, meta_key, meta_value FROM wp_postmeta_change_log WHERE ID > ? LIMIT 1000;`;
        const [changes] = await pool.query<any[]>(query, [this._lastAppliedChange]) as any as [ChangeLogItem[]];

        if (!changes || changes.length === 0)
            return;

        const products = await productsCache.GetProducts();

        productsCache.updateProducts(() => {
            for (const product of products) {
                changes.filter(c => c.product_or_variation_id === product.product.id)
                    .forEach(change => this.applyChange(change, product.product));

                for (const variation of product.product.variations) {
                    changes.filter(c => c.product_or_variation_id === variation.id)
                        .forEach(change => this.applyChange(change, variation));
                }
            }

            return products;
        });

        this._lastAppliedChange = Math.max(...changes.map(c => c.ID));
        console.debug(changes.length, "changes applied to cache.");
    }

    private applyChange(change: ChangeLogItem, item: Product | Variation): void {
        switch (change.meta_key) {
            case "_stock":
                item.stock_quantity = parseInt(change.meta_value) ?? 0;
                break;
            case "_price":
                item.price = parseFloat(change.meta_value)?.toFixed(2) ?? 0;
                break;
            case "_price_circulations":
                item.price_circulations = unserialize(change.meta_value);
        }
    }
}

const synchronizationWorker = new CacheSynchronizationWorker();
export default synchronizationWorker;
