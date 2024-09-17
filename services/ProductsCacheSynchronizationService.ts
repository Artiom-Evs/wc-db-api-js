import redis from "../infrastructure/RedisConnection";
import productsCache from "./ProductsCacheService";
import productsRepository from "../infrastructure/ProductsRepository";

const SYNCHRONIZATION_FREQUANCY_MS = parseInt(process.env.PRODUCTS_CACHE_SYNCHRONIZATION_FREQUANCY_MS ?? "") || 5000;
const SYNCHRONIZATION_UPDATES_PROCESSING_LIMIT = 1000;

export class ProductsCacheSynchronizationService {
    private _isInitialized: boolean = false;

    public get isInitialized(): boolean {
        return this._isInitialized;
    }

    public async initialize(): Promise<void> {
        try {
            console.log("Initializing products cache");

            await productsCache.initialize();
            await this.reloadProductsCache();

            this._isInitialized = true;
            console.log("Products cache initialized");
        }
        catch (e: any) {
            console.error("Error while initializing products cache", e);
            throw e;
        }
    }

    private async reloadProductsCache(): Promise<void> {
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

            page++;
            console.log(products.length, "products added to cache from page", page);
        }

        const productsCount = productsCache.getProductsCount();
        console.log("Products cache reloaded. Count:", productsCount);
    }
}

const synchronizationService = new ProductsCacheSynchronizationService();
export default synchronizationService;
