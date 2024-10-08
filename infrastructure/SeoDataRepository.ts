import { unserialize } from "php-serialize";
import pool from "./DbConnectionPool";
import RepositoryBase from "./RepositoryBase";
import { PostSeoData } from "schemas";

const DEFAULT_POST_TITLE_TEMPLATE = "%%title%% %%page%% %%sep%% %%sitename%%";

const createGetIoastPostsDataQuery = (postIds: number[]) => `
SELECT p.post_title, object_id as post_id, title AS title_template, description, breadcrumb_title, blog_id, estimated_reading_time_minutes,
    is_robots_noindex, is_robots_nofollow, is_robots_noarchive, is_robots_noimageindex, is_robots_nosnippet, 
    twitter_title, twitter_image, twitter_description, twitter_image_id, twitter_image_source,
    open_graph_title, open_graph_description, open_graph_image, open_graph_image_id, open_graph_image_source, open_graph_image_meta
FROM wp_yoast_indexable AS i
LEFT JOIN wp_posts AS p ON i.object_id = p.ID
WHERE i.object_id IN (${postIds.map(() => "?").join(",")})
    AND i.object_type = "post"
LIMIT ${postIds.length};
`;

const GET_IOAST_POST_DATA_QUERY = `
SELECT p.post_title, object_id as post_id, title AS title_template, description, breadcrumb_title, blog_id, estimated_reading_time_minutes,
    is_robots_noindex, is_robots_nofollow, is_robots_noarchive, is_robots_noimageindex, is_robots_nosnippet, 
    twitter_title, twitter_image, twitter_description, twitter_image_id, twitter_image_source,
    open_graph_title, open_graph_description, open_graph_image, open_graph_image_id, open_graph_image_source, open_graph_image_meta
FROM wp_yoast_indexable AS i
LEFT JOIN wp_posts AS p ON i.object_id = p.ID
WHERE i.object_id = ? AND i.object_type = "post"
LIMIT 1;
`;

const GET_SITENAME_QUERY = `
SELECT option_value
FROM wp_options
WHERE option_name = "blogname"
LIMIT 1;
`;

const GET_SEO_TITLES_OPTIONS_QUERY = `
SELECT option_value
FROM wp_options 
WHERE option_name = "wpseo_titles"
LIMIT 1;
`;

interface DbIoastPostDataRow {
    post_id: number;
    post_title: string | null;
    title_template: string | null;
    description: string | null;
    breadcrumb_title: string;
    estimated_reading_time_minutes: number | null;
    is_robots_noindex: boolean | null;
    is_robots_nofollow: boolean | null;
    is_robots_noarchive: boolean | null;
    is_robots_noimageindex: boolean | null;
    is_robots_nosnippet: boolean | null;
    twitter_title: string | null;
    twitter_image: string | null;
    twitter_description: string | null;
    twitter_image_id: string | null;
    twitter_image_source: string | null;
    open_graph_title: string | null;
    open_graph_description: string | null;
    open_graph_image: string | null;
    open_graph_image_id: string | null;
    open_graph_image_source: string | null;
    open_graph_image_meta: string | null;
}

export interface DbPostSeoData extends PostSeoData {
    post_id: number;
}

/**
 * Uses to get SEO data from the Ioast plugin
 */
export class SeoDataRepository extends RepositoryBase {
    public async getPostsData(postIds: number[]): Promise<DbPostSeoData[]> {
        if (postIds.length === 0)
            return [];

        const query = createGetIoastPostsDataQuery(postIds);
        const [rows] = await this._pool.execute(query, postIds);
        const dbPostsData = rows as DbIoastPostDataRow[];
        const siteName = await this.getSiteName();
        const separator = await this.getTitleSeparator();

        const postsData = dbPostsData.map(dpd => {
            const postData = this.buildPostData(dpd);
            const titleTemplate = dpd.title_template ?? DEFAULT_POST_TITLE_TEMPLATE;
            postData.title = this.buildPostTitle(titleTemplate, dpd.post_title ?? postData.breadcrumb_title, siteName, separator);

            return postData;
        });

        return postsData;
    }

    public async getPostData(postId: number): Promise<DbPostSeoData | null> {
        const [[row]] = await this._pool.execute<any[]>(GET_IOAST_POST_DATA_QUERY, [postId]);
        const dbData = row as DbIoastPostDataRow;

        if (!dbData)
            return null;

        const postData = this.buildPostData(dbData);
        const titleTemplate = dbData.title_template ?? DEFAULT_POST_TITLE_TEMPLATE;
        const siteName = await this.getSiteName();
        const separator = await this.getTitleSeparator();
        postData.title = this.buildPostTitle(titleTemplate, postData.breadcrumb_title, siteName, separator);

        return postData;
    }

    private buildPostData(dbData: DbIoastPostDataRow): DbPostSeoData {
        return {
            post_id: dbData.post_id,
            title: "",
            description: dbData.description,
            breadcrumb_title: dbData.breadcrumb_title,
            reading_time_minutes: dbData.estimated_reading_time_minutes,
            bot: {
                is_no_index: !!dbData.is_robots_noindex,
                is_no_follow: !!dbData.is_robots_nofollow,
                is_no_archive: !!dbData.is_robots_noarchive,
            },
            twitter: {
                title: dbData.twitter_title,
                description: dbData.twitter_description,
                image: dbData.twitter_image,
                image_id: parseInt(dbData.twitter_image_id ?? "") || null,
                image_source: dbData.twitter_image_source,
            },
            open_graph: {
                title: dbData.open_graph_title,
                description: dbData.open_graph_description,
                image: dbData.open_graph_image,
                image_id: parseInt(dbData.open_graph_image_id ?? "") || null,
                image_source: dbData.open_graph_image_source,
                image_meta: dbData.open_graph_image_meta ? JSON.parse(dbData.open_graph_image_meta) : null,
            },
        };
    }

    private async getSiteName(): Promise<string> {
        const [[row]] = await this._pool.execute<any[]>(GET_SITENAME_QUERY, [])
        const siteName = row.option_value as string;

        if (!siteName)
            throw new Error("Error while getting site name.");

        return siteName;
    }

    private async getTitleSeparator(): Promise<string> {
        const [[row]] = await this._pool.query<any[]>(GET_SEO_TITLES_OPTIONS_QUERY);
        const seoTitlesStr = row.option_value as string;

        if (!seoTitlesStr)
            throw new Error("Error while getting SEO titles options.");

        const seoTitles = unserialize(seoTitlesStr ?? "");
        const separatorName = seoTitles.separator ?? "";
        const separator = this.getSeparator(separatorName);

        return separator;
    }

    private getSeparator(name: string): string {
        switch (name) {
            case "sc-dash":
                return "-";
            case "sc-pipe":
                return "|";
            default:
                return "<UNKNOWN_SEP>";
        }
    }

    private buildPostTitle(template: string, postName: string, siteName: string, separator: string): string {
        return template
            .replace("%%title%%", postName)
            // remove unused schema part
            .replace("%%page%%", "")
            .replace("%%sep%%", separator)
            .replace("%%sitename%%", siteName)
            // remove multiple spaces
            .replace(/\s{2,}/g, " ");
    }

}

const seoDataRepository = new SeoDataRepository(pool);
export default seoDataRepository;
