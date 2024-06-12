import moment from "moment";
import { Image, Product } from "../schemas";
import pool from "./DbConnectionPool";
import RepositoryBase from "./RepositoryBase";

const GET_ALL_QUERY = `
CALL GetProductsV2(?, ?, ?, ?, ?, ?, ?, ?, ?, ?);
`;

const GET_BY_ID_QUERY = `
CALL GetProductByID(?);
`;

const createGetProductsImagesQuery = (ids: number[]) => `
SELECT 
    ID AS id, 
    post_parent AS parent_id, 
    post_title AS name, 
    guid AS src
FROM wp_posts
WHERE post_parent IN (${ids.map(() => "?").join(", ")}) AND post_mime_type LIKE "image/%";
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

        const productIds = products.map(p => p.id);
        const [imageRows] = await this._pool.execute<any[]>(createGetProductsImagesQuery(productIds), productIds);
        
        products.forEach(product => {
            product.type = "simple";
            product.price = product.price != null ? parseInt(product.price as any) : null;
            product.created = moment(product.created).format("yyyy-MM-DD hh:mm:ss");
            product.modified = moment(product.modified).format("yyyy-MM-DD hh:mm:ss");
            product.categories = [];
            product.attributes = [];
            product.default_attribute = [];
            product.variations = [];

            product.images = imageRows.filter(i => i.parent_id === product.id) as Image[];
        });

        return products;
    }

    public async getById(id: number): Promise<Product | null> {
        const [[productRows]] = await this._pool.execute<[any[]]>(GET_BY_ID_QUERY, [ id ]);
        const [imageRows] = await this._pool.execute<any[]>(createGetProductsImagesQuery([id]), [id]);

        const products = productRows as Product[];
        const product = products && Array.isArray(products) && products.length > 0 ? products[0] : null;

        if (product) {
            product.type = "simple";
            product.price = product.price != null ? parseInt(product.price as any) : null;
            product.created = moment(product.created).format("yyyy-MM-DD hh:mm:ss");
            product.modified = moment(product.modified).format("yyyy-MM-DD hh:mm:ss");
            product.categories = [];
            product.attributes = [];
            product.default_attribute = [];
            product.variations = [];

            product.images = imageRows as Image[];
        }

        return product;
    }
}

const productsRepository = new ProductsRepository(pool);
export default productsRepository;
