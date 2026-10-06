import express from "express";
import cors from "cors";

import productRoutes from "./routes/productRoutes";

const app = express();

app.use(
  cors({
    origin: "http://localhost:3000",
  }),
);

app.use(express.json());

app.get("/api/health", (_req, res) => {
  res.json({
    status: "ok",
  });
});

app.use("/api/products", productRoutes);

export default app;
