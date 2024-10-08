import { Post, PostsStatistic } from "../schemas";
import categoriesRepository from "./CategoriesRepository";
import pool from "./DbConnectionPool";
import imagesRepository from "./ImagesRepository";
import RepositoryBase from "./RepositoryBase";
import seoDataRepository from "./SeoDataRepository";

const GET_ALL_QUERY = `
select ID AS id, post_author AS author, post_content AS content, post_title AS title, post_excerpt AS excerpt, post_status AS status, post_name AS slug, post_parent AS parent, menu_order, post_type AS type, post_date AS created, post_modified AS modified, CAST(pm.meta_value AS INT) AS thumbnail_id
from wp_posts AS p
LEFT JOIN wp_postmeta AS pm ON p.ID = pm.post_id AND pm.meta_key = "_thumbnail_id"
where post_type = "post" AND post_status = "publish" AND post_name != ""
ORDER BY post_date
LIMIT ? OFFSET ?;
`;

const GET_STATISTIC = `
select COUNT(1) AS posts_count
from wp_posts AS p
where post_type = "post" AND post_status = "publish" AND post_name != "";
`;

const GET_BY_SLUG_QUERY = `
select ID AS id, post_author AS author, post_content AS content, post_title AS title, post_excerpt AS excerpt, post_status AS status, post_name AS slug, post_parent AS parent, menu_order, post_type AS type, post_date AS created, post_modified AS modified, CAST(pm.meta_value AS INT) AS thumbnail_id,
    (SELECT post_name FROM wp_posts AS np
    where np.post_type = "post" AND post_status = "publish" AND post_name != "" AND np.post_date < p.post_date
    ORDER BY np.post_date DESC
    LIMIT 1) AS prev_post,
    (SELECT post_name FROM wp_posts AS np
    where np.post_type = "post" AND post_name != "" AND np.post_date > p.post_date
    ORDER BY np.post_date
    LIMIT 1) AS next_post
from wp_posts AS p
LEFT JOIN wp_postmeta AS pm ON p.ID = pm.post_id AND pm.meta_key = "_thumbnail_id"
where post_type = "post" AND post_name != ""
    AND p.post_name = ?
ORDER BY post_date
LIMIT 1;
`;

interface GetPostsOptions {
    page: number;
    per_page: number;
}

class PostsRepository extends RepositoryBase {
    public async getAll(options: GetPostsOptions): Promise<Post[]> {
        const [rows] = await this._pool.execute<any[]>(GET_ALL_QUERY, [options.per_page, options.per_page * (options.page - 1)]);
        const thumbnailIds = rows.map(r => r.thumbnail_id ?? 0);
        const posts = rows as Post[];
        const images = await imagesRepository.getImagesByIds(thumbnailIds, "large");
        const postIds = posts.map(p => p.id);
        const categories = await categoriesRepository.getPostsCategories(postIds);
        const postsSeoData = await seoDataRepository.getPostsData(postIds);

        posts.forEach(post => {
            post.categories = categories.filter(c => c.object_id == post.id);
            post.thumbnail = images.find(i => i.id === (post as any).thumbnail_id)?.src ?? null;
            post.seo_data = postsSeoData.find(s => s.post_id === post.id) ?? null;
        });

        return posts;
    }

    public async getBySlug(slug: string): Promise<Post | null> {
        const [[row]] = await this._pool.execute<any[]>(GET_BY_SLUG_QUERY, [slug]);
        const [image] = await imagesRepository.getImagesByIds([ row.thumbnail_id ?? 0 ], "original");

        const post = row as Post ?? null;

        if (!post)
            return null;

        const categories = await categoriesRepository.getPostsCategories([post.id]);
        const postSeoData = await seoDataRepository.getPostData(post.id);

        post.categories = categories;
        post.thumbnail = image?.src ?? null;
        post.seo_data = postSeoData;

        return post;
    }

    public async getStatistic(): Promise<PostsStatistic> {
        const [[row]] = await this._pool.execute<any[]>(GET_STATISTIC);
        const statistic = row as PostsStatistic;
        
        return statistic;
    }
}

const postsRepository = new PostsRepository(pool);
export default postsRepository;
