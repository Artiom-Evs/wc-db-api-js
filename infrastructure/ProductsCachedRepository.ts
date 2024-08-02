import pool from "./DbConnectionPool";
import { Product, ProductsStatistic } from "schemas";
import RepositoryBase from "./RepositoryBase";
import { GetProductsOptions } from "./ProductsRepository";
import productsCache, { ProductCacheItem } from "../services/ProductsCache";
import docStorage from "../services/DocStorage";


class ProductsCachedRepository extends RepositoryBase {
    public async getAll(options: GetProductsOptions): Promise<Product[]> {
        const collection = docStorage.collection<Product>("products");

        const filter = this.buildFilter(options);
        const limit = options.per_page ?? 100;
        const offset = limit * ((options.page ?? 1) - 1);

        const products = await collection
            .find(filter)
            .skip(offset)
            .limit(limit)
            .toArray();

        return products;
    }

    public async getStatistic(options: GetProductsOptions): Promise<ProductsStatistic> {
        const collection = docStorage.collection<Product>("products");

        const filter = this.buildFilter(options);

        const pipeline = [
            { $match: filter },
            {
                $group: {
                    _id: null,
                    products_count: { $sum: 1 },
                    min_price: { $min: "$price" },
                    max_price: { $max: "$price" }
                }
            },
            {
                $project: {
                    _id: 0,
                    products_count: 1,
                    min_price: 1,
                    max_price: 1
                }
            }
        ];

        const statistic = await collection
            .aggregate<ProductsStatistic>(pipeline)
            .toArray();

        return statistic?.[0] ?? { products_count: 0, min_price: 0, max_price: 0 };
    }

    private buildFilter(options: GetProductsOptions): any {
        const filter: any = { };

        if (options.category)
            filter.categories = {
                $elemMatch: { slug: options.category }
            };
        
        if (options.min_price || options.max_price) {
            filter.price = { };
            if (options.min_price)
                filter.price.$gt = options.min_price;
            if (options.max_price)
                filter.price.$lt = options.max_price;
        }

        if (options.attribute) {
            filter.attributes = {
                $elemMatch: { slug: options.attribute }
            };

            if (options.attribute_term)
                filter.attributes.$elemMatch.options = {
                    $elemMatch: {  slug: { $regex: options.attribute_term } }
                };
        }

        if (options.search) {
            filter.$or = [
                { sku: { $regex: options.search, $options: "i" } },
                { name: { $regex: options.search, $options: "i" } },
                {
                    variations: {
                        $elemMatch: {
                            $or: [
                                { sku: { $regex: options.search, $options: "i" } },
                                { name: { $regex: options.search, $options: "i" } }
                            ]
                        }
                    }
                }
            ]
        }
        
        return filter;
    }
}

const productsCachedRepository = new ProductsCachedRepository(pool);
export default productsCachedRepository;
