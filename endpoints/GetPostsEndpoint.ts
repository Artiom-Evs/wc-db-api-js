import { z } from "zod";
import { defaultEndpointsFactory } from "express-zod-api";
import { Post, PostSchema, PostsStatisticSchema } from "../schemas";
import postsRepository from "../infrastructure/PostsRepository";

export const GetPostsEndpoint = defaultEndpointsFactory.build({
    method: "get",
    input: z.object({
        page: z.string().optional().default("1").transform(s => parseInt(s)),
        per_page: z.string().optional().default("100").transform(s => parseInt(s))
    }),
    output: z.object({
        statistic: PostsStatisticSchema,
        items: z.array(PostSchema)
    }),
    handler: async ({ input, options, logger }) => {
        logger.debug("Requested parameters:", input);

        const posts = await postsRepository.getAll(input);
        const statistic = await postsRepository.getStatistic();

        return { items: posts, statistic };
    },
});
