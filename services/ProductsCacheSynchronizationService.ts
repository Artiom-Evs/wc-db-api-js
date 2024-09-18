import redis from "../infrastructure/RedisConnection";
import productsCache from "./ProductsCacheService";
import productsRepository from "../infrastructure/ProductsRepository";
import cron from "node-cron";

const SYNCHRONIZATION_DAYLY_RELOAD_HOUR = parseInt(process.env.PRODUCTS_CACHE_SYNCHRONIZATION_DAYLY_RELOAD_HOUR ?? "") || 0;
const SYNCHRONIZATION_DAYLY_RELOAD_MINUTE = parseInt(process.env.PRODUCTS_CACHE_SYNCHRONIZATION_DAYLY_RELOAD_MINUTE ?? "") || 0;
const SYNCHRONIZATION_FREQUANCY_MS = parseInt(process.env.PRODUCTS_CACHE_SYNCHRONIZATION_FREQUANCY_MS ?? "") || 5000;
const SYNCHRONIZATION_UPDATES_PROCESSING_LIMIT = 1000;

export class ProductsCacheSynchronizationService {
    private _isInitialized: boolean = false;
    private _isSynchronizing: boolean = false;

    public get isInitialized(): boolean {
        return this._isInitialized;
    }

    public async initialize(): Promise<void> {
        try {
            console.log("Initializing products cache");

            await productsCache.initialize();
            await productsRepository.initializeProductsUpdatesLog();
            await this.reloadProductsCache();

            cron.schedule(`${SYNCHRONIZATION_DAYLY_RELOAD_MINUTE} ${SYNCHRONIZATION_DAYLY_RELOAD_HOUR} * * *`, async () => {
                this.reloadProductsCache();
            });

            cron.schedule(`*/${SYNCHRONIZATION_FREQUANCY_MS / 1000} * * * * *`, async () => {
                this.synchronizeProductsCache();
            });

            this._isInitialized = true;
            console.log("Products cache initialized");
        }
        catch (e: any) {
            console.error("Error while initializing products cache", e);
            throw e;
        }
    }

    private async reloadProductsCache(): Promise<void> {
        try {
            let page = 1;

            console.log("Reloading products cache");

            while (true) {
                const products = await productsRepository.getAll({
                    page,
                    per_page: 100
                });

                if (products.length === 0)
                    break;

                for (const product of products) {
                    productsCache.setProduct(product);
                }

                console.log(products.length, "products added to cache from page", page);
                page++;
            }

            const productsCount = await productsCache.getProductsCount();
            console.log("Products cache reloaded. Count:", productsCount);
        }
        catch (e: any) {
            console.error("Error while reloading products cache", e);
        }
    }

    private async synchronizeProductsCache(): Promise<void> {
        try {
            if (this._isSynchronizing)
                return;

            this._isSynchronizing = true;

            // get current UTC time minus synchronization frequency minus 500 milliseconds to avoid gaps in updates
            const startDate = new Date(new Date().getTime() - SYNCHRONIZATION_FREQUANCY_MS - 500);
            const updates = await productsRepository.getProductsUpdates(startDate, SYNCHRONIZATION_UPDATES_PROCESSING_LIMIT);

            if (updates.length > 0) {
                const productIds = [...new Set(updates.map(u => u.parent_id))];
                const products = await productsRepository.GetByIds(productIds);

                await productsCache.setProducts(products);
                console.log(productIds.length, "products updated in cache.");
            }
        }
        catch (e: any) {
            console.error("Error while synchronizing products cache", e);
        }
        finally {
            this._isSynchronizing = false;
        }
    }
}

const synchronizationService = new ProductsCacheSynchronizationService();
export default synchronizationService;
