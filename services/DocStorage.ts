import { MongoClient } from "mongodb";

const url = process.env.MONGODB_CONNECTION_URL;

if (!url)
    throw new Error("MONGODB_CONNECTION_URL environment variable is not set.");

const mongoClient = new MongoClient(url);

mongoClient.connect()
    .then(() => console.log("Successfully connected to MongoDB."))
    .catch(err => console.error("Error while connecting to MongoDB.", err));

process.on("exit", () => {
    mongoClient.close().catch(console.error);
});
const docStorage = mongoClient.db("ewagifts");

docStorage.collection("products")
    .createIndex({ id: 1 }, { unique: true })
    .catch(err => console.error(`Error while creating unique index for the "products" MongoDB collection.`, err));

export default docStorage;
