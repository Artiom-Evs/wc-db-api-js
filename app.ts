import express from "express";

const app = express();
const PORT = 5000;

app.get("/", (req, res) => {
    res.send("I am working!");
});

app.listen(PORT, () => console.log(`Running on port ${PORT}`));
