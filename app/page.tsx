import Storefront from "@/components/Storefront";
import { listPublicProductsAction } from "@/app/actions";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const result = await listPublicProductsAction();

  return (
    <Storefront
      initialProducts={result.ok ? result.data ?? [] : []}
      initialLoadError={result.ok ? "" : result.message ?? "商品讀取失敗"}
    />
  );
}
