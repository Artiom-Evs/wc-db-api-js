import { unserialize } from "php-serialize";
import { Image } from "../schemas";
import pool from "./MySQLPool";
import RepositoryBase from "./RepositoryBase";

const createGetImagesByIdsQuery = (ids: number[]) => `
SELECT 
    p.ID AS id, 
    p.post_parent AS parent_id, 
    p.post_title AS name, 
    p.guid AS src,
    pm.meta_value AS meta
FROM wp_posts AS p
INNER JOIN wp_postmeta AS pm ON p.ID = pm.post_id AND pm.meta_key = "_wp_attachment_metadata"
WHERE p.ID IN (${ids.map(() => "?").join(", ")}) AND p.post_mime_type LIKE "image/%";
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

const createGetSingleProductsImagesQuery = (ids: number[]) => `
SELECT 
    p.ID AS id, 
    post_parent AS parent_id, 
    post_title AS name, 
    guid AS src,
    pm.meta_value AS meta
FROM wp_posts as p 
INNER JOIN wp_postmeta AS pm ON p.ID = pm.post_id AND pm.meta_key = "_wp_attachment_metadata"
INNER JOIN 
    (SELECT ID, MIN(post_parent) AS first_image_id
    FROM wp_posts
    WHERE post_parent IN (${ids.map(() => "?").join(", ")}) AND post_mime_type LIKE "image/%"
    GROUP BY post_parent
    ) AS p2 ON p.ID = p2.ID
LIMIT ${ids.length};
`;

export interface DBImage {
    id: number,
    parent_id: number,
    name: string,
    src: string,
    meta: string
}

export type ImageSizes = "medium" | "large" | "original";

class ImagesRepository extends RepositoryBase {
    public async getProductsImages(productIds: number[], targetSize: ImageSizes): Promise<DBImage[]> {
        if (productIds.length === 0)
            return [];

        const query = createGetProductsImagesQuery(productIds);
        const [variationRows] = await this._pool.execute(query, productIds);
        const dbImages = variationRows as DBImage[];

        dbImages.forEach(i => this.changeImageSize(i, targetSize));
        
        return dbImages;
    }

    public async getSingleProductsImages(productIds: number[], targetSize: ImageSizes): Promise<DBImage[]> {
        if (productIds.length === 0)
            return [];

        const query = createGetSingleProductsImagesQuery (productIds);
        const [variationRows] = await this._pool.execute(query, productIds);
        const dbImages = variationRows as DBImage[];

        dbImages.forEach(i => this.changeImageSize(i, targetSize));
        
        return dbImages;
    }

    public async getImagesByIds(imageIds: number[], targetSize: ImageSizes): Promise<DBImage[]> {
        if (imageIds.length === 0)
            return [];

        const query = createGetImagesByIdsQuery(imageIds);
        const [variationRows] = await this._pool.execute(query, imageIds);
        const dbImages = variationRows as DBImage[];

        dbImages.forEach(i => this.changeImageSize(i, targetSize));
        
        return variationRows as DBImage[];
    }    

    private changeImageSize(dbImage: DBImage, targetSize: ImageSizes): void {
        if (targetSize === "original")
            return;
        
        const meta = unserialize(dbImage.meta);
        const sizeInfo = meta?.sizes?.[targetSize];

        if (!sizeInfo) return;
        
        const lastPathSeparator = dbImage.src.lastIndexOf("/");
        dbImage.src = dbImage.src.substring(0, lastPathSeparator + 1) + sizeInfo.file;
    }
}

const imagesRepository = new ImagesRepository (pool);
export default imagesRepository;
