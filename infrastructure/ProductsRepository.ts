import moment from "moment";
import { Product } from "../schemas";
import pool from "./DbConnectionPool";
import RepositoryBase from "./RepositoryBase";
import { QueryResult } from "mysql2";

const GET_ALL_QUERY = `
CALL GetProductsV2(?, ?, ?, ?, ?, ?, ?, ?, ?, ?);
`;

const GET_BY_ID_QUERY = `
CALL GetProductByID(?);
`;

interface GetProductsOptions {
    page?: number,
    per_page?: number,
    order_by?: "date" | "price" | "quantity" | "name",
    order?: "asc" | "desc",
    min_price?: number,
    max_price?: number,
    category?: string,
    attribute?: string,
    attribute_term?: string,
    search?: string
}

class ProductsRepository extends RepositoryBase {
    public async getAll({
        page = 1,
        per_page = 100,
        min_price = -1,
        max_price = -1,
        order_by = "date",
        order = "desc",
        category = "",
        attribute = "",
        attribute_term = "",
        search = ""
    }: GetProductsOptions): Promise<Product[]> {
        const [[rows]] = await this._pool.execute<[any[]]>(GET_ALL_QUERY, [
            per_page,
            per_page * (page - 1),
            min_price,
            max_price,
            order_by,
            order,
            category,
            attribute,
            attribute_term,
            search
        ]);

        const products = rows as Product[];

        products.forEach(product => {
            product.type = "simple";
            product.price = product.price != null ? parseInt(product.price as any) : null;
            product.created = moment(product.created).format("yyyy-MM-DD hh:mm:ss");
            product.modified = moment(product.modified).format("yyyy-MM-DD hh:mm:ss");
            product.images = [];
            product.categories = [];
            product.attributes = [];
            product.default_attribute = [];
            product.variations = [];
        });
        
        return products;
    }

    public async getById(id: number): Promise<Product | null> {
        const [rows] = await this._pool.execute(GET_BY_ID_QUERY, [ id ]);
        const products = rows as Product[];
        const product = products && Array.isArray(products) && products.length > 0 ? products[0] : null;

        if (product) {
            product.type = "simple";
            product.price = product.price != null ? parseInt(product.price as any) : null;
            product.created = moment(product.created).format("yyyy-MM-DD hh:mm:ss");
            product.modified = moment(product.modified).format("yyyy-MM-DD hh:mm:ss");
            product.images = [];
            product.categories = [];
            product.attributes = [];
            product.default_attribute = [];
            product.variations = [];
        }

        return product;
    }
}

const productsRepository = new ProductsRepository(pool);
export default productsRepository;
