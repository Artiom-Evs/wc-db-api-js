import { z } from "zod";
import { defaultEndpointsFactory } from "express-zod-api";
import { OrderItemPriceCirculationSchema } from "../schemas";
import ordersRepository from "../infrastructure/OrdersRepository";

export const GetOrderCirculationsEndpoint = defaultEndpointsFactory.build({
    method: "get",
    input: z.object({
        orderId: z.string().transform(s => z.number().parse(parseInt(s)))
    }),
    output: z.object({
        items: z.nullable(z.array(OrderItemPriceCirculationSchema))
    }),
    handler: async ({ input, options, logger }) => {
        logger.debug("Requested parameters:", input);

        const circulations = await ordersRepository.getOrderCirculations(input.orderId);

        return { items: circulations };
    },
});
