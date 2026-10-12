This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.

## Obsługa pustego katalogu, 404 i awarii (Lab 06)

Projekt używa Next.js 16.3.8 i App Router. Katalog jest obecnie dostępny pod
`/pages/product-list`.

- Pusta tablica z repozytorium daje zwykły komunikat „Katalog produktów jest pusty.”
  w `page.tsx`, bez rzucania wyjątku.
- Nieznany URL obsługuje główny `app/not-found.tsx`, z linkiem na stronę główną.
- Błąd odczytu, parsowania lub walidacji danych trafia do
  `app/pages/product-list/error.tsx`. Jest to komponent klienta z ogólnym
  komunikatem, który nie wyświetla treści wyjątku ani ścieżek plików.
  Przycisk „Spróbuj ponownie” wywołuje `retry()` udostępnione przez Next.js 16.3.8:
  ponownie pobiera dane i renderuje segment. Samo `reset()` tylko czyści stan
  granicy, dlatego nie jest tu używane. Podczas ponawiania przycisk jest wyłączony.

Weryfikacja 2026-10-12: TypeScript, ESLint i build produkcyjny zakończyły się
pomyślnie (ESLint zgłasza istniejące ostrzeżenie o nieużywanym `findProductById`).
W development i produkcji tymczasowo zastąpiono zawartość `data/products.json`
pustą tablicą, a następnie niepoprawnym JSON-em. Pusty katalog zwrócił HTTP 200
i komunikat, awaria HTTP 500 i wpis w logu serwera. W odpowiedzi produkcyjnej nie
było szczegółów wyjątku. Po eksperymencie przywrócono oryginalny plik i sprawdzono
wyświetlenie 100 produktów. Nieznany URL zwrócił własny widok z HTTP 404 i linkiem
powrotu. Produkcyjne trasy katalogu, informacji o sklepie, koszyka i historii
odpowiedziały HTTP 200. Testy HTTP nie obejmowały kliknięcia przycisku ponowienia
w przeglądarce.

Eksperyment można powtórzyć po wykonaniu `npm run build` i `npm run start`:
zachować kopię JSON-u, ustawić `[]` i wejść do katalogu, następnie wstawić
niepoprawny JSON i ponownie wejść do katalogu. Po przywróceniu poprawnego pliku
kliknąć „Spróbuj ponownie”. Zawsze przywrócić oryginalne dane po teście.
Katalog korzysta z `searchParams`, więc jest renderowany przy żądaniu;
przeprowadzony eksperyment nie był błędem podczas prerenderowania w buildzie.

Brak zaimplementowanej funkcjonalności nie jest awarią i powinien mieć zwykły
widok. Granica `error.tsx` nie obejmuje layoutu w tym samym segmencie.
Widok `not-found` może mieć HTTP 200, jeśli odpowiedź była już strumieniowana;
sprawdzony nieznany URL zwrócił HTTP 404.

Źródła: dokumentacja przypiętej wersji w
`node_modules/next/dist/docs/01-app/03-api-reference/03-file-conventions/error.md`
i `not-found.md`, oraz [error.tsx](https://nextjs.org/docs/app/api-reference/file-conventions/error)
i [not-found.tsx](https://nextjs.org/docs/app/api-reference/file-conventions/not-found).

## Read-only API produktów

`GET /api/products` zwraca tablicę produktów w JSON. Route Handler i strona
katalogu wywołują bezpośrednio to samo `listProducts` z repozytorium serwerowego.
Strona nie wykonuje żądania HTTP do API.

| Parametr | Dozwolone wartości | Gdy pominięty |
| --- | --- | --- |
| `type` | `cpu`, `gpu`, `ram`, `disk` | Wszystkie kategorie |
| `sort` | `nameAsc`, `nameDesc`, `priceAsc`, `priceDesc` | `nameAsc` |

Przykład: `/api/products?type=gpu&sort=priceAsc` zwraca karty graficzne od
najtańszej. Cena w odpowiedzi pozostaje liczbą całkowitą w groszach.
Parametry rozróżniają wielkość liter. Nieznana, pusta lub powtórzona wartość,
a także nieobsługiwany parametr, daje HTTP 400 i JSON `{ "error": "…" }`.
Poprawne zapytanie bez wyników daje HTTP 200 i `[]`, również dla pustego katalogu.
Awaria repozytorium daje HTTP 500 z ogólnym komunikatem JSON; szczegóły trafiają
do logu serwera. API nie udostępnia zapisu: POST, PUT, PATCH i DELETE dają HTTP 405.

Źródło: dokumentacja Route Handlers przypiętej wersji w
`node_modules/next/dist/docs/01-app/03-api-reference/03-file-conventions/route.md`.

Weryfikacja API (2026-10-13): sprawdzono przez HTTP wszystkie kombinacje czterech
kategorii i czterech porządków sortowania oraz wartości domyślne. Dziesięć
przypadków błędnych parametrów dało JSON z HTTP 400; POST, PUT, PATCH i DELETE
dały HTTP 405. Poprawny filtr bez dopasowań oraz pusty katalog zwróciły `[]`
z HTTP 200. Tymczasowe uszkodzenie JSON-u dało ogólny komunikat z HTTP 500;
walidacja błędnego zapytania nadal zwracała 400 przed odczytem repozytorium.
Po eksperymencie przywrócono oryginalne 100 produktów. TypeScript i ESLint
przeszły, z istniejącym ostrzeżeniem o nieużywanym `findProductById`.
