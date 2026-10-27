import type { ProductSort, ProductStock, ProductType } from "@/app/types/products";
import { listProducts } from "@/lib/products/product-repo";

const productTypes: ProductType[] = ["cpu", "gpu", "ram", "disk"];
const productSorts: ProductSort[] = [
  "name",
  "newest",
  "nameAsc",
  "nameDesc",
  "priceAsc",
  "priceDesc",
];

export async function GET(request: Request) {
  const params = new URL(request.url).searchParams;

  for (const key of params.keys()) {
    if (key !== "type" && key !== "sort" && key !== "available" && key !== "stock") {
      return Response.json(
        { error: "Dozwolone parametry to type, sort, stock i available." },
        { status: 400 },
      );
    }
    if (params.getAll(key).length > 1) {
      return Response.json(
        { error: `Parametr ${key} można podać tylko raz.` },
        { status: 400 },
      );
    }
  }

  const requestedType = params.get("type");
  const type = productTypes.find((value) => value === requestedType);
  if (requestedType !== null && requestedType !== "all" && type === undefined) {
    return Response.json(
      { error: "Parametr type musi mieć wartość: all, cpu, gpu, ram lub disk." },
      { status: 400 },
    );
  }

  const requestedSort = params.get("sort");
  const sort = productSorts.find((value) => value === requestedSort);
  if (requestedSort !== null && sort === undefined) {
    return Response.json(
      { error: "Parametr sort musi mieć wartość: name, newest, nameAsc, nameDesc, priceAsc lub priceDesc." },
      { status: 400 },
    );
  }

  const requestedAvailable = params.get("available");
  const requestedStock = params.get("stock");
  const stock = (["all", "available", "unavailable"] as ProductStock[])
    .find((value) => value === requestedStock);
  if (requestedStock !== null && stock === undefined) {
    return Response.json(
      { error: "Parametr stock musi mieć wartość: all, available lub unavailable." },
      { status: 400 },
    );
  }
  if (requestedStock !== null && requestedAvailable !== null) {
    return Response.json(
      { error: "Nie łącz parametrów stock i available." },
      { status: 400 },
    );
  }
  if (requestedAvailable !== null && requestedAvailable !== "true" && requestedAvailable !== "false") {
    return Response.json(
      { error: "Parametr available musi mieć wartość: true lub false." },
      { status: 400 },
    );
  }

  try {
    const products = await listProducts({
      type,
      sort: sort ?? "nameAsc",
      ...(requestedAvailable === null ? {} : { available: requestedAvailable === "true" }),
      ...(stock === undefined ? {} : { stock }),
    });
    return Response.json(products);
  } catch (error) {
    console.error("Nie udało się odczytać katalogu produktów:", error);
    return Response.json(
      { error: "Nie udało się wczytać produktów. Spróbuj ponownie później." },
      { status: 500 },
    );
  }
}
