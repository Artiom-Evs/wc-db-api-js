import { z } from "zod";
import { defaultEndpointsFactory } from "express-zod-api";
import { MenuItem, MenuItemSchema } from "../schemas";
import menuItemsRepository from "../infrastructure/MenuItemsRepository";

export const GetMenuItemsByMenuIdEndpoint = defaultEndpointsFactory.build({
    method: "get",
    input: z.object({
        id: z.string().transform(s => parseInt(s))
    }),
    output: z.object({
        items: z.array(MenuItemSchema)
    }),
    handler: async ({ input, options, logger }) => {
        logger.debug("Requested parameters:", input);

        const items = await menuItemsRepository.getByMenuId(input.id);

        return { items: items };
    },
});
