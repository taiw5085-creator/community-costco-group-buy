import { getPublicProductBySlugAction } from "@/app/actions";
import { ProductDetail } from "@/components/ProductDetail";

export default async function ProductPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const result = await getPublicProductBySlugAction(slug);

  if (!result.data) {
    return (
      <main className="grid min-h-screen place-items-center bg-forest-50 px-4">
        <section className="rounded-[2rem] bg-white p-8 text-center shadow-soft">
          <h1 className="text-2xl font-black text-forest-900">商品不存在或已下架</h1>
          <p className="mt-3 font-bold text-zinc-500">請返回商品列表查看目前可代購商品。</p>
        </section>
      </main>
    );
  }

  return <ProductDetail product={result.data} />;
}
