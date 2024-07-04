import { z } from "zod";
import { defaultEndpointsFactory } from "express-zod-api";
import { Menu, MenuSchema } from "../schemas";
import menuItemsRepository from "../infrastructure/MenuItemsRepository";

export const GetMenuItemsEndpoint = defaultEndpointsFactory.build({
    method: "get",
    description: `"include" parameter takes string with menu IDs separated by "," separator.`,
    input: z.object({
        include: z.string().transform(v => v?.split(",").map(s => parseInt(s)).filter(n => n))
    }),
    output: z.object({
        items: z.array(MenuSchema)
    }),
    handler: async ({ input, options, logger }) => {
        logger.debug("Requested parameters:", input);

        const items = await menuItemsRepository.getByMenuIds(input.include);

        return { items: items };
    },
});
