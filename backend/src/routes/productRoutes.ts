import { Router } from "express";
import {
  ProductRepository,
  ProductType,
} from "../repositories/productRepository";

const router = Router();

const repository = new ProductRepository();

router.get("/", async (_req, res) => {
  try {
    const products = await repository.findAll();

    res.json(products);
  } catch (error) {
    console.error(error);

    res.status(500).json({
      error: "Failed to load products",
    });
  }
});

router.get("/:id", async (req, res) => {
  try {
    const id = Number(req.params.id);

    if (!Number.isInteger(id) || id <= 0) {
      res.status(400).json({
        error: "Invalid product id",
      });
      return;
    }

    const product = await repository.findById(id);

    if (!product) {
      res.status(404).json({
        error: "Product not found",
      });
      return;
    }

    res.json(product);
  } catch (error) {
    console.error(error);

    res.status(500).json({
      error: "Failed to load product",
    });
  }
});

router.get("/type/:type", async (req, res) => {
  try {
    const type = req.params.type as ProductType;

    const validTypes: ProductType[] = [
      "cpu",
      "gpu",
      "ram",
      "disk",
    ];

    if (!validTypes.includes(type)) {
      res.status(400).json({
        error: "Invalid product type",
      });
      return;
    }

    const products = await repository.findByType(type);

    res.json(products);
  } catch (error) {
    console.error(error);

    res.status(500).json({
      error: "Failed to load products",
    });
  }
});

export default router;
