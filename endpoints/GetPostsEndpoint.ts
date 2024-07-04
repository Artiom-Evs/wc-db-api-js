import { z } from "zod";
import { defaultEndpointsFactory } from "express-zod-api";
import { Post, PostSchema } from "../schemas";
import postsRepository from "../infrastructure/PostsRepository";

export const GetPostsEndpoint = defaultEndpointsFactory.build({
    method: "get",
    input: z.object({}),
    output: z.object({
        items: z.array(PostSchema)
    }),
    handler: async ({ input, options, logger }) => {
        logger.debug("Requested parameters:", input);

        const posts = await postsRepository.getAll();

        return { items: posts };
    },
});
