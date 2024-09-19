import redis from "../infrastructure/RedisConnection";
import productsCache from "./ProductsCacheService";
import productsRepository from "../infrastructure/ProductsRepository";
import cron from "node-cron";
import { BuiltinLogger, createLogger } from "express-zod-api";

const SYNCHRONIZATION_DAYLY_RELOAD_HOUR = parseInt(process.env.PRODUCTS_CACHE_SYNCHRONIZATION_DAYLY_RELOAD_HOUR ?? "") || 0;
const SYNCHRONIZATION_DAYLY_RELOAD_MINUTE = parseInt(process.env.PRODUCTS_CACHE_SYNCHRONIZATION_DAYLY_RELOAD_MINUTE ?? "") || 0;
const SYNCHRONIZATION_FREQUANCY_MS = parseInt(process.env.PRODUCTS_CACHE_SYNCHRONIZATION_FREQUANCY_MS ?? "") || 5000;
const SYNCHRONIZATION_UPDATES_PROCESSING_LIMIT = 1000;

export class ProductsCacheSynchronizationService {
    private readonly _logger: BuiltinLogger;
    private _isInitialized: boolean = false;
    private _isSynchronizing: boolean = false;

    constructor() {
        this._logger = createLogger({ level: "info" });
    }

    public get isInitialized(): boolean {
        return this._isInitialized;
    }

    public async initialize(): Promise<void> {
        try {
            this._logger.info("Initializing products cache");

            await productsCache.initialize();
            await productsRepository.initializeProductsUpdatesLog();
            await this.reloadProductsCache();

            this._logger.info(`Daily products reloading timer started. Time: ${SYNCHRONIZATION_DAYLY_RELOAD_HOUR}:${SYNCHRONIZATION_DAYLY_RELOAD_MINUTE}`);
            cron.schedule(`${SYNCHRONIZATION_DAYLY_RELOAD_MINUTE} ${SYNCHRONIZATION_DAYLY_RELOAD_HOUR} * * *`, async () => {
                this.reloadProductsCache();
            });

            this._logger.info(`Product change tracking started. Synchronization frequency:" ${SYNCHRONIZATION_FREQUANCY_MS} ms`);
            cron.schedule(`*/${SYNCHRONIZATION_FREQUANCY_MS / 1000} * * * * *`, async () => {
                this.synchronizeProductsCache();
            });

            this._isInitialized = true;
            this._logger.info("Products cache initialized");
        }
        catch (e: any) {
            this._logger.error("Error while initializing products cache", e);
            throw e;
        }
    }

    private async reloadProductsCache(): Promise<void> {
        try {
            let page = 1;

            this._logger.info("Reloading products cache");

            while (true) {
                const products = await productsRepository.getAll(page, 100);

                if (products.length === 0)
                    break;

                for (const product of products) {
                    productsCache.setProduct(product);
                }

                this._logger.info(`${products.length} products added to cache from page ${page}`);
                page++;
            }

            const productsCount = await productsCache.getProductsCount();
            this._logger.info(`Products cache reloaded. Count: ${productsCount}`);
        }
        catch (e: any) {
            this._logger.error("Error while reloading products cache", e);
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
                this._logger.info(`${productIds.length} products updated in cache`);
            }
        }
        catch (e: any) {
            this._logger.error("Error while synchronizing products cache", e);
        }
        finally {
            this._isSynchronizing = false;
        }
    }
}

const synchronizationService = new ProductsCacheSynchronizationService();
export default synchronizationService;
