import redis from "../infrastructure/RedisConnection";
import { Product, ProductAttribute, ProductsStatistic } from "../schemas";
import { SchemaFieldTypes, SearchOptions } from "redis";

const INDEX_NAME = "idx:products";

interface StatisticResultItem {
    price: number;
    attributes: ProductAttribute[];
    "$.price": string;
    "$.attributes": string;
}

export interface GetCachedProductsOptions {
    page?: number,
    per_page?: number,
    order_by?: "date" | "price" | "quantity" | "name",
    order?: "asc" | "desc",
    min_price?: number,
    max_price?: number,
    category?: string,
    pa_supplier?: string[],
    pa_color?: string[],
    pa_base_color?: string[],
    pa_size?: string[],
    search?: string
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

    public async getProducts(options: GetCachedProductsOptions): Promise<Product[]> {
        const query = this.buildRedisearchQuery(options);
        const searchOptions = this.buildRedisearchOptions(options);

        const result = await redis.ft.search(INDEX_NAME, query, searchOptions);
        const products = result.documents.map(d => d.value) as any as Product[];

        return products;
    }

    public async getProductsStatistic(options: GetCachedProductsOptions): Promise<ProductsStatistic> {
        const query = this.buildRedisearchQuery(options);
        const result = await redis.ft.search(INDEX_NAME, query, {
            RETURN: ["$.price", "$.attributes"]
        });
        const items = result.documents.map(d => d.value) as any as StatisticResultItem[];

        // when RETURN option used, then selected fields are returned as strings
        items.forEach(item => {
            item.price = parseFloat(item["$.price"]);
            item.attributes = JSON.parse(item["$.attributes"]);
        });

        const filteredByPrice = items.filter(this.filterByPrice(options));
        const filteredByAttributes = items.filter(this.filterByAttributes(options));

        const products_count = result.total;
        const attributes = this.getAttributesStatistic(filteredByPrice);
        const [min_price, max_price] = this.getMinAndMaxPrice(filteredByAttributes);

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

    public async searchProducts(search: string, page: number = 1, perPage: number = 100): Promise<Product[]> {
        // the minimum word length for wildcard search with default Redis settings is 2 characters
        if (!search || search.length < 2)
            return [];

        const escapedSearch = escapeParam(search);
        const query = `@sku|name:'*${escapedSearch}*'`;
        const options = { LIMIT: { from: perPage * (page - 1), size: perPage } };
        const result = await redis.ft.search(INDEX_NAME, query, options);
        const products = result.documents.map(d => d.value) as any as Product[];

        return products;
    }

    public async getSearchStatistic(search: string): Promise<ProductsStatistic> {
        // the minimum word length for wildcard search with default Redis settings is 2 characters
        if (!search || search.length < 2)
            return { products_count: 0 };

        const escapedSearch = escapeParam(search);
        const query = `@sku|name:'*${escapedSearch}*'`;
        const options = { RETURN: ["id"] };
        const result = await redis.ft.search(INDEX_NAME, query, options);
        const products_count = result.total;

        return { products_count };
    }

    private buildRedisearchQuery(options: GetCachedProductsOptions): string {
        const queryFilters: string[] = [
            options.category ? `@categories:{${escapeParam(options.category)}}` : "",
            options.min_price || options.max_price ? `@price:[${options.min_price ?? "-inf"} ${options.max_price ?? "+inf"}]` : "",
            options.pa_supplier ? `(@attributes:{supplier} and @attributes_options:{${options.pa_supplier.map(o => escapeParam(o)).join("|")}})` : "",
            options.pa_color ? `(@attributes:{color} and @attributes_options:{${options.pa_color.map(o => escapeParam(o)).join("|")}})` : "",
            options.pa_base_color ? `(@attributes:{base_color} and @attributes_options:{${options.pa_base_color.map(o => escapeParam(o)).join("|")}})` : "",
            options.pa_size ? `(@attributes:{size} and @attributes_options:{${options.pa_size.map(o => escapeParam(o)).join("|")}})` : ""
        ];

        const query = queryFilters.filter(f => f).join(" ") || "*";

        return query;
    }

    private buildRedisearchOptions(options: GetCachedProductsOptions): SearchOptions {
        const page = options.page ?? 1;
        const perPage = options.per_page ?? 100;
        const direction = options.order === "asc" ? "ASC" : "DESC";
        let orderBy: string = options.order_by ?? "date";

        if (orderBy === "quantity")
            orderBy = "stock_quantity";
        else if (orderBy === "date")
            orderBy = "created";

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

    private filterByAttributes(options: GetCachedProductsOptions): (p: StatisticResultItem) => boolean {
        const { pa_supplier, pa_color, pa_base_color, pa_size } = options;

        return (p) =>
            (!pa_supplier || p.attributes.some(a => a.slug === "supplier" && pa_supplier.includes(a.slug)))
            && (!pa_color || p.attributes.some(a => a.slug === "color" && pa_color.includes(a.slug)))
            && (!pa_base_color || p.attributes.some(a => a.slug === "base_color" && pa_base_color.includes(a.slug)))
            && (!pa_size || p.attributes.some(a => a.slug === "size" && pa_size.includes(a.slug)));
    }

    private filterByPrice(options: GetCachedProductsOptions): (p: StatisticResultItem) => boolean {
        return (p) =>
            (!options.min_price || p.price >= options.min_price)
            && (!options.max_price || p.price <= options.max_price);
    }

    private getAttributesStatistic(items: StatisticResultItem[]): ProductAttribute[] {
        const attributes: ProductAttribute[] = [];

        items.forEach(item => {
            item.attributes.forEach(attribute => {
                const existingAttribute = attributes.find(a => a.slug === attribute.slug);
                if (existingAttribute) {
                    attribute.options.forEach(option => {
                        if (!existingAttribute.options.some(o => o.slug === option.slug))
                            existingAttribute.options.push(option);
                    });
                } else {
                    attributes.push(attribute);
                }
            });
        });

        return attributes;
    }

    private getMinAndMaxPrice(items: StatisticResultItem[]): [min: number, max: number] {
        let min = items[0]?.price ?? 0;
        let max = items[0]?.price ?? 0;

        items.forEach(item => {
            if (item.price < min)
                min = item.price;
            if (item.price > max)
                max = item.price;
        });

        return [min, max];
    }
}

const productsCache = new ProductsCacheService();
export default productsCache;
