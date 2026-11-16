# EUROALIMENTOS SRL — Sistema POS, Preventa y Control de Planta

## Regla de Contrato de Base de Datos (Obligatoria)

> **Única Fuente de Verdad:** [`supabase/SCHEMA_REFERENCE.sql`](./supabase/SCHEMA_REFERENCE.sql) es el contrato oficial de base de datos del proyecto (3FN + Herencia CTI).
>
> Antes de escribir o modificar cualquier consulta a Supabase (`.select()`, `.insert()`, `.update()`, `.eq()`, `.order()`, `.rpc()`) o interfaz TypeScript en `src/types/database.types.ts`, **consulta obligatoriamente `supabase/SCHEMA_REFERENCE.sql`**. Está prohibido inventar o asumir nombres de columnas.
>
> En relaciones de `pedidos` hacia `usuarios` (donde existen dos llaves extranjeras: `id_vendedor` e `id_despachador`), especifica siempre el hint explícito de PostgREST (`vendedor:usuarios!pedidos_id_vendedor_fkey(...)` y `despachador:usuarios!pedidos_id_despachador_fkey(...)`).

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
