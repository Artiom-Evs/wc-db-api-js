import { Post } from "../schemas";
import categoriesRepository from "./CategoriesRepository";
import pool from "./DbConnectionPool";
import imagesRepository from "./ImagesRepository";
import RepositoryBase from "./RepositoryBase";

const GET_ALL_QUERY = `
select ID AS id, post_author AS author, post_content AS content, post_title AS title, post_excerpt AS excerpt, post_status AS status, post_name AS slug, post_parent AS parent, menu_order, post_type AS type, post_date AS created, post_modified AS modified, CAST(pm.meta_value AS INT) AS thumbnail_id
from wp_posts AS p
LEFT JOIN wp_postmeta AS pm ON p.ID = pm.post_id AND pm.meta_key = "_thumbnail_id"
where post_type = "post" AND post_name != "";
`;

const GET_BY_SLUG_QUERY = `
select ID AS id, post_author AS author, post_content AS content, post_title AS title, post_excerpt AS excerpt, post_status AS status, post_name AS slug, post_parent AS parent, menu_order, post_type AS type, post_date AS created, post_modified AS modified, CAST(pm.meta_value AS INT) AS thumbnail_id
from wp_posts AS p
LEFT JOIN wp_postmeta AS pm ON p.ID = pm.post_id AND pm.meta_key = "_thumbnail_id"
where post_type = "post"
    AND post_name = ?
LIMIT 1;
`;

class PostsRepository extends RepositoryBase {
    public async getAll(): Promise<Post[]> {
        const [rows] = await this._pool.execute<any[]>(GET_ALL_QUERY, []);
        const thumbnailIds = rows.map(r => r.thumbnail_id ?? 0);
        const posts = rows as Post[];
        const images = await imagesRepository.getImagesByIds(thumbnailIds, "medium");

        console.debug("IMAGES:", posts);

        const postIds = posts.map(p => p.id);
        const categories = await categoriesRepository.getPostsCategories(postIds);

        posts.forEach(post => {
            post.categories = categories.filter(c => c.object_id == post.id);
            post.thumbnail = images.find(i => i.id === (post as any).thumbnail_id)?.src ?? null;
        });

        return posts;
    }

    public async getBySlug(slug: string): Promise<Post | null> {
        const [[row]] = await this._pool.execute<any[]>(GET_BY_SLUG_QUERY, [slug]);
        const [image] = await imagesRepository.getImagesByIds([ row.thumbnail_id ?? 0 ], "large");

        const post = row as Post ?? null;

        if (!post)
            return null;

        const categories = await categoriesRepository.getPostsCategories([post.id]);
        post.categories = categories;
        post.thumbnail = image?.src ?? null;

        return post;
    }
}

const postsRepository = new PostsRepository(pool);
export default postsRepository;
