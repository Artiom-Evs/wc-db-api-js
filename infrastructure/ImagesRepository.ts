import { Image } from "../schemas";
import pool from "./DbConnectionPool";
import RepositoryBase from "./RepositoryBase";

const createGetImagesByIdsQuery = (ids: number[]) => `
SELECT 
    ID AS id, 
    post_parent AS parent_id, 
    post_title AS name, 
    guid AS src
FROM wp_posts
WHERE ID IN (${ids.map(() => "?").join(", ")}) AND post_mime_type LIKE "image/%";
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

export interface DBImage {
    id: number,
    parent_id: number,
    name: string,
    src: string
}

class ImagesRepository extends RepositoryBase {
    public async getProductsImages(productIds: number[]): Promise<DBImage[]> {
        if (productIds.length === 0)
            return [];

        const query = createGetProductsImagesQuery(productIds);
        const [variationRows] = await this._pool.execute(query, productIds);

        return variationRows as DBImage[];
    }

    public async getImagesByIds(imageIds: number[]): Promise<DBImage[]> {
        if (imageIds.length === 0)
            return [];

        const query = createGetImagesByIdsQuery(imageIds);
        const [variationRows] = await this._pool.execute(query, imageIds);

        return variationRows as DBImage[];
    }    
}

const imagesRepository = new ImagesRepository (pool);
export default imagesRepository;
