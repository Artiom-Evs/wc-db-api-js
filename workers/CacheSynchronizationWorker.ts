import { Product, Variation } from "schemas";
import docStorage from "../services/DocStorage";
import productsCache, { toCacheItem } from "../services/ProductsCache";
import productsRepository from "../infrastructure/ProductsRepository";
import pool from "../infrastructure/DbConnectionPool";
import { unserialize } from "php-serialize";
import { randomInt } from "crypto";

const synchronizationFreequancy = parseInt(process.env.CACHE_PRODUCTS_SYNCHRONIZATION_FREEQUANCY_MS ?? "");
const reimportTime = process.env.CACHE_PRODUCTS_REIMPORT_TIME;

if (!synchronizationFreequancy) 
    throw new Error (`"CACHE_PRODUCTS_SYNCHRONIZATION_FREEQUANCY_MS" environment variable should be defined and should be number.`);
if (!reimportTime || !/^\d{2}:\d{2}$/.test(reimportTime)) 
    throw new Error (`"CACHE_PRODUCTS_REIMPORT_TIME" environment variable should be defined and has a "HH:MM" format.`);

interface ChangeLogItem {
    ID: number,
    product_or_variation_id: number,
    meta_key: string,
    meta_value: string
}

const WORKER_DATA_KEY = "cache-synchronization-worker";
interface WorkerData {
    key: string,
    lastAppliedChange: number
}

class CacheSynchronizationWorker {
    public async start(): Promise<void>{
        const collection = docStorage.collection<Product>("products");
        const cachedProductsCount  = await collection.count({ });

        // if cache is not empty, then firstly initialize memory cache
        if (cachedProductsCount > 0)
            await this.loadProductsFromMongoCacheToMemoryCache();
        
        await this.loadProductsFromMainDBToMongoCache();
        await this.loadProductsFromMongoCacheToMemoryCache();
        
        this.startPeriodicMemoryCacheUpdating();
        this.StartPeriodicMongoDBCacheReloading();
    }

    private async loadProductsFromMongoCacheToMemoryCache(): Promise<void> {
        console.debug("Start loading cached products.");

        const collection = docStorage.collection<Product>("products");

        const products = await collection.find({ }).toArray();
        const items = products.map(p => toCacheItem(p));
        productsCache.updateProducts(() => items);
        
        console.debug("Cached products loaded. Count:", items.length);
    }

    private async loadProductsFromMainDBToMongoCache(): Promise<void> {
        console.debug("Start loading products from main DB to MongoDB cache.");

        const collection = docStorage.collection<Product>("products");
        const productsCount = (await productsRepository.getProductsStatistic({ })).products_count;
        
        for (let i = 1; (i - 1) * 100 < productsCount; i++) {
            const products = await productsRepository.getAll({ page: i });
            const productIds = products.map(p => p.id);

            if (products.length > 0) {
                const productsMap: Map<number, Product> = new Map();

                products.forEach(p => {
                    if (!productsMap.has(p.id))
                        productsMap.set(p.id, p);
                });

                await collection.deleteMany({ id: { $in: productIds }});
                await collection.insertMany([...productsMap.values()]);

                console.debug(productsMap.size, "products loaded from page", i);;
            }
        }

        console.debug("Products successfully loaded from main DB to MongoDB cache.");
    }

    private startPeriodicMemoryCacheUpdating(): void {
        const interval = synchronizationFreequancy;

        setTimeout(async () => {
            try {
                await this.applyChangesToMemoryCache();
            }
            catch (e) {
                console.error("Error while periodic memory cache updating.", e);
            }
            finally {
                this.startPeriodicMemoryCacheUpdating();
            }
        }, interval);
    }

    private StartPeriodicMongoDBCacheReloading(): void {
        // milliseconds untill 6:00 +/- 10 minutes
        const interval = this.getMillisecondsUntil(reimportTime ?? "") + randomInt(-10 * 60 * 1000, 10 * 60 * 1000);

        setTimeout(async () => {
            try {
                await this.loadProductsFromMainDBToMongoCache();
                await this.loadProductsFromMongoCacheToMemoryCache();
            }
            catch (e) {
                console.error("Error while periodic MongoDB cache reloading.", e);
            }
            finally {
                this.startPeriodicMemoryCacheUpdating();
            }
        }, interval);
    }

    private async applyChangesToMemoryCache(): Promise<void> {
        const workerData = await this.getOrCreateWorkerData();

        const query = `SELECT ID, product_or_variation_id, meta_key, meta_value FROM wp_postmeta_change_log WHERE ID > ? LIMIT 1000;`;
        const [changes] = await pool.query<any[]>(query, [workerData.lastAppliedChange]) as any as [ChangeLogItem[]];

        if (!changes || changes.length === 0)
            return;

        const products = await productsCache.GetProducts();

        productsCache.updateProducts(() => {
            for (const product of products) {
                changes.filter(c => c.product_or_variation_id === product.product.id)
                    .forEach(change => this.applyChangeToMemoryCache(change, product.product));

                for (const variation of product.product.variations) {
                    changes.filter(c => c.product_or_variation_id === variation.id)
                        .forEach(change => this.applyChangeToMemoryCache(change, variation));
                }
            }

            return products;
        });

        const lastAppliedChange = Math.max(...changes.map(c => c.ID));
        await this.updateWorkerData({ lastAppliedChange });
        console.debug(changes.length, "changes applied to cache.");
    }

    private applyChangeToMemoryCache(change: ChangeLogItem, item: Product | Variation): void {
        switch (change.meta_key) {
            case "_stock":
                item.stock_quantity = parseInt(change.meta_value) ?? 0;
                break;
            case "_price":
                item.price = Math.round((parseFloat(change.meta_value) ?? 0) * 100) / 100;
                break;
            case "_price_circulations":
                item.price_circulations = unserialize(change.meta_value);
        }
    }

    // takes time in format "HH:MM" and returns milliseconds from now to this time in future
    private getMillisecondsUntil(time: string): number {
        const [targetHours, targetMinutes] = time.split(":").map(Number);
        const now = new Date();
        const targetTime = new Date(
            now.getFullYear(),
            now.getMonth(),
            now.getDate(),
            targetHours,
            targetMinutes,
            0,
            0
        );
    
        if (targetTime <= now) {
            targetTime.setDate(targetTime.getDate() + 1);
        }
    
        return targetTime.getTime() - now.getTime();
    }

    private async getOrCreateWorkerData(): Promise<WorkerData> {
        const collection = docStorage.collection<WorkerData>("system_data");
        let data = await collection.findOne({ key: WORKER_DATA_KEY });

        if (!data) {
            await collection.insertOne({ key: WORKER_DATA_KEY, lastAppliedChange: 0 });
            data = await collection.findOne({ key: WORKER_DATA_KEY });
        }

        if (!data)
            throw new Error("Failed to get the cache synchronization worker system data.");

        return data;
    }

    private async updateWorkerData(data: Partial<WorkerData>): Promise<void> {
        const collection = docStorage.collection<WorkerData>("system_data");
        await collection.updateOne({ key: WORKER_DATA_KEY }, { $set: data });
    }
}

const synchronizationWorker = new CacheSynchronizationWorker();
export default synchronizationWorker;
