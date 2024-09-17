import redis from "../infrastructure/RedisConnection";
import { Product, ProductAttribute, ProductsStatistic } from "../schemas";
import { GetProductsOptions } from "../infrastructure/ProductsRepository";
import { SchemaFieldTypes, SearchOptions } from "redis";

const INDEX_NAME = "idx:products";

interface StatisticResultItem { 
    price: number;
    attributes: ProductAttribute[];
}

// escapes special characters in the given string to correct inserting into RediSearch queries as a parameter
function escapeParam(param: string): string {
    const escapedParam = param.replace(/[-@|(){}[\]"~*^$:;,]/g, '\\$&');
    return escapedParam;
}


class ProductsCacheService {
    public async initialize(): Promise<void> {
        const indexes = await redis.ft._list();

        // TODO: estimate the time spent on recreating the index on a real data
        if (indexes.includes(INDEX_NAME))
            await redis.ft.dropIndex(INDEX_NAME);

        await redis.ft.create(INDEX_NAME, {
            "$.id": {
                type: SchemaFieldTypes.NUMERIC,
                SORTABLE: false,
                AS: "id"
            },
            "$.slug": {
                type: SchemaFieldTypes.TAG,
                AS: "slug"
            },
            "$.sku": {
                type: SchemaFieldTypes.TEXT,
                AS: "sku"
            },
            "$.name": {
                type: SchemaFieldTypes.TEXT,
                AS: "name"
            },
            "$.created": {
                type: SchemaFieldTypes.TAG,
                AS: "created"
            },
            "$.modified": {
                type: SchemaFieldTypes.TAG,
                AS: "modified"
            },
            "$.stock_quantity": {
                type: SchemaFieldTypes.NUMERIC,
                sortable: true,
                AS: "stock_quantity"
            },
            "$.price": {
                type: SchemaFieldTypes.NUMERIC,
                sortable: true,
                AS: "price"
            },
            "$.categories[*].slug": {
                type: SchemaFieldTypes.TAG,
                SORTABLE: true,
                AS: "categories"
            },
            "$.attributes[*].slug": {
                type: SchemaFieldTypes.TAG,
                SORTABLE: true,
                AS: "attributes"
            },
            "$.attributes[*].options[*].slug": {
                type: SchemaFieldTypes.TAG,
                SORTABLE: true,
                AS: "attributes_options"
            },
        }, {
            ON: "JSON",
            PREFIX: "product:",
        });
    }

    public async setProduct(product: Product): Promise<void> {
        await redis.json.set(`product:${product.id}`, "$", product);
    }

    public async setProducts(products: Product[]): Promise<void> {
        for (const product of products)
            await this.setProduct(product);
    }

    public async getProducts(options: GetProductsOptions): Promise<Product[]> {
        const query = this.buildRedisearchQuery(options);
        const searchOptions = this.buildRedisearchOptions(options);

        const result = await redis.ft.search(INDEX_NAME, query, searchOptions);
        const products = result.documents.map(d => d.value) as any as Product[];

        return products;
    }

    public async getProductsStatistic(options: GetProductsOptions): Promise<ProductsStatistic> {
        const query = this.buildRedisearchQuery(options);
        const result = await redis.ft.search(INDEX_NAME, query, {
            RETURN: ["price", "attributes"]
        });
        const items = result.documents.map(d => d.value) as any as StatisticResultItem[];
        
        const products_count = result.total;
        const min_price = 0;
        const max_price = 0;
        const attributes: ProductAttribute[] = [];

        return {
            products_count,
            min_price,
            max_price,
            attributes
        };
    }

    public async getProductsCount(): Promise<number> {
        const result = await redis.ft.search(INDEX_NAME, "*", { RETURN: ["id"] });
        return result.total;
    }

    private buildRedisearchQuery(options: GetProductsOptions): string {
        const attributeFilte = "";
        const query: string = [
            options.category ? `@categories:{${escapeParam(options.category)}}` : null,
            options.min_price || options.max_price ? `@price:[${options.min_price ?? "-inf"} ${options.max_price ?? "+inf"}]` : null
        ].filter(f => f).join(" ") || "*";

        return query;
    }

    private buildRedisearchOptions(options: GetProductsOptions): SearchOptions {
        const page = options.page ?? 1;
        const perPage = options.per_page ?? 100;
        const direction = options.order === "asc" ? "ASC" : "DESC";
        let orderBy: string = options.order_by ?? "date";

        if (orderBy === "quantity")
            orderBy = "stock_quantity";

        const searchOptions: SearchOptions = {
            LIMIT: {
                from: (page - 1) * perPage,
                size: perPage
            },
            SORTBY: {
                BY: orderBy,
                DIRECTION: direction
            }
        };

        return searchOptions;
    }
}

const productsCache = new ProductsCacheService();
export default productsCache;
