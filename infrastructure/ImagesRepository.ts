import { unserialize } from "php-serialize";
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
    guid AS src,
    pm.meta_value AS meta
FROM wp_posts as p 
INNER JOIN wp_postmeta AS pm ON p.ID = pm.post_id AND pm.meta_key = "_wp_attachment_metadata"
WHERE post_parent IN (${ids.map(() => "?").join(", ")}) AND post_mime_type LIKE "image/%";
`;

export interface DBImage {
    id: number,
    parent_id: number,
    name: string,
    src: string,
    meta: string
}

class ImagesRepository extends RepositoryBase {
    public async getProductsImages(productIds: number[]): Promise<DBImage[]> {
        if (productIds.length === 0)
            return [];

        const query = createGetProductsImagesQuery(productIds);
        const [variationRows] = await this._pool.execute(query, productIds);
        const dbImages = variationRows as DBImage[];

        dbImages.forEach(i => this.changeImageSize(i));
            
        return dbImages;
    }

    public async getImagesByIds(imageIds: number[]): Promise<DBImage[]> {
        if (imageIds.length === 0)
            return [];

        const query = createGetImagesByIdsQuery(imageIds);
        const [variationRows] = await this._pool.execute(query, imageIds);

        return variationRows as DBImage[];
    }    

    private changeImageSize(dbImage: DBImage): void {
        const meta = unserialize(dbImage.meta);
        const targetSize = meta?.sizes?.medium;

        if (!targetSize) return;
        
        const lastPathSeparator = dbImage.src.lastIndexOf("/");
        dbImage.src = dbImage.src.substring(0, lastPathSeparator + 1) + targetSize.file;
    }
}

const imagesRepository = new ImagesRepository (pool);
export default imagesRepository;
